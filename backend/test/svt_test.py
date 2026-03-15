"""
SVT (System Validation Test) - Heavy concurrency tests.

Tests multi-tenant isolation under concurrent load:
- Creates multiple organizations with different data
- Simulates concurrent requests
- Verifies no context mix-up between organizations
- Each organization user should only see their own data

NOTE: Full multi-tenant isolation can only be tested in live mode because
      contextvar isolation doesn't work correctly through ASGITransport.
      Mock mode runs basic validation; live mode runs full isolation tests.
"""

import asyncio
import platform
import random
import string
import time
import pytest
import httpx
from datetime import datetime, timezone
from typing import List, Tuple
from passlib.context import CryptContext

from instacrud.model.system_model import User, Organization, Invitation, Role
from instacrud.model.organization_model import Project, ProjectDocument, Client
from instacrud.database import init_org_db, drop_org_db, DatabaseManager
from conftest import wait_for_org_active


# Test configuration
NUM_ORGANIZATIONS = 10
REQUESTS_PER_ORG = 25
_TS = str(int(time.time()))
ADMIN_EMAIL = f"svt_admin_{_TS}@test.com"
ADMIN_PASSWORD = "svtadmin123"

# Total concurrent tasks: (user + org_admin) * orgs * requests + admin requests
_MAX_CONCURRENT_TASKS = NUM_ORGANIZATIONS * REQUESTS_PER_ORG * 2 + REQUESTS_PER_ORG


@pytest.fixture
def http_client_max_connections() -> int:
    """On Windows, cap connections below the select() FD limit of 512.
    On Linux/macOS epoll/kqueue can handle the full concurrency without limits."""
    return 200 if platform.system() == "Windows" else _MAX_CONCURRENT_TASKS + 50


def generate_unique_code(prefix: str, index: int) -> str:
    """Generate a unique code for testing."""
    return f"{prefix}_{index:03d}"


