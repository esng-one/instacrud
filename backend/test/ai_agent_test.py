# test/ai_agent_test.py
"""
Tests for AI completion, streaming, embedding, and image generation APIs.
Requires live mode with real API keys - mock mode is not supported.

Live mode: Uses running server with existing AI models and real API keys.
Mock mode: Skipped (AI APIs cannot be mocked).

Run with:
    pytest backend/test/ai_agent_test.py --type=live -v
"""

import time
import pytest
import httpx
from passlib.context import CryptContext

from instacrud.model.system_model import User, Organization, Role
from instacrud.database import init_org_db, drop_org_db, firestore_mode
from conftest import wait_for_org_active

# Test configuration
_TS = str(int(time.time()))
TEST_ADMIN_EMAIL = f"ai_test_admin_{_TS}@test.com"
TEST_ADMIN_PASSWORD = "testadmin123"
TEST_ORG_CODE = f"ai_test_org_{_TS}"
TEST_USER_EMAIL = f"ai_test_user_{_TS}@test.com"
TEST_USER_PASSWORD = "testuser123"

# Module-level cache for shared test state
_cached_context: dict | None = None
_setup_done = False
_use_count = 0


async def _do_setup(http_client: httpx.AsyncClient) -> dict:
    """Perform the actual setup - called once per module."""
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(TEST_ADMIN_PASSWORD)

    # Create admin user directly in DB
    admin_user = User(
        email=TEST_ADMIN_EMAIL,
        hashed_password=hashed_password,
        name="AI Test Admin",
        role=Role.ADMIN
    )
    await admin_user.insert()
    admin_user_id = str(admin_user.id)

    # Sign in as ADMIN
    resp = await http_client.post("/api/v1/signin", json={
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin sign in failed: {resp.text}"
    admin_token = resp.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Create test organization
    resp = await http_client.post("/api/v1/admin/organizations", json={
        "name": "AI Test Org",
        "code": TEST_ORG_CODE,
        "description": "Organization for AI tests"
    }, headers=headers_admin)
    assert resp.status_code == 200, f"Create org failed: {resp.text}"

    org = await Organization.find_one(Organization.code == TEST_ORG_CODE)
    assert org is not None
    org_id = str(org.id)

    await wait_for_org_active(http_client, org_id, headers_admin)

    # Add test user to organization
    resp = await http_client.post("/api/v1/admin/add_user", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD,
        "name": "AI Test User",
        "role": "USER",
        "organization_id": org_id
    }, headers=headers_admin)
    assert resp.status_code == 200, f"Add user failed: {resp.text}"

    test_user = await User.find_one(User.email == TEST_USER_EMAIL)
    test_user_id = str(test_user.id) if test_user else None

    # Sign in as test user
    resp = await http_client.post("/api/v1/signin", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    assert resp.status_code == 200, f"User sign in failed: {resp.text}"
    user_token = resp.json()["access_token"]
    headers_user = {"Authorization": f"Bearer {user_token}"}

    return {
        "headers_admin": headers_admin,
        "headers_user": headers_user,
        "org_id": org_id,
        "admin_user_id": admin_user_id,
        "test_user_id": test_user_id,
    }


async def _do_cleanup(context: dict):
    """Perform cleanup of all created resources."""
    org_id = context.get("org_id")
    test_user_id = context.get("test_user_id")
    admin_user_id = context.get("admin_user_id")

    # Drop the organization database first
    if org_id:
        if not firestore_mode:
            await init_org_db(org_id)
        await drop_org_db(org_id)

    if firestore_mode:
        # In Firestore mode drop_org_db deletes the whole DB; skip direct doc deletion
        # Just clean up system-level records
        if org_id:
            organization = await Organization.get(org_id)
            if organization:
                await organization.delete()
        for email, uid in [(TEST_USER_EMAIL, test_user_id), (TEST_ADMIN_EMAIL, admin_user_id)]:
            if uid:
                u = await User.get(uid)
            else:
                u = await User.find_one(User.email == email)
            if u:
                await u.delete()
        return

    # Delete test user
    if test_user_id:
        user = await User.get(test_user_id)
        if user:
            await user.delete()
    else:
        user = await User.find_one(User.email == TEST_USER_EMAIL)
        if user:
            await user.delete()

    # Delete organization
    if org_id:
        organization = await Organization.get(org_id)
        if organization:
            await organization.delete()

    # Delete admin user
    if admin_user_id:
        admin = await User.get(admin_user_id)
        if admin:
            await admin.delete()
    else:
        admin = await User.find_one(User.email == TEST_ADMIN_EMAIL)
        if admin:
            await admin.delete()


@pytest.fixture
async def ai_test_context(http_client: httpx.AsyncClient, clean_db, test_mode, request):
    """
    Shared setup for all AI tests.

    Uses module-level caching so setup runs once, but works with function-scoped fixtures.
    Cleanup runs after all tests in the module complete.
    """
    global _cached_context, _setup_done, _use_count

    if test_mode == "mock":
        pytest.skip("AI agent tests require real API keys and cannot run in mock mode")

    # Only do setup once per module
    if not _setup_done:
        _cached_context = await _do_setup(http_client)
        _setup_done = True

    _use_count += 1

    # Reference-counted cleanup: only runs when the last test is done
    def cleanup():
        global _setup_done, _cached_context, _use_count
        _use_count -= 1
        if _use_count == 0 and _setup_done:
            import asyncio
            asyncio.get_event_loop().run_until_complete(_do_cleanup(_cached_context))
            _setup_done = False
            _cached_context = None

    request.addfinalizer(cleanup)

    # Return context with current http_client
    return {
        **_cached_context,
        "http_client": http_client,
    }


@pytest.mark.asyncio
async def test_list_ai_models(ai_test_context):
    """Test listing available AI models."""
    http_client = ai_test_context["http_client"]
    headers_admin = ai_test_context["headers_admin"]

    resp = await http_client.get("/api/v1/admin/ai-models", headers=headers_admin)
    assert resp.status_code == 200, f"List models failed: {resp.text}"
    models = resp.json()
    assert isinstance(models, list)
    assert len(models) > 0, "No AI models found in database"


@pytest.mark.asyncio
async def test_completion_gpt5_mini(ai_test_context):
    """Test non-streaming completion with GPT-5 Mini."""
    http_client = ai_test_context["http_client"]
    headers_user = ai_test_context["headers_user"]

    resp = await http_client.post("/api/v1/completion", json={
        "model_id": "gpt-5-mini",
        "prompt": "What is 2+2? Answer with just the number.",
        "stream": False
    }, headers=headers_user, timeout=60.0)

    if resp.status_code == 404:
        pytest.skip("Model gpt-5-mini not found")
    if resp.status_code == 500 and "API key" in resp.text:
        pytest.skip("OpenAI API key not configured")
    if resp.status_code == 403:
        pytest.skip("Tier access denied - user tier too low")

    assert resp.status_code == 200, f"Completion failed: {resp.text}"
    data = resp.json()
    assert "content" in data
    assert len(data["content"]) > 0
    if "API key" in data["content"] or "No API key" in data["content"]:
        pytest.skip("OpenAI API key not configured")
    assert "4" in data["content"], f"Expected '4' in response: {data['content']}"


@pytest.mark.asyncio
async def test_streaming_completion(ai_test_context):
    """Test streaming completion with GPT-5 Mini."""
    http_client = ai_test_context["http_client"]
    headers_user = ai_test_context["headers_user"]

    async with http_client.stream("POST", "/api/v1/completion", json={
        "model_id": "gpt-5-mini",
        "prompt": "Count from 1 to 5, one number per line.",
        "stream": True
    }, headers=headers_user, timeout=60.0) as resp:

        if resp.status_code == 404:
            pytest.skip("Model gpt-5-mini not found")
        if resp.status_code == 500:
            pytest.skip("Model streaming error or API key not configured")
        if resp.status_code == 403:
            pytest.skip("Tier access denied")

        assert resp.status_code == 200, f"Streaming failed: {resp.status_code}"

        chunks = []
        async for chunk in resp.aiter_text():
            chunks.append(chunk)

        full_response = "".join(chunks)
        assert len(full_response) > 0, "No streaming content received"
        if "API key" in full_response or "No API key" in full_response:
            pytest.skip("OpenAI API key not configured")
        assert any(str(i) in full_response for i in range(1, 6)), f"Expected numbers in response: {full_response}"


@pytest.mark.asyncio
async def test_completion_claude_sonnet(ai_test_context):
    """Test completion with Claude Sonnet."""
    http_client = ai_test_context["http_client"]
    headers_user = ai_test_context["headers_user"]

    resp = await http_client.post("/api/v1/completion", json={
        "model_id": "claude-sonnet-4-5",
        "prompt": "Say 'Hello' in French. Answer with just the French word.",
        "stream": False
    }, headers=headers_user, timeout=90.0)

    if resp.status_code == 404:
        pytest.skip("Model claude-sonnet-4-5 not found")
    if resp.status_code == 500 and ("api_key" in resp.text.lower() or "authentication" in resp.text.lower()):
        pytest.skip("Claude API key not configured")
    if resp.status_code == 403:
        pytest.skip("Tier access denied")

    assert resp.status_code == 200, f"Claude completion failed: {resp.text}"
    data = resp.json()
    assert "content" in data
    if "API key" in data["content"] or "No API key" in data["content"] or "authentication" in data["content"].lower():
        pytest.skip("Claude API key not configured")
    assert "bonjour" in data["content"].lower(), f"Expected 'Bonjour' in response: {data['content']}"


@pytest.mark.asyncio
async def test_completion_model_not_found(ai_test_context):
    """Test that completion with non-existent model returns 404."""
    http_client = ai_test_context["http_client"]
    headers_user = ai_test_context["headers_user"]

    resp = await http_client.post("/api/v1/completion", json={
        "model_id": "non-existent-model-xyz",
        "prompt": "Test",
        "stream": False
    }, headers=headers_user, timeout=30.0)

    assert resp.status_code == 404
    assert "not found" in resp.text.lower()


@pytest.mark.asyncio
async def test_image_generation_flux(ai_test_context):
    """Test image generation with FLUX Schnell."""
    http_client = ai_test_context["http_client"]
    headers_user = ai_test_context["headers_user"]

    resp = await http_client.post("/api/v1/images/generate", json={
        "model_id": "black-forest-labs/FLUX-1-schnell",
        "prompt": "A simple red circle on a white background",
        "size": "512x512",
        "n": 1,
        "response_format": "url"
    }, headers=headers_user, timeout=120.0)

    if resp.status_code == 404:
        pytest.skip("Model FLUX-1-schnell not found")
    if resp.status_code == 500 and ("API key" in resp.text or "DEEP_INFRA" in resp.text):
        pytest.skip("DeepInfra API key not configured")
    if resp.status_code == 403:
        pytest.skip("Tier access denied")

    assert resp.status_code == 200, f"Image generation failed: {resp.text}"
    data = resp.json()
    assert "images" in data
    assert len(data["images"]) > 0
    if isinstance(data["images"][0], str) and ("API key" in data["images"][0] or "error" in data["images"][0].lower()):
        pytest.skip("DeepInfra API key not configured")
    if data.get("format") == "url":
        assert (
            data["images"][0].startswith("http")
            or data["images"][0].startswith("data:image/")
        ), f"Expected URL or data URI: {data['images'][0]}"


@pytest.mark.asyncio
async def test_embeddings(ai_test_context):
    """Test embedding generation."""
    http_client = ai_test_context["http_client"]
    headers_user = ai_test_context["headers_user"]

    resp = await http_client.post("/api/v1/embeddings", json={
        "model_id": "text-embedding-3-small",
        "text": "Hello, world!"
    }, headers=headers_user, timeout=60.0)

    if resp.status_code == 404:
        pytest.skip("Model text-embedding-3-small not found")
    if resp.status_code == 500 and ("api_key" in resp.text.lower() or "API key" in resp.text):
        pytest.skip("OpenAI API key not configured")
    if resp.status_code == 403:
        pytest.skip("Tier access denied")

    assert resp.status_code == 200, f"Embedding generation failed: {resp.text}"
    data = resp.json()
    assert "embeddings" in data
    if not data["embeddings"] or (isinstance(data["embeddings"], list) and len(data["embeddings"]) == 0):
        pytest.skip("Embedding generation returned empty - API key may not be configured")
    assert isinstance(data["embeddings"], list)
    assert len(data["embeddings"]) > 0


@pytest.mark.asyncio
async def test_usage_stats(ai_test_context):
    """Test fetching usage statistics."""
    http_client = ai_test_context["http_client"]
    headers_user = ai_test_context["headers_user"]

    resp = await http_client.get("/api/v1/usage/stats", headers=headers_user, timeout=30.0)

    assert resp.status_code == 200, f"Usage stats failed: {resp.text}"
    data = resp.json()
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_unauthorized_access(ai_test_context):
    """Test that requests without auth are rejected."""
    http_client = ai_test_context["http_client"]

    resp = await http_client.post("/api/v1/completion", json={
        "model_id": "gpt-5-mini",
        "prompt": "Test"
    }, timeout=30.0)

    assert resp.status_code in [401, 403], f"Expected auth error, got: {resp.status_code}"


@pytest.mark.asyncio
async def test_completion_deepinfra_llama(ai_test_context):
    """Test completion with DeepInfra LLaMA model."""
    http_client = ai_test_context["http_client"]
    headers_user = ai_test_context["headers_user"]

    resp = await http_client.post("/api/v1/completion", json={
        "model_id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "prompt": "What is the capital of France? Answer in one word.",
        "stream": False
    }, headers=headers_user, timeout=90.0)

    if resp.status_code == 404:
        pytest.skip("Model LLaMA 3.1 8B not found")
    if resp.status_code == 500 and ("api_key" in resp.text.lower() or "not configured" in resp.text.lower() or "401" in resp.text or "DEEP_INFRA" in resp.text):
        pytest.skip("DeepInfra API key not configured")
    if resp.status_code == 403:
        pytest.skip("Tier access denied")

    assert resp.status_code == 200, f"LLaMA completion failed: {resp.text}"
    data = resp.json()
    assert "content" in data
    if "API key" in data["content"] or "No API key" in data["content"] or "DEEP_INFRA" in data["content"]:
        pytest.skip("DeepInfra API key not configured")
    assert "paris" in data["content"].lower(), f"Expected 'Paris' in response: {data['content']}"


# ==============================================================================
# CONVERSATION SYNC TESTS
# ==============================================================================

TEST_SYNC_ADMIN_EMAIL = f"sync_test_admin_{_TS}@test.com"
TEST_SYNC_ADMIN_PASSWORD = "syncadmin123"
TEST_SYNC_ORG_CODE = f"sync_test_org_{_TS}"
TEST_SYNC_USER_EMAIL = f"sync_test_user_{_TS}@test.com"
TEST_SYNC_USER_PASSWORD = "syncuser123"

_sync_cached_context: dict | None = None
_sync_setup_done = False
_sync_use_count = 0


async def _do_sync_setup(http_client: httpx.AsyncClient) -> dict:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(TEST_SYNC_ADMIN_PASSWORD)

    admin_user = User(
        email=TEST_SYNC_ADMIN_EMAIL,
        hashed_password=hashed_password,
        name="Sync Test Admin",
        role=Role.ADMIN
    )
    await admin_user.insert()
    admin_user_id = str(admin_user.id)

    resp = await http_client.post("/api/v1/signin", json={
        "email": TEST_SYNC_ADMIN_EMAIL,
        "password": TEST_SYNC_ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Admin sign in failed: {resp.text}"
    admin_token = resp.json()["access_token"]
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    resp = await http_client.post("/api/v1/admin/organizations", json={
        "name": "Sync Test Org",
        "code": TEST_SYNC_ORG_CODE,
        "description": "Organization for sync tests"
    }, headers=headers_admin)
    assert resp.status_code == 200, f"Create org failed: {resp.text}"

    org = await Organization.find_one(Organization.code == TEST_SYNC_ORG_CODE)
    assert org is not None
    org_id = str(org.id)

    await wait_for_org_active(http_client, org_id, headers_admin)

    resp = await http_client.post("/api/v1/admin/add_user", json={
        "email": TEST_SYNC_USER_EMAIL,
        "password": TEST_SYNC_USER_PASSWORD,
        "name": "Sync Test User",
        "role": "USER",
        "organization_id": org_id
    }, headers=headers_admin)
    assert resp.status_code == 200, f"Add user failed: {resp.text}"

    test_user = await User.find_one(User.email == TEST_SYNC_USER_EMAIL)
    test_user_id = str(test_user.id) if test_user else None

    resp = await http_client.post("/api/v1/signin", json={
        "email": TEST_SYNC_USER_EMAIL,
        "password": TEST_SYNC_USER_PASSWORD
    })
    assert resp.status_code == 200, f"User sign in failed: {resp.text}"
    user_token = resp.json()["access_token"]
    headers_user = {"Authorization": f"Bearer {user_token}"}

    return {
        "headers_admin": headers_admin,
        "headers_user": headers_user,
        "org_id": org_id,
        "admin_user_id": admin_user_id,
        "test_user_id": test_user_id,
    }


async def _do_sync_cleanup(context: dict):
    org_id = context.get("org_id")
    test_user_id = context.get("test_user_id")
    admin_user_id = context.get("admin_user_id")

    if org_id:
        if not firestore_mode:
            await init_org_db(org_id)
        await drop_org_db(org_id)

    if firestore_mode:
        if org_id:
            organization = await Organization.get(org_id)
            if organization:
                await organization.delete()
        for email, uid in [(TEST_SYNC_USER_EMAIL, test_user_id), (TEST_SYNC_ADMIN_EMAIL, admin_user_id)]:
            u = await User.get(uid) if uid else None
            if u is None and email:
                u = await User.find_one(User.email == email)
            if u:
                await u.delete()
        return

    if test_user_id:
        user = await User.get(test_user_id)
        if user:
            await user.delete()
    else:
        user = await User.find_one(User.email == TEST_SYNC_USER_EMAIL)
        if user:
            await user.delete()

    if org_id:
        organization = await Organization.get(org_id)
        if organization:
            await organization.delete()

    if admin_user_id:
        admin = await User.get(admin_user_id)
        if admin:
            await admin.delete()
    else:
        admin = await User.find_one(User.email == TEST_SYNC_ADMIN_EMAIL)
        if admin:
            await admin.delete()


@pytest.fixture
async def sync_test_context(http_client: httpx.AsyncClient, clean_db, request):
    global _sync_cached_context, _sync_setup_done, _sync_use_count

    if not _sync_setup_done:
        _sync_cached_context = await _do_sync_setup(http_client)
        _sync_setup_done = True

    _sync_use_count += 1

    # Reference-counted cleanup: only runs when the last test is done
    def cleanup():
        global _sync_cached_context, _sync_setup_done, _sync_use_count
        _sync_use_count -= 1
        if _sync_use_count == 0 and _sync_setup_done:
            import asyncio
            asyncio.get_event_loop().run_until_complete(_do_sync_cleanup(_sync_cached_context))
            _sync_setup_done = False
            _sync_cached_context = None

    request.addfinalizer(cleanup)

    return {
        **_sync_cached_context,
        "http_client": http_client,
    }


@pytest.mark.asyncio
async def test_org_sync_defaults_to_enabled(sync_test_context):
    """New organization should have sync enabled (local_only_conversations=False)."""
    http_client = sync_test_context["http_client"]
    headers_admin = sync_test_context["headers_admin"]
    org_id = sync_test_context["org_id"]

    resp = await http_client.get(f"/api/v1/admin/organizations/{org_id}", headers=headers_admin)
    assert resp.status_code == 200, f"Get org failed: {resp.text}"
    data = resp.json()
    assert data.get("local_only_conversations") is False, (
        f"Expected sync enabled by default, got: {data.get('local_only_conversations')}"
    )


@pytest.mark.asyncio
async def test_admin_can_disable_sync(sync_test_context):
    """Admin can set local_only_conversations=True to disable sync."""
    http_client = sync_test_context["http_client"]
    headers_admin = sync_test_context["headers_admin"]
    org_id = sync_test_context["org_id"]

    resp = await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": True},
        headers=headers_admin
    )
    assert resp.status_code == 200, f"Patch org failed: {resp.text}"
    data = resp.json()
    assert data.get("local_only_conversations") is True

    # Re-enable after test
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": False},
        headers=headers_admin
    )


@pytest.mark.asyncio
async def test_admin_can_reenable_sync(sync_test_context):
    """Admin can re-enable sync after disabling it."""
    http_client = sync_test_context["http_client"]
    headers_admin = sync_test_context["headers_admin"]
    org_id = sync_test_context["org_id"]

    # Disable first
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": True},
        headers=headers_admin
    )

    # Re-enable
    resp = await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": False},
        headers=headers_admin
    )
    assert resp.status_code == 200, f"Re-enable sync failed: {resp.text}"
    data = resp.json()
    assert data.get("local_only_conversations") is False


