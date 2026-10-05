"""Adversarial regressions beyond the original penetration suite.

Only disposable users, organizations and loopback listeners are used. OAuth
tests replace the identity provider, not the application's authorization code.
"""

import asyncio
import json
import secrets
import threading
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import AsyncMock
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
from authlib.jose.errors import JoseError
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic import ValidationError
from starlette.responses import RedirectResponse

from conftest import delete_org, delete_users
from instacrud.app import app
from instacrud.api import oauth_api
from instacrud.api.system_api import pwd_context
from instacrud.config import AppSettings, settings
from instacrud.model.system_model import (
    Invitation, OAuthSession, Organization, PasswordResetToken, Role, User,
)


@pytest.fixture
async def security_env(http_client):
    suffix = secrets.token_hex(8)
    password = secrets.token_urlsafe(24)
    admin = User(email=f"security-admin-{suffix}@example.com", role=Role.ADMIN,
                 hashed_password=pwd_context.hash(password))
    await admin.insert()
    org_id = None
    try:
        login = await http_client.post("/api/v1/signin", json={
            "email": admin.email, "password": password,
        })
        assert login.status_code == 200, login.text
        admin_h = {"Authorization": f"Bearer {login.json()['access_token']}"}
        response = await http_client.post("/api/v1/admin/organizations", headers=admin_h,
                                         json={"name": suffix, "code": f"security-{suffix}"})
        assert response.status_code == 200, response.text
        org = await Organization.find_one({"code": f"security-{suffix}"})
        org_id = org.id

        async def add_user(role=Role.USER):
            email = f"security-user-{secrets.token_hex(8)}@example.com"
            response = await http_client.post("/api/v1/admin/add_user", headers=admin_h, json={
                "email": email, "password": password, "name": "Security fixture",
                "role": role.value, "organization_id": str(org_id),
            })
            assert response.status_code == 200, response.text
            user = await User.find_one({"email": email})
            login = await http_client.post("/api/v1/signin", json={"email": email, "password": password})
            assert login.status_code == 200, login.text
            return user, {"Authorization": f"Bearer {login.json()['access_token']}"}

        async def invite(email):
            response = await http_client.post("/api/v1/admin/invite_user", headers=admin_h, json={
                "email": email, "organization_id": str(org_id), "role": "USER",
            })
            assert response.status_code == 200, response.text
            return response.json()["invitation_id"]

        yield SimpleNamespace(api=http_client, admin_h=admin_h, org_id=org_id,
                              password=password, add_user=add_user, invite=invite)
    finally:
        if org_id:
            for user in await User.find({"organization_id": org_id}).to_list():
                await delete_users(user.id)
            await delete_org(str(org_id))
        await delete_users(admin.id)


async def test_invitation_cannot_be_redeemed_by_another_email(security_env):
    env = security_env
    code = await env.invite(f"intended-{secrets.token_hex(6)}@example.com")
    attacker_email = f"attacker-{secrets.token_hex(6)}@example.com"
    response = await env.api.post("/api/v1/signup", json={
        "email": attacker_email, "password": env.password, "name": "Uninvited user",
        "invitation_id": code,
    })
    assert response.status_code in (400, 401, 403), "An outsider redeemed another person's invitation"
    assert await User.find_one({"email": attacker_email}) is None


async def test_invitation_cannot_be_predicted_from_adjacent_object_id(security_env):
    env = security_env
    # The attacker is given an ordinary, non-secret record ID, never the invite.
    _, own_headers = await env.add_user()
    anchor = await env.api.get("/api/v1/me", headers=own_headers)
    assert anchor.status_code == 200, anchor.text
    anchor_id = anchor.json()["user"]["id"]
    email = f"target-{secrets.token_hex(6)}@example.com"
    code = await env.invite(email)
    # Ordinary Mongo ObjectIds share a process prefix and nearby counter. A
    # capability minted from the CSPRNG must not share that predictable prefix.
    assert code[8:18] != anchor_id[8:18]
    for offset in range(1, 33):
        guess = f"{int(anchor_id, 16) + offset:024x}"
        response = await env.api.post("/api/v1/signup", json={
            "email": email, "password": env.password, "name": "Attacker chosen identity",
            "invitation_id": guess,
        })
        assert response.status_code in (400, 401, 403, 404), "Predictable invitation granted access without a password"


async def test_invitation_has_only_one_winner_under_concurrency(security_env):
    env = security_env
    email = f"invited-{secrets.token_hex(6)}@example.com"
    code = await env.invite(email)
    payload = {"email": email, "password": env.password, "name": "Invited", "invitation_id": code}
    responses = await asyncio.gather(*(env.api.post("/api/v1/signup", json=payload) for _ in range(6)))
    assert sum(r.status_code == 200 for r in responses) == 1
    assert all(r.status_code in (200, 400, 401, 409, 422) for r in responses)