def generate_random_string(length: int = 8) -> str:
    """Generate a random string for unique data."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


class OrgTestContext:
    """Holds test context for a single organization."""
    def __init__(self, index: int):
        self.index = index
        self.org_code = generate_unique_code(f"svt_{_TS}_org", index)
        self.org_name = f"SVT Organization {_TS} {index}"
        self.org_id: str | None = None
        self.org_admin_email = f"orgadmin_{_TS}_{index}@svttest.com"
        self.org_admin_password = f"orgpass_{index}"
        self.org_admin_id: str | None = None
        self.org_admin_token: str | None = None
        self.user_email = f"user_{_TS}_{index}@svttest.com"
        self.user_password = f"userpass_{index}"
        self.user_id: str | None = None
        self.user_token: str | None = None
        self.invitation_id: str | None = None
        self.client_ids: List[str] = []
        self.project_ids: List[str] = []
        self.document_ids: List[str] = []
        # Unique data markers for isolation verification
        self.unique_marker = f"marker_{index}_{generate_random_string()}"


@pytest.mark.asyncio
async def test_svt_multi_tenant_isolation(http_client: httpx.AsyncClient, clean_db, test_mode):
    """
    Multi-tenant isolation test.

    In mock mode: Creates multiple orgs and validates basic API functionality.
    In live mode: Performs full multi-tenant isolation verification.
    """
    is_live = test_mode == "live"
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # Phase 1: Create system admin
    print(f"\n[Phase 1] Creating system admin... (mode={test_mode})")
    hashed_password = pwd_context.hash(ADMIN_PASSWORD)
    admin_user = User(
        email=ADMIN_EMAIL,
        hashed_password=hashed_password,
        name="SVT Admin",
        role=Role.ADMIN
    )
    await admin_user.insert()
    admin_user_id = str(admin_user.id)

    # Sign in as admin
    resp = await http_client.post("/api/v1/signin", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin signin failed: {resp.text}"
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Phase 2: Create all organizations
    print(f"[Phase 2] Creating {NUM_ORGANIZATIONS} organizations...")
    org_contexts: List[OrgTestContext] = []

    for i in range(NUM_ORGANIZATIONS):
        ctx = OrgTestContext(i)
        org_contexts.append(ctx)

        # Create organization
        resp = await http_client.post("/api/v1/admin/organizations", json={
            "name": ctx.org_name,
            "code": ctx.org_code,
            "description": f"SVT Test Org {i} - {ctx.unique_marker}"
        }, headers=admin_headers)
        assert resp.status_code == 200, f"Failed to create org {i}: {resp.text}"

        org = await Organization.find_one(Organization.code == ctx.org_code)
        assert org is not None, f"Organization {ctx.org_code} not found"
        ctx.org_id = str(org.id)

        # Add org admin
        resp = await http_client.post("/api/v1/admin/add_user", json={
            "email": ctx.org_admin_email,
            "password": ctx.org_admin_password,
            "name": f"Org Admin {i}",
            "role": "ORG_ADMIN",
            "organization_id": ctx.org_id
        }, headers=admin_headers)
        assert resp.status_code == 200, f"Failed to add org admin {i}: {resp.text}"
        ctx.org_admin_id = resp.json().get("user_id")

    print(f"  All {NUM_ORGANIZATIONS} organizations created")

    # Wait for all org provisioning to complete in parallel (no-op for mongo)
    print(f"  Waiting for provisioning of {NUM_ORGANIZATIONS} orgs...")
    await asyncio.gather(*(
        wait_for_org_active(http_client, ctx.org_id, admin_headers)
        for ctx in org_contexts
    ))
    print(f"  All {NUM_ORGANIZATIONS} orgs provisioned")

    # Phase 3: Setup users for each organization
    print("[Phase 3] Setting up org admins and users...")
    for ctx in org_contexts:
        # Sign in as org admin
        resp = await http_client.post("/api/v1/signin", json={
            "email": ctx.org_admin_email,
            "password": ctx.org_admin_password
        })
        assert resp.status_code == 200, f"Org admin signin failed for org {ctx.index}: {resp.text}"
        ctx.org_admin_token = resp.json()["access_token"]
        org_admin_headers = {"Authorization": f"Bearer {ctx.org_admin_token}"}

        # Invite regular user
        resp = await http_client.post("/api/v1/admin/invite_user", json={
            "email": ctx.user_email,
            "role": "USER",
            "expires_in_seconds": 3600
        }, headers=org_admin_headers)
        assert resp.status_code == 200, f"Failed to invite user for org {ctx.index}: {resp.text}"
        ctx.invitation_id = resp.json()["invitation_id"]

        # Sign up user
        resp = await http_client.post("/api/v1/signup", json={
            "email": ctx.user_email,
            "password": ctx.user_password,
            "name": f"User {ctx.index}",
            "invitation_id": ctx.invitation_id
        })
        assert resp.status_code == 200, f"Failed to signup user for org {ctx.index}: {resp.text}"
        ctx.user_id = resp.json().get("user_id")

        # Sign in as user
        resp = await http_client.post("/api/v1/signin", json={
            "email": ctx.user_email,
            "password": ctx.user_password
        })
        assert resp.status_code == 200, f"User signin failed for org {ctx.index}: {resp.text}"
        ctx.user_token = resp.json()["access_token"]

    print(f"  All users set up for {NUM_ORGANIZATIONS} organizations")

    # Phase 4: Create unique data for each organization
    print("[Phase 4] Creating unique data for each organization...")
    for ctx in org_contexts:
        user_headers = {"Authorization": f"Bearer {ctx.user_token}"}

        # Create clients with unique marker
        for j in range(2):
            resp = await http_client.post("/api/v1/clients", json={
                "code": f"client_{ctx.index}_{j}",
                "name": f"Client {j} - {ctx.unique_marker}",
                "type": "COMPANY",
                "description": f"Client for org {ctx.index} with marker {ctx.unique_marker}"
            }, headers=user_headers)
            assert resp.status_code == 200, f"Failed to create client for org {ctx.index}: {resp.text}"
            ctx.client_ids.append(resp.json()["_id"])

        # Create project with unique marker
        resp = await http_client.post("/api/v1/projects", json={
            "code": f"proj_{ctx.index}",
            "client_id": ctx.client_ids[0],
            "name": f"Project - {ctx.unique_marker}",
            "start_date": datetime.now(tz=timezone.utc).isoformat()
        }, headers=user_headers)
        assert resp.status_code == 200, f"Failed to create project for org {ctx.index}: {resp.text}"
        ctx.project_ids.append(resp.json()["_id"])

        # Create document with unique marker
        resp = await http_client.post("/api/v1/documents", json={
            "project_id": ctx.project_ids[0],
            "code": f"doc_{ctx.index}",
            "name": f"Document - {ctx.unique_marker}",
            "content": f"Content with unique marker: {ctx.unique_marker}"
        }, headers=user_headers)
        assert resp.status_code == 200, f"Failed to create document for org {ctx.index}: {resp.text}"
        ctx.document_ids.append(resp.json()["_id"])

    print(f"  Data created for all {NUM_ORGANIZATIONS} organizations")

    # Phase 5: Isolation verification (live mode only)
    if is_live:
        total_requests = NUM_ORGANIZATIONS * REQUESTS_PER_ORG * 2 + REQUESTS_PER_ORG  # user + org_admin + admin
        print(f"[Phase 5] Running CONCURRENT isolation tests ({total_requests} requests fired simultaneously)...")

        async def verify_org_isolation(ctx: OrgTestContext, client: httpx.AsyncClient, request_num: int, role: str = "user") -> Tuple[bool, str]:
            """Verify that a user only sees their own organization's data with mixed read/write operations."""
            # Jitter to force request interleaving and expose context leaks
            await asyncio.sleep(random.uniform(0, 0.05))

            # Select token based on role for cross-role pressure testing
            if role == "org_admin":
                headers = {"Authorization": f"Bearer {ctx.org_admin_token}"}
            else:
                headers = {"Authorization": f"Bearer {ctx.user_token}"}

            errors = []
            role_prefix = f"[{role}]"

            try:
                # Random jitter between operations
                await asyncio.sleep(random.uniform(0, 0.02))

                # === MIXED READ/WRITE: Create a temp client ===
                temp_client_code = f"temp_{ctx.index}_{request_num}_{generate_random_string(4)}"
                resp = await client.post("/api/v1/clients", json={
                    "code": temp_client_code,
                    "name": f"TempClient - {ctx.unique_marker}",
                    "type": "PERSON",
                    "description": f"Temp client for stress test - {ctx.unique_marker}"
                }, headers=headers)
                temp_client_id = None
                if resp.status_code == 200:
                    temp_client_id = resp.json()["_id"]

                await asyncio.sleep(random.uniform(0, 0.02))

                # Check clients - should only see own org's clients
                resp = await client.get("/api/v1/clients", headers=headers)
                if resp.status_code != 200:
                    return False, f"{role_prefix} Org {ctx.index} req {request_num}: Failed to get clients: {resp.status_code}"

                clients_data = resp.json()
                for c in clients_data:
                    if ctx.unique_marker not in c.get("name", "") and ctx.unique_marker not in c.get("description", ""):
                        errors.append(f"Client {c.get('_id')} doesn't contain org {ctx.index} marker")

                # Should have at least original 2 clients (temp client may or may not be visible yet)
                if len(clients_data) < 2:
                    errors.append(f"Expected at least 2 clients, got {len(clients_data)}")

                await asyncio.sleep(random.uniform(0, 0.02))

                # Check projects
                resp = await client.get("/api/v1/projects", headers=headers)
                if resp.status_code != 200:
                    return False, f"{role_prefix} Org {ctx.index} req {request_num}: Failed to get projects: {resp.status_code}"

                projects = resp.json()
                for project in projects:
                    if ctx.unique_marker not in project.get("name", ""):
                        errors.append(f"Project {project.get('_id')} doesn't contain org {ctx.index} marker")

                if len(projects) < 1:
                    errors.append(f"Expected at least 1 project, got {len(projects)}")

                await asyncio.sleep(random.uniform(0, 0.02))

                # === MIXED READ/WRITE: Update the project name ===
                if ctx.project_ids:
                    update_marker = f"{ctx.unique_marker}_updated_{request_num}"
                    resp = await client.patch(f"/api/v1/projects/{ctx.project_ids[0]}", json={
                        "name": f"Project - {update_marker}"
                    }, headers=headers)
                    # Restore original name
                    if resp.status_code == 200:
                        await client.patch(f"/api/v1/projects/{ctx.project_ids[0]}", json={
                            "name": f"Project - {ctx.unique_marker}"
                        }, headers=headers)

                await asyncio.sleep(random.uniform(0, 0.02))

                # Check documents
                resp = await client.get("/api/v1/documents", headers=headers)
                if resp.status_code != 200:
                    return False, f"{role_prefix} Org {ctx.index} req {request_num}: Failed to get documents: {resp.status_code}"

                documents = resp.json()
                for doc in documents:
                    if ctx.unique_marker not in doc.get("name", "") and ctx.unique_marker not in doc.get("content", ""):
                        errors.append(f"Document {doc.get('_id')} doesn't contain org {ctx.index} marker")

                if len(documents) < 1:
                    errors.append(f"Expected at least 1 document, got {len(documents)}")

                await asyncio.sleep(random.uniform(0, 0.02))

                # === MIXED READ/WRITE: Delete the temp client we created ===
                if temp_client_id:
                    await client.delete(f"/api/v1/clients/{temp_client_id}", headers=headers)

                if errors:
                    return False, f"{role_prefix} Org {ctx.index} req {request_num}: {'; '.join(errors)}"

                return True, f"{role_prefix} Org {ctx.index} req {request_num}: OK"

            except Exception as e:
                return False, f"{role_prefix} Org {ctx.index} req {request_num}: Exception: {str(e)}"

        # Also add system admin requests hitting all orgs simultaneously
        async def admin_pressure(admin_hdrs: dict, client: httpx.AsyncClient, req_num: int) -> Tuple[bool, str]:
            """System admin making requests while org users are active."""
            await asyncio.sleep(random.uniform(0, 0.05))
            try:
                resp = await client.get("/api/v1/admin/organizations", headers=admin_hdrs)
                if resp.status_code != 200:
                    return False, f"[admin] req {req_num}: Failed to list orgs: {resp.status_code}"
                orgs = resp.json()
                if len(orgs) < NUM_ORGANIZATIONS:
                    return False, f"[admin] req {req_num}: Expected {NUM_ORGANIZATIONS} orgs, got {len(orgs)}"
                return True, f"[admin] req {req_num}: OK"
            except Exception as e:
                return False, f"[admin] req {req_num}: Exception: {str(e)}"

        async def _retry_verify(ctx, client, req_num, role, max_retries: int = 2):
            """Retry on transient connection errors; propagate validation failures immediately."""
            for attempt in range(max_retries + 1):
                success, msg = await verify_org_isolation(ctx, client, req_num, role)
                if success or "Exception:" not in msg:
                    return success, msg
                if attempt < max_retries:
                    await asyncio.sleep(random.uniform(0.3, 0.8))
            return success, msg

        async def _retry_admin(admin_hdrs, client, req_num, max_retries: int = 2):
            """Retry admin pressure on transient errors."""
            for attempt in range(max_retries + 1):
                success, msg = await admin_pressure(admin_hdrs, client, req_num)
                if success or "Exception:" not in msg:
                    return success, msg
                if attempt < max_retries:
                    await asyncio.sleep(random.uniform(0.3, 0.8))
            return success, msg

        # Build all tasks for TRUE concurrent execution
        tasks = []
        for ctx in org_contexts:
            for req_num in range(REQUESTS_PER_ORG):
                # User requests
                tasks.append(_retry_verify(ctx, http_client, req_num, "user"))
                # Org admin requests - cross-role pressure
                tasks.append(_retry_verify(ctx, http_client, req_num, "org_admin"))

        for req_num in range(REQUESTS_PER_ORG):
            tasks.append(_retry_admin(admin_headers, http_client, req_num))

        # Windows select() caps file descriptors at 512.  The httpx connection
        # pool (http_client_max_connections=200 on Windows) is the real ceiling:
        # httpx never opens more than 200 simultaneous connections regardless of
        # how many coroutines are running, so the server stays ~200 FDs under
        # load — well below the 512 limit.  Setting the semaphore to 200 matches
        # the pool and maximises isolation pressure without risking a crash.
        # On Linux/macOS epoll/kqueue handles unlimited FDs so we fire everything
        # at once.
        if platform.system() == "Windows":
            _win_max = 200  # must match http_client_max_connections fixture
            _sem = asyncio.Semaphore(_win_max)

            async def _limited(coro):
                async with _sem:
                    return await coro

            print(f"  Launching {len(tasks)} concurrent requests (Windows semaphore={_win_max})...")
            results = await asyncio.gather(*[_limited(t) for t in tasks])
        else:
            print(f"  Launching {len(tasks)} concurrent requests...")
            results = await asyncio.gather(*tasks)

        # Analyze results
        successes = sum(1 for success, _ in results if success)
        failures = [(msg) for success, msg in results if not success]

        print(f"  Completed: {successes}/{len(results)} successful")

        if failures:
            print(f"  FAILURES ({len(failures)}):")
            for msg in failures[:10]:
                print(f"    - {msg}")
            if len(failures) > 10:
                print(f"    ... and {len(failures) - 10} more failures")

        # Phase 6: Cross-org access attempts (negative tests)
        print("[Phase 6] Testing cross-organization access denial...")
        cross_org_errors = []

        for i in range(min(3, NUM_ORGANIZATIONS - 1)):
            ctx = org_contexts[i]
            other_ctx = org_contexts[i + 1]
            user_headers = {"Authorization": f"Bearer {ctx.user_token}"}

            if other_ctx.client_ids:
                resp = await http_client.get(f"/api/v1/clients/{other_ctx.client_ids[0]}", headers=user_headers)
                if resp.status_code == 200:
                    cross_org_errors.append(f"Org {ctx.index} could access org {other_ctx.index}'s client!")

            if other_ctx.project_ids:
                resp = await http_client.get(f"/api/v1/projects/{other_ctx.project_ids[0]}", headers=user_headers)
                if resp.status_code == 200:
                    cross_org_errors.append(f"Org {ctx.index} could access org {other_ctx.index}'s project!")

            if other_ctx.document_ids:
                resp = await http_client.get(f"/api/v1/documents/{other_ctx.document_ids[0]}", headers=user_headers)
                if resp.status_code == 200:
                    cross_org_errors.append(f"Org {ctx.index} could access org {other_ctx.index}'s document!")

        if cross_org_errors:
            print(f"  CRITICAL SECURITY FAILURES ({len(cross_org_errors)}):")
            for err in cross_org_errors:
                print(f"    - {err}")
        else:
            print("  All cross-organization access correctly denied")
    else:
        print("[Phase 5] Skipping isolation tests in mock mode (contextvar limitation)")
        print("[Phase 6] Skipping cross-org tests in mock mode")
        failures = []
        cross_org_errors = []

    # Phase 7: Cleanup - delete only the specific items we created
    print("[Phase 7] Cleaning up test data...")

    for ctx in org_contexts:
        if ctx.org_id:
            await init_org_db(ctx.org_id)
            # Delete specific documents
            for doc_id in ctx.document_ids:
                doc = await ProjectDocument.get(doc_id)
                if doc:
                    await doc.delete()
            # Delete specific projects
            for proj_id in ctx.project_ids:
                proj = await Project.get(proj_id)
                if proj:
                    await proj.delete()
            # Delete specific clients
            for client_id in ctx.client_ids:
                client = await Client.get(client_id)
                if client:
                    await client.delete()

            if is_live:
                await drop_org_db(ctx.org_id)

        # Delete the invitation we created
        if ctx.invitation_id:
            invitation = await Invitation.get(ctx.invitation_id)
            if invitation:
                await invitation.delete()

        # Delete the regular user we created (by ID or by email fallback)
        if ctx.user_id:
            user = await User.get(ctx.user_id)
            if user:
                await user.delete()
        else:
            user = await User.find_one(User.email == ctx.user_email)
            if user:
                await user.delete()

        # Delete the org admin we created (by ID or by email fallback)
        if ctx.org_admin_id:
            org_admin = await User.get(ctx.org_admin_id)
            if org_admin:
                await org_admin.delete()
        else:
            org_admin = await User.find_one(User.email == ctx.org_admin_email)
            if org_admin:
                await org_admin.delete()

        # Delete the organization we created
        if ctx.org_id:
            org = await Organization.get(ctx.org_id)
            if org:
                await org.delete()

    # Delete the system admin we created
    admin = await User.get(admin_user_id)
    if admin:
        await admin.delete()

    print("  Cleanup complete")

    # Final assertions (only for live mode)
    if is_live:
        total_concurrent = NUM_ORGANIZATIONS * REQUESTS_PER_ORG * 2 + REQUESTS_PER_ORG
        assert len(failures) == 0, f"Isolation test failed with {len(failures)} errors"
        assert len(cross_org_errors) == 0, f"Cross-org access test failed: {cross_org_errors}"
        print(f"\n[SUCCESS] Multi-tenant isolation verified under CONCURRENT load!")
        print(f"  - {NUM_ORGANIZATIONS} organizations")
        print(f"  - {total_concurrent} simultaneous requests (user + org_admin + admin roles)")
        print(f"  - Mixed read/write operations with random jitter")
    else:
        print(f"\n[SUCCESS] Basic multi-org test completed in mock mode.")
        print("  NOTE: Run with --type=live for full stress testing.")


