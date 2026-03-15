# api/system_api.py
import asyncio
import hashlib
import httpx
import jwt

from beanie import PydanticObjectId
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header, BackgroundTasks
from loguru import logger
from passlib.context import CryptContext
from typing import Any, Dict, Optional, Annotated, List

from instacrud.api.api_utils import role_required, create_crud_router, ALGORITHM, SECRET_KEY, TOKEN_EXPIRATION_SECONDS
from instacrud.api.rate_limiter import limiter, SIGNIN_RATE_LIMIT, SIGNUP_RATE_LIMIT, FORGOT_PW_RATE_LIMIT, RESET_PW_RATE_LIMIT
from instacrud.api.organization_api import SEARCH_MODELS
from instacrud.api.system_dto import OrganizationCreate, OrganizationUpdate, UserCreate, UserUpdate, \
    InviteUserCreate, SignInRequest, TokenResponse, MessageResponse, OrganizationResponse, \
    DeleteOrgConfirmResponse, UserResponse, InvitationResponse, InvitationListResponse, SignupResponse, \
    ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest, \
    UserSettingsUpdate, UserSettingsResponse
from instacrud.config import settings
from instacrud.context import current_user_context
from instacrud.crypto import encrypt_connection_url
from instacrud.database import drop_org_db, ensure_search_indexes_for_org, init_org_db, assign_org_db, assign_firestore_org_db, use_org_db_mode, firestore_mode, create_firestore_org_db
from instacrud.model.system_model import Organization, Role, User, Invitation, AiModel, Tier, PasswordResetToken
from instacrud.mailer import get_email_service
from instacrud.mailer.templates import render_invitation_email, render_password_reset_email

router = APIRouter()

async def verify_turnstile_token(
    token: str,
    remoteip: Optional[str] = None,
) -> bool:
    """
    Verify Cloudflare Turnstile token with Cloudflare.

    If TURNSTILE_SECRET_KEY is not configured, we treat Turnstile as disabled
    and always return True.
    """
    if not settings.TURNSTILE_SECRET_KEY:
        return True

    data: Dict[str, str] = {
        "secret": settings.TURNSTILE_SECRET_KEY,
        "response": token,
    }
    if remoteip:
        data["remoteip"] = remoteip

    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            resp = await http.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", data=data)
        payload = resp.json()
        logger.debug("Turnstile verification result: success=%s", payload.get("success"))
        return bool(payload.get("success"))
    except Exception as exc:  # noqa: BLE001
        logger.error(f"Turnstile verification error: {exc}")
        return False

async def turnstile_guard(
    request: Request,
    cf_turnstile_token: Annotated[
        Optional[str],
        Header(alias="CF-Turnstile-Token"),
    ] = None,
):
    """
    Dependency that enforces Turnstile verification if enabled.
    """
    if not settings.TURNSTILE_ENABLED:
        return

    if not cf_turnstile_token:
        raise HTTPException(
            status_code=400,
            detail="Missing Turnstile verification token.",
        )

    is_valid = await verify_turnstile_token(
        cf_turnstile_token,
        remoteip=request.client.host if request.client else None,
    )
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Turnstile verification failed.",
        )

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pre-computed dummy hash for timing attack prevention (bcrypt hash of "dummy")
DUMMY_PASSWORD_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqKe6JVKZm"

# ------------------------------
# ORGANIZATION ENDPOINTS
# ------------------------------

@router.get("/admin/organizations", response_model=List[OrganizationResponse], tags=["admin"])
async def list_organizations(
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))]
):
    user_ctx = current_user_context.get()
    
    # List organizations based on user role: all for ADMIN and only assigned for ORG_ADMIN
    if user_ctx.role == Role.ORG_ADMIN:
        # For ORG_ADMIN, find organization by ObjectId (not string)
        organization = await Organization.get(user_ctx.organization_id)
        organizations = [organization] if organization else []
    elif user_ctx.role == Role.ADMIN:
        organizations = await Organization.find_all().to_list()
    else:
        raise HTTPException(status_code=403, detail="Not authorized to access organizations")
        
    return [
        OrganizationResponse(
            id=str(org.id),
            name=org.name,
            code=org.code,
            description=org.description,
            status=org.status,
            tier_id=str(org.tier_id) if org.tier_id else None,
            local_only_conversations=org.local_only_conversations
        ) for org in organizations
    ]


