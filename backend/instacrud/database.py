# database.py

import asyncio
import time
from contextvars import ContextVar
from loguru import logger
from beanie import init_beanie
from beanie.odm.utils import init as _beanie_init
from beanie.odm.utils.init import IndexModelField as _IndexModelField
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from pymongo.synchronous.collection import Collection as _SyncCollection
from typing import Dict, Iterable, Set

from instacrud.config import settings
from instacrud.model.model_helper import get_organization_models, get_system_models
from instacrud.model.system_model import OAuthSession, Usage, UsageHistory
from instacrud.helpers.gcp_firebase_helper import (
    gcp_firestore_create_database,
    gcp_firestore_delete_database,
    gcp_firestore_build_mongo_url,
    org_to_firestore_id,
)


# ---------------------------------------------------------------------------
# Context variable for current request's database
# ---------------------------------------------------------------------------
_current_db_id: ContextVar[str | None] = ContextVar('current_db_id', default=None)


def get_current_db_id() -> str | None:
    """Get the database ID for the current request."""
    return _current_db_id.get()


def set_current_db_id(db_id: str) -> None:
    """Set the database ID for the current request."""
    _current_db_id.set(db_id)


# ---------------------------------------------------------------------------
# Database Manager - caches connections, patches models
# ---------------------------------------------------------------------------
class DatabaseManager:
    """
    Thread-safe database connection manager with contextvar-based routing.

    - Caches database connections (no reconnecting per request)
    - Uses contextvar to route requests to correct database
    - Patches org models once to use contextvar lookup
    - Tracks last access time and evicts idle connections
    - Health checks cached connections and auto-reconnects if broken
    """

    # Cleanup interval: 5 minutes
    CLEANUP_INTERVAL_SECONDS = 5 * 60
    # Default idle timeout: 30 minutes
    DEFAULT_IDLE_TIMEOUT_SECONDS = 30 * 60
    # Health check timeout: 5 seconds
    HEALTH_CHECK_TIMEOUT_SECONDS = 5

    def __init__(self, idle_timeout_seconds: int | None = None):
        self._databases: Dict[str, AsyncIOMotorDatabase] = {}
        self._clients: Dict[str, AsyncIOMotorClient] = {}
        self._initialized_dbs: Set[str] = set()  # DBs that have had init_beanie called
        self._last_access: Dict[str, float] = {}  # db_id -> last access timestamp
        self._db_mongo_urls: Dict[str, str | None] = {}  # db_id -> mongo_url for reconnection
        self._lock = asyncio.Lock()
        self._models_patched = False
        self._idle_timeout = idle_timeout_seconds or self.DEFAULT_IDLE_TIMEOUT_SECONDS
        self._cleanup_task: asyncio.Task | None = None
        self._cleanup_task_started = False  # Guard against race conditions

    def _patch_org_models(self) -> None:
        """
        Patch organization models to use contextvar for database lookup.
        Called once on first use.

        The key insight: Beanie's models use class-level attributes for database
        connections. We patch get_pymongo_collection to dynamically look up the
        correct database from a contextvar instead of using the class attribute.
        """
        if self._models_patched:
            return

        org_models = get_organization_models()
        manager = self  # Capture reference for closure

        for model_cls in org_models:
            model_name = model_cls.__name__

            # Create the patched method - must be a closure to capture model_name
            def make_patched_method(name):
                def patched_get_pymongo_collection(cls):
                    db_id = _current_db_id.get()

                    if db_id is None:
                        # Fallback: use the cached collection from _document_settings
                        doc_settings = getattr(cls, '_document_settings', None)
                        if doc_settings and hasattr(doc_settings, 'pymongo_collection'):
                            return doc_settings.pymongo_collection
                        raise RuntimeError(f"No database context set for {name}")

                    if db_id not in manager._databases:
                        raise RuntimeError(f"Database '{db_id}' not initialized for {name}")

                    db = manager._databases[db_id]
                    collection_name = cls.get_collection_name()
                    return db[collection_name]

                return patched_get_pymongo_collection

            # Create the patched classmethod and apply it
            patched_func = make_patched_method(model_name)
            setattr(model_cls, 'get_pymongo_collection', classmethod(patched_func))
            logger.debug(f"Patched {model_name}.get_pymongo_collection")

        self._models_patched = True
        logger.info(f"Patched {len(org_models)} org models for contextvar routing")

    async def _check_health(self, db_id: str) -> bool:
        """
        Check if a cached connection is healthy by pinging the server.
        Returns True if healthy, False if broken.
        """
        try:
            client = self._clients.get(db_id, _client_instance)
            await asyncio.wait_for(
                client.admin.command('ping'),
                timeout=self.HEALTH_CHECK_TIMEOUT_SECONDS
            )
            return True
        except (ConnectionFailure, ServerSelectionTimeoutError, asyncio.TimeoutError) as e:
            logger.warning(f"Health check failed for database '{db_id}': {e}")
            return False
        except Exception as e:
            logger.warning(f"Unexpected error during health check for '{db_id}': {e}")
            return False

    def _remove_connection(self, db_id: str) -> None:
        """Remove a connection from cache (internal use, no lock)."""
        self._databases.pop(db_id, None)
        self._initialized_dbs.discard(db_id)
        self._last_access.pop(db_id, None)

        client = self._clients.pop(db_id, None)
        if client:
            client.close()
            logger.info(f"Closed connection for database: {db_id}")

        # Also evict FAISS index for this tenant (DEMO Implementation)
        from instacrud.ai.vector_search import clear_vector_search
        clear_vector_search(db_id)

    async def ensure_database(self, db_id: str, mongo_url: str | None = None) -> None:
        """
        Ensure database connection exists, is healthy, and is initialized.
        Does NOT set contextvar - that's the caller's job.

        - Checks health of cached connections before returning
        - Auto-reconnects if a cached connection is broken
        - Tracks last access time for idle eviction
        """
        # Fast path: already have this database - but verify it's healthy
        if db_id in self._databases:
            if await self._check_health(db_id):
                self._last_access[db_id] = time.monotonic()
                return
            else:
                # Connection is broken, remove it and reconnect
                logger.warning(f"Cached connection for '{db_id}' is broken, reconnecting...")
                async with self._lock:
                    # Use stored mongo_url if we have it
                    if mongo_url is None:
                        mongo_url = self._db_mongo_urls.get(db_id)
                    self._remove_connection(db_id)

        async with self._lock:
            # Double-check after lock (another request may have reconnected)
            if db_id in self._databases:
                self._last_access[db_id] = time.monotonic()
                return

            # Ensure models are patched
            self._patch_org_models()

            # Create connection
            if mongo_url:
                client = AsyncIOMotorClient(mongo_url, **_tls_kwargs)
                db = client.get_default_database()
                self._clients[db_id] = client
            else:
                db = _client_instance.get_database(db_id)

            # Test connectivity
            try:
                test_client = self._clients.get(db_id, _client_instance)
                await asyncio.wait_for(
                    test_client.admin.command('ping'),
                    timeout=self.HEALTH_CHECK_TIMEOUT_SECONDS
                )
            except Exception as e:
                # Clean up partial state on failure
                self._clients.pop(db_id, None)
                raise ValueError(f"Cannot connect to database {db_id}: {e}")

            self._databases[db_id] = db
            self._last_access[db_id] = time.monotonic()
            self._db_mongo_urls[db_id] = mongo_url  # Store for potential reconnection
            logger.info(f"Database connection cached: {db_id} -> {db.name}")

            # Initialize Beanie for this database (creates indexes, etc.)
            # Only needed once per database
            if db_id not in self._initialized_dbs:
                # IMPORTANT: Set contextvar BEFORE init_beanie so that
                # get_pymongo_collection returns the correct database's collections
                old_db_id = _current_db_id.get()
                _current_db_id.set(db_id)

                try:
                    org_models = get_organization_models()
                    await init_beanie(database=db, document_models=org_models)
                    self._initialized_dbs.add(db_id)
                    logger.debug(f"Beanie initialized for: {db_id}")
                finally:
                    # Restore previous contextvar (will be set again by use_database)
                    _current_db_id.set(old_db_id)

    def drop_database(self, db_id: str) -> None:
        """Remove a database from the cache."""
        self._databases.pop(db_id, None)
        self._initialized_dbs.discard(db_id)
        self._last_access.pop(db_id, None)
        self._db_mongo_urls.pop(db_id, None)

        client = self._clients.pop(db_id, None)
        if client:
            client.close()

    async def _cleanup_idle_connections(self) -> None:
        """Background task to periodically evict idle connections."""
        while True:
            try:
                await asyncio.sleep(self.CLEANUP_INTERVAL_SECONDS)
                await self._evict_idle_connections()
            except asyncio.CancelledError:
                logger.info("Connection cleanup task cancelled")
                break
            except Exception:
                logger.exception("Error in cleanup task")

    async def _evict_idle_connections(self) -> None:
        """Evict connections that have been idle longer than the timeout."""
        now = time.monotonic()
        to_evict = []

        for db_id, last_access in self._last_access.items():
            idle_time = now - last_access
            if idle_time > self._idle_timeout:
                to_evict.append(db_id)

        if to_evict:
            async with self._lock:
                for db_id in to_evict:
                    # Double-check it's still idle (may have been accessed while waiting for lock)
                    if db_id in self._last_access:
                        idle_time = now - self._last_access[db_id]
                        if idle_time > self._idle_timeout:
                            logger.info(f"Evicting idle connection: {db_id} (idle for {idle_time:.0f}s)")
                            self._remove_connection(db_id)
                            self._db_mongo_urls.pop(db_id, None)

    def start_cleanup_task(self) -> None:
        """Start the background cleanup task."""
        # Use a simple boolean guard to prevent race conditions where multiple
        # tasks could be created before the first one is assigned to _cleanup_task
        if self._cleanup_task_started:
            return
        self._cleanup_task_started = True

        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_idle_connections())
            logger.info(f"Started connection cleanup task (idle timeout: {self._idle_timeout}s)")

    def stop_cleanup_task(self) -> None:
        """Stop the background cleanup task."""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
        self._cleanup_task = None
        self._cleanup_task_started = False
        logger.info("Stopped connection cleanup task")

    def get_stats(self) -> dict:
        now = time.monotonic()
        idle_times = {
            db_id: round(now - last_access, 1)
            for db_id, last_access in self._last_access.items()
        }
        return {
            'current_db_id': _current_db_id.get(),
            'cached_databases': list(self._databases.keys()),
            'initialized_dbs': list(self._initialized_dbs),
            'custom_clients': list(self._clients.keys()),
            'models_patched': self._models_patched,
            'idle_timeout_seconds': self._idle_timeout,
            'connection_idle_times': idle_times,
            'cleanup_task_running': self._cleanup_task is not None and not self._cleanup_task.done(),
            'cleanup_task_started_flag': self._cleanup_task_started,
        }