@pytest.mark.parametrize("action", ["change", "reset", "admin"])
async def test_password_replacement_revokes_existing_bearer(security_env, action):
    env = security_env
    user, stolen_h = await env.add_user()
    new_password = secrets.token_urlsafe(24)
    if action == "change":
        response = await env.api.post("/api/v1/changePassword", headers=stolen_h, json={
            "current_password": env.password, "new_password": new_password,
        })
    elif action == "reset":
        raw = secrets.token_urlsafe(32)
        await PasswordResetToken(user_id=user.id, token=sha256(raw.encode()).hexdigest(),
                                 expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)).insert()
        response = await env.api.post("/api/v1/resetPassword", json={"token": raw, "new_password": new_password})
    else:
        response = await env.api.patch(f"/api/v1/admin/users/{user.id}", headers=env.admin_h,
                                      json={"password": new_password})
    assert response.status_code == 200, response.text
    # The attacker has only an old bearer, and does not know the new password.
    access = await env.api.get("/api/v1/clients", headers=stolen_h)
    assert access.status_code == 401, "Old bearer still reads tenant data after credential recovery"
    login = await env.api.post("/api/v1/signin", json={"email": user.email, "password": new_password})
    assert login.status_code == 200, login.text
    fresh_h = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert (await env.api.get("/api/v1/clients", headers=fresh_h)).status_code == 200


async def test_password_reset_is_atomic(security_env):
    env = security_env
    user, _ = await env.add_user()
    raw = secrets.token_urlsafe(32)
    await PasswordResetToken(user_id=user.id, token=sha256(raw.encode()).hexdigest(),
                             expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)).insert()
    responses = await asyncio.gather(*(env.api.post("/api/v1/resetPassword", json={
        "token": raw, "new_password": secrets.token_urlsafe(24),
    }) for _ in range(5)))
    assert sum(r.status_code == 200 for r in responses) == 1, "Reset token was spent more than once"


async def test_concurrent_password_recoveries_each_revoke_old_bearers(security_env):
    env = security_env
    user, stolen_h = await env.add_user()
    tokens = [secrets.token_urlsafe(32) for _ in range(2)]
    for raw in tokens:
        await PasswordResetToken(user_id=user.id, token=sha256(raw.encode()).hexdigest(),
                                 expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)).insert()
    responses = await asyncio.gather(*(env.api.post("/api/v1/resetPassword", json={
        "token": raw, "new_password": secrets.token_urlsafe(24),
    }) for raw in tokens))
    assert all(r.status_code == 200 for r in responses)
    assert (await User.get(user.id)).auth_version == 2
    assert (await env.api.get("/api/v1/clients", headers=stolen_h)).status_code == 401