@router.post("/admin/organizations", response_model=MessageResponse, tags=["admin"])
async def onboard_organization(
    data: OrganizationCreate,
    background_tasks: BackgroundTasks,
    _: Annotated[None, Depends(role_required(Role.ADMIN))]
):
    # Check if org exists
    existing = await Organization.find_one({"code": data.code})
    if existing:
        raise HTTPException(status_code=400, detail="Organization ID already exists")

    # Assign org-specific database URL if MONGO_USE_ORG_DB is enabled
    mongo_url = assign_org_db() if use_org_db_mode else None

    # Create org document
    org_data = data.model_dump()
    if mongo_url:
        org_data["mongo_url"] = encrypt_connection_url(mongo_url)
    # Convert tier_id string to PydanticObjectId if provided
    if org_data.get("tier_id"):
        org_data["tier_id"] = PydanticObjectId(org_data["tier_id"])

    if firestore_mode:
        # Firestore IAM propagation takes up to 3 minutes — run async so the
        # request returns immediately with PROVISIONING status.
        org_data["status"] = "PROVISIONING"
        org = Organization(**org_data)
        await org.insert()

        from instacrud.api.provisioning import provision_organization_task
        background_tasks.add_task(
            provision_organization_task,
            str(org.id),
            mongo_url,
            firestore_mode,
            False  # load_mock_data not applicable for admin-created orgs
        )
    else:
        org = Organization(**org_data)
        await org.insert()

        await init_org_db(str(org.id), mongo_url=mongo_url)

        # Auto-create search indexes if enabled
        if settings.AUTO_CREATE_SEARCH_INDEXES:
            try:
                await ensure_search_indexes_for_org(str(org.id), SEARCH_MODELS)
            except Exception as e:
                logger.warning(f"Failed to auto-create search indexes for org {org.id}: {e}")

    return MessageResponse(message="Organization onboarded")


@router.get("/admin/organizations/{organization_id}", response_model=OrganizationResponse, tags=["admin"])
async def get_organization(
    organization_id: str,
):
    user_ctx = current_user_context.get()

    if organization_id == None or organization_id == "None" or organization_id == "":
        return OrganizationResponse(
            id= "",
            name= "No Organization",
            code= "",
            description= "This user is not assigned to any organization.",
            status= "ACTIVE",
            tier_id= None
        )

    if user_ctx.role != Role.ADMIN:
        organization_id = user_ctx.organization_id

    org = await Organization.get(organization_id)
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return OrganizationResponse(
        id=str(org.id),
        name=org.name,
        code=org.code,
        description=org.description,
        status=org.status,
        tier_id=str(org.tier_id) if org.tier_id else None,
        local_only_conversations=org.local_only_conversations
    )