_db_manager = DatabaseManager()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def use_database(db_id: str, mongo_url: str | None = None) -> None:
    """
    Switch current request to use the specified database.
    - Ensures connection is cached
    - Sets contextvar for this request
    - Safe for concurrent requests from different orgs
    """
    await _db_manager.ensure_database(db_id, mongo_url)
    set_current_db_id(db_id)

    # Safety check
    if get_current_db_id() != db_id:
        raise RuntimeError(f"SECURITY: Failed to set current database to '{db_id}'")


def get_active_db() -> str | None:
    """Return the database ID for the current request."""
    return get_current_db_id()


def drop_cached_db(db_id: str) -> None:
    """Remove a database from the cache."""
    _db_manager.drop_database(db_id)


def get_database_stats() -> dict:
    """Get database manager statistics."""
    return _db_manager.get_stats()


def start_connection_cleanup() -> None:
    """Start the background task that evicts idle database connections."""
    _db_manager.start_cleanup_task()


def stop_connection_cleanup() -> None:
    """Stop the background connection cleanup task."""
    _db_manager.stop_cleanup_task()


# ---------------------------------------------------------------------------
# Legacy settings (used by middleware)
# ---------------------------------------------------------------------------
firestore_mode = settings.DB_ENGINE and settings.DB_ENGINE.lower() == "firestore"
use_org_db_mode = settings.MONGO_USE_ORG_DB and settings.DB_ENGINE.lower() in ("mongo", "atlas")


