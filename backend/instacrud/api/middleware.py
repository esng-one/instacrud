from fastapi import Request
from starlette.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from beanie import PydanticObjectId
import jwt
from loguru import logger

from instacrud.api.api_utils import (
    CORS_ALLOW_ORIGINS,
    CORS_ALLOW_CREDENTIALS,
    CORS_ALLOW_METHODS,
    CORS_ALLOW_HEADERS,
    PUBLIC_PATHS,
    SECRET_KEY,
    ALGORITHM,
)
from instacrud.config import settings

from instacrud.crypto import resolve_org_mongo_url
from instacrud.database import use_database, firestore_mode, use_org_db_mode
from instacrud.context import current_user_context, CurrentUserContext
from instacrud.model.system_model import Organization, Role, User


# =========================================================
# Heartbeat Guard Middleware
# =========================================================
class HeartbeatGuardMiddleware(BaseHTTPMiddleware):
    """
    Normalizes ALL heartbeat failures to 401/403 for expected auth decay.
    """
    async def dispatch(self, request: Request, call_next):
        if request.url.path != "/api/v1/heartbeat":
            return await call_next(request)

        try:
            return await call_next(request)

        except HTTPException as e:
            logger.debug(
                f"Heartbeat auth invalid: {e.detail} ({e.status_code})"
            )
            return JSONResponse(
                status_code=401 if e.status_code != 403 else 403,
                content={"detail": "Session expired"},
            )

        except Exception as e:
            logger.debug(f"Heartbeat unexpected failure: {e}")
            return JSONResponse(
                status_code=401,
                content={"detail": "Session expired"},
            )


async def switch_to_org_db(organization_id: str | None):
    """
    Switch Beanie to the correct database for this organization.
    Middleware owns the logic; database.py just manages connections.
    """
    if organization_id is None:
        # Admin with no org - use a "none" database
        if firestore_mode:
            # In Firestore mode, "_none" becomes "project#_none" which is invalid.
            # Use the system MONGO_URL so _none maps to the shared system DB.
            await use_database("_none", settings.MONGO_URL)
        else:
            await use_database("_none")
        return

    if firestore_mode:
        # Firestore: each org has its own mongo_url
        org = await Organization.get(PydanticObjectId(organization_id))
        if not org:
            raise HTTPException(status_code=400, detail=f"Organization '{organization_id}' not found")
        if not org.mongo_url:
            raise HTTPException(status_code=400, detail=f"Organization '{organization_id}' has no Mongo URL configured")
        
        mongo_url = await resolve_org_mongo_url(org)
        await use_database(f"firestore:{organization_id}", mongo_url)

    elif use_org_db_mode:
        # Org DB mode: use org's mongo_url if set, otherwise shared default
        org = await Organization.get(PydanticObjectId(organization_id))
        if not org:
            raise HTTPException(status_code=400, detail=f"Organization '{organization_id}' not found")
        if org.mongo_url:
            mongo_url = await resolve_org_mongo_url(org)
            await use_database(f"custom:{organization_id}", mongo_url)
        else:
            await use_database("_default")

    else:
        # Standard mode: one database per org, same mongo instance
        await use_database(organization_id)


# =========================================================
# Auth + Org DB Init Middleware (Pure ASGI for contextvar support)
# =========================================================
class DBInitMiddleware:
    """
    Pure ASGI middleware for authentication and database initialization.

    Using pure ASGI instead of BaseHTTPMiddleware to ensure contextvars
    propagate correctly to route handlers. BaseHTTPMiddleware spawns a
    separate task which loses contextvar state.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Skip for OPTIONS and public paths
        if scope["method"] == "OPTIONS":
            await self.app(scope, receive, send)
            return

        path = scope["path"]
        if path in PUBLIC_PATHS:
            await self.app(scope, receive, send)
            return

        # Extract Authorization header
        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization", b"").decode()

        if not auth_header or not auth_header.startswith("Bearer "):
            response = JSONResponse(
                status_code=401,
                content={"detail": "Authorization token required"},
            )
            await response(scope, receive, send)
            return

        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

            user_id = payload.get("user_id")
            email = payload.get("email")
            role = payload.get("role")
            organization_id = payload.get("organization_id")

            if not user_id or not email or not role:
                response = JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid token payload"},
                )
                await response(scope, receive, send)
                return

            logger.debug(
                f"Token decoded: user_id={user_id}, role={role}, "
                f"org={organization_id}, email={email}"
            )

            # Verify user exists in the database
            user = await User.get(PydanticObjectId(user_id))
            if not user:
                response = JSONResponse(
                    status_code=401,
                    content={"detail": "User not found"},
                )
                await response(scope, receive, send)
                return

            # Update context with fresh data from DB to enforce role/org demotions immediately
            role = user.role
            if organization_id and user.organization_id and str(user.organization_id) != organization_id:
                logger.warning(
                    f"Token org mismatch for user {user.email}: token={organization_id} db={user.organization_id}"
                )
            organization_id = str(user.organization_id) if user.organization_id else None

            # Initialize database context
            if role != Role.ADMIN:
                if not organization_id:
                    response = JSONResponse(
                        status_code=401,
                        content={"detail": "Organization ID required"},
                    )
                    await response(scope, receive, send)
                    return
                await switch_to_org_db(organization_id)
            else:
                await switch_to_org_db(organization_id)  # None for admin without org

            # Set user context
            current_user_context.set(
                CurrentUserContext(
                    user_id=PydanticObjectId(user_id),
                    email=email,
                    role=role,
                    organization_id=organization_id,
                )
            )

        except jwt.ExpiredSignatureError:
            response = JSONResponse(
                status_code=401,
                content={"detail": "Token has expired"},
            )
            await response(scope, receive, send)
            return
        except jwt.InvalidTokenError:
            response = JSONResponse(
                status_code=401,
                content={"detail": "Invalid token"},
            )
            await response(scope, receive, send)
            return
        except HTTPException as e:
            response = JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail},
            )
            await response(scope, receive, send)
            return

        except Exception as e:
            logger.exception(f"Auth middleware error: {e}")
            response = JSONResponse(
                status_code=401,
                content={"detail": "Invalid token payload"},
            )
            await response(scope, receive, send)
            return

        # Continue with the request in the same context
        await self.app(scope, receive, send)


# =========================================================
# Middleware Registration
# =========================================================
def register_middlewares(app):
    # Rate limiting setup
    from instacrud.api.rate_limiter import limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        if settings.MODE == "prod":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response

    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

    # SessionMiddleware must come before any middleware accessing request.session
    app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

    # Heartbeat guard BEFORE auth/db init
    app.add_middleware(HeartbeatGuardMiddleware)

    # Auth + DB initialization
    app.add_middleware(DBInitMiddleware)
    
    # Block "null" origin before CORS processing (sandboxed iframe attack vector)
    @app.middleware("http")
    async def block_null_origin(request: Request, call_next):
        origin = request.headers.get("origin")
        if origin and origin.lower() == "null":
            return JSONResponse(
                status_code=403,
                content={"detail": "Forbidden origin"},
            )
        return await call_next(request)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOW_ORIGINS,
        allow_credentials=CORS_ALLOW_CREDENTIALS,
        allow_methods=CORS_ALLOW_METHODS,
        allow_headers=CORS_ALLOW_HEADERS,
    )
