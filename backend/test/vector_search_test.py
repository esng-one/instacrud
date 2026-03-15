"""
Vector Search Test Suite - Comprehensive tests for FAISS-based semantic search.

Tests cover:
1. FAISS db and invalidation flag tenant isolation
2. Cold load and document availability
3. Adding new documents and their availability
4. Creating document with empty content, editing, and availability
5. Tenant isolation verification (cross-tenant queries)
6. Invalidation flag behavior

NOTE: This test suite is for LIVE mode only (--type=live).
Uses mock data from init/init_mock_db.py with pre-computed embeddings.
"""

import json
import time
import pytest
import httpx
from pathlib import Path
from datetime import datetime, timezone
from passlib.context import CryptContext
from httpx import ASGITransport

from instacrud.config import settings
from instacrud.app import app
from instacrud.model.system_model import User, Organization, Role
from instacrud.model.organization_model import Project, ProjectDocument, Client
from instacrud.database import init_org_db, drop_org_db, get_current_db_id, firestore_mode
from instacrud.ai.vector_search import clear_vector_search
from conftest import wait_for_org_active

# Test configuration
_TS = str(int(time.time()))
TEST_ADMIN_EMAIL = f"vs_admin_{_TS}@test.com"
TEST_ADMIN_PASSWORD = "vsadmin123"
ORG1_CODE = f"vs_org_001_{_TS}"
ORG2_CODE = f"vs_org_002_{_TS}"
ORG1_USER_EMAIL = f"vs_user1_{_TS}@test.com"
ORG2_USER_EMAIL = f"vs_user2_{_TS}@test.com"
USER_PASSWORD = "userpass123"


def load_embeddings_by_title() -> dict:
    """Load embeddings from the init file."""
    embeddings_file = Path(__file__).parent.parent / "init" / "embeddings_output.json"
    with open(embeddings_file, "r") as f:
        data = json.load(f)
    return {item["title"]: item["embedding"] for item in data}


async def setup_test_org(
    http_client: httpx.AsyncClient,
    admin_headers: dict,
    org_code: str,
    org_name: str,
    user_email: str,
    pwd_context: CryptContext,
    embeddings_by_title: dict,
    doc_content: list[dict],
) -> dict:
    """
    Set up a test organization with documents that have embeddings.
    Returns a dict with org_id, user_token, user_id, project_id, document_ids, etc.
    """
    # Create organization
    resp = await http_client.post("/api/v1/admin/organizations", json={
        "name": org_name,
        "code": org_code,
        "description": f"Vector Search Test Org - {org_name}"
    }, headers=admin_headers)
    assert resp.status_code == 200, f"Failed to create org: {resp.text}"

    org = await Organization.find_one(Organization.code == org_code)
    assert org is not None
    org_id = str(org.id)

    await wait_for_org_active(http_client, org_id, admin_headers)

    # Add org admin
    org_admin_email = f"admin_{org_code}@test.com"
    resp = await http_client.post("/api/v1/admin/add_user", json={
        "email": org_admin_email,
        "password": USER_PASSWORD,
        "name": f"Org Admin {org_code}",
        "role": "ORG_ADMIN",
        "organization_id": org_id
    }, headers=admin_headers)
    assert resp.status_code == 200
    org_admin_id = resp.json().get("user_id")

    # Sign in as org admin to invite user
    resp = await http_client.post("/api/v1/signin", json={
        "email": org_admin_email,
        "password": USER_PASSWORD
    })
    org_admin_token = resp.json()["access_token"]
    org_admin_headers = {"Authorization": f"Bearer {org_admin_token}"}

    # Invite and signup user
    resp = await http_client.post("/api/v1/admin/invite_user", json={
        "email": user_email,
        "role": "USER",
        "expires_in_seconds": 3600
    }, headers=org_admin_headers)
    assert resp.status_code == 200
    invitation_id = resp.json()["invitation_id"]

    resp = await http_client.post("/api/v1/signup", json={
        "email": user_email,
        "password": USER_PASSWORD,
        "name": f"User {org_code}",
        "invitation_id": invitation_id
    })
    assert resp.status_code == 200
    user_id = resp.json().get("user_id")

    # Sign in as user
    resp = await http_client.post("/api/v1/signin", json={
        "email": user_email,
        "password": USER_PASSWORD
    })
    user_token = resp.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Create client
    resp = await http_client.post("/api/v1/clients", json={
        "code": f"client_{org_code}",
        "name": f"Client for {org_name}",
        "type": "COMPANY",
        "description": f"Test client for {org_name}"
    }, headers=user_headers)
    assert resp.status_code == 200
    client_id = resp.json()["_id"]

    # Create project
    resp = await http_client.post("/api/v1/projects", json={
        "code": f"proj_{org_code}",
        "client_id": client_id,
        "name": f"Project for {org_name}",
        "start_date": datetime.now(tz=timezone.utc).isoformat()
    }, headers=user_headers)
    assert resp.status_code == 200
    project_id = resp.json()["_id"]

    # Create documents with embeddings directly in DB
    await init_org_db(org_id)
    document_ids = []
    for idx, doc_data in enumerate(doc_content):
        title = doc_data["title"]
        embedding = embeddings_by_title.get(title, [])

        doc = ProjectDocument(
            project_id=project_id,
            code=f"DOC_{org_code}_{idx:03d}",
            name=f"{org_name} - {title}",
            content=doc_data["content"],
            description=f"{title} for {org_name}",
            content_embedding=embedding
        )
        await doc.insert()
        document_ids.append(str(doc.id))

    return {
        "org_id": org_id,
        "org_admin_id": org_admin_id,
        "org_admin_email": org_admin_email,
        "user_id": user_id,
        "user_email": user_email,
        "user_token": user_token,
        "user_headers": user_headers,
        "invitation_id": invitation_id,
        "client_id": client_id,
        "project_id": project_id,
        "document_ids": document_ids,
    }


