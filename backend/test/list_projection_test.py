"""
Tests for the list-endpoint field projections added to create_crud_router.

Verifies that:
- GET /clients, /projects, /contacts, /documents return only their XxxListItem fields
- Internal fields (search_tokens, content_embedding) are absent from list responses
- GET /clients/{id}, /projects/{id}, etc. (detail) still return full documents
- datetime serialization uses UTC Z-suffix format (shared _serialize_utc_dt)
- Projection dicts match expected field sets
"""

import pytest
import httpx
import time
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from instacrud.model.system_model import User, Organization, Role


# ---------------------------------------------------------------------------
# Unit tests — no HTTP, no DB
# ---------------------------------------------------------------------------

def _projection_dict(model_cls):
    """Derive the projection dict Beanie would build from a plain BaseModel.

    Iterates model_fields and maps each field's alias (or name) to 1 —
    same logic Beanie's internal get_projection uses.
    """
    return {
        (info.alias or name): 1
        for name, info in model_cls.model_fields.items()
    }


# ── ClientListItem unit tests ─────────────────────────────────────────────────

def test_client_list_item_projection_dict():
    from instacrud.api.organization_dto import ClientListItem

    proj = _projection_dict(ClientListItem)

    assert proj == {
        "_id": 1,
        "code": 1,
        "name": 1,
        "type": 1,
        "description": 1,
        "updated_at": 1,
    }, f"Unexpected projection dict: {proj}"

    for excluded in ("search_tokens", "contact_ids", "address_ids", "id"):
        assert excluded not in proj, f"Field '{excluded}' must not appear in ClientListItem projection"


def test_client_list_item_naive_datetime_gets_z_suffix():
    from instacrud.api.organization_dto import ClientListItem

    naive = datetime(2025, 6, 21, 10, 30, 45, 123456)
    item = ClientListItem(updated_at=naive)
    serialized = item.model_dump(by_alias=True).get("updated_at")
    assert serialized == "2025-06-21T10:30:45.123456Z", f"Got: {serialized}"


def test_client_list_item_aware_datetime_keeps_z_suffix():
    from instacrud.api.organization_dto import ClientListItem

    aware = datetime(2025, 6, 21, 10, 30, 45, 123456, tzinfo=timezone.utc)
    item = ClientListItem(updated_at=aware)
    serialized = item.model_dump(by_alias=True).get("updated_at")
    assert serialized == "2025-06-21T10:30:45.123456Z", f"Got: {serialized}"


def test_client_list_item_id_alias():
    from instacrud.api.organization_dto import ClientListItem

    raw_id = "507f1f77bcf86cd799439011"
    item = ClientListItem.model_validate({"_id": raw_id, "name": "Test Client", "code": "TC1"})
    assert str(item.id) == raw_id

    dumped = item.model_dump(by_alias=True)
    assert "_id" in dumped
    assert "id" not in dumped


def test_client_list_item_type_coercion():
    from instacrud.api.organization_dto import ClientListItem
    from instacrud.model.organization_model import ClientType

    item = ClientListItem.model_validate({"type": "COMPANY"})
    assert item.type == ClientType.COMPANY


# ── ProjectListItem unit tests ────────────────────────────────────────────────

def test_project_list_item_projection_dict():
    from instacrud.api.organization_dto import ProjectListItem

    proj = _projection_dict(ProjectListItem)

    assert proj == {
        "_id": 1,
        "code": 1,
        "name": 1,
        "client_id": 1,
        "start_date": 1,
        "end_date": 1,
        "description": 1,
        "updated_at": 1,
    }, f"Unexpected projection dict: {proj}"

    for excluded in ("search_tokens", "id"):
        assert excluded not in proj, f"Field '{excluded}' must not appear in ProjectListItem projection"


def test_project_list_item_start_date_utc():
    from instacrud.api.organization_dto import ProjectListItem

    naive = datetime(2025, 3, 15, 9, 0, 0, 0)
    item = ProjectListItem(start_date=naive)
    dumped = item.model_dump(by_alias=True)
    assert dumped["start_date"] == "2025-03-15T09:00:00.000000Z", f"Got: {dumped['start_date']}"


def test_project_list_item_end_date_non_utc_normalized():
    from instacrud.api.organization_dto import ProjectListItem

    plus5 = timezone(timedelta(hours=5))
    aware_plus5 = datetime(2025, 3, 15, 14, 0, 0, 0, tzinfo=plus5)
    item = ProjectListItem(end_date=aware_plus5)
    dumped = item.model_dump(by_alias=True)
    assert dumped["end_date"] == "2025-03-15T09:00:00.000000Z", f"Got: {dumped['end_date']}"


