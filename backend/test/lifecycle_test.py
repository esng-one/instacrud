import json
import time
import pytest
import httpx
from datetime import datetime, timezone
from passlib.context import CryptContext

from instacrud.model.system_model import User, Organization, Invitation, Role
from instacrud.model.organization_model import Project, ProjectDocument, Client
from instacrud.database import init_org_db, drop_org_db, firestore_mode
from conftest import wait_for_org_active

# Unique suffix per run to avoid duplicate-key collisions on re-runs against a live DB
_TS = str(int(time.time()))

# Shared test config
TEST_ADMIN_EMAIL = f"lc_admin_{_TS}@test.com"
TEST_ADMIN_PASSWORD = "admin123"
TEST_ORG_CODE = f"lc_org_{_TS}"
TEST_USER_EMAIL = f"lc_user_{_TS}@test.com"
TEST_RO_USER_EMAIL = f"lc_ro_{_TS}@test.com"
ORG_ADMIN_EMAIL = f"lc_orgadmin_{_TS}@test.com"
ORG_ADMIN_PASSWORD = "orgadmin123"
RO_USER_PASSWORD = "ropass123"
USER_PASSWORD = "userpass1"


@pytest.mark.asyncio
async def test_integration_lifecycle(http_client: httpx.AsyncClient, clean_db, test_mode):
    """Full integration lifecycle test."""
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(TEST_ADMIN_PASSWORD)

    # Track all created IDs for cleanup
    admin_user_id: str | None = None
    org_id: str | None = None
    org_admin_id: str | None = None
    user_id: str | None = None
    ro_user_id: str | None = None
    invite_ids: dict = {}
    client_ids: list = []
    project_id: str | None = None
    document_id: str | None = None

    # Create ADMIN user directly in DB
    admin_user = User(
        email=TEST_ADMIN_EMAIL,
        hashed_password=hashed_password,
        name="Test Admin",
        role=Role.ADMIN
    )
    await admin_user.insert()
    admin_user_id = str(admin_user.id)

    # Sign in as ADMIN
    resp = await http_client.post("/api/v1/signin", json={
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASSWORD
    })
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Create organization
    resp = await http_client.post("/api/v1/admin/organizations", json={
        "name": "Test Org",
        "code": TEST_ORG_CODE,
        "description": "Test organization"
    }, headers=headers_admin)
    assert resp.status_code == 200

    org = await Organization.find_one(Organization.code == TEST_ORG_CODE)
    assert org is not None
    org_id = str(org.id)

    await wait_for_org_active(http_client, org_id, headers_admin)

    # Add ORG_ADMIN
    resp = await http_client.post("/api/v1/admin/add_user", json={
        "email": ORG_ADMIN_EMAIL,
        "password": ORG_ADMIN_PASSWORD,
        "name": "Org Admin",
        "role": "ORG_ADMIN",
        "organization_id": org_id
    }, headers=headers_admin)
    assert resp.status_code == 200
    org_admin_id = resp.json().get("user_id")

    # Sign in as ORG_ADMIN
    resp = await http_client.post("/api/v1/signin", json={
        "email": ORG_ADMIN_EMAIL,
        "password": ORG_ADMIN_PASSWORD
    })
    assert resp.status_code == 200
    org_admin_token = resp.json()["access_token"]
    headers_org_admin = {"Authorization": f"Bearer {org_admin_token}"}

    # Invite USER and RO_USER
    for email, role in [(TEST_USER_EMAIL, "USER"), (TEST_RO_USER_EMAIL, "RO_USER")]:
        resp = await http_client.post("/api/v1/admin/invite_user", json={
            "email": email,
            "role": role,
            "expires_in_seconds": 3600
        }, headers=headers_org_admin)
        assert resp.status_code == 200
        invite_ids[role] = resp.json()["invitation_id"]

    # Sign up USER
    resp = await http_client.post("/api/v1/signup", json={
        "email": TEST_USER_EMAIL,
        "password": USER_PASSWORD,
        "name": "Test User",
        "invitation_id": invite_ids["USER"]
    })
    assert resp.status_code == 200
    user_id = resp.json().get("user_id")

    # Sign in as USER
    resp = await http_client.post("/api/v1/signin", json={
        "email": TEST_USER_EMAIL,
        "password": USER_PASSWORD
    })
    user_token = resp.json()["access_token"]
    headers_user = {"Authorization": f"Bearer {user_token}"}

    # Create clients
    for i in range(2):
        resp = await http_client.post("/api/v1/clients", json={
            "code": f"client_{i+1}",
            "name": f"Client {i+1}",
            "type": "COMPANY",
            "description": f"Client {i+1} description"
        }, headers=headers_user)
        assert resp.status_code == 200
        client_ids.append(resp.json()["_id"])

    # Get clients
    resp = await http_client.get("/api/v1/clients", headers=headers_user)
    assert resp.status_code == 200
    clients = resp.json()
    assert len(clients) == 2

    # Create project
    resp = await http_client.post("/api/v1/projects", json={
        "code": "P001",
        "client_id": str(client_ids[0]),
        "name": "Test Project",
        "start_date": datetime.now(tz=timezone.utc).isoformat()
    }, headers=headers_user)
    assert resp.status_code == 200
    project_id = resp.json()["_id"]

    # Get project
    filters_json = json.dumps({"code": "P001"})
    resp = await http_client.get("/api/v1/projects", params={"filters": filters_json}, headers=headers_user)
    assert resp.status_code == 200
    projects = resp.json()
    assert len(projects) > 0
    project = projects[0]

    # Create document
    resp = await http_client.post("/api/v1/documents", json={
        "project_id": str(project["_id"]),
        "code": "DOC001",
        "name": "Test Document",
        "content": "Some content"
    }, headers=headers_user)
    assert resp.status_code == 200
    document = resp.json()
    document_id = document["_id"]

    # Sign up RO_USER
    resp = await http_client.post("/api/v1/signup", json={
        "email": TEST_RO_USER_EMAIL,
        "password": RO_USER_PASSWORD,
        "name": "RO User",
        "invitation_id": invite_ids["RO_USER"]
    })
    assert resp.status_code == 200
    ro_user_id = resp.json().get("user_id")

    # Sign in as RO_USER
    resp = await http_client.post("/api/v1/signin", json={
        "email": TEST_RO_USER_EMAIL,
        "password": RO_USER_PASSWORD
    })
    ro_token = resp.json()["access_token"]
    headers_ro_user = {"Authorization": f"Bearer {ro_token}"}

    # RO_USER tries to modify document (should fail)
    resp = await http_client.put(f"/api/v1/documents/{document['_id']}", json={
        "project_id": str(project["_id"]),
        "code": "DOC001",
        "name": "Modified Title"
    }, headers=headers_ro_user)
    assert resp.status_code == 403

    # ---------------------------------------------------------------
    # Test: Only ADMIN can change user organization
    # ---------------------------------------------------------------

    # ORG_ADMIN tries to change user's organization (should fail with 403)
    resp = await http_client.patch(f"/api/v1/admin/users/{user_id}", json={
        "organization_id": org_id  # Attempting to change organization
    }, headers=headers_org_admin)
    assert resp.status_code == 403
    assert "Only admins can change user organization" in resp.json().get("detail", "")

    # ADMIN can change user's organization (should succeed)
    resp = await http_client.patch(f"/api/v1/admin/users/{user_id}", json={
        "organization_id": org_id
    }, headers=headers_admin)
    assert resp.status_code == 200

    # Cleanup - delete only the specific items we created
    if org_id:
        if test_mode == "live" and firestore_mode:
            # In live Firestore mode, drop_org_db deletes the entire DB, so
            # individual doc/project/client cleanup is redundant and requires
            # a direct DB connection that may fail during IAM propagation.
            await drop_org_db(org_id)
        else:
            await init_org_db(org_id)

            # Delete specific document
            if document_id:
                doc = await ProjectDocument.get(document_id)
                if doc:
                    await doc.delete()

            # Delete specific project
            if project_id:
                proj = await Project.get(project_id)
                if proj:
                    await proj.delete()

            # Delete specific clients
            for cid in client_ids:
                client = await Client.get(cid)
                if client:
                    await client.delete()

            if test_mode == "live":
                await drop_org_db(org_id)

    # Delete invitations we created
    for inv_id in invite_ids.values():
        invitation = await Invitation.get(inv_id)
        if invitation:
            await invitation.delete()

    # Delete users we created (by ID or by email fallback)
    if user_id:
        user = await User.get(user_id)
        if user:
            await user.delete()
    else:
        user = await User.find_one(User.email == TEST_USER_EMAIL)
        if user:
            await user.delete()

    if ro_user_id:
        ro_user = await User.get(ro_user_id)
        if ro_user:
            await ro_user.delete()
    else:
        ro_user = await User.find_one(User.email == TEST_RO_USER_EMAIL)
        if ro_user:
            await ro_user.delete()

    # Delete org admin (by ID or by email fallback)
    if org_admin_id:
        org_admin = await User.get(org_admin_id)
        if org_admin:
            await org_admin.delete()
    else:
        org_admin = await User.find_one(User.email == ORG_ADMIN_EMAIL)
        if org_admin:
            await org_admin.delete()

    # Delete organization
    if org_id:
        organization = await Organization.get(org_id)
        if organization:
            await organization.delete()

    # Delete system admin
    if admin_user_id:
        admin = await User.get(admin_user_id)
        if admin:
            await admin.delete()