async def cleanup_test_org(ctx: dict, test_mode: str):
    """Clean up a test organization and all its data."""
    if not ctx.get("org_id"):
        return

    if test_mode == "live" and firestore_mode:
        # In Firestore mode init_org_db can fail with IAM errors in cleanup;
        # drop_org_db already nukes the whole DB so skip individual doc deletion
        await drop_org_db(ctx["org_id"])
        # Clean up system-level records only
        for email, uid in [
            (ctx.get("user_email"), ctx.get("user_id")),
            (ctx.get("org_admin_email"), ctx.get("org_admin_id")),
        ]:
            u = await User.get(uid) if uid else None
            if u is None and email:
                u = await User.find_one(User.email == email)
            if u:
                await u.delete()
        if ctx.get("invitation_id"):
            from instacrud.model.system_model import Invitation
            inv = await Invitation.get(ctx["invitation_id"])
            if inv:
                await inv.delete()
        org = await Organization.get(ctx["org_id"])
        if org:
            await org.delete()
        return

    await init_org_db(ctx["org_id"])

    # Delete documents
    for doc_id in ctx.get("document_ids", []):
        doc = await ProjectDocument.get(doc_id)
        if doc:
            await doc.delete()

    # Delete project
    if ctx.get("project_id"):
        proj = await Project.get(ctx["project_id"])
        if proj:
            await proj.delete()

    # Delete client
    if ctx.get("client_id"):
        client = await Client.get(ctx["client_id"])
        if client:
            await client.delete()

    if test_mode == "live":
        await drop_org_db(ctx["org_id"])

    # Delete invitation
    if ctx.get("invitation_id"):
        from instacrud.model.system_model import Invitation
        inv = await Invitation.get(ctx["invitation_id"])
        if inv:
            await inv.delete()

    # Delete user
    if ctx.get("user_id"):
        user = await User.get(ctx["user_id"])
        if user:
            await user.delete()
    else:
        user = await User.find_one(User.email == ctx.get("user_email"))
        if user:
            await user.delete()

    # Delete org admin
    if ctx.get("org_admin_id"):
        admin = await User.get(ctx["org_admin_id"])
        if admin:
            await admin.delete()
    else:
        admin = await User.find_one(User.email == ctx.get("org_admin_email"))
        if admin:
            await admin.delete()

    # Delete organization
    org = await Organization.get(ctx["org_id"])
    if org:
        await org.delete()

    # Clear FAISS index for this tenant
    clear_vector_search(ctx["org_id"])