# ---------------------------------------------------------------------------
# Firestore compatibility: one index per createIndexes call
# ---------------------------------------------------------------------------
_orig__create_indexes = _SyncCollection._create_indexes
def _one_by_one_create_indexes(self, indexes, session=None, **kwargs):
    if len(indexes) <= 1:
        return _orig__create_indexes(self, indexes, session, **kwargs)
    created: list[str] = []
    for idx in indexes:
        created += _orig__create_indexes(self, [idx], session, **kwargs)
    return created
_SyncCollection._create_indexes = _one_by_one_create_indexes


# ---------------------------------------------------------------------------
# Global client for standard mode
# ---------------------------------------------------------------------------
_tls_kwargs: dict = {}
if settings.MONGO_TLS_ALLOW_INVALID:
    _tls_kwargs["tlsAllowInvalidCertificates"] = True

_client_instance = AsyncIOMotorClient(settings.MONGO_URL, **_tls_kwargs)


def get_client() -> AsyncIOMotorClient:
    return _client_instance


def set_client(new_client: AsyncIOMotorClient):
    global _client_instance
    _client_instance.close()
    _client_instance = new_client


# ---------------------------------------------------------------------------
# System DB initialization (called once at startup)
# ---------------------------------------------------------------------------
async def init_system_db():
    models = get_system_models() + [OAuthSession, Usage, UsageHistory]

    if firestore_mode:
        for M in models:
            if hasattr(M, "Settings") and hasattr(M.Settings, "indexes"):
                M.Settings.indexes = []
        _IndexModelField.list_to_index_model = staticmethod(lambda x: [])
        async def _no_indexes(self, cls, allow_index_dropping: bool = False):
            return []
        _beanie_init.Initializer.init_indexes = _no_indexes

    await init_beanie(
        database=get_client().get_default_database() if firestore_mode else get_client().get_database("_system"),
        document_models=models,
    )

    # Start the background cleanup task for idle connections
    _db_manager.start_cleanup_task()


