# api/oauth_api.py

from datetime import datetime, timedelta, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Request, HTTPException, Query, BackgroundTasks
from loguru import logger
from authlib.integrations.starlette_client import OAuth
from authlib.jose import JsonWebToken
from authlib.jose.errors import JoseError
import jwt
import json
import base64
import secrets
from typing import Optional
from starlette.responses import RedirectResponse
import httpx

from instacrud.config import settings
from instacrud.crypto import encrypt_connection_url
from instacrud.model.system_model import OAuthSession, User, Invitation, Organization, Tier, Role
from instacrud.api.system_dto import TokenResponse
from instacrud.api.api_utils import (SECRET_KEY, ALGORITHM, TOKEN_EXPIRATION_SECONDS, GOOGLE_CLIENT_ID,
                                     GOOGLE_CLIENT_SECRET, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID,
                                     FRONTEND_BASE_URL)

SESSION_EXPIRATION_SECONDS = 24 * 60 * 60  # 24 hours
OAUTH_SIGNIN = "/signin"
OAUTH_SIGNUP = "/signup"
OAUTH_CALLBACK = "/oauth/callback"

router = APIRouter(tags=["oauth"])

# OAuth setup
oauth = OAuth()

oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

oauth.register(
    name='microsoft',
    client_id=MS_CLIENT_ID,
    client_secret=MS_CLIENT_SECRET,
    server_metadata_url=f'https://login.microsoftonline.com/{MS_TENANT_ID}/v2.0/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# ----------------------------
# Helper for decoding Microsoft id_token
# ----------------------------

async def decode_microsoft_id_token(id_token: str) -> dict:
    """
    Decode Microsoft id_token manually to avoid `iss` validation errors in multi-tenant scenario.
    Validates `aud` and `exp` only.
    """
    async with httpx.AsyncClient() as http:
        jwks_resp = await http.get("https://login.microsoftonline.com/common/discovery/v2.0/keys")
        jwks = jwks_resp.json()

    jwt_obj = JsonWebToken(["RS256"])
    claims = jwt_obj.decode(
        id_token,
        jwks,
        claims_options={
            "aud": {"essential": True, "value": MS_CLIENT_ID},
            "exp": {"essential": True},
            # Skip 'iss' validation
        },
    )
    claims.validate()
    return claims

# ----------------------------
# OAuth LOGIN FLOW (sign in only)
# ----------------------------

@router.get("/session", response_model=TokenResponse)
async def get_session_token(session_code: str = Query(...)):
    session = await OAuthSession.find_one({
        "session_code": session_code,
        "expires_at": {"$gt": datetime.now(tz=timezone.utc)}
    })
    if not session:
        raise HTTPException(401, detail="Invalid or expired session code")

    token = session.token
    # enforce one-time use
    await session.delete()

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=TOKEN_EXPIRATION_SECONDS
    )

@router.get("/signin/{provider}", name="oauth_login", response_class=RedirectResponse)
async def oauth_login(provider: str, request: Request):
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(400, f"OAuth provider '{provider}' not configured.")
    redirect_uri = request.url_for("oauth_login_callback", provider=provider)
    return await client.authorize_redirect(request, redirect_uri)

@router.get("/signin/{provider}/callback", name="oauth_login_callback", response_model=TokenResponse)
async def oauth_login_callback(provider: str, request: Request):
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(
        request,
        claims_options={"iss": {"essential": False}}
    )

    if provider == "microsoft":
        id_token = token.get("id_token")
        if not id_token:
            return redirect_with_message("error", "No id_token in response", path=OAUTH_SIGNIN)
        try:
            claims = await decode_microsoft_id_token(id_token)
        except JoseError as exc:
            return redirect_with_message("error", f"Invalid ID token: {exc}", path=OAUTH_SIGNIN)
        email = (claims.get("email") or claims.get("preferred_username") or "").lower()
    else:
        user_info = token.get("userinfo") or await client.userinfo(token=token)
        email = user_info.get("email", "").lower()

    if not email:
        # raise HTTPException(400, "OAuth login failed: email not returned.")
        return redirect_with_message("error", "OAuth login failed: email not returned.", path=OAUTH_SIGNIN)

    user = await User.find_one({"email": email})
    if not user:
        # raise HTTPException(401, "No account found for this email.")
        return redirect_with_message("error", "No account found for this email.", path=OAUTH_SIGNIN)

    expiration = datetime.now(tz=timezone.utc) + timedelta(seconds=TOKEN_EXPIRATION_SECONDS)
    org_tier = await get_organization_tier(user.organization_id)
    token_data = {
        "user_id": str(user.id),
        "name": user.name,
        "email": user.email,
        **({"organization_id": str(user.organization_id)} if user.organization_id else {}),
        **({"tier": org_tier} if org_tier is not None else {}),
        "role": user.role.value,
        "exp": expiration,
        "has_password": bool(user.hashed_password),
    }
    jwt_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    session_code = secrets.token_urlsafe(16)
    expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=SESSION_EXPIRATION_SECONDS)

    await OAuthSession(
        session_code=session_code,
        token=jwt_token,
        expires_at=expires_at
    ).insert()

    frontend_redirect = f"{FRONTEND_BASE_URL}{OAUTH_CALLBACK}?session_code={session_code}"
    return RedirectResponse(url=frontend_redirect)

# ----------------------------
# OAuth SIGNUP FLOW (invited)
# ----------------------------

@router.get("/signup/{provider}", name="oauth_signup")
async def oauth_signup_start(provider: str, request: Request, state: Optional[str] = None):
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(400, f"OAuth provider '{provider}' not configured.")
    redirect_uri = request.url_for("oauth_signup_callback", provider=provider)
    return await client.authorize_redirect(request, redirect_uri, state=state)