# Document content sets for different tenants
DOC_CONTENT_ORG1 = [
    {
        "title": "Smart Building IoT Implementation",
        "content": "This comprehensive proposal outlines the integration of Internet of Things (IoT) sensors and smart devices across our Chicago headquarters facility. The project encompasses installing temperature monitors, occupancy sensors, and automated lighting systems throughout the 15-story building. Our team will deploy over 500 wireless sensors connected via mesh network topology, enabling real-time monitoring and predictive maintenance."
    },
    {
        "title": "San Francisco Office Lease Agreement",
        "content": "This legally binding commercial lease agreement is entered into between Pacific Properties LLC (Landlord) and TechVenture Inc (Tenant) for office space located at 450 Mission Street, San Francisco, California. The premises consist of 12,000 square feet on the 8th floor with panoramic bay views. The lease term is five years commencing January 1st, with monthly rent of $72,000 plus utilities."
    },
    {
        "title": "Mobile App Development Progress Report Q3",
        "content": "Our development team has successfully completed 78% of the planned features for the new mobile banking application during Q3. The iOS and Android versions are progressing in parallel using React Native framework, allowing for efficient code sharing. Key accomplishments include implementing biometric authentication (fingerprint and facial recognition), real-time transaction notifications via push messaging."
    },
]

DOC_CONTENT_ORG2 = [
    {
        "title": "Electric Vehicle Fleet Transition Strategy",
        "content": "This strategic document presents our roadmap for transitioning our entire corporate vehicle fleet to electric vehicles (EVs) across operations in Los Angeles, Phoenix, and Las Vegas by 2027. Currently, we operate 250 delivery vans and service vehicles powered by diesel and gasoline. The phased approach will replace 50 vehicles annually over five years, beginning with shorter-route vehicles in urban areas."
    },
    {
        "title": "Cybersecurity Incident Response Final Report",
        "content": "This report documents the security incident that occurred on March 15th affecting our Houston data center and the comprehensive response measures implemented. At 2:47 AM, our intrusion detection system identified suspicious network traffic patterns indicating potential ransomware activity. The security operations center immediately isolated affected servers, preventing spread to critical production systems."
    },
    {
        "title": "Renewable Energy Investment Proposal",
        "content": "This investment proposal presents an opportunity to acquire and develop a 150-megawatt wind farm project in rural Montana, strategically positioned to serve growing energy demands in Seattle, Portland, and Boise markets. The site features consistent wind resources with average speeds of 8.5 meters per second, ideal for modern turbine technology."
    },
]


class VectorSearchTestState:
    """Shared state for vector search tests."""
    org1_ctx: dict = {}
    org2_ctx: dict = {}
    admin_user_id: str = None
    initialized: bool = False


@pytest.fixture(scope="module")
def embeddings_by_title():
    """Module-scoped fixture for embeddings."""
    return load_embeddings_by_title()


@pytest.fixture(scope="module")
async def module_http_client(test_mode, initialized_system_db):
    """Module-scoped HTTP client for vector search tests."""
    if test_mode == "mock":
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
    else:
        limits = httpx.Limits(max_connections=500, max_keepalive_connections=200)
        async with httpx.AsyncClient(
            base_url=settings.BASE_URL,
            limits=limits,
            timeout=httpx.Timeout(60.0)
        ) as client:
            yield client


@pytest.fixture(scope="module")
async def vector_search_setup(module_http_client: httpx.AsyncClient, test_mode, embeddings_by_title):
    """
    Module-scoped fixture that sets up two organizations with documents for vector search testing.
    Shared across all tests in this module.
    """
    if test_mode != "live":
        pytest.skip("Vector search tests require live mode (--type=live)")

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    state = VectorSearchTestState()

    # Create system admin
    admin_user = User(
        email=TEST_ADMIN_EMAIL,
        hashed_password=pwd_context.hash(TEST_ADMIN_PASSWORD),
        name="Vector Search Test Admin",
        role=Role.ADMIN
    )
    await admin_user.insert()
    state.admin_user_id = str(admin_user.id)

    # Sign in as admin
    resp = await module_http_client.post("/api/v1/signin", json={
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASSWORD
    })
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Clear any existing FAISS state
    clear_vector_search()

    # Setup Org 1 with documents about IoT, lease, and mobile app
    state.org1_ctx = await setup_test_org(
        module_http_client, admin_headers, ORG1_CODE, "Vector Test Org 1",
        ORG1_USER_EMAIL, pwd_context, embeddings_by_title, DOC_CONTENT_ORG1
    )

    # Setup Org 2 with documents about EV, cybersecurity, and wind farm
    state.org2_ctx = await setup_test_org(
        module_http_client, admin_headers, ORG2_CODE, "Vector Test Org 2",
        ORG2_USER_EMAIL, pwd_context, embeddings_by_title, DOC_CONTENT_ORG2
    )

    state.initialized = True

    yield state

    # Cleanup
    await cleanup_test_org(state.org1_ctx, test_mode)
    await cleanup_test_org(state.org2_ctx, test_mode)

    if state.admin_user_id:
        admin = await User.get(state.admin_user_id)
        if admin:
            await admin.delete()

    clear_vector_search()


