"""
Firestore lifecycle integration test.

Tests the full lifecycle against a real GCP Firestore project, using the
app's native Beanie ODM and init helpers for data operations:
  create database → build mongo_url (SCRAM + IAM) → wait for IAM →
  init org DB → populate via Beanie models → query & verify →
  update & delete documents → drop database → confirm gone.

NOTE: Excluded from run_all_test.py — run directly, as this performs
real cloud operations against GCP Firestore.

Requirements:
  - GCP credentials (ADC or JSON via GCP_FIREBASE_SA_JSON)
  - GCP_PROJECT_ID set in .env or environment

Usage:
    pytest test/firestore_test.py -v
    pytest test/firestore_test.py -v --type=live   (uses live MONGO_URL)
"""

import time
import uuid
import pytest

from google.cloud import firestore_admin_v1

from instacrud.config import settings
from instacrud.crypto import encrypt_connection_url, decrypt_connection_url, is_plain_connection_url
from instacrud.database import init_org_db
from instacrud.helpers.gcp_firebase_helper import (
    gcp_get_credentials,
    gcp_firestore_database_exist,
    gcp_firestore_create_database,
    gcp_firestore_delete_database,
    gcp_firestore_build_mongo_url,
    gcp_firestore_wait_for_iam,
)
from instacrud.model.organization_model import (
    Client, Project, ProjectDocument, Contact, Address,
)
from init.mock_data_helper import (
    populate_org_data,
    SAMPLE_CLIENTS,
    SAMPLE_PROJECTS,
    SAMPLE_DOC_CONTENT,
)

# Firestore database IDs: lowercase, digits, hyphens; max 63 chars
TEST_DB_ID = f"test-lc-{uuid.uuid4().hex[:12]}"


@pytest.fixture(scope="module", autouse=True)
async def enable_firestore_mode(mongo_container):
    """Initialize system DB on local mongo (so AiModel etc. are available),
    then enable firestore_mode for org DB operations and patch Beanie to
    skip index creation (Firestore doesn't support createIndexes)."""
    import instacrud.database as db_mod
    from beanie.odm.utils import init as _beanie_init

    # System DB init must happen while firestore_mode is still False
    # so it uses get_database("_system") on the local testcontainer.
    await db_mod.init_system_db()

    original_mode = db_mod.firestore_mode
    original_init_indexes = _beanie_init.Initializer.init_indexes

    db_mod.firestore_mode = True

    async def _no_indexes(self, cls, allow_index_dropping=False):
        return []
    _beanie_init.Initializer.init_indexes = _no_indexes

    yield

    db_mod.firestore_mode = original_mode
    _beanie_init.Initializer.init_indexes = original_init_indexes


@pytest.fixture(scope="module")
def credentials():
    return gcp_get_credentials()


@pytest.fixture(scope="module")
def admin_client(credentials):
    return firestore_admin_v1.FirestoreAdminClient(credentials=credentials)