# ---------------------------------------------------------------------------
# Organization database helpers
# ---------------------------------------------------------------------------
async def init_org_db(organization_id: str, mongo_url: str | None = None):
    """Initialize the database context for an organization."""
    if firestore_mode:
        db_id = f"firestore:{organization_id}"
        if mongo_url is None:
            from instacrud.model.system_model import Organization
            from beanie import PydanticObjectId
            from instacrud.crypto import resolve_org_mongo_url
            org = await Organization.get(PydanticObjectId(organization_id))
            if org and org.mongo_url:
                mongo_url = await resolve_org_mongo_url(org)
        await use_database(db_id, mongo_url)
    elif mongo_url:
        await use_database(f"custom:{organization_id}", mongo_url)
    else:
        await use_database(organization_id)


def assign_org_db() -> str | None:
    """
    Assign a MongoDB URL for a new organization.
    STUB: Implement your database assignment logic here.
    """
    return settings.MONGO_URL


def assign_firestore_org_db(organization_id: str) -> str:
    """
    Create SCRAM credentials and build a MongoDB-compatible connection URL
    for a Firestore org database.
    """
    fs_db_id = org_to_firestore_id(organization_id)
    return gcp_firestore_build_mongo_url(fs_db_id)


async def drop_org_db(organization_id: str):
    """Drop an organization's database."""
    if firestore_mode:
        try:
            gcp_firestore_delete_database(org_to_firestore_id(organization_id))
        except Exception as e:
            raise ValueError(f"Failed to delete Firestore database for organization {organization_id}: {str(e)}")
    else:
        client = get_client()
        await client.drop_database(organization_id)
    drop_cached_db(organization_id)
    drop_cached_db(f"custom:{organization_id}")
    drop_cached_db(f"firestore:{organization_id}")


async def ensure_search_indexes_for_org(organization_id: str, model_entries: Iterable[dict]):
    """Create search-related indexes for a new organization. MongoDB only."""
    if firestore_mode:
        return

    client = get_client()
    db = client.get_database(organization_id)

    for entry in model_entries:
        model = entry["model"]
        collection_name = model.get_collection_name()
        await db[collection_name].create_index(
            [("search_tokens", ASCENDING)],
            name=f"search_tokens_{collection_name}_idx"
        )


# ---------------------------------------------------------------------------
# GCP Firestore organization management
# ---------------------------------------------------------------------------
async def create_firestore_org_db(organization_id: str) -> str:
    """Create a Firestore database and collections for a new organization."""
    if not firestore_mode:
        raise ValueError("create_firestore_org_db should only be called in Firestore mode")

    db_id = org_to_firestore_id(organization_id)
    try:
        gcp_firestore_create_database(db_id)
        # Collections are created automatically on first write via Beanie/MongoDB endpoint.
        # No need to use Firestore API (which may be disabled).
        return organization_id

    except Exception as e:
        raise ValueError(f"Failed to create Firestore database for organization {organization_id}: {str(e)}")


async def delete_firestore_org_db(organization_id: str) -> None:
    """Delete a Firestore database for an organization."""
    if not firestore_mode:
        raise ValueError("delete_firestore_org_db should only be called in Firestore mode")

    try:
        gcp_firestore_delete_database(org_to_firestore_id(organization_id))
    except Exception as e:
        raise ValueError(f"Failed to delete Firestore database for organization {organization_id}: {str(e)}")