@pytest.mark.asyncio
@pytest.mark.medium
async def test_vector_search_cold_load(module_http_client: httpx.AsyncClient, vector_search_setup):
    """
    Test cold load - first search should initialize FAISS index and return correct results.
    """
    state = vector_search_setup

    # Search in Org 1 for IoT sensors - should find Smart Building doc
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "IoT sensors building automation"},
        headers=state.org1_ctx["user_headers"]
    )
    assert resp.status_code == 200, f"Semantic search failed: {resp.text}"
    results = resp.json()["entities"]

    assert len(results) > 0, "Expected at least 1 result for IoT search"
    found_iot = any("Smart Building" in r["name"] or "IoT" in r["name"] for r in results[:3])
    assert found_iot, f"Expected to find IoT document in top 3, got: {[r['name'] for r in results[:3]]}"

    # Search in Org 2 for electric vehicles - should find EV doc
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "electric vehicle fleet EV charging"},
        headers=state.org2_ctx["user_headers"]
    )
    assert resp.status_code == 200
    results = resp.json()["entities"]

    assert len(results) > 0, "Expected at least 1 result for EV search"
    found_ev = any("Electric Vehicle" in r["name"] or "EV" in r["name"] or "Fleet" in r["name"] for r in results[:3])
    assert found_ev, f"Expected to find EV document in top 3, got: {[r['name'] for r in results[:3]]}"


@pytest.mark.asyncio
@pytest.mark.critical
@pytest.mark.cross_tenant
async def test_vector_search_tenant_isolation(module_http_client: httpx.AsyncClient, vector_search_setup):
    """
    CRITICAL: Verify tenant isolation - cross-tenant queries must not leak data.
    """
    state = vector_search_setup

    # Org 1 user searches for EV (which is in Org 2) - should NOT find it
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "electric vehicle fleet EV charging"},
        headers=state.org1_ctx["user_headers"]
    )
    assert resp.status_code == 200
    results = resp.json()["entities"]

    ev_leak = any("Electric Vehicle" in r["name"] or "EV" in r["name"] for r in results)
    assert not ev_leak, f"SECURITY: Org 1 user found Org 2's EV document! Results: {[r['name'] for r in results]}"

    # Org 2 user searches for IoT (which is in Org 1) - should NOT find it
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "IoT sensors building automation"},
        headers=state.org2_ctx["user_headers"]
    )
    assert resp.status_code == 200
    results = resp.json()["entities"]

    iot_leak = any("Smart Building" in r["name"] or "IoT" in r["name"] for r in results)
    assert not iot_leak, f"SECURITY: Org 2 user found Org 1's IoT document! Results: {[r['name'] for r in results]}"

    # Cross-check: Org 1 search for cybersecurity (Org 2's doc)
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "ransomware cybersecurity incident Houston"},
        headers=state.org1_ctx["user_headers"]
    )
    results = resp.json()["entities"]
    cyber_leak = any("Cybersecurity" in r["name"] or "Ransomware" in r["name"] for r in results)
    assert not cyber_leak, f"SECURITY: Org 1 should not see Org 2's cybersecurity doc!"

    # Cross-check: Org 2 search for mobile app (Org 1's doc)
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "mobile banking React Native biometric"},
        headers=state.org2_ctx["user_headers"]
    )
    results = resp.json()["entities"]
    mobile_leak = any("Mobile" in r["name"] or "Banking" in r["name"] for r in results)
    assert not mobile_leak, f"SECURITY: Org 2 should not see Org 1's mobile app doc!"