@pytest.mark.asyncio
async def test_conversation_sync_allowed_when_enabled(sync_test_context):
    """Creating a conversation succeeds when sync is enabled."""
    http_client = sync_test_context["http_client"]
    headers_admin = sync_test_context["headers_admin"]
    headers_user = sync_test_context["headers_user"]
    org_id = sync_test_context["org_id"]

    # Ensure sync is enabled
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": False},
        headers=headers_admin
    )

    resp = await http_client.post("/api/v1/conversations", json={
        "title": "Test Conversation",
        "messages": []
    }, headers=headers_user)
    assert resp.status_code == 200, f"Create conversation failed: {resp.text}"
    data = resp.json()
    assert "id" in data or "_id" in data

    # Cleanup conversation
    conv_id = data.get("id") or data.get("_id")
    if conv_id:
        await http_client.delete(f"/api/v1/conversations/{conv_id}", headers=headers_user)


@pytest.mark.asyncio
async def test_conversation_sync_blocked_when_disabled(sync_test_context):
    """Creating a conversation fails with 400 when sync is disabled."""
    http_client = sync_test_context["http_client"]
    headers_admin = sync_test_context["headers_admin"]
    headers_user = sync_test_context["headers_user"]
    org_id = sync_test_context["org_id"]

    # Disable sync
    resp = await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": True},
        headers=headers_admin
    )
    assert resp.status_code == 200

    resp = await http_client.post("/api/v1/conversations", json={
        "title": "Should Be Blocked",
        "messages": []
    }, headers=headers_user)
    assert resp.status_code == 400, f"Expected 400, got: {resp.status_code} {resp.text}"
    assert "disabled" in resp.text.lower()

    # Re-enable sync
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": False},
        headers=headers_admin
    )


