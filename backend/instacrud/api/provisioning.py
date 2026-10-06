# api/provisioning.py
import asyncio
import uuid
from datetime import datetime, timezone

from beanie import PydanticObjectId
from loguru import logger
from instacrud.model.system_model import Organization
import instacrud.database as db
from instacrud.config import settings
from instacrud.crypto import encrypt_connection_url

# The running attempt bumps its heartbeat this often while its event loop is alive.
HEARTBEAT_INTERVAL_SECONDS = 10


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


async def _heartbeat_loop(oid: PydanticObjectId, lease: str, stop: asyncio.Event):
    """Bump `provisioning_heartbeat_at` every interval while we still hold the lease.

    A killed or CPU-throttled task stops running this, so its heartbeat goes stale and another
    attempt can take over. The lease filter means that once a newer attempt claims the lease,
    our updates match nothing and we silently stop touching the org.
    """
    coll = Organization.get_pymongo_collection()
    while not stop.is_set():
        try:
            await coll.update_one(
                {"_id": oid, "provisioning_lease": lease},
                {"$set": {"provisioning_heartbeat_at": _now()}},
            )
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop.wait(), timeout=HEARTBEAT_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass


async def _still_ours(oid: PydanticObjectId, lease: str) -> bool:
    org = await Organization.get(oid)
    return bool(org and org.provisioning_lease == lease and org.status != "ACTIVE")


async def provision_organization_task(
    organization_id: str,
    mongo_url: str | None,
    firestore_mode: bool,
    load_mock_data: bool,
    is_retry: bool = False,
    lease: str | None = None,
):
    """Provision an organization's data store, then mark it ACTIVE.

    Fire-and-forget background task, made crash/throttle-safe with a lease + heartbeat:
      * This attempt owns a unique `provisioning_lease` and bumps `provisioning_heartbeat_at`
        every few seconds while alive. If it is killed/throttled the heartbeat goes stale and
        `retry_provisioning` atomically claims a new lease and resumes — detection is based on
        heartbeat staleness, not elapsed time, so a slow-but-healthy provision is never
        mistaken for stuck (and never torn down under it).
      * Every state write (mongo_url, ACTIVE, FAILED) and the Firestore teardown is gated on
        still holding the lease, so a superseded old attempt can never clobber a newer one or
        drop a database a newer attempt is using.
      * An already-ACTIVE org is a no-op.
    """
    oid = PydanticObjectId(organization_id)
    coll = Organization.get_pymongo_collection()

    org = await Organization.get(oid)
    if not org:
        logger.error(f"Organization {organization_id} not found for provisioning")
        return
    if org.status == "ACTIVE":
        logger.info(f"Organization {organization_id} already ACTIVE; skipping provisioning")
        return

    # Claim the lease. A first dispatch (no lease passed) takes one atomically; a retry passes
    # the lease retry_provisioning already claimed.
    if lease is None:
        lease = uuid.uuid4().hex
        claimed = await coll.find_one_and_update(
            {"_id": oid, "status": {"$ne": "ACTIVE"}},
            {"$set": {"provisioning_lease": lease,
                      "provisioning_heartbeat_at": _now(),
                      "status": "PROVISIONING"}},
        )
        if claimed is None:
            return  # became ACTIVE between the read and the claim

    stop = asyncio.Event()
    heartbeat = asyncio.create_task(_heartbeat_loop(oid, lease, stop))
    try:
        if firestore_mode:
            import anyio
            if is_retry:
                # A prior attempt may have left a partial Firestore DB + creds (the create
                # steps below raise ALREADY_EXISTS otherwise). Tear it down first — safe
                # because we hold the lease (sole owner) and the org is not ACTIVE (no data).
                if not await _still_ours(oid, lease):
                    return
                try:
                    await db.drop_org_db(organization_id)
                    logger.info(f"Retry: cleared partial Firestore state for org={organization_id}")
                except Exception:
                    logger.info(f"Retry: no partial Firestore state to clear for org={organization_id}")
                await coll.update_one({"_id": oid, "provisioning_lease": lease},
                                      {"$set": {"mongo_url": None}})

            logger.info(f"Creating firestore DB for org={organization_id}")
            await db.create_firestore_org_db(organization_id)
            # Blocking gRPC + ABORTED-retry sleeps — off the event loop so it can't stall the
            # /me polls the provisioning guard makes (the heartbeat task keeps running).
            mongo_url = await anyio.to_thread.run_sync(db.assign_firestore_org_db, organization_id)
            saved = await coll.update_one(
                {"_id": oid, "provisioning_lease": lease},
                {"$set": {"mongo_url": encrypt_connection_url(mongo_url)}},
            )
            if saved.matched_count == 0:
                logger.info(f"Superseded before mongo_url save for org={organization_id}; aborting")
                return

            from instacrud.helpers.gcp_firebase_helper import gcp_firestore_wait_for_iam
            await gcp_firestore_wait_for_iam(mongo_url)
            logger.info(f"IAM ready for org={organization_id}, initializing org DB")
            await db.init_org_db(organization_id, mongo_url=mongo_url)
        else:
            await db.init_org_db(organization_id, mongo_url=mongo_url)

        if load_mock_data and settings.SUGGEST_LOADING_MOCK_DATA:
            try:
                from init.mock_data_helper import populate_org_mock_data
                await populate_org_mock_data(organization_id, create_indexes=not firestore_mode, mongo_url=mongo_url)
                logger.info(f"Mock data loaded for new organization {organization_id}")
            except Exception:
                logger.exception(f"Failed to load mock data for org {organization_id}")

        # Finalize — only if still ours, so we never flip a newer attempt's work.
        finalized = await coll.update_one(
            {"_id": oid, "provisioning_lease": lease},
            {"$set": {"status": "ACTIVE"}},
        )
        if finalized.matched_count == 0:
            logger.info(f"Superseded before finalize for org={organization_id}; not marking ACTIVE")
        else:
            logger.info(f"Organization {organization_id} provisioned successfully")

    except Exception:
        logger.exception(f"Failed to provision org {organization_id}")
        # Mark FAILED only if still ours and not ACTIVE — never clobber a newer attempt. Clear
        # the heartbeat so the org is immediately eligible for a resume.
        try:
            await coll.update_one(
                {"_id": oid, "provisioning_lease": lease, "status": {"$ne": "ACTIVE"}},
                {"$set": {"status": "FAILED", "provisioning_heartbeat_at": None}},
            )
        except Exception:
            logger.exception(f"Failed to mark org {organization_id} as FAILED")
    finally:
        stop.set()
        try:
            await heartbeat
        except Exception:
            pass