@pytest.mark.asyncio
@pytest.mark.medium
async def test_vector_search_correct_tenant_results(module_http_client: httpx.AsyncClient, vector_search_setup):
    """
    Test that each tenant gets correct results for their own documents.
    """
    state = vector_search_setup

    # Org 1 should find their lease document
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "commercial lease San Francisco office"},
        headers=state.org1_ctx["user_headers"]
    )
    assert resp.status_code == 200
    results = resp.json()["entities"]
    found_lease = any("Lease" in r["name"] or "San Francisco" in r["name"] for r in results[:3])
    assert found_lease, f"Org 1 should find their lease doc, got: {[r['name'] for r in results[:3]]}"

    # Org 2 should find their wind farm document
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "wind farm renewable energy Montana"},
        headers=state.org2_ctx["user_headers"]
    )
    assert resp.status_code == 200
    results = resp.json()["entities"]
    found_wind = any("Renewable" in r["name"] or "Energy" in r["name"] or "Wind" in r["name"] for r in results[:3])
    assert found_wind, f"Org 2 should find their wind farm doc, got: {[r['name'] for r in results[:3]]}"


@pytest.mark.asyncio
@pytest.mark.medium
async def test_vector_search_new_document_availability(module_http_client: httpx.AsyncClient, vector_search_setup):
    """
    Test that newly added documents become available in semantic search after FAISS refresh.
    """
    state = vector_search_setup

    # Create a new document via API (triggers embedding + invalidation in server)
    resp = await module_http_client.post("/api/v1/documents", json={
        "project_id": state.org1_ctx["project_id"],
        "code": "DOC_NEW_001",
        "name": "Customer Survey Analysis Report",
        "content": "Our annual customer satisfaction survey conducted across all markets in New York, Boston, Miami, and Atlanta achieved a record response rate of 34% with 8,500 completed questionnaires. Net Promoter Score increased to 42 indicating strong customer loyalty."
    }, headers=state.org1_ctx["user_headers"])
    assert resp.status_code == 200, f"Failed to create document: {resp.text}"
    new_doc_id = resp.json()["_id"]
    state.org1_ctx["document_ids"].append(new_doc_id)

    # Force embedding recalculation to ensure embedding exists
    resp = await module_http_client.post(
        f"/api/v1/documents/{new_doc_id}/recalculate-embedding",
        headers=state.org1_ctx["user_headers"]
    )
    assert resp.status_code == 200, f"Failed to recalculate embedding: {resp.text}"

    # Search for the new document - FAISS should find it after refresh
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "customer satisfaction survey questionnaires"},
        headers=state.org1_ctx["user_headers"]
    )
    assert resp.status_code == 200
    results = resp.json()["entities"]

    found_survey = any("Customer" in r["name"] or "Survey" in r["name"] for r in results[:5])
    assert found_survey, f"New document should be found, got: {[r['name'] for r in results[:5]]}"


@pytest.mark.asyncio
@pytest.mark.medium
async def test_vector_search_document_edit_availability(module_http_client: httpx.AsyncClient, vector_search_setup):
    """
    Test that edited documents become searchable with new content after FAISS refresh.
    """
    state = vector_search_setup

    # Create document with placeholder content via API
    resp = await module_http_client.post("/api/v1/documents", json={
        "project_id": state.org1_ctx["project_id"],
        "code": "DOC_EDIT_001",
        "name": "Placeholder Document",
        "content": "This is a placeholder document that will be edited."
    }, headers=state.org1_ctx["user_headers"])
    assert resp.status_code == 200
    edit_doc_id = resp.json()["_id"]
    state.org1_ctx["document_ids"].append(edit_doc_id)

    # Update it with data center migration content via API
    resp = await module_http_client.put(
        f"/api/v1/documents/{edit_doc_id}",
        json={
            "project_id": state.org1_ctx["project_id"],
            "code": "DOC_EDIT_001",
            "name": "Data Center Migration Plan",
            "content": "This project plan details the migration of all IT infrastructure from our aging facility in Dallas to a modern colocation data center in Austin, Texas. The migration encompasses 200 physical servers and 1,500 virtual machines."
        },
        headers=state.org1_ctx["user_headers"]
    )
    assert resp.status_code == 200, f"Update failed: {resp.text}"

    # Force embedding recalculation
    resp = await module_http_client.post(
        f"/api/v1/documents/{edit_doc_id}/recalculate-embedding",
        headers=state.org1_ctx["user_headers"]
    )
    assert resp.status_code == 200, f"Recalculate failed: {resp.text}"

    # Search for the updated document
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "data center migration Dallas servers"},
        headers=state.org1_ctx["user_headers"]
    )
    assert resp.status_code == 200
    results = resp.json()["entities"]

    found_dc = any("Data Center" in r["name"] or "Migration" in r["name"] for r in results[:5])
    assert found_dc, f"Edited document should be found, got: {[r['name'] for r in results[:5]]}"