def test_project_list_item_none_dates():
    from instacrud.api.organization_dto import ProjectListItem

    item = ProjectListItem(start_date=None, end_date=None)
    dumped = item.model_dump(by_alias=True)
    assert dumped["start_date"] is None
    assert dumped["end_date"] is None


def test_project_list_item_client_id_round_trip():
    from instacrud.api.organization_dto import ProjectListItem

    client_id = "507f1f77bcf86cd799439013"
    item = ProjectListItem.model_validate({
        "_id": "507f1f77bcf86cd799439012",
        "client_id": client_id,
        "name": "Test Project",
        "code": "TP1",
    })
    dumped = item.model_dump(by_alias=True)
    assert str(dumped["client_id"]) == client_id


# ── ContactListItem unit tests ────────────────────────────────────────────────

def test_contact_list_item_projection_dict():
    from instacrud.api.organization_dto import ContactListItem

    proj = _projection_dict(ContactListItem)

    assert proj == {
        "_id": 1,
        "name": 1,
        "title": 1,
        "email": 1,
        "phone": 1,
        "updated_at": 1,
    }, f"Unexpected projection dict: {proj}"

    for excluded in ("search_tokens", "id"):
        assert excluded not in proj, f"Field '{excluded}' must not appear in ContactListItem projection"


def test_contact_list_item_id_alias():
    from instacrud.api.organization_dto import ContactListItem

    raw_id = "507f1f77bcf86cd799439015"
    item = ContactListItem.model_validate({"_id": raw_id, "name": "Test Contact"})
    assert str(item.id) == raw_id
    dumped = item.model_dump(by_alias=True)
    assert "_id" in dumped and "id" not in dumped


# ── ProjectDocumentListItem unit tests ────────────────────────────────────────

def test_document_list_item_projection_dict():
    from instacrud.api.organization_dto import ProjectDocumentListItem

    proj = _projection_dict(ProjectDocumentListItem)

    assert proj == {
        "_id": 1,
        "project_id": 1,
        "code": 1,
        "name": 1,
        "content": 1,
        "description": 1,
        "updated_at": 1,
    }, f"Unexpected projection dict: {proj}"

    for excluded in ("search_tokens", "content_embedding", "id"):
        assert excluded not in proj, f"Field '{excluded}' must not appear in ProjectDocumentListItem projection"


def test_document_list_item_none_datetime():
    from instacrud.api.organization_dto import ProjectDocumentListItem

    item = ProjectDocumentListItem(updated_at=None)
    assert item.model_dump(by_alias=True).get("updated_at") is None


# ── Shared _serialize_utc_dt ──────────────────────────────────────────────────

def test_shared_serialize_utc_dt():
    from instacrud.api.organization_dto import _serialize_utc_dt

    assert _serialize_utc_dt(None) is None

    naive = datetime(2025, 1, 15, 8, 0, 0, 0)
    assert _serialize_utc_dt(naive) == "2025-01-15T08:00:00.000000Z"

    aware = datetime(2025, 1, 15, 8, 0, 0, 0, tzinfo=timezone.utc)
    assert _serialize_utc_dt(aware) == "2025-01-15T08:00:00.000000Z"

    plus3 = timezone(timedelta(hours=3))
    aware_plus3 = datetime(2025, 1, 15, 11, 0, 0, 0, tzinfo=plus3)
    assert _serialize_utc_dt(aware_plus3) == "2025-01-15T08:00:00.000000Z"


# ---------------------------------------------------------------------------
# Integration tests — require testcontainer (run via run_all_test.py)
# ---------------------------------------------------------------------------

LARGE_CLIENT_PAYLOAD = {
    "name": "Projection Test Client",
    "type": "COMPANY",
    "description": "test description with " + "x" * 100,
}

CLIENT_ABSENT_FIELDS = ["search_tokens", "contact_ids", "address_ids"]
CLIENT_PRESENT_FIELDS = ["_id", "code", "name", "type", "description", "updated_at"]

LARGE_PROJECT_PAYLOAD = {
    "name": "Projection Test Project",
    "code": None,  # filled in per-test with timestamp
    "client_id": None,  # filled in per-test
    "start_date": "2025-01-01T00:00:00Z",
    "description": "test description with " + "x" * 100,
}

