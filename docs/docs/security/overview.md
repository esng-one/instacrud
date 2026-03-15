---
sidebar_position: 1
title: Security Overview
---

# Security Overview

InstaCRUD implements multiple layers of security to protect your application and data. This guide covers the security features, best practices, and configuration options available.

---

## Security Features

The codebase demonstrates several security best practices across authentication, data isolation, and input validation.

| Feature | Implementation |
|---------|----------------|
| Password Hashing | bcrypt via Passlib with auto-upgrade |
| Multi-tenancy Isolation | Per-organization MongoDB databases |
| Input Validation | Pydantic models with strict type checking |
| Query Injection Prevention | MongoDB operator allowlist (blocks `$where`, `$function`, `$regex`) |
| User Scoping | Query wrapping with `$and` prevents bypass via `$or` |
| Bot Protection | Cloudflare Turnstile integration |
| Audit Trail | `created_by`, `updated_by`, timestamps on all models |
| FK Validation | Validates referenced documents exist before saving |
| Context Isolation | Thread-safe `ContextVar` for request context |
| OAuth Implementation | One-time session codes, proper token validation |
| Base64 Log Sanitization | Prevents logging sensitive image data |
| Security Headers | X-Frame-Options, X-Content-Type-Options, CSP, HSTS |
| Rate Limiting | Per-IP rate limiting on authentication endpoints |

---

## Password Security

Passwords are hashed using bcrypt via the Passlib library with automatic algorithm upgrades:

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
```

This ensures:
- Secure one-way hashing with bcrypt
- Automatic rehashing when users log in if the algorithm is updated
- Protection against rainbow table attacks

---

## Multi-tenancy Isolation

Each organization operates in complete data isolation:

- **Standard mode**: Each organization gets its own MongoDB database within the same instance
- **Org DB mode** (`MONGO_USE_ORG_DB=true`): Organizations can have dedicated MongoDB connection strings
- **Firestore mode**: Each organization connects to its own MongoDB instance via stored connection URL

This prevents any cross-tenant data leakage at the database level.

---

## Query Injection Prevention

InstaCRUD blocks dangerous MongoDB operators that could be used for injection attacks:

```python
# Safe MongoDB operators - block dangerous ones like $where, $function, $expr
# NOTE: $regex intentionally excluded (ReDoS risk)
ALLOWED_QUERY_OPS = frozenset({
    "$and", "$or", "$nor", "$not",                  # Logical
    "$eq", "$ne", "$gt", "$gte", "$lt", "$lte",     # Comparison
    "$in", "$nin", "$exists", "$type",              # Element
    "$all", "$elemMatch", "$size",                  # Array (safe)
})
```

Any query using operators outside this allowlist (like `$where`, `$function`, or `$regex`) will be rejected with a 400 error.

---

## User Scoping

For user-scoped entities, queries are automatically wrapped with `$and` to prevent bypass attacks:

```python
def _add_user_scope(query: dict) -> dict:
    # Always wrap with $and to prevent bypass via $or
    if query:
        return {"$and": [query, {"user_id": user_ctx.user_id}]}
    return {"user_id": user_ctx.user_id}
```

This ensures users cannot access other users' data by crafting malicious `$or` queries.

---

## Security Headers

All responses include security headers to protect against common web vulnerabilities:

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | `DENY` | Prevents clickjacking attacks |
| X-Content-Type-Options | `nosniff` | Prevents MIME type sniffing |
| X-XSS-Protection | `1; mode=block` | Enables browser XSS filtering |
| Content-Security-Policy | `default-src 'self'` | Restricts resource loading |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | Enforces HTTPS (prod mode only) |

---

## OAuth Security

OAuth implementation includes several security measures:

- **One-time session codes**: After OAuth callback, a session code is generated that can only be used once
- **Token validation**: Microsoft tokens are validated against public JWKS keys
- **Audience verification**: Tokens are verified to match the configured client ID
- **Expiration enforcement**: Session codes and tokens have strict expiration times

---

## Rate Limiting

Authentication endpoints are rate-limited to prevent brute force attacks:

```python
AUTH_RATE_LIMIT = "5/minute"  # For signin/signup
AI_RATE_LIMIT = "20/minute"   # For AI completion endpoints
```

Rate limiting is applied per-IP address for public endpoints and per-user for authenticated endpoints.

:::caution
Rate limiting is **disabled** in test mode (`MODE="test"`) to allow automated tests to run without restrictions.
:::

---

## Base64 Log Sanitization

To prevent sensitive image data from appearing in logs, base64 content is automatically sanitized:

```python
def sanitize_base64_in_body(body_str: str) -> str:
    # Truncates base64 data to first 7 characters followed by "..."
```

This applies to:
- Data URLs with base64 encoding
- Large alphanumeric strings that appear to be base64

---

## Context Isolation

Request context is isolated using Python's `ContextVar`:

```python
current_user_context: ContextVar[CurrentUserContext] = ContextVar(
    "current_user_context",
    default=CurrentUserContext()
)
```

This ensures:
- Thread-safe access to user context
- No cross-request data leakage
- Proper async/await context propagation

---

## Foreign Key Validation

Before saving documents, referenced foreign keys are validated to exist:

```python
async def ensure_exists(model: Type[Document], field_name: str, value):
    # Raises 422 if any referenced ID does not exist
```

This prevents orphaned references and maintains data integrity.

---

## Summary

InstaCRUD provides comprehensive security through:

- Strong password hashing with bcrypt
- Complete tenant isolation at the database level
- Input validation and query injection prevention
- Security headers on all responses
- Rate limiting on sensitive endpoints
- Secure OAuth implementation
- Log sanitization for sensitive data

See [Production Mode](./production-mode) for deployment configuration.
