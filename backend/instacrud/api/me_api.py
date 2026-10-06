# api/me_api.py

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from instacrud.ai.usage_tracker import UsageTracker
from instacrud.api.api_utils import role_required
from instacrud.api.me_dto import MeOrgInfo, MeOrganizationResponse, MeOrganizationUpdate, MeResponse, MeTierInfo, MeUpdateRequest, MeUsageInfo, MeUserInfo
from instacrud.context import current_user_context
from instacrud.model.system_model import Organization, Role, Tier, User

router = APIRouter()

# A provisioning attempt that hasn't bumped its heartbeat for this long is treated as dead
# and eligible to be resumed. The running task heartbeats every ~10s, so this only trips for a
# genuinely killed/throttled attempt — never a slow-but-healthy one (which keeps heartbeating).
PROVISIONING_STALE_SECONDS = 45


async def _build_me_response(user: User) -> MeResponse:
    """Assemble MeResponse from a User document. Makes DB calls for org, tier, usage."""

    # Org
    org = None
    org_info = None
    if user.organization_id:
        org = await Organization.get(user.organization_id)
    if org:
        org_info = MeOrgInfo(
            id=str(org.id),
            name=org.name,
            description=org.description,
            status=org.status,
        )

    # Tier — org tier takes precedence over user tier
    tier = None
    tier_id = (org.tier_id if org else None) or user.tier_id
    if tier_id:
        tier = await Tier.get(tier_id)
    tier_info = MeTierInfo(name=tier.name, code=tier.code, level=tier.tier) if tier else None

    # Usage
    raw_usage = await UsageTracker.get_usage_stats(user.id)
    usage_info = MeUsageInfo(
        used=raw_usage["usage"]["used"],
        limit=raw_usage["usage"]["limit"],
        percentage=raw_usage["usage"]["percentage"],
        remaining=raw_usage["usage"]["remaining"],
        reset_at=raw_usage["reset_at"],
    )

    return MeResponse(
        user=MeUserInfo(
            id=str(user.id),
            email=user.email,
            name=user.name,
            role=user.role.value,
            has_password=bool(user.hashed_password),
        ),
        organization=org_info,
        usage=usage_info,
        tier=tier_info,
    )


@router.get("/me", response_model=MeResponse, tags=["me"])
async def get_me(
    _: Annotated[None, Depends(role_required(Role.RO_USER, Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """Return the full profile of the currently authenticated user."""
    ctx = current_user_context.get()
    user = await User.get(ctx.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await _build_me_response(user)


@router.patch("/me", response_model=MeResponse, tags=["me"])
async def patch_me(
    data: MeUpdateRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """Update the currently authenticated user."""
    ctx = current_user_context.get()
    user = await User.get(ctx.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.name = data.name
    await user.save()
    return await _build_me_response(user)


def _build_org_response(org: Organization) -> MeOrganizationResponse:
    return MeOrganizationResponse(
        id=str(org.id),
        name=org.name,
        code=org.code,
        description=org.description,
        local_only_conversations=org.local_only_conversations,
        tier_id=str(org.tier_id) if org.tier_id else None,
    )


@router.get("/me/organization", response_model=MeOrganizationResponse, tags=["me"])
async def get_me_organization(
    _: Annotated[None, Depends(role_required(Role.ORG_ADMIN))]
):
    """Return the organization of the currently authenticated ORG_ADMIN user."""
    ctx = current_user_context.get()
    if not ctx.organization_id:
        raise HTTPException(status_code=404, detail="No organization assigned")
    org = await Organization.get(ctx.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _build_org_response(org)


@router.patch("/me/organization", response_model=MeOrganizationResponse, tags=["me"])
async def patch_me_organization(
    data: MeOrganizationUpdate,
    _: Annotated[None, Depends(role_required(Role.ORG_ADMIN))]
):
    """Update allowed organization fields for ORG_ADMIN.

    Omitting a field leaves it unchanged. Sending description as null or "" clears it.
    """
    ctx = current_user_context.get()
    if not ctx.organization_id:
        raise HTTPException(status_code=404, detail="No organization assigned")
    org = await Organization.get(ctx.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.status != "ACTIVE":
        raise HTTPException(status_code=409, detail="Organization is not active")

    if data.name is not None:
        org.name = data.name
    if "description" in data.model_fields_set:
        org.description = data.description or None
    if data.local_only_conversations is not None:
        org.local_only_conversations = data.local_only_conversations

    await org.save()
    return _build_org_response(org)


@router.post("/me/organization/retry-provisioning", tags=["me"])
async def retry_provisioning(
    background_tasks: BackgroundTasks,
    _: Annotated[None, Depends(role_required(Role.RO_USER, Role.USER, Role.ORG_ADMIN, Role.ADMIN))],
):
    """Resume a stuck organization provisioning.

    The provisioning task is a fire-and-forget background job; if its worker is killed or
    CPU-throttled mid-run (common on serverless once the response is sent) the org is stranded
    in PROVISIONING. The provisioning guard calls this to recover.

    It atomically claims a new provisioning lease, but ONLY when the current attempt's
    heartbeat is stale (dead) or the org is FAILED — a live attempt that is still heartbeating
    is left untouched. The claim is a single `find_one_and_update`, so concurrent callers
    (multiple tabs, mount + interval) can never both win and double-dispatch.
    """
    ctx = current_user_context.get()
    if not ctx.organization_id:
        raise HTTPException(status_code=404, detail="No organization assigned")
    org = await Organization.get(ctx.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.status == "ACTIVE":
        return {"status": "ACTIVE", "retriggered": False}

    from instacrud.database import assign_org_db, use_org_db_mode, firestore_mode
    from instacrud.api.provisioning import provision_organization_task

    now = datetime.now(tz=timezone.utc)
    cutoff = now - timedelta(seconds=PROVISIONING_STALE_SECONDS)
    lease = uuid.uuid4().hex
    # Atomic claim: only a non-ACTIVE org whose heartbeat is missing or stale is taken, and
    # only one caller wins (the winner stamps a fresh heartbeat + new lease in the same op).
    claimed = await Organization.get_pymongo_collection().find_one_and_update(
        {"_id": PydanticObjectId(ctx.organization_id),
         "status": {"$ne": "ACTIVE"},
         "$or": [{"provisioning_heartbeat_at": None},
                 {"provisioning_heartbeat_at": {"$lt": cutoff}}]},
        {"$set": {"provisioning_lease": lease,
                  "provisioning_heartbeat_at": now,
                  "status": "PROVISIONING"}},
    )
    if claimed is None:
        # ACTIVE, or a live attempt is still heartbeating — leave it alone.
        return {"status": org.status, "retriggered": False}

    mongo_url = assign_org_db() if use_org_db_mode else None
    background_tasks.add_task(
        provision_organization_task, str(org.id), mongo_url, firestore_mode, False, True, lease
    )
    return {"status": "PROVISIONING", "retriggered": True}
