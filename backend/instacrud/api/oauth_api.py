# api/oauth_api.py

from datetime import datetime, timedelta, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Request, HTTPException, Query, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from loguru import logger
from authlib.integrations.starlette_client import OAuth
from authlib.jose import JsonWebToken
from authlib.jose.errors import JoseError
import jwt
import json
import base64
import secrets
import re
from typing import Optional
from uuid import UUID
from urllib.parse import urlencode
from starlette.responses import RedirectResponse
import httpx

from instacrud.config import settings
from instacrud.crypto import encrypt_connection_url
from instacrud.model.system_model import OAuthSession, User, Invitation, Organization, Tier, Role
from instacrud.api.system_dto import TokenResponse
from instacrud.context import current_user_context
from instacrud.api.api_utils import (SECRET_KEY, ALGORITHM, TOKEN_EXPIRATION_SECONDS, GOOGLE_CLIENT_ID,
                                     GOOGLE_CLIENT_SECRET, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID,
                                     FRONTEND_BASE_URL, role_required)

SESSION_EXPIRATION_SECONDS = 24 * 60 * 60  # 24 hours
LINK_EXPIRATION_SECONDS = 10 * 60
OAUTH_SIGNIN = "/signin"
OAUTH_SIGNUP = "/signup"
OAUTH_CALLBACK = "/oauth/callback"