@router.patch("/admin/organizations/{organization_id}", response_model=OrganizationResponse, tags=["admin"])
async def update_organization(
    organization_id: str,
    data: OrganizationUpdate,
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))]
):
    org = await Organization.get(organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user_ctx = current_user_context.get()
    if user_ctx.role == Role.ORG_ADMIN and str(org.id) != user_ctx.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this organization")

    if data.name is not None:
        org.name = data.name
    if data.description is not None:
        org.description = data.description
    if data.tier_id is not None:
        # Only ADMIN can change tier
        if user_ctx.role != Role.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can change organization tier")
        org.tier_id = PydanticObjectId(data.tier_id) if data.tier_id else None
    if data.local_only_conversations is not None:
        org.local_only_conversations = data.local_only_conversations

    await org.save()

    return OrganizationResponse(
        id=str(org.id),
        name=org.name,
        code=org.code,
        description=org.description,
        status=org.status,
        tier_id=str(org.tier_id) if org.tier_id else None,
        local_only_conversations=org.local_only_conversations
    )


@router.delete("/admin/organizations/{organization_id}", response_model=MessageResponse | DeleteOrgConfirmResponse, tags=["admin"])
async def delete_organization(
    _: Annotated[None, Depends(role_required(Role.ADMIN))],
    organization_id: str,
    confirm_hash: str = Query(default="", description="Hash to confirm deletion")
):
    org = await Organization.get(organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    expected_hash = hashlib.sha256(org.name.encode("utf-8")).hexdigest()
    
    if not confirm_hash:
        # Return confirmation message with hash preview
        return DeleteOrgConfirmResponse(
            message="Please confirm deletion by providing the hash of the organization name.",
            org_name_hash=expected_hash
        )

    if confirm_hash != expected_hash:
        raise HTTPException(status_code=400, detail="Invalid confirmation hash")

    await User.find({"organization_id": org.id}).delete_many()
    await Invitation.find({"organization_id": org.id}).delete_many()
    await org.delete()
    await drop_org_db(str(org.id))

    return MessageResponse(message="Organization deleted successfully")


# ------------------------------
# USER ENDPOINTS
# ------------------------------

@router.post("/admin/add_user", response_model=MessageResponse, tags=["admin"])
async def add_user(
    data: UserCreate,
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))]
):
    user_context = current_user_context.get()

    requester = await User.get(user_context.user_id)
    if not requester:
        raise HTTPException(status_code=404, detail="Requester not found")

    if requester.role == Role.ORG_ADMIN:
        organization_id = requester.organization_id
    elif requester.role == Role.ADMIN and not data.organization_id:
        organization_id = None
    else:
        if not data.organization_id:
            raise HTTPException(status_code=400, detail="Organization ID is required")
        organization_id = PydanticObjectId(data.organization_id)

    if organization_id is not None:
        org_obj = await Organization.get(organization_id)
        if not org_obj:
            raise HTTPException(status_code=404, detail="Organization not found")

    existing_user = await User.find_one({"email": data.email.lower(), "organization_id": organization_id})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists in the organization")

    hashed_pw = pwd_context.hash(data.password)

    user = User(
        email=data.email,
        hashed_password=hashed_pw,
        name=data.name,
        role=data.role,
        organization_id=organization_id,
    )

    await user.insert()
    return MessageResponse(message=f"User {data.email} added successfully")


@router.get("/admin/users", response_model=List[UserResponse], tags=["admin"])
async def list_users(
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))],
    organization_id: Optional[str] = Query(None),
    skip: Optional[int] = Query(0, ge=0),
    limit: Optional[int] = Query(10, ge=1, le=100)
):
    user_ctx = current_user_context.get()

    query = {}

    if user_ctx.role == Role.ORG_ADMIN:
        query["organization_id"] = PydanticObjectId(user_ctx.organization_id)
    elif organization_id:
        query["organization_id"] = PydanticObjectId(organization_id)
    else:
        query["role"] = "ADMIN"

    users = await User.find(query).skip(skip).limit(limit).to_list()

    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            name=u.name,
            role=u.role,
            organization_id=str((await Organization.get(u.organization_id)).name) if u.organization_id else None
        ) for u in users
    ]


@router.get("/admin/users/{user_id}", response_model=UserResponse, tags=["admin"])
async def get_user(
    user_id: str,
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))]
):
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_ctx = current_user_context.get()

    if user_ctx.role == Role.ORG_ADMIN and str(user.organization_id) != user_ctx.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this user")

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        organization_id=str(user.organization_id)
    )


