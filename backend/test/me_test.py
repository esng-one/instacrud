"""Tests for GET/PATCH /me/organization and related access control changes."""

import time
import pytest
import httpx
from passlib.context import CryptContext

from instacrud.model.system_model import User, Organization, Role
from instacrud.database import init_org_db
from conftest import wait_for_org_active

_TS = str(int(time.time()))

ADMIN_EMAIL = f"me_admin_{_TS}@test.com"
ADMIN_PASSWORD = "adminpass1"
ORG_ADMIN_EMAIL = f"me_orgadmin_{_TS}@test.com"
ORG_ADMIN_PASSWORD = "orgadminpass1"
USER_EMAIL = f"me_user_{_TS}@test.com"
USER_PASSWORD = "userpass1"
ORG_CODE = f"me_org_{_TS}"


@pytest.mark.asyncio
async def test_me_organization_endpoints(http_client: httpx.AsyncClient, clean_db, test_mode):
    """
    Tests:
    - GET /me returns organization.status (not code)
    - GET /me/organization returns data for ORG_ADMIN; 403 for bare ADMIN; 403 for USER
    - PATCH /me/organization updates name/description/local_only_conversations for ORG_ADMIN; 403 for USER
    - GET /admin/organizations returns 403 for ORG_ADMIN
    - GET /admin/organizations/{id} returns 403 for ORG_ADMIN
    """
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # ---- Setup: ADMIN user ----
    admin_user = User(
        email=ADMIN_EMAIL,
        hashed_password=pwd_context.hash(ADMIN_PASSWORD),
        name="Me Test Admin",
        role=Role.ADMIN,
    )
    await admin_user.insert()

    resp = await http_client.post("/api/v1/signin", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # ---- Setup: Organization ----
    resp = await http_client.post("/api/v1/admin/organizations", json={
        "name": "Me Test Org",
        "code": ORG_CODE,
        "description": "Org for /me tests",
    }, headers=headers_admin)
    assert resp.status_code == 200

    org = await Organization.find_one(Organization.code == ORG_CODE)
    assert org is not None
    org_id = str(org.id)

    await wait_for_org_active(http_client, org_id, headers_admin)

    # ---- Setup: ORG_ADMIN user ----
    resp = await http_client.post("/api/v1/admin/add_user", json={
        "email": ORG_ADMIN_EMAIL,
        "password": ORG_ADMIN_PASSWORD,
        "name": "Org Admin",
        "role": "ORG_ADMIN",
        "organization_id": org_id,
    }, headers=headers_admin)
    assert resp.status_code == 200

    resp = await http_client.post("/api/v1/signin", json={
        "email": ORG_ADMIN_EMAIL,
        "password": ORG_ADMIN_PASSWORD,
    })
    assert resp.status_code == 200
    org_admin_token = resp.json()["access_token"]
    headers_org_admin = {"Authorization": f"Bearer {org_admin_token}"}

    # ---- Setup: regular USER ----
    resp = await http_client.post("/api/v1/admin/add_user", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD,
        "name": "Regular User",
        "role": "USER",
        "organization_id": org_id,
    }, headers=headers_admin)
    assert resp.status_code == 200

    resp = await http_client.post("/api/v1/signin", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD,
    })
    assert resp.status_code == 200
    user_token = resp.json()["access_token"]
    headers_user = {"Authorization": f"Bearer {user_token}"}

    # =====================================================================
    # Test 1: GET /me — organization.status present, code absent
    # =====================================================================
    resp = await http_client.get("/api/v1/me", headers=headers_org_admin)
    assert resp.status_code == 200
    me_data = resp.json()
    org_info = me_data["organization"]
    assert org_info is not None
    assert "status" in org_info, "MeOrgInfo must include status"
    assert org_info["status"] == "ACTIVE"
    assert "code" not in org_info, "MeOrgInfo must not expose code"

    # =====================================================================
    # Test 1b: PATCH /me — ADMIN can update their own name
    # =====================================================================
    resp = await http_client.patch("/api/v1/me", json={"name": "Updated Admin"}, headers=headers_admin)
    assert resp.status_code == 200, f"ADMIN should be able to PATCH /me, got {resp.status_code}"
    assert resp.json()["user"]["name"] == "Updated Admin"

    # =====================================================================
    # Test 2: GET /me/organization — ORG_ADMIN gets full org details
    # =====================================================================
    resp = await http_client.get("/api/v1/me/organization", headers=headers_org_admin)
    assert resp.status_code == 200
    org_data = resp.json()
    assert org_data["id"] == org_id
    assert org_data["name"] == "Me Test Org"
    assert org_data["code"] == ORG_CODE
    assert org_data["description"] == "Org for /me tests"
    assert "local_only_conversations" in org_data
    # status and tier should NOT be in the response
    assert "status" not in org_data
    assert "tier" not in org_data

    # =====================================================================
    # Test 3: GET /me/organization — bare ADMIN (no org) gets 403
    # =====================================================================
    resp = await http_client.get("/api/v1/me/organization", headers=headers_admin)
    assert resp.status_code == 403, f"ADMIN should get 403, got {resp.status_code}"

    # =====================================================================
    # Test 4: GET /me/organization — regular USER gets 403
    # =====================================================================
    resp = await http_client.get("/api/v1/me/organization", headers=headers_user)
    assert resp.status_code == 403, f"USER should get 403, got {resp.status_code}"

    # =====================================================================
    # Test 5: PATCH /me/organization — ORG_ADMIN can update name/description/local_only
    # =====================================================================
    resp = await http_client.patch("/api/v1/me/organization", json={
        "name": "Updated Org Name",
        "description": "Updated description",
        "local_only_conversations": True,
    }, headers=headers_org_admin)
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["name"] == "Updated Org Name"
    assert updated["description"] == "Updated description"
    assert updated["local_only_conversations"] is True

    # =====================================================================
    # Test 5b: PATCH /me/organization — empty string clears description to null
    # =====================================================================
    resp = await http_client.patch("/api/v1/me/organization", json={
        "description": "",
    }, headers=headers_org_admin)
    assert resp.status_code == 200
    assert resp.json()["description"] is None, \
        "Empty string should clear description to null"

    # =====================================================================
    # Test 5c: PATCH /me/organization — extra field rejected (extra="forbid")
    # =====================================================================
    resp = await http_client.patch("/api/v1/me/organization", json={
        "name": "Valid Name",
        "tier_id": "abc123",
    }, headers=headers_org_admin)
    assert resp.status_code == 422, \
        f"Extra field 'tier_id' should be rejected with 422, got {resp.status_code}"

    # =====================================================================
    # Test 6: PATCH /me/organization — regular USER gets 403
    # =====================================================================
    resp = await http_client.patch("/api/v1/me/organization", json={
        "name": "Should not work",
    }, headers=headers_user)
    assert resp.status_code == 403, f"USER should get 403 on PATCH, got {resp.status_code}"

    # =====================================================================
    # Test 7: GET /admin/organizations — ORG_ADMIN gets 403 (locked to ADMIN only)
    # =====================================================================
    resp = await http_client.get("/api/v1/admin/organizations", headers=headers_org_admin)
    assert resp.status_code == 403, f"ORG_ADMIN should get 403 on list orgs, got {resp.status_code}"

    # =====================================================================
    # Test 8: GET /admin/organizations/{id} — ORG_ADMIN gets 403
    # =====================================================================
    resp = await http_client.get(f"/api/v1/admin/organizations/{org_id}", headers=headers_org_admin)
    assert resp.status_code == 403, f"ORG_ADMIN should get 403 on get org, got {resp.status_code}"

    # =====================================================================
    # Test 9: GET /admin/organizations — ADMIN still works
    # =====================================================================
    resp = await http_client.get("/api/v1/admin/organizations", headers=headers_admin)
    assert resp.status_code == 200
    orgs = resp.json()
    assert any(o["id"] == org_id for o in orgs)