router = APIRouter(tags=["oauth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    Validate a Microsoft ID token against the signing keys and tenant issuer.
    The common endpoint signs for many tenants, so its issuer is tenant-specific.
    """
    if not MS_CLIENT_ID:
        raise ValueError("Microsoft OAuth is not configured")
    unverified = jwt.decode(id_token, options={"verify_signature": False})
    tenant_id = unverified.get("tid", "")
    try:
        tenant_id = str(UUID(tenant_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ValueError("Invalid Microsoft tenant") from exc
    if MS_TENANT_ID not in ("common", "organizations", "consumers"):
        # A configured tenant ID must not accept tokens from other tenants.
        try:
            if str(UUID(MS_TENANT_ID)) != tenant_id:
                raise ValueError("Microsoft tenant mismatch")
        except (TypeError, AttributeError) as exc:
            raise ValueError("Invalid configured Microsoft tenant") from exc

    async with httpx.AsyncClient() as http:
        jwks_resp = await http.get("https://login.microsoftonline.com/common/discovery/v2.0/keys")
        jwks_resp.raise_for_status()
        jwks = jwks_resp.json()

    jwt_obj = JsonWebToken(["RS256"])
    claims = jwt_obj.decode(
        id_token,
        jwks,
        claims_options={
            "aud": {"essential": True, "value": MS_CLIENT_ID},
            "exp": {"essential": True},
            "iss": {"essential": True, "value": f"https://login.microsoftonline.com/{tenant_id}/v2.0"},
            "tid": {"essential": True, "value": tenant_id},
            "sub": {"essential": True},
        },
    )
    claims.validate()
    return claims


async def verified_oauth_identity(provider: str, token: dict) -> tuple[str, str, str | None]:
    """Return an email for display and a stable, provider-scoped account key."""
    if provider == "microsoft":
        id_token = token.get("id_token")
        if not id_token:
            raise ValueError("Missing Microsoft ID token")
        claims = await decode_microsoft_id_token(id_token)
        tenant_id = claims.get("tid")
        subject = claims.get("oid") or claims.get("sub")
        if not tenant_id or not subject:
            raise ValueError("Missing Microsoft subject")
        email = (claims.get("email") or claims.get("preferred_username") or "").lower()
        return email, f"{tenant_id}:{subject}", claims.get("name")
    if provider == "google":
        # authorize_access_token parses and validates the Google ID token.
        claims = token.get("userinfo")
        if not token.get("id_token") or not claims or claims.get("email_verified") is not True:
            raise ValueError("Google email is not verified")
        subject = claims.get("sub")
        if not subject:
            raise ValueError("Missing Google subject")
        return (claims.get("email") or "").lower(), subject, claims.get("name")
    raise ValueError("Unknown OAuth provider")

# ----------------------------
# OAuth LOGIN FLOW (sign in only)
# ----------------------------

@router.get("/session", response_model=TokenResponse)
async def get_session_token(session_code: str = Query(...)):
    session = await OAuthSession.get_pymongo_collection().find_one_and_delete({
        "session_code": session_code,
        "purpose": "signin",
        "expires_at": {"$gt": datetime.now(tz=timezone.utc)}
    })
    if not session:
        raise HTTPException(401, detail="Invalid or expired session code")

    token = session["token"]

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=TOKEN_EXPIRATION_SECONDS
    )

@router.get("/signin/{provider}", name="oauth_login", response_class=RedirectResponse)
async def oauth_login(provider: str, request: Request, link_intent: str | None = None):
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(400, f"OAuth provider '{provider}' not configured.")
    if link_intent:
        if not re.fullmatch(r"[a-f0-9]{32,64}", link_intent):
            raise HTTPException(400, "Invalid link intent")
        request.session["oauth_link_intent"] = link_intent
    redirect_uri = request.url_for("oauth_login_callback", provider=provider)
    return await client.authorize_redirect(request, redirect_uri)

@router.get("/signin/{provider}/callback", name="oauth_login_callback", response_model=TokenResponse)
async def oauth_login_callback(provider: str, request: Request):
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(
        request,
        claims_options={"iss": {"essential": False}}
    )

    try:
        email, subject, _ = await verified_oauth_identity(provider, token)
    except (JoseError, ValueError, jwt.InvalidTokenError):
        return redirect_with_message("error", "OAuth identity verification failed.", path=OAUTH_SIGNIN)
    if not email:
        return redirect_with_message("error", "OAuth identity verification failed.", path=OAUTH_SIGNIN)

    # An email address is mutable and is not proof that this is the same person.
    # Only a previously linked, immutable provider subject may sign in.
    user = await User.find_one({f"oauth_identities.{provider}": subject})
    if not user:
        existing = await User.find_one({"email": email})
        link_intent = request.session.pop("oauth_link_intent", None)
        if not existing or not link_intent:
            return redirect_with_message("error", "OAuth identity is not linked to an account.", path=OAUTH_SIGNIN)
        link_code = secrets.token_urlsafe(32)
        await OAuthSession(
            session_code=link_code,
            purpose="link",
            token=json.dumps({"provider": provider, "subject": subject, "email": email}),
            expires_at=datetime.now(tz=timezone.utc) + timedelta(seconds=LINK_EXPIRATION_SECONDS),
        ).insert()
        query = urlencode({"oauth_link_code": link_code, "link_intent": link_intent,
                           "provider": provider})
        return RedirectResponse(f"{FRONTEND_BASE_URL}{OAUTH_SIGNIN}?{query}")

    request.session.pop("oauth_link_intent", None)

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
        "auth_version": user.auth_version,
    }
    jwt_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    session_code = secrets.token_urlsafe(16)
    expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=SESSION_EXPIRATION_SECONDS)

    await OAuthSession(
        session_code=session_code,
        token=jwt_token,
        purpose="signin",
        expires_at=expires_at
    ).insert()

    frontend_redirect = f"{FRONTEND_BASE_URL}{OAUTH_CALLBACK}?session_code={session_code}"
    return RedirectResponse(url=frontend_redirect)


class OAuthLinkRequest(BaseModel):
    link_code: str = Field(min_length=20, max_length=128)
    current_password: str


@router.post("/oauth/link", tags=["oauth"])
async def link_oauth_identity(
    data: OAuthLinkRequest,
    _: None = Depends(role_required(Role.ADMIN, Role.ORG_ADMIN, Role.USER, Role.RO_USER)),
):
    """Link an OAuth subject to the account authenticated by a fresh password login."""
    ctx = current_user_context.get()
    user = await User.get(ctx.user_id)
    if not user or not user.hashed_password or not pwd_context.verify(
        data.current_password, user.hashed_password
    ):
        raise HTTPException(403, "Password confirmation required")
    session = await OAuthSession.get_pymongo_collection().find_one_and_delete({
        "session_code": data.link_code,
        "purpose": "link",
        "expires_at": {"$gt": datetime.now(tz=timezone.utc)},
    })
    if not session:
        raise HTTPException(400, "Invalid or expired link code")
    identity = json.loads(session["token"])
    provider = identity.get("provider")
    subject = identity.get("subject")
    if (provider not in {"google", "microsoft"} or not subject
            or identity.get("email") != ctx.email.lower()):
        raise HTTPException(403, "OAuth identity does not match this account")
    linked = await User.find_one({f"oauth_identities.{provider}": subject})
    if linked and linked.id != ctx.user_id:
        raise HTTPException(409, "OAuth identity is already linked")
    await User.get_pymongo_collection().update_one(
        {"_id": ctx.user_id},
        {"$set": {f"oauth_identities.{provider}": subject}},
    )
    return {"message": "OAuth identity linked"}

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

    try:
        email, subject, name = await verified_oauth_identity(provider, token)
    except (JoseError, ValueError, jwt.InvalidTokenError):
        return redirect_with_message("error", "OAuth identity verification failed.")

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
        try:
            invitation = await Invitation.get(PydanticObjectId(invitation_id))
        except (ValueError, TypeError):
            return redirect_with_message("error", "Invalid invitation")
        if not invitation:
            return redirect_with_message("error", "Invitation not found")

        if not invitation.email or invitation.email.lower() != email:
            return redirect_with_message("error", "Invitation is for a different email")

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
        organization_id=organization_id,
        oauth_identities={provider: subject},
    )
    if invitation_id:
        claimed = await Invitation.get_pymongo_collection().find_one_and_update(
            {"_id": invitation.id, "email": email, "accepted": False,
             "expires_at": {"$gt": datetime.now(tz=timezone.utc)}},
            {"$set": {"accepted": True}},
        )
        if not claimed:
            return redirect_with_message("error", "Invalid or used invitation")
    try:
        await user.insert()
    except Exception:
        if invitation_id:
            await Invitation.get_pymongo_collection().update_one(
                {"_id": invitation.id}, {"$set": {"accepted": False}}
            )
        raise

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