@router.patch("/admin/users/{user_id}", response_model=UserResponse, tags=["admin"])
async def update_user(
    user_id: str,
    data: UserUpdate,
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))]
):
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_ctx = current_user_context.get()

    if user_ctx.role == Role.ORG_ADMIN and str(user.organization_id) != user_ctx.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")

    if data.email is not None:
        user.email = data.email
    if data.name is not None:
        user.name = data.name
    if data.role is not None:
        user.role = data.role
    if data.organization_id is not None:
        if user_ctx.role != Role.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can change user organization")
        user.organization_id = PydanticObjectId(data.organization_id) if data.organization_id else None
    if data.password is not None:
        user.hashed_password = pwd_context.hash(data.password)

    await user.save()

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        organization_id=str(user.organization_id)

    )


@router.delete("/admin/users/{user_id}", response_model=MessageResponse, tags=["admin"])
async def delete_user(
    user_id: str,
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))]
):
    user = await User.get(PydanticObjectId(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_ctx = current_user_context.get()

    if user_ctx.role == Role.ORG_ADMIN and str(user.organization_id) != user_ctx.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this user")

    await user.delete()
    return MessageResponse(message="User deleted successfully")


# ------------------------------
# INVITATION ENDPOINTS
# ------------------------------

@router.post("/admin/invite_user", response_model=InvitationResponse, tags=["admin"])
async def invite_user(
    request: Request,
    data: InviteUserCreate,
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))],
    __: Annotated[None, Depends(turnstile_guard)] = None,
):
    user_context = current_user_context.get()

    requester = await User.get(user_context.user_id)
    if not requester:
        raise HTTPException(status_code=404, detail="Requester not found")

    try:
        user_role = Role(user_context.role)
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid user role")

    if user_role == Role.ORG_ADMIN and data.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="ORG_ADMIN cannot invite ADMIN users")

    if user_role == Role.ORG_ADMIN:
        organization_id = requester.organization_id
    else:
        if not data.organization_id:
            raise HTTPException(status_code=400, detail="Organization ID is required")
        organization_id = PydanticObjectId(data.organization_id)

    org_obj = await Organization.get(organization_id)
    if not org_obj:
        raise HTTPException(status_code=404, detail="Organization not found")

    existing_user = await User.find_one({"email": data.email.lower(), "organization_id": organization_id})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists in the organization")

    expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=data.expires_in_seconds)

    invitation = Invitation(
        organization_id=organization_id,
        invited_by=requester.id,
        expires_at=expires_at,
        role=data.role,
    )
    await invitation.insert()

    # Send invitation email
    if settings.EMAIL_ENABLED:
        try:
            invitation_link = f"{settings.FRONTEND_BASE_URL}/signup?invitation_id={invitation.id}"
            html_body, text_body = render_invitation_email(
                org_name=org_obj.name,
                inviter_name=requester.name or requester.email,
                role=data.role.value,
                invitation_link=invitation_link,
                expires_at=expires_at
            )

            email_service = get_email_service()
            await email_service.send_email(
                to=data.email,
                subject=f"Invitation to join {org_obj.name}",
                html_body=html_body,
                text_body=text_body
            )
        except Exception as e:
            # Log error but don't fail the invitation creation
            logger.error(f"Failed to send invitation email: {str(e)}")

    return InvitationResponse(
        message=f"Invitation sent to {data.email}",
        invitation_id=str(invitation.id)
    )


@router.get("/admin/invitations", response_model=List[InvitationListResponse], tags=["admin"])
async def list_invitations(
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))],
    organization_id: Optional[str] = Query(None),
    skip: Optional[int] = Query(0, ge=0),
    limit: Optional[int] = Query(10, ge=1, le=100)
):
    user_ctx = current_user_context.get()

    query = {}
    if user_ctx.role == Role.ORG_ADMIN:
        query["organization_id"] = PydanticObjectId(user_ctx.organization_id)
    elif organization_id:
        query["organization_id"] = PydanticObjectId(organization_id)
    else:
        query["role"] = Role.ADMIN

    invitations = await Invitation.find(query).skip(skip).limit(limit).to_list()

    return [
        InvitationListResponse(
            id=str(i.id),
            organization_id=str((await Organization.get(i.organization_id)).name) if i.organization_id else None,
            invited_by=str((await User.get(i.invited_by)).name) if i.invited_by else None,
            invited_at=i.invited_at,
            expires_at=i.expires_at,
            role=i.role,
            accepted=i.accepted,
        )
        for i in invitations
    ]