PROJECT_ABSENT_FIELDS = ["search_tokens"]
PROJECT_PRESENT_FIELDS = ["_id", "code", "name", "client_id", "start_date", "description", "updated_at"]

LARGE_CONTACT_PAYLOAD = {
    "name": "Projection Test Contact",
    "title": "Senior Tester",
    "phone": None,  # filled per-test with unique value
}

CONTACT_ABSENT_FIELDS = ["search_tokens"]
CONTACT_PRESENT_FIELDS = ["_id", "name", "title", "email", "phone", "updated_at"]

LARGE_DOCUMENT_PAYLOAD = {
    "code": None,  # filled per-test
    "name": "Projection Test Document",
    "project_id": None,  # filled per-test
    "content": "The quick brown fox " * 500,
    "description": "test",
    "content_embedding": [0.1] * 1536,
}

DOCUMENT_ABSENT_FIELDS = ["search_tokens", "content_embedding"]
DOCUMENT_PRESENT_FIELDS = ["_id", "project_id", "code", "name", "content", "description", "updated_at"]


async def _setup_org_user(http_client, admin_headers, ts):
    """Create an org and return user token headers."""
    org_code = f"proj_org_{ts}"
    resp = await http_client.post("/api/v1/admin/organizations", json={
        "code": org_code,
        "name": f"Projection Org {ts}",
    }, headers=admin_headers)
    assert resp.status_code == 200, resp.text

    org = await Organization.find_one(Organization.code == org_code)
    assert org is not None
    org_id = str(org.id)

    resp = await http_client.post("/api/v1/admin/add_user", json={
        "email": f"proj_user_{ts}@test.com",
        "password": "testpass1",
        "name": f"Proj User {ts}",
        "role": "USER",
        "organization_id": org_id,
    }, headers=admin_headers)
    assert resp.status_code == 200, resp.text

    from conftest import wait_for_org_active
    await wait_for_org_active(http_client, org_id, admin_headers)

    resp = await http_client.post("/api/v1/signin", json={
        "email": f"proj_user_{ts}@test.com", "password": "testpass1"
    })
    assert resp.status_code == 200, resp.text
    return {"Authorization": "Bearer " + resp.json()["access_token"]}


async def _admin_headers(http_client):
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    admin = User(
        email="lp_admin@test.com",
        hashed_password=pwd_context.hash("adminpass"),
        name="LP Admin",
        role=Role.ADMIN,
    )
    await admin.insert()
    resp = await http_client.post("/api/v1/signin", json={
        "email": "lp_admin@test.com", "password": "adminpass"
    })
    assert resp.status_code == 200, resp.text
    return {"Authorization": "Bearer " + resp.json()["access_token"]}


@pytest.mark.asyncio
async def test_client_list_returns_only_projected_fields(
    http_client: httpx.AsyncClient, clean_db, test_mode
):
    """GET /clients list returns only ClientListItem fields; detail returns full document."""
    admin_hdr = await _admin_headers(http_client)
    ts = str(int(time.time())) + "_cli"
    user_hdr = await _setup_org_user(http_client, admin_hdr, ts)

    payload = {**LARGE_CLIENT_PAYLOAD, "code": f"tc_{ts}"}
    resp = await http_client.post("/api/v1/clients", json=payload, headers=user_hdr)
    assert resp.status_code == 200, resp.text
    created_id = resp.json()["_id"]

    # List — verify projection
    resp = await http_client.get("/api/v1/clients", headers=user_hdr)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    item = next((c for c in items if c["_id"] == created_id), None)
    assert item is not None, "Created client not found in list"

    for field in CLIENT_PRESENT_FIELDS:
        assert field in item, f"Expected field '{field}' missing from list response"
    for field in CLIENT_ABSENT_FIELDS:
        assert field not in item, f"Field '{field}' must not appear in list response"

    assert item["updated_at"].endswith("Z"), "updated_at must end with Z"

    # Detail — full document still returned
    resp = await http_client.get(f"/api/v1/clients/{created_id}", headers=user_hdr)
    assert resp.status_code == 200, resp.text
    full = resp.json()
    assert full["name"] == "Projection Test Client"