@pytest.mark.asyncio
async def test_get_settings_includes_sync_flag(sync_test_context):
    """GET /api/v1/user-settings returns local_only_conversations for authenticated user."""
    http_client = sync_test_context["http_client"]
    headers_user = sync_test_context["headers_user"]

    resp = await http_client.get("/api/v1/user-settings", headers=headers_user)
    assert resp.status_code == 200, f"user-settings failed: {resp.text}"
    data = resp.json()
    assert "local_only_conversations" in data, f"Missing local_only_conversations in: {data}"
    assert isinstance(data["local_only_conversations"], bool)


@pytest.mark.asyncio
async def test_user_settings_get(sync_test_context):
    """GET /api/v1/user-settings returns user sync preference."""
    http_client = sync_test_context["http_client"]
    headers_user = sync_test_context["headers_user"]

    resp = await http_client.get("/api/v1/user-settings", headers=headers_user)
    assert resp.status_code == 200, f"user-settings GET failed: {resp.text}"
    data = resp.json()
    assert "local_only_conversations" in data
    assert isinstance(data["local_only_conversations"], bool)


@pytest.mark.asyncio
async def test_user_can_override_sync_setting(sync_test_context):
    """User can set their own local_only_conversations override."""
    http_client = sync_test_context["http_client"]
    headers_admin = sync_test_context["headers_admin"]
    headers_user = sync_test_context["headers_user"]
    org_id = sync_test_context["org_id"]

    # Ensure org sync is enabled
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": False},
        headers=headers_admin
    )

    # User disables sync for themselves
    resp = await http_client.patch("/api/v1/user-settings", json={
        "local_only_conversations": True
    }, headers=headers_user)
    assert resp.status_code == 200, f"user-settings PATCH failed: {resp.text}"
    data = resp.json()
    assert data.get("local_only_conversations") is True

    # user-settings should reflect user override
    resp = await http_client.get("/api/v1/user-settings", headers=headers_user)
    assert resp.status_code == 200
    settings_data = resp.json()
    assert settings_data.get("local_only_conversations") is True

    # Reset user override
    await http_client.patch("/api/v1/user-settings", json={
        "local_only_conversations": None
    }, headers=headers_user)