@router.get("/signup/{provider}/callback", name="oauth_signup_callback", response_model=TokenResponse)
async def oauth_signup_callback(provider: str, request: Request, background_tasks: BackgroundTasks):
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(
        request,
        claims_options={"iss": {"essential": False}}
    )

    if provider == "microsoft":
        id_token = token.get("id_token")
        if not id_token:
            return redirect_with_message("error", "No id_token in response", path=OAUTH_SIGNUP)
        try:
            claims = await decode_microsoft_id_token(id_token)
        except JoseError as exc:
            return redirect_with_message("error", f"Invalid ID token: {exc}", path=OAUTH_SIGNUP)
        email = (claims.get("email") or claims.get("preferred_username") or "").lower()
        name = claims.get("name") or claims.get("preferred_username")
    else:
        user_info = token.get("userinfo") or await client.userinfo(token=token)
        email = user_info.get("email").lower()
        name = user_info.get("name") or user_info.get("preferred_username")

    if not email:
        # raise HTTPException(400, "OAuth sign-up failed: email not returned.")
        return redirect_with_message("error", "Error signing up user. Please try again.")

    # Read state to get invitation_id, organization_name, load_mock_data
    state = request.query_params.get("state")
    invitation_id = None
    organization_name = None
    load_mock_data = settings.SUGGEST_LOADING_MOCK_DATA_DEFAULT

    if state:
        try:
            # The state might be just a random string if oauth_signup_start was called without a state.
            decoded = json.loads(base64.b64decode(state).decode('utf-8'))
            invitation_id = decoded.get("invitation_id")
            organization_name = decoded.get("organization_name")
            load_mock_data = decoded.get("load_mock_data", settings.SUGGEST_LOADING_MOCK_DATA_DEFAULT)
        except Exception:
            # If it's not our valid base64 JSON, we just treat it as no extra data was passed.
            pass

    # Check if user already exists
    user = await User.find_one({"email": email})
    if user:
        return redirect_with_message("error", "Account already exists. Please sign in instead.")

    if invitation_id:
        invitation = await Invitation.get(PydanticObjectId(invitation_id))
        if not invitation:
            return redirect_with_message("error", "Invitation not found")

        if invitation.expires_at < datetime.now(tz=timezone.utc):
            return redirect_with_message("error", "Invitation has expired")

        if invitation.accepted:
            return redirect_with_message("error", "Invitation has already been accepted")

        organization_id = invitation.organization_id
        user_role = invitation.role

    else:
        # Open Registration flow
        if not settings.OPEN_REGISTRATION:
            return redirect_with_message("error", "Open registration is disabled. Invitation ID is required.")

        # Generate organization name if empty
        if not organization_name:
            if not name:
                name_for_org = email.split('@')[0]
            else:
                name_for_org = name
            organization_name = f"{name_for_org}'s Team"

        # Check if organization already exists
        existing_org = await Organization.find_one({"name": organization_name})
        if existing_org:
            return redirect_with_message("error", "Organization name already exists")

        organization_code = organization_name.lower().replace(" ", "_")

        # Check if organization code already exists
        existing_org = await Organization.find_one({"code": organization_code})
        if existing_org:
            return redirect_with_message("error", "Organization code already exists")

        # Resolve default tier if configured
        default_tier_id = None
        if settings.DEFAULT_TIER_CODE:
            default_tier = await Tier.find_one({"code": settings.DEFAULT_TIER_CODE})
            if default_tier:
                default_tier_id = default_tier.id
            else:
                logger.warning(f"DEFAULT_TIER_CODE '{settings.DEFAULT_TIER_CODE}' not found in database, skipping tier assignment")

        from instacrud.database import assign_org_db, assign_firestore_org_db, use_org_db_mode, init_org_db, firestore_mode, create_firestore_org_db
        # Assign org-specific database URL
        mongo_url = assign_org_db() if use_org_db_mode else None

        # Create new organization
        organization = Organization(
            name=organization_name,
            code=organization_code,
            description=f"Organization for {name}",
            status="PROVISIONING",
            tier_id=default_tier_id,
            mongo_url=encrypt_connection_url(mongo_url) if mongo_url else None
        )
        try:
            await organization.insert()
        except Exception as e:
            logger.error(f"Failed to create organization: {e}")
            return redirect_with_message("error", "Failed to create organization")

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

    # Create user
    user = User(
        email=email,
        name=name,
        role=user_role,
        organization_id=organization_id
    )
    await user.insert()

    if invitation_id:
        # Mark invitation as accepted
        invitation.accepted = True
        await invitation.save()

    return redirect_with_message("success", "User signed up successfully! Please sign in.", path=OAUTH_SIGNIN)

# ----------------------------
# Utility
# ----------------------------

def redirect_with_message(status: str, message: str, path: str = OAUTH_SIGNUP) -> RedirectResponse:
    from urllib.parse import urlencode
    query = urlencode({"status": status, "message": message})
    return RedirectResponse(f"{FRONTEND_BASE_URL}{path}?{query}")


async def get_organization_tier(organization_id: Optional[PydanticObjectId]) -> Optional[int]:
    """
    Get the numeric tier level for an organization.

    Returns:
        The numeric tier level or None if org has no tier assigned
    """
    if not organization_id:
        return None

    org = await Organization.get(organization_id)
    if not org or not org.tier_id:
        return None

    tier = await Tier.get(org.tier_id)
    return tier.tier if tier else None