async def test_bearer_requires_expiration(security_env):
    user, _ = await security_env.add_user()
    token = jwt.encode({"user_id": str(user.id), "email": user.email,
                        "role": "USER", "auth_version": user.auth_version},
                       settings.SECRET_KEY, algorithm="HS256")
    response = await security_env.api.get("/api/v1/clients",
                                          headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_production_rejects_weak_jwt_key():
    with pytest.raises(ValidationError):
        AppSettings(_env_file=None, MODE="prod", SECRET_KEY="short")


async def test_oauth_session_exchange_is_atomic(http_client):
    code = secrets.token_urlsafe(32)
    session = OAuthSession(session_code=code, token="fixture-bearer",
                           expires_at=datetime.now(timezone.utc) + timedelta(minutes=5))
    await session.insert()
    try:
        responses = await asyncio.gather(*(http_client.get("/api/v1/session", params={"session_code": code})
                                           for _ in range(8)))
        assert sum(r.status_code == 200 for r in responses) == 1, "One-time OAuth code returned multiple bearers"
    finally:
        await OAuthSession.find({"session_code": code}).delete_many()


@pytest.fixture
def internal_service():
    hits = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            hits.append(self.path)
            self.rfile.read(int(self.headers.get("Content-Length", 0)))
            data = json.dumps({"internal_secret": "private-network-canary", "tools": [], "resources": []}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", hits
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.mark.parametrize("endpoint", ["tools", "resources", "resources/read"])
async def test_mcp_cannot_reach_unapproved_internal_service(security_env, internal_service, endpoint):
    env = security_env
    _, headers = await env.add_user()
    url, hits = internal_service
    response = await env.api.post(f"/api/v1/mcp/{endpoint}", headers=headers,
                                  json={"mcp_server_url": url, "uri": "private-record"})
    assert response.status_code in (400, 403), f"Internal service was reachable: {response.text}"
    assert not hits, "Unauthorized outbound request reached the internal service"


async def test_mcp_approved_server_still_works(security_env, internal_service, monkeypatch):
    _, headers = await security_env.add_user()
    url, hits = internal_service
    monkeypatch.setattr(settings, "MCP_ALLOWED_SERVER_URLS", url)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
        response = await api.post("/api/v1/mcp/tools", headers=headers,
                                  json={"mcp_server_url": url})
    assert response.status_code == 200, response.text
    assert hits == ["/tools/list"]


@pytest.mark.parametrize("provider", ["google", "microsoft"])
async def test_oauth_email_claim_cannot_take_over_password_account(security_env, monkeypatch, provider):
    victim, _ = await security_env.add_user()
    claims = {"email": victim.email, "preferred_username": victim.email,
              "email_verified": True, "sub": "attacker-subject",
              "tid": "11111111-1111-1111-1111-111111111111", "oid": "attacker-object"}
    client = SimpleNamespace(authorize_access_token=AsyncMock(return_value={"userinfo": claims, "id_token": "stub"}))
    monkeypatch.setattr(oauth_api.oauth, "create_client", lambda _: client)
    monkeypatch.setattr(oauth_api, "decode_microsoft_id_token", AsyncMock(return_value=claims))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
        response = await api.get(f"/api/v1/signin/{provider}/callback")
    code = parse_qs(urlsplit(response.headers.get("location", "")).query).get("session_code")
    if code:
        await OAuthSession.find({"session_code": code[0]}).delete_many()
    assert not code, "Untrusted email claim issued the victim's bearer without their password"


@pytest.mark.parametrize("provider", ["google", "microsoft"])
async def test_oauth_link_requires_password_and_one_time_code(security_env, monkeypatch, provider):
    env = security_env
    user, headers = await env.add_user()
    claims = {"email": user.email, "email_verified": True, "sub": "verified-subject",
              "tid": "11111111-1111-1111-1111-111111111111", "oid": "verified-object"}
    client = SimpleNamespace(
        authorize_redirect=AsyncMock(return_value=RedirectResponse("https://provider.invalid/authorize")),
        authorize_access_token=AsyncMock(return_value={"userinfo": claims, "id_token": "stub"}),
    )
    monkeypatch.setattr(oauth_api.oauth, "create_client", lambda _: client)
    monkeypatch.setattr(oauth_api, "decode_microsoft_id_token", AsyncMock(return_value=claims))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as api:
        intent = secrets.token_hex(24)
        start = await api.get(f"/api/v1/signin/{provider}", params={"link_intent": intent})
        assert start.status_code in (302, 307)
        callback = await api.get(f"/api/v1/signin/{provider}/callback")
        link_code = parse_qs(urlsplit(callback.headers["location"]).query)["oauth_link_code"][0]
        assert (await api.get("/api/v1/session", params={"session_code": link_code})).status_code == 401
        assert (await api.post("/api/v1/oauth/link", json={
            "link_code": link_code, "current_password": env.password,
        })).status_code == 401
        assert (await api.post("/api/v1/oauth/link", headers=headers, json={
            "link_code": link_code, "current_password": "wrong-password",
        })).status_code == 403
        linked = await api.post("/api/v1/oauth/link", headers=headers, json={
            "link_code": link_code, "current_password": env.password,
        })
        assert linked.status_code == 200, linked.text
        assert (await api.post("/api/v1/oauth/link", headers=headers, json={
            "link_code": link_code, "current_password": env.password,
        })).status_code == 400
        signed_in = await api.get(f"/api/v1/signin/{provider}/callback")
        session_code = parse_qs(urlsplit(signed_in.headers["location"]).query)["session_code"][0]
        session = await api.get("/api/v1/session", params={"session_code": session_code})
        assert session.status_code == 200
        bearer = {"Authorization": f"Bearer {session.json()['access_token']}"}
        assert (await api.get("/api/v1/clients", headers=bearer)).status_code == 200


async def test_microsoft_token_rejects_wrong_tenant_issuer(monkeypatch):
    tenant = "11111111-1111-1111-1111-111111111111"
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    public_jwk.update({"kid": "test-key", "use": "sig", "alg": "RS256"})
    real_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda _: httpx.Response(200, json={"keys": [public_jwk]}))
    monkeypatch.setattr(oauth_api.httpx, "AsyncClient",
                        lambda *args, **kwargs: real_client(transport=transport))
    monkeypatch.setattr(oauth_api, "MS_CLIENT_ID", "test-client")
    monkeypatch.setattr(oauth_api, "MS_TENANT_ID", "common")

    def make_token(issuer):
        return jwt.encode({"iss": issuer, "tid": tenant, "sub": "provider-subject",
                           "aud": "test-client", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                          private_key, algorithm="RS256", headers={"kid": "test-key"})

    good = await oauth_api.decode_microsoft_id_token(
        make_token(f"https://login.microsoftonline.com/{tenant}/v2.0"))
    assert good["sub"] == "provider-subject"
    with pytest.raises((JoseError, ValueError)):
        await oauth_api.decode_microsoft_id_token(
            make_token("https://login.microsoftonline.com/attacker/v2.0"))


@pytest.mark.parametrize("endpoint", ["documents/000000000000000000000001/recalculate-embedding",
                                      "documents/recalculate-embeddings-all"])
async def test_readonly_user_cannot_trigger_embedding_writes(security_env, endpoint):
    _, headers = await security_env.add_user(Role.RO_USER)
    response = await security_env.api.post(f"/api/v1/{endpoint}", headers=headers)
    assert response.status_code == 403, "Read-only role reached a write/cost endpoint"