@router.delete("/admin/invitations/{invitation_id}", response_model=MessageResponse, tags=["admin"])
async def delete_invitation(
    invitation_id: str,
    _: Annotated[None, Depends(role_required(Role.ADMIN, Role.ORG_ADMIN))]
):
    invitation = await Invitation.get(PydanticObjectId(invitation_id))
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    user_ctx = current_user_context.get()

    if user_ctx.role == Role.ORG_ADMIN and str(invitation.organization_id) != user_ctx.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this invitation")

    await invitation.delete()
    return MessageResponse(message="Invitation deleted successfully")


# ------------------------------
# PASSWORD RESET ENDPOINTS
# ------------------------------

@router.post("/forgotPassword", response_model=MessageResponse, tags=["system"])
@limiter.limit(FORGOT_PW_RATE_LIMIT)
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    _ = Depends(turnstile_guard),
):
    """Request password reset email"""
    import asyncio
    import secrets
    from hashlib import sha256

    user = await User.find_one({"email": data.email.lower()})

    # Always do expensive operations to prevent timing attacks
    raw_token = secrets.token_urlsafe(32)
    hashed_token = sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=1)

    if user:
        # Delete existing tokens for this user
        await PasswordResetToken.find({"user_id": user.id}).delete()

        # Create new token (expires in 1 hour)
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=hashed_token,
            expires_at=expires_at
        )
        await reset_token.insert()

        # Send email
        if settings.EMAIL_ENABLED:
            try:
                reset_link = f"{settings.FRONTEND_BASE_URL}/reset-password?token={raw_token}"
                html_body, text_body = render_password_reset_email(
                    user_name=user.name or user.email,
                    reset_link=reset_link,
                    expires_at=expires_at
                )

                email_service = get_email_service()
                await email_service.send_email(
                    to=user.email,
                    subject="Password Reset Request",
                    html_body=html_body,
                    text_body=text_body
                )
            except Exception as e:
                logger.error(f"Failed to send password reset email: {str(e)}")

    # Equalize timing for both existing and non-existing emails to prevent enumeration
    await asyncio.sleep(0.3)

    # Always return success to prevent email enumeration
    return MessageResponse(message="If the email exists, a reset link has been sent")


