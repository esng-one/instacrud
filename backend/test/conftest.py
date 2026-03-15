import pytest
import asyncio
import time
from pathlib import Path
from typing import AsyncGenerator

import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from httpx import ASGITransport
from testcontainers.mongodb import MongoDbContainer

from instacrud.config import settings
from instacrud.app import app
from instacrud.database import set_client, init_system_db
from instacrud.model.system_model import User, Organization


async def wait_for_org_active(
    http_client: httpx.AsyncClient,
    org_id: str,
    headers_admin: dict,
    timeout: float = 300.0,
    poll_interval: float = 5.0,
):
    """Poll until org status == ACTIVE (Firestore only; no-op for mongo).

    Firestore IAM propagation takes ~3 min, so we poll every 5 s up to 5 min.
    Raises RuntimeError on FAILED, TimeoutError on timeout.
    """
    if settings.DB_ENGINE != "firestore":
        return  # mongo provisioning is synchronous — nothing to wait for

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        resp = await http_client.get(
            f"/api/v1/admin/organizations/{org_id}", headers=headers_admin
        )
        if resp.status_code == 200:
            status = resp.json().get("status")
            if status == "ACTIVE" or status is None:
                return
            if status == "FAILED":
                raise RuntimeError(f"Org {org_id} provisioning FAILED")
        await asyncio.sleep(poll_interval)
    raise TimeoutError(f"Org {org_id} provisioning timed out after {timeout}s")


def _get_all_test_files():
    """Find all test files (exclude runner and cloud-only tests)."""
    test_dir = Path(__file__).parent
    exclude = {"run_all_test.py", "firestore_test.py"}
    return sorted(
        str(tf) for tf in test_dir.glob("*_test.py")
        if tf.name not in exclude
    )


def pytest_configure(config):
    """Expand run_all_test.py to all actual test files."""
    if any("run_all_test.py" in str(arg) for arg in config.args):
        new_args = []
        for arg in config.args:
            if "run_all_test.py" in str(arg):
                new_args.extend(_get_all_test_files())
            else:
                new_args.append(arg)
        config.args[:] = new_args


def pytest_addoption(parser):
    parser.addoption(
        "--type",
        action="store",
        default="mock",
        help="Test type: mock or live"
    )


# Session-scoped MongoDB container - starts once per test suite run
_mongo_container = None
_mongo_client = None


def get_or_create_mongo_container():
    """Get existing container or create a new one (session scope)."""
    global _mongo_container, _mongo_client

    if _mongo_container is None:
        _mongo_container = MongoDbContainer()
        _mongo_container.start()
        _mongo_client = AsyncIOMotorClient(_mongo_container.get_connection_url())
        set_client(_mongo_client)

    return _mongo_container, _mongo_client


def cleanup_mongo_container():
    """Cleanup the container at the end of the session."""
    global _mongo_container, _mongo_client

    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None

    if _mongo_container:
        _mongo_container.stop()
        _mongo_container = None


@pytest.fixture(scope="session")
def test_mode(request) -> str:
    """Get test mode from command line."""
    return request.config.getoption("--type")


@pytest.fixture(scope="session")
def mongo_container(test_mode):
    """Session-scoped MongoDB container fixture."""
    if test_mode == "mock":
        container, client = get_or_create_mongo_container()
        yield container
        cleanup_mongo_container()
    else:
        yield None


@pytest.fixture(scope="session")
def event_loop(mongo_container):
    """Create a session-scoped event loop."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def initialized_system_db(mongo_container, test_mode):
    """Initialize system DB once per session."""
    await init_system_db()
    yield


@pytest.fixture
def http_client_max_connections() -> int:
    """Max connections for the live HTTP client. Override in test files for high-concurrency tests."""
    return 500


@pytest.fixture
async def http_client(test_mode, initialized_system_db, http_client_max_connections) -> AsyncGenerator[httpx.AsyncClient, None]:
    """HTTP client fixture - works for both mock and live modes."""
    if test_mode == "mock":
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    else:
        limits = httpx.Limits(max_connections=http_client_max_connections, max_keepalive_connections=http_client_max_connections // 2)
        async with httpx.AsyncClient(
            base_url=settings.BASE_URL,
            limits=limits,
            timeout=httpx.Timeout(60.0)
        ) as client:
            yield client


@pytest.fixture
async def clean_db(initialized_system_db, test_mode):
    """Ensure a clean database state before each test (mock mode only).

    In live mode, bulk deletion is skipped — each test is responsible for
    cleaning up only the entities it creates.
    """
    if test_mode == "mock":
        await User.delete_all()
        await Organization.delete_all()
    yield
