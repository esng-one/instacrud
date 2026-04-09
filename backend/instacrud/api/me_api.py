# api/me_api.py

from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException

from instacrud.ai.usage_tracker import UsageTracker
from instacrud.api.api_utils import role_required
from instacrud.api.me_dto import MeOrgInfo, MeOrganizationResponse, MeOrganizationUpdate, MeResponse, MeTierInfo, MeUpdateRequest, MeUsageInfo, MeUserInfo
from instacrud.context import current_user_context
from instacrud.model.system_model import Organization, Role, Tier, User

router = APIRouter()


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
    _: Annotated[None, Depends(role_required(Role.RO_USER, Role.USER, Role.ORG_ADMIN, Role.ADMIN))]
):
    """Update allowed fields (name, email) of the currently authenticated user."""
    ctx = current_user_context.get()
    user = await User.get(ctx.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.name is not None:
        user.name = data.name

    if data.email is not None:
        # Explicit uniqueness check — email has a unique index; gives clean 409 vs raw DB error
        existing = await User.find_one({"email": data.email.lower()})
        if existing and existing.id != user.id:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = data.email.lower()

    await user.save()
    return await _build_me_response(user)


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
    return MeOrganizationResponse(
        id=str(org.id),
        name=org.name,
        code=org.code,
        description=org.description,
        local_only_conversations=org.local_only_conversations,
        tier_id=str(org.tier_id) if org.tier_id else None,
    )


@router.patch("/me/organization", response_model=MeOrganizationResponse, tags=["me"])
async def patch_me_organization(
    data: MeOrganizationUpdate,
    _: Annotated[None, Depends(role_required(Role.ORG_ADMIN))]
):
    """Update allowed organization fields (name, description, local_only_conversations) for ORG_ADMIN."""
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
    if data.description is not None:
        org.description = data.description
    if data.local_only_conversations is not None:
        org.local_only_conversations = data.local_only_conversations

    await org.save()
    return MeOrganizationResponse(
        id=str(org.id),
        name=org.name,
        code=org.code,
        description=org.description,
        local_only_conversations=org.local_only_conversations,
        tier_id=str(org.tier_id) if org.tier_id else None,
    )