@router.post("/resetPassword", response_model=MessageResponse, tags=["system"])
@limiter.limit(RESET_PW_RATE_LIMIT)
async def reset_password(request: Request, data: ResetPasswordRequest):
    """Reset password using token"""
    from hashlib import sha256

    hashed_token = sha256(data.token.encode()).hexdigest()

    # Find valid token
    token_obj = await PasswordResetToken.find_one({
        "token": hashed_token,
        "used": False,
        "expires_at": {"$gt": datetime.now(tz=timezone.utc)}
    })

    if not token_obj:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Get user and update password
    user = await User.get(token_obj.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = pwd_context.hash(data.new_password)
    await user.save()

    # Mark token as used
    token_obj.used = True
    await token_obj.save()

    return MessageResponse(message="Password reset successfully")


@router.post("/changePassword", response_model=MessageResponse, tags=["system"])
async def change_password(
    data: ChangePasswordRequest,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN, Role.RO_USER))]
):
    """Change password for authenticated user"""
    user_context = current_user_context.get()

    user = await User.get(user_context.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    if not user.hashed_password or not pwd_context.verify(data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Update password
    user.hashed_password = pwd_context.hash(data.new_password)
    await user.save()

    return MessageResponse(message="Password changed successfully")


# ------------------------------
# SIGNUP / SIGNIN ENDPOINTS
# ------------------------------

@router.post("/signup", response_model=SignupResponse, tags=["system"])
@limiter.limit(SIGNUP_RATE_LIMIT)
async def signup(
    request: Request,
    data: UserCreate,
    background_tasks: BackgroundTasks,
    _ = Depends(turnstile_guard),
    organization_name: Optional[str] = None,
    load_mock_data: Optional[bool] = None
):

    # Check if user already exists
    existing_user = await User.find_one({"email": data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=409, detail="User already exists in the organization")

    
    if not settings.OPEN_REGISTRATION and not data.invitation_id:
        raise HTTPException(status_code=409, detail="Open registration is disabled. Invitation ID is required.")

    if settings.OPEN_REGISTRATION and not data.invitation_id:
        if not organization_name:
            raise HTTPException(status_code=400, detail="Organization name is required for signup with open registration")

        # Check if organization already exists
        existing_org = await Organization.find_one({"name": organization_name})
        if existing_org:
            raise HTTPException(status_code=400, detail="Organization name already exists")

        # Resolve default tier if configured
        default_tier_id = None
        if settings.DEFAULT_TIER_CODE:
            default_tier = await Tier.find_one({"code": settings.DEFAULT_TIER_CODE})
            if default_tier:
                default_tier_id = default_tier.id
            else:
                logger.warning(f"DEFAULT_TIER_CODE '{settings.DEFAULT_TIER_CODE}' not found in database, skipping tier assignment")

        # Assign org-specific database URL if MONGO_USE_ORG_DB is enabled
        mongo_url = assign_org_db() if use_org_db_mode else None

        # Create new organization
        organization = Organization(
            name=organization_name,
            code=organization_name.lower().replace(" ", "_"),
            description=f"Organization for {data.name}",
            status="PROVISIONING",
            tier_id=default_tier_id,
            mongo_url=encrypt_connection_url(mongo_url) if mongo_url else None
        )
        await organization.insert()
        
        from instacrud.api.provisioning import provision_organization_task
        background_tasks.add_task(
            provision_organization_task,
            str(organization.id),
            mongo_url,
            firestore_mode,
            bool(load_mock_data)
        )

        organization_id = organization.id
        user_role = Role.ORG_ADMIN

    elif data.invitation_id:
        invitation = await Invitation.get(PydanticObjectId(data.invitation_id))
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")

        if invitation.expires_at < datetime.now(tz=timezone.utc):
            raise HTTPException(status_code=401, detail="Invitation has expired")

        if invitation.accepted:
            raise HTTPException(status_code=401, detail="Invitation has already been accepted")

        organization_id = invitation.organization_id
        user_role = invitation.role

    else:
        if not data.invitation_id:
            raise HTTPException(status_code=400, detail="Invitation ID is required for signup")

    hashed_pw = pwd_context.hash(data.password)

    user = User(
        email=data.email,
        hashed_password=hashed_pw,
        name=data.name,
        role=user_role,
        organization_id=organization_id,
    )

    await user.insert()

    if data.invitation_id:
        invitation.accepted = True
        await invitation.save()

    return SignupResponse(
        message="User signed up successfully",
        user_id=str(user.id)
    )

@router.post("/signin", response_model=TokenResponse, tags=["system"])
@limiter.limit(SIGNIN_RATE_LIMIT)
async def signin(
    request: Request,
    data: SignInRequest,
    _ = Depends(turnstile_guard),
):
    user = await User.find_one({"email": data.email.lower()})

    # Always verify password to maintain constant time across all paths
    if user and user.hashed_password:
        password_valid = pwd_context.verify(data.password, user.hashed_password)
    else:
        pwd_context.verify(data.password, DUMMY_PASSWORD_HASH)
        password_valid = False

    # Add a fixed delay to equalize timing across all paths
    await asyncio.sleep(0.3)

    # Check authentication results after timing equalization
    if not user or not password_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Get organization's tier if user has an organization
    organization_id = None
    tier_level = None
    tier_name = None
    if user.organization_id:
        organization_id = str(user.organization_id)
        org = await Organization.get(user.organization_id)
        if org and org.tier_id:
            tier = await Tier.get(org.tier_id)
            if tier:
                tier_level = tier.tier
                tier_name = tier.name

    expiration = datetime.now(tz=timezone.utc) + timedelta(seconds=TOKEN_EXPIRATION_SECONDS)
    token_data = {
        "user_id": str(user.id),
        "name": user.name,
        "email": user.email,
        "organization_id": organization_id,
        "role": user.role.value,
        "exp": expiration,
        "tier": tier_level,
        "tier_name": tier_name,
        "has_password": bool(user.hashed_password),
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=TOKEN_EXPIRATION_SECONDS
    )

@router.get("/heartbeat", response_model=MessageResponse, tags=["system"])
async def heartbeat():
    # user_ctx = current_user_context.get()
    # logger.trace("heartbeat: username: %s", user_ctx.email)
    return MessageResponse(message="ok")


# ------------------------------
# SETTINGS ENDPOINTS
# ------------------------------

@router.get("/getSettings", response_model=Dict[str, Any], tags=["system"])
async def get_settings():
    public_fields = [
        "OPEN_REGISTRATION",
        "TURNSTILE_ENABLED",
        "TURNSTILE_SITE_KEY",
        "TURNSTILE_MODE",
        "SUGGEST_LOADING_MOCK_DATA",
        "SUGGEST_LOADING_MOCK_DATA_DEFAULT",
    ]

    settings_dict = {}
    for field in public_fields:
        if hasattr(settings, field):
            settings_dict[field] = getattr(settings, field)

    # Add effective local_only_conversations setting for authenticated users
    user_ctx = current_user_context.get()
    if user_ctx and user_ctx.user_id:
        user = await User.get(user_ctx.user_id)
        org = None
        if user and user.organization_id:
            org = await Organization.get(user.organization_id)

        org_local_only = org.local_only_conversations if org else False
        if user:
            effective_local_only = user.local_only_conversations if user.local_only_conversations is not None else org_local_only
        else:
            effective_local_only = org_local_only

        settings_dict["local_only_conversations"] = effective_local_only

    return settings_dict


@router.get("/user-settings", response_model=UserSettingsResponse, tags=["system"])
async def get_user_settings(
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN, Role.RO_USER))]
):
    """Get current user's sync settings with effective values."""
    user_ctx = current_user_context.get()
    user = await User.get(user_ctx.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    org = None
    if user.organization_id:
        org = await Organization.get(user.organization_id)

    org_local_only = org.local_only_conversations if org else False
    effective_local_only = user.local_only_conversations if user.local_only_conversations is not None else org_local_only

    return UserSettingsResponse(
        local_only_conversations=effective_local_only,
        user_local_only_conversations=user.local_only_conversations,
    )


@router.patch("/user-settings", response_model=UserSettingsResponse, tags=["system"])
async def update_user_settings(
    data: UserSettingsUpdate,
    _: Annotated[None, Depends(role_required(Role.USER, Role.ORG_ADMIN, Role.ADMIN, Role.RO_USER))]
):
    """Update current user's sync settings."""
    user_ctx = current_user_context.get()
    user = await User.get(user_ctx.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if "local_only_conversations" in data.model_fields_set:
        user.local_only_conversations = data.local_only_conversations

    await user.save()

    org = None
    if user.organization_id:
        org = await Organization.get(user.organization_id)

    org_local_only = org.local_only_conversations if org else False
    effective_local_only = user.local_only_conversations if user.local_only_conversations is not None else org_local_only

    return UserSettingsResponse(
        local_only_conversations=effective_local_only,
        user_local_only_conversations=user.local_only_conversations,
    )


# ------------------------------
# AI MODEL CRUD (ADMIN only)
# ------------------------------
router.include_router(
    create_crud_router(AiModel, write_roles=[Role.ADMIN]),
    prefix="/admin/ai-models",
    tags=["admin", "ai-models"]
)

# ------------------------------
# TIER CRUD (ADMIN only)
# ------------------------------
router.include_router(
    create_crud_router(Tier, write_roles=[Role.ADMIN]),
    prefix="/admin/tiers",
    tags=["admin", "tiers"]
)