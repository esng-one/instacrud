# api/rate_limiter.py
"""
Rate limiting configuration using slowapi.

Provides per-IP and per-user rate limiting for authentication
and resource-intensive endpoints.

Rate limiting is disabled in test mode to allow SVT and other tests to run.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

from instacrud.config import settings
from instacrud.context import current_user_context


def get_user_identifier(request: Request) -> str:
    """
    Get rate limit key based on authenticated user.
    Falls back to IP address if no user context available.
    """
    try:
        user_ctx = current_user_context.get()
        if user_ctx and user_ctx.user_id:
            return f"user:{user_ctx.user_id}"
    except LookupError:
        pass
    return get_remote_address(request)


# Main limiter instance using IP address (for public endpoints)
# In test mode, use enabled=False to disable rate limiting
limiter = Limiter(key_func=get_remote_address, enabled=(settings.MODE != "test"))

# Rate limit constants (per IP via slowapi)
SIGNIN_RATE_LIMIT = "20/minute"         # Credential guessing protection
SIGNUP_RATE_LIMIT = "20/minute"         # Signup abuse protection
FORGOT_PW_RATE_LIMIT = "20/hour"        # Enumeration abuse protection
RESET_PW_RATE_LIMIT = "10/hour"         # Token brute-force protection
AI_RATE_LIMIT = "20/minute"             # AI completion endpoints