class TestFirestoreLifecycle:
    """Ordered lifecycle: create → connect → populate → verify → teardown."""

    # Class-level state shared across ordered tests
    _mongo_url: str = ""

    # ------------------------------------------------------------------
    # Phase 1: Create Firestore database
    # ------------------------------------------------------------------

    def test_01_create_database(self, credentials):
        """Create Firestore DB via GCP admin API."""
        result = gcp_firestore_create_database(TEST_DB_ID, credentials=credentials)
        assert result is not None
        assert gcp_firestore_database_exist(TEST_DB_ID, credentials=credentials)
        print(f"\nCreated Firestore database: {TEST_DB_ID}")

    # ------------------------------------------------------------------
    # Phase 2: Build mongo_url (SCRAM creds + IAM) and wait for propagation
    # Same as production: assign_firestore_org_db → wait_for_iam
    # ------------------------------------------------------------------

    def test_02_build_mongo_url(self, credentials):
        """Create SCRAM credentials, grant IAM, build MongoDB-compatible URL."""
        mongo_url = gcp_firestore_build_mongo_url(TEST_DB_ID, credentials=credentials)
        assert mongo_url
        assert TEST_DB_ID in mongo_url
        self.__class__._mongo_url = mongo_url
        print(f"\nBuilt mongo_url for {TEST_DB_ID}")

    def test_02a_encrypt_decrypt_round_trip(self):
        """Verify encrypt/decrypt round-trip preserves the Firestore mongo_url.

        This mirrors the signup flow where mongo_url is encrypted before storing
        in the Organization document. If encryption corrupts special characters
        in the password (e.g. url-encoded chars), this test will catch it.
        """
        mongo_url = self.__class__._mongo_url
        assert mongo_url, "mongo_url not set — test_02 must run first"

        # Encrypt (same as signup: organization.mongo_url = encrypt_connection_url(mongo_url))
        encrypted = encrypt_connection_url(mongo_url)
        assert encrypted, "encryption returned empty"
        assert not is_plain_connection_url(encrypted), "encrypted value should not look like a plain URL"

        # Decrypt (same as middleware: resolve_org_mongo_url → decrypt_connection_url)
        decrypted = decrypt_connection_url(encrypted)
        assert decrypted == mongo_url, (
            f"Decrypt mismatch!\n"
            f"  original:  {mongo_url}\n"
            f"  decrypted: {decrypted}"
        )
        print(f"\nEncrypt/decrypt round-trip OK for Firestore URL")

    @pytest.mark.asyncio
    async def test_03_wait_for_iam(self):
        """Poll until IAM role propagates and MongoDB endpoint is reachable.

        Uses gcp_firestore_wait_for_iam (requires 3 consecutive successes) because
        a single successful probe is not sufficient — IAM propagation is flaky and
        intermittent success does not guarantee stability for subsequent operations.
        """
        mongo_url = self.__class__._mongo_url
        assert mongo_url, "mongo_url not set — test_02 must run first"

        await gcp_firestore_wait_for_iam(mongo_url, timeout_seconds=300, required_successes=3)
        print(f"\nIAM fully propagated (3 consecutive successes)")

    # ------------------------------------------------------------------
    # Phase 3: Initialize org DB + populate mock data (same as signup)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_04_init_org_db(self, enable_firestore_mode):
        """Initialize org database context via init_org_db (same as signup flow).

        Also tests encrypt→decrypt→connect to verify the full signup+middleware
        round-trip: signup encrypts the URL and stores it, middleware later
        decrypts it and reconnects.
        """
        mongo_url = self.__class__._mongo_url
        assert mongo_url, "mongo_url not set"

        # 1. Direct plaintext connection (same as signup path)
        await init_org_db(TEST_DB_ID, mongo_url=mongo_url)
        print(f"\n  init_org_db with plaintext URL: OK")

        # 2. Simulate middleware path: encrypt, then decrypt, then connect
        encrypted = encrypt_connection_url(mongo_url)
        decrypted = decrypt_connection_url(encrypted)
        assert decrypted == mongo_url, "decrypt mismatch"

        # Force re-init by evicting cached connection
        import instacrud.database as db_mod
        db_mod._db_manager._remove_connection(f"firestore:{TEST_DB_ID}")

        await init_org_db(TEST_DB_ID, mongo_url=decrypted)
        print(f"  init_org_db with decrypted URL: OK")

    @pytest.mark.asyncio
    async def test_05_populate_mock_data(self, enable_firestore_mode):
        """Insert sample data via Beanie (same path as signup)."""
        mongo_url = self.__class__._mongo_url
        result = await populate_org_data(
            org_id=TEST_DB_ID,
            client_data=SAMPLE_CLIENTS,
            project_data=SAMPLE_PROJECTS,
            doc_content=SAMPLE_DOC_CONTENT,
            create_indexes=False,
            mongo_url=mongo_url,
        )
        assert result["clients"] == len(SAMPLE_CLIENTS)
        assert result["projects"] == len(SAMPLE_PROJECTS)
        assert result["documents"] == len(SAMPLE_DOC_CONTENT)
        assert result["contacts"] > 0
        assert result["addresses"] > 0
        print(f"\nPopulated: {result}")

    # ------------------------------------------------------------------
    # Phase 4: Query & verify data through Beanie
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_06_verify_clients(self, enable_firestore_mode):
        await init_org_db(TEST_DB_ID, mongo_url=self.__class__._mongo_url)
        clients = await Client.find_all().to_list()
        assert len(clients) == len(SAMPLE_CLIENTS)

        codes = {c.code for c in clients}
        expected_codes = {c[0] for c in SAMPLE_CLIENTS}
        assert codes == expected_codes

    @pytest.mark.asyncio
    async def test_07_verify_projects(self, enable_firestore_mode):
        await init_org_db(TEST_DB_ID, mongo_url=self.__class__._mongo_url)
        projects = await Project.find_all().to_list()
        assert len(projects) == len(SAMPLE_PROJECTS)

        codes = {p.code for p in projects}
        expected_codes = {p[0] for p in SAMPLE_PROJECTS}
        assert codes == expected_codes

    @pytest.mark.asyncio
    async def test_08_verify_documents(self, enable_firestore_mode):
        await init_org_db(TEST_DB_ID, mongo_url=self.__class__._mongo_url)
        docs = await ProjectDocument.find_all().to_list()
        assert len(docs) == len(SAMPLE_DOC_CONTENT)
        for doc in docs:
            assert doc.content is not None
            assert len(doc.content) > 0

    @pytest.mark.asyncio
    async def test_09_verify_contacts(self, enable_firestore_mode):
        await init_org_db(TEST_DB_ID, mongo_url=self.__class__._mongo_url)
        contacts = await Contact.find_all().to_list()
        assert len(contacts) == len(SAMPLE_CLIENTS)  # one contact per client
        emails = {c.email for c in contacts}
        assert len(emails) == len(contacts)  # all unique

    @pytest.mark.asyncio
    async def test_10_verify_addresses(self, enable_firestore_mode):
        await init_org_db(TEST_DB_ID, mongo_url=self.__class__._mongo_url)
        addresses = await Address.find_all().to_list()
        assert len(addresses) == len(SAMPLE_CLIENTS)  # one address per client

    # ------------------------------------------------------------------
    # Phase 5: CRUD operations via Beanie
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_11_update_client(self, enable_firestore_mode):
        await init_org_db(TEST_DB_ID, mongo_url=self.__class__._mongo_url)
        client = await Client.find_one(Client.code == "acme_corp")
        assert client is not None

        client.name = "Acme Corp (Updated)"
        await client.save()

        refreshed = await Client.find_one(Client.code == "acme_corp")
        assert refreshed.name == "Acme Corp (Updated)"

    @pytest.mark.asyncio
    async def test_12_delete_single_document(self, enable_firestore_mode):
        await init_org_db(TEST_DB_ID, mongo_url=self.__class__._mongo_url)
        docs_before = await ProjectDocument.find_all().to_list()
        count_before = len(docs_before)

        await docs_before[0].delete()

        docs_after = await ProjectDocument.find_all().to_list()
        assert len(docs_after) == count_before - 1

    @pytest.mark.asyncio
    async def test_13_query_filter(self, enable_firestore_mode):
        await init_org_db(TEST_DB_ID, mongo_url=self.__class__._mongo_url)
        companies = await Client.find(Client.type == "COMPANY").to_list()
        persons = await Client.find(Client.type == "PERSON").to_list()
        total = await Client.find_all().to_list()
        assert len(companies) + len(persons) == len(total)

    # ------------------------------------------------------------------
    # Phase 6: Index check via Firestore admin API
    # ------------------------------------------------------------------

    def test_14_list_indexes(self, admin_client):
        parent = (
            f"projects/{settings.GCP_PROJECT_ID}"
            f"/databases/{TEST_DB_ID}"
            f"/collectionGroups/-"
        )
        try:
            indexes = list(admin_client.list_indexes(parent=parent))
            print(f"\nComposite indexes: {len(indexes)}")
        except Exception as e:
            print(f"\nlist_indexes note: {e}")

    # ------------------------------------------------------------------
    # Phase 7: Teardown — delete the Firestore database
    # ------------------------------------------------------------------

    def test_15_delete_database(self, credentials):
        gcp_firestore_delete_database(TEST_DB_ID, credentials=credentials)

    def test_16_database_gone(self, credentials):
        for _ in range(12):
            if not gcp_firestore_database_exist(TEST_DB_ID, credentials=credentials):
                print(f"\nConfirmed database {TEST_DB_ID} deleted")
                return
            time.sleep(5)
        pytest.fail(f"Database {TEST_DB_ID} still exists after 60s")