@pytest.mark.asyncio
@pytest.mark.low
async def test_vector_search_stability(module_http_client: httpx.AsyncClient, vector_search_setup):
    """
    Test FAISS index stability across multiple searches.
    """
    state = vector_search_setup

    search_queries = [
        ("IoT sensors building", state.org1_ctx["user_headers"], "Org1"),
        ("electric vehicle fleet", state.org2_ctx["user_headers"], "Org2"),
        ("mobile banking React", state.org1_ctx["user_headers"], "Org1"),
        ("cybersecurity ransomware", state.org2_ctx["user_headers"], "Org2"),
        ("lease agreement office", state.org1_ctx["user_headers"], "Org1"),
        ("wind farm renewable", state.org2_ctx["user_headers"], "Org2"),
    ]

    for query, headers, org_name in search_queries:
        resp = await module_http_client.get(
            "/api/v1/find-semantic",
            params={"q": query},
            headers=headers
        )
        assert resp.status_code == 200, f"Search failed for {org_name}: {resp.text}"
        results = resp.json()["entities"]
        assert len(results) > 0, f"Expected results for '{query}' in {org_name}"


@pytest.mark.asyncio
@pytest.mark.critical
@pytest.mark.cross_tenant
async def test_vector_search_isolation_after_modifications(module_http_client: httpx.AsyncClient, vector_search_setup):
    """
    CRITICAL: Verify tenant isolation remains intact after document additions and modifications.
    """
    state = vector_search_setup

    # After all previous test modifications, verify isolation is still intact
    # Org 1 should see their docs
    resp = await module_http_client.get("/api/v1/documents", headers=state.org1_ctx["user_headers"])
    org1_docs = resp.json()

    # Org 2 should still see only their 3 docs
    resp = await module_http_client.get("/api/v1/documents", headers=state.org2_ctx["user_headers"])
    org2_docs = resp.json()

    # Verify no cross-contamination in document lists
    org1_doc_names = [d["name"] for d in org1_docs]
    org2_doc_names = [d["name"] for d in org2_docs]

    # Org 1 should not have Org 2 docs
    for name in org1_doc_names:
        assert "Electric Vehicle" not in name, f"Org 1 has Org 2's EV doc in list!"
        assert "Cybersecurity" not in name, f"Org 1 has Org 2's cybersecurity doc in list!"
        assert "Renewable Energy" not in name, f"Org 1 has Org 2's renewable doc in list!"

    # Org 2 should not have Org 1 docs
    for name in org2_doc_names:
        assert "Smart Building" not in name, f"Org 2 has Org 1's IoT doc in list!"
        assert "Lease Agreement" not in name, f"Org 2 has Org 1's lease doc in list!"
        assert "Mobile App" not in name, f"Org 2 has Org 1's mobile doc in list!"

    # Final semantic search isolation check
    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "electric vehicle fleet EV"},
        headers=state.org1_ctx["user_headers"]
    )
    results = resp.json()["entities"]
    ev_leak = any("Electric Vehicle" in r["name"] for r in results)
    assert not ev_leak, "SECURITY FINAL: Org 1 can still see Org 2's EV document after modifications!"

    resp = await module_http_client.get(
        "/api/v1/find-semantic",
        params={"q": "IoT sensors smart building"},
        headers=state.org2_ctx["user_headers"]
    )
    results = resp.json()["entities"]
    iot_leak = any("Smart Building" in r["name"] for r in results)
    assert not iot_leak, "SECURITY FINAL: Org 2 can still see Org 1's IoT document after modifications!"