@pytest.mark.asyncio
async def test_db_connection_eviction():
    """
    Test database connection eviction logic.

    Verifies:
    - Cleanup task only starts once (race condition guard)
    - Idle connections are evicted after timeout
    - No duplicate evictions occur
    """
    import time

    print("\n[DB Eviction Test] Testing connection eviction logic...")

    # Create a manager with very short timeout for testing
    manager = DatabaseManager(idle_timeout_seconds=1)

    # Phase 1: Test cleanup task race condition guard
    print("[Phase 1] Testing cleanup task startup guard...")

    # Simulate concurrent calls to start_cleanup_task
    assert not manager._cleanup_task_started, "Flag should be False initially"
    assert manager._cleanup_task is None, "Task should be None initially"

    # Start task
    manager.start_cleanup_task()
    assert manager._cleanup_task_started, "Flag should be True after start"
    assert manager._cleanup_task is not None, "Task should exist after start"
    first_task = manager._cleanup_task

    # Try starting again - should be a no-op
    manager.start_cleanup_task()
    assert manager._cleanup_task is first_task, "Should not create a new task"

    # Stop and verify reset
    manager.stop_cleanup_task()
    assert not manager._cleanup_task_started, "Flag should be False after stop"
    assert manager._cleanup_task is None, "Task should be None after stop"

    print("  Cleanup task guard working correctly")

    # Phase 2: Test eviction logic directly
    print("[Phase 2] Testing eviction logic...")

    # Manually add fake entries to simulate cached connections
    fake_db_id = "test_eviction_db"
    manager._databases[fake_db_id] = "fake_db"  # type: ignore
    manager._last_access[fake_db_id] = time.monotonic() - 10  # 10 seconds ago
    manager._initialized_dbs.add(fake_db_id)

    # Verify it's in the cache
    assert fake_db_id in manager._databases
    assert fake_db_id in manager._last_access

    # Run eviction (timeout is 1 second, entry is 10 seconds old)
    await manager._evict_idle_connections()

    # Verify it was evicted
    assert fake_db_id not in manager._databases, "Should have been evicted"
    assert fake_db_id not in manager._last_access, "Should have been removed from last_access"
    assert fake_db_id not in manager._initialized_dbs, "Should have been removed from initialized_dbs"

    print("  Idle connection evicted correctly")

    # Phase 3: Test that non-idle connections are NOT evicted
    print("[Phase 3] Testing non-idle connections are preserved...")

    active_db_id = "test_active_db"
    manager._databases[active_db_id] = "fake_db"  # type: ignore
    manager._last_access[active_db_id] = time.monotonic()  # Just accessed
    manager._initialized_dbs.add(active_db_id)

    await manager._evict_idle_connections()

    # Should still be there
    assert active_db_id in manager._databases, "Active connection should NOT be evicted"
    assert active_db_id in manager._last_access

    # Cleanup
    manager._databases.pop(active_db_id, None)
    manager._last_access.pop(active_db_id, None)
    manager._initialized_dbs.discard(active_db_id)

    print("  Active connections preserved correctly")

    # Phase 4: Test concurrent start_cleanup_task calls
    print("[Phase 4] Testing concurrent cleanup task starts...")

    async def try_start_task(mgr: DatabaseManager, results: list):
        mgr.start_cleanup_task()
        results.append(mgr._cleanup_task)

    results: list = []
    tasks = [try_start_task(manager, results) for _ in range(10)]
    await asyncio.gather(*tasks)

    # All should have gotten the same task (or None after the first)
    unique_tasks = set(id(t) for t in results if t is not None)
    assert len(unique_tasks) <= 1, f"Should have at most 1 unique task, got {len(unique_tasks)}"

    manager.stop_cleanup_task()
    print("  Concurrent starts handled correctly")

    print("\n[SUCCESS] Database connection eviction tests passed!")