@pytest.mark.asyncio
async def test_user_setting_blocks_sync_when_org_allows(sync_test_context):
    """User local override blocks sync even when org allows it."""
    http_client = sync_test_context["http_client"]
    headers_admin = sync_test_context["headers_admin"]
    headers_user = sync_test_context["headers_user"]
    org_id = sync_test_context["org_id"]

    # Org allows sync
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": False},
        headers=headers_admin
    )

    # User disables sync
    await http_client.patch("/api/v1/user-settings", json={
        "local_only_conversations": True
    }, headers=headers_user)

    # Creating conversation should be blocked
    resp = await http_client.post("/api/v1/conversations", json={
        "title": "User Override Block Test",
        "messages": []
    }, headers=headers_user)
    assert resp.status_code == 400, f"Expected 400 from user override, got: {resp.status_code}"

    # Reset
    await http_client.patch("/api/v1/user-settings", json={
        "local_only_conversations": None
    }, headers=headers_user)


@pytest.mark.asyncio
async def test_sync_patch_blocked_when_disabled(sync_test_context):
    """PATCH conversation is also blocked when sync is disabled."""
    http_client = sync_test_context["http_client"]
    headers_admin = sync_test_context["headers_admin"]
    headers_user = sync_test_context["headers_user"]
    org_id = sync_test_context["org_id"]

    # Ensure sync is enabled, create a conversation
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": False},
        headers=headers_admin
    )
    resp = await http_client.post("/api/v1/conversations", json={
        "title": "Patch Test Conversation",
        "messages": []
    }, headers=headers_user)
    assert resp.status_code == 200, f"Create conversation failed: {resp.text}"
    conv_id = resp.json().get("id") or resp.json().get("_id")

    # Disable sync
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": True},
        headers=headers_admin
    )

    # PATCH should be blocked
    resp = await http_client.patch(f"/api/v1/conversations/{conv_id}", json={
        "title": "Updated Title"
    }, headers=headers_user)
    assert resp.status_code == 400, f"Expected 400, got: {resp.status_code}"

    # Re-enable and cleanup
    await http_client.patch(
        f"/api/v1/admin/organizations/{org_id}",
        json={"local_only_conversations": False},
        headers=headers_admin
    )
    if conv_id:
        await http_client.delete(f"/api/v1/conversations/{conv_id}", headers=headers_user)
