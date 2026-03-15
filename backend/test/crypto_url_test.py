"""
Connection URL encryption integration tests.

Tests encrypt/decrypt round-trip through real Organization documents stored in
the system DB.  Verifies:
  - Plaintext mongo_url is auto-encrypted on first middleware read (backward compat)
  - Already-encrypted mongo_url is decrypted correctly
  - Re-reading the org after auto-encryption returns the same plaintext URL

Works in both mock and live modes.

Usage:
    pytest test/crypto_url_test.py -v
    pytest test/crypto_url_test.py -v --type=live
"""

import pytest

from instacrud.config import settings
from instacrud.crypto import (
    encrypt_connection_url,
    decrypt_connection_url,
    is_plain_connection_url,
    resolve_org_mongo_url,
)
from instacrud.model.system_model import Organization


def _get_plain_url(mongo_container) -> str:
    """Return a plain MongoDB URL suitable for crypto tests.

    In mock mode the testcontainer URL is used; in live mode the system
    MONGO_URL from settings is used (no actual connection is opened to it
    during these tests — it is only encrypted/decrypted as a string).
    """
    if mongo_container is not None:
        return mongo_container.get_connection_url()
    return settings.MONGO_URL


@pytest.mark.asyncio
async def test_plaintext_mongo_url_auto_encrypted(
    http_client, clean_db, mongo_container
):
    """When an org has a plaintext mongo_url, resolve_org_mongo_url should:
    1. Return the plaintext URL for immediate use
    2. Encrypt it and persist the encrypted value back to the DB
    3. On the next read the org.mongo_url in DB is no longer plaintext
    """
    plain_url = _get_plain_url(mongo_container)

    # Create org with a raw plaintext mongo_url (simulating legacy data)
    org = Organization(
        name="Crypto Test Org",
        code="crypto_test_plain",
        description="org for crypto backward-compat test",
        mongo_url=plain_url,
    )
    await org.insert()
    org_id = str(org.id)

    try:
        # --- first read: should detect plaintext, encrypt & save, return plaintext ---
        result = await resolve_org_mongo_url(org)
        assert result == plain_url, "first read must return the original plaintext URL"

        # The in-memory org should now hold the encrypted value
        assert not is_plain_connection_url(org.mongo_url), (
            "org.mongo_url should have been encrypted in-place"
        )
        assert decrypt_connection_url(org.mongo_url) == plain_url

        # --- reload from DB and verify persistence ---
        org_reloaded = await Organization.get(org.id)
        assert org_reloaded is not None
        assert not is_plain_connection_url(org_reloaded.mongo_url), (
            "persisted mongo_url must be encrypted after auto-migration"
        )
        assert decrypt_connection_url(org_reloaded.mongo_url) == plain_url

    finally:
        await _cleanup_org(org_id)


@pytest.mark.asyncio
async def test_encrypted_mongo_url_decrypted(
    http_client, clean_db, mongo_container
):
    """When an org already has an encrypted mongo_url, resolve_org_mongo_url
    should just decrypt it without touching the DB."""
    plain_url = _get_plain_url(mongo_container)
    encrypted_url = encrypt_connection_url(plain_url)

    org = Organization(
        name="Crypto Test Org Enc",
        code="crypto_test_enc",
        description="org with pre-encrypted url",
        mongo_url=encrypted_url,
    )
    await org.insert()
    org_id = str(org.id)

    try:
        result = await resolve_org_mongo_url(org)
        assert result == plain_url, "should decrypt to original URL"

        # mongo_url in DB must remain unchanged (no re-encryption)
        org_reloaded = await Organization.get(org.id)
        assert org_reloaded.mongo_url == encrypted_url, (
            "already-encrypted URL must not be re-written"
        )

    finally:
        await _cleanup_org(org_id)


@pytest.mark.asyncio
async def test_encrypt_decrypt_round_trip(
    http_client, clean_db, mongo_container
):
    """Full round-trip: store encrypted, read back, decrypt — must match."""
    plain_url = _get_plain_url(mongo_container)
    encrypted_url = encrypt_connection_url(plain_url)

    org = Organization(
        name="Crypto RT Org",
        code="crypto_test_rt",
        description="round-trip test",
        mongo_url=encrypted_url,
    )
    await org.insert()
    org_id = str(org.id)

    try:
        org_reloaded = await Organization.get(org.id)
        decrypted = decrypt_connection_url(org_reloaded.mongo_url)
        assert decrypted == plain_url

    finally:
        await _cleanup_org(org_id)


@pytest.mark.asyncio
async def test_each_encryption_produces_different_ciphertext(
    http_client, clean_db, mongo_container
):
    """AES-GCM uses random IV — encrypting the same URL twice must produce
    different ciphertexts, but both must decrypt to the same value."""
    plain_url = _get_plain_url(mongo_container)
    enc1 = encrypt_connection_url(plain_url)
    enc2 = encrypt_connection_url(plain_url)

    assert enc1 != enc2, "random IV should produce different ciphertexts"
    assert decrypt_connection_url(enc1) == plain_url
    assert decrypt_connection_url(enc2) == plain_url


@pytest.mark.asyncio
async def test_none_and_empty_mongo_url(
    http_client, clean_db
):
    """Orgs with no mongo_url should pass through without errors."""
    org = Organization(
        name="No URL Org",
        code="crypto_test_none",
        description="no mongo_url",
    )
    await org.insert()
    org_id = str(org.id)

    try:
        result = await resolve_org_mongo_url(org)
        assert result is None

    finally:
        await _cleanup_org(org_id)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _cleanup_org(org_id: str):
    from beanie import PydanticObjectId

    org = await Organization.get(PydanticObjectId(org_id))
    if org:
        await org.delete()