@pytest.mark.asyncio
async def test_project_list_returns_only_projected_fields(
    http_client: httpx.AsyncClient, clean_db, test_mode
):
    """GET /projects list returns only ProjectListItem fields; detail returns full document."""
    admin_hdr = await _admin_headers(http_client)
    ts = str(int(time.time())) + "_prj"
    user_hdr = await _setup_org_user(http_client, admin_hdr, ts)

    payload = {**LARGE_PROJECT_PAYLOAD, "code": f"tp_{ts}", "client_id": None}
    resp = await http_client.post("/api/v1/projects", json=payload, headers=user_hdr)
    assert resp.status_code == 200, resp.text
    created_id = resp.json()["_id"]

    # List — verify projection
    resp = await http_client.get("/api/v1/projects", headers=user_hdr)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    item = next((p for p in items if p["_id"] == created_id), None)
    assert item is not None, "Created project not found in list"

    for field in PROJECT_PRESENT_FIELDS:
        assert field in item, f"Expected field '{field}' missing from list response"
    for field in PROJECT_ABSENT_FIELDS:
        assert field not in item, f"Field '{field}' must not appear in list response"

    assert item["updated_at"].endswith("Z"), "updated_at must end with Z"
    assert item["start_date"].endswith("Z"), "start_date must end with Z"

    # Detail — full document still returned
    resp = await http_client.get(f"/api/v1/projects/{created_id}", headers=user_hdr)
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Projection Test Project"


@pytest.mark.asyncio
async def test_contact_list_returns_only_projected_fields(
    http_client: httpx.AsyncClient, clean_db, test_mode
):
    """GET /contacts list returns only ContactListItem fields; detail returns full document."""
    admin_hdr = await _admin_headers(http_client)
    ts = str(int(time.time())) + "_cnt"
    user_hdr = await _setup_org_user(http_client, admin_hdr, ts)

    payload = {**LARGE_CONTACT_PAYLOAD, "phone": f"+1555{ts[-6:]}"}
    resp = await http_client.post("/api/v1/contacts", json=payload, headers=user_hdr)
    assert resp.status_code == 200, resp.text
    created_id = resp.json()["_id"]

    # List — verify projection
    resp = await http_client.get("/api/v1/contacts", headers=user_hdr)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    item = next((c for c in items if c["_id"] == created_id), None)
    assert item is not None, "Created contact not found in list"

    for field in CONTACT_PRESENT_FIELDS:
        assert field in item, f"Expected field '{field}' missing from list response"
    for field in CONTACT_ABSENT_FIELDS:
        assert field not in item, f"Field '{field}' must not appear in list response"

    # Detail — full document still returned
    resp = await http_client.get(f"/api/v1/contacts/{created_id}", headers=user_hdr)
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Projection Test Contact"


@pytest.mark.asyncio
async def test_document_list_returns_only_projected_fields(
    http_client: httpx.AsyncClient, clean_db, test_mode
):
    """GET /documents list returns only ProjectDocumentListItem fields; content_embedding absent."""
    admin_hdr = await _admin_headers(http_client)
    ts = str(int(time.time())) + "_doc"
    user_hdr = await _setup_org_user(http_client, admin_hdr, ts)

    # Create a project first (document requires project_id)
    proj_resp = await http_client.post("/api/v1/projects", json={
        "code": f"proj_for_doc_{ts}",
        "name": "Doc Owner Project",
        "client_id": None,
        "start_date": "2025-01-01T00:00:00Z",
    }, headers=user_hdr)
    assert proj_resp.status_code == 200, proj_resp.text
    project_id = proj_resp.json()["_id"]

    payload = {**LARGE_DOCUMENT_PAYLOAD, "code": f"td_{ts}", "project_id": project_id}
    resp = await http_client.post("/api/v1/documents", json=payload, headers=user_hdr)
    assert resp.status_code == 200, resp.text
    created_id = resp.json()["_id"]

    # List — verify projection
    resp = await http_client.get("/api/v1/documents", headers=user_hdr)
    assert resp.status_code == 200, resp.text
    items = resp.json()
    item = next((d for d in items if d["_id"] == created_id), None)
    assert item is not None, "Created document not found in list"

    for field in DOCUMENT_PRESENT_FIELDS:
        assert field in item, f"Expected field '{field}' missing from list response"
    for field in DOCUMENT_ABSENT_FIELDS:
        assert field not in item, f"Field '{field}' must not appear in list response"

    assert item["updated_at"].endswith("Z"), "updated_at must end with Z"
    assert item["name"] == "Projection Test Document"

    # Detail — full document still returned (with content_embedding)
    resp = await http_client.get(f"/api/v1/documents/{created_id}", headers=user_hdr)
    assert resp.status_code == 200, resp.text
    full = resp.json()
    assert "content_embedding" in full and full["content_embedding"] is not None, \
        "Detail endpoint must still return content_embedding"
    assert full["name"] == "Projection Test Document"
