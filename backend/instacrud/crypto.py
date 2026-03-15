"""
Cryptographic utilities for AES-256-GCM encryption.

This module provides cross-compatible encryption functions that match the Java
implementation in CryptoProcessor.java. Both implementations use:
- AES-256-GCM for authenticated encryption
- PBKDF2-HMAC-SHA256 for key derivation (65536 iterations)
- 12-byte IV for GCM
- 128-bit authentication tag

Data formats:
- Encrypted AES key: salt (16 bytes) + IV (12 bytes) + ciphertext
- Encrypted text/data: IV (12 bytes) + ciphertext
"""

import base64
import hashlib
import secrets

from Crypto.Cipher import AES

ITERATIONS = 65536
KEY_LENGTH = 32  # 256 bits in bytes
GCM_TAG_LENGTH = 16  # 128 bits in bytes (GCM tag is appended to ciphertext)
AES_KEY_SIZE = 32  # 256 bits in bytes
GCM_IV_LENGTH = 12  # bytes, recommended size for GCM
SALT_LENGTH = 16  # bytes

# Deterministic KDF salt for zero-knowledge key derivation.
# The user's password is never stored; instead this fixed-salt PBKDF2
# produces a stable derived key that is held in the session and used
# to unlock the user's encrypted AES key.  A random salt would make
# the derived key non-reproducible across requests, breaking decryption.
KEY_DERIVATION_SALT = base64.b64decode("A9U5g6cVZjCX9V3ws78D4g==")


def generate_aes_key() -> str:
    """
    Generate a 256-bit AES key.

    Returns:
        Base64-encoded AES key string.
    """
    key = secrets.token_bytes(AES_KEY_SIZE)
    return base64.b64encode(key).decode('utf-8')


def _pbkdf2_derive(password: str, salt: bytes) -> bytes:
    """
    Derive a key using PBKDF2-HMAC-SHA256.

    Uses hashlib for cross-compatibility with Java's PBKDF2WithHmacSHA256.

    Args:
        password: Password string.
        salt: Salt bytes.

    Returns:
        Derived key bytes.
    """
    return hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        ITERATIONS,
        dklen=KEY_LENGTH
    )


def get_key_encryption_password(user_password: str) -> str:
    """
    Derive an encryption password from user password using PBKDF2.

    Uses a fixed salt to ensure consistent key derivation across
    Python and Java implementations.

    Args:
        user_password: The user's password string.

    Returns:
        Base64-encoded derived key string.
    """
    derived_key = _pbkdf2_derive(user_password, KEY_DERIVATION_SALT)
    return base64.b64encode(derived_key).decode('utf-8')


def encrypt_aes_key(key: str, password: str) -> str:
    """
    Encrypt a 256-bit AES key using a password with AES/GCM.

    The encrypted output format is: salt (16 bytes) + IV (12 bytes) + ciphertext
    This format matches the Java implementation.

    Args:
        key: Base64-encoded AES key to encrypt.
        password: Password to derive encryption key from.

    Returns:
        Base64-encoded encrypted key string.
    """
    # Generate random salt
    salt = secrets.token_bytes(SALT_LENGTH)

    # Derive key from password using PBKDF2
    pbe_key = _pbkdf2_derive(password, salt)

    # Generate random IV
    iv = secrets.token_bytes(GCM_IV_LENGTH)

    # Encrypt the AES key
    cipher = AES.new(pbe_key, AES.MODE_GCM, nonce=iv)
    key_bytes = base64.b64decode(key)
    ciphertext, tag = cipher.encrypt_and_digest(key_bytes)

    # Concatenate: salt + IV + ciphertext + tag
    # Note: In GCM, the tag is typically appended to ciphertext
    encrypted_key = salt + iv + ciphertext + tag

    return base64.b64encode(encrypted_key).decode('utf-8')


def decrypt_aes_key(encrypted_key_str: str, password: str) -> str:
    """
    Decrypt a 256-bit AES key using a password with AES/GCM.

    Args:
        encrypted_key_str: Base64-encoded encrypted key (salt + IV + ciphertext + tag).
        password: Password to derive decryption key from.

    Returns:
        Base64-encoded decrypted AES key string.
    """
    encrypted_data = base64.b64decode(encrypted_key_str)

    # Extract salt, IV, ciphertext, and tag
    salt = encrypted_data[:SALT_LENGTH]
    iv = encrypted_data[SALT_LENGTH:SALT_LENGTH + GCM_IV_LENGTH]
    ciphertext_with_tag = encrypted_data[SALT_LENGTH + GCM_IV_LENGTH:]

    # In Java's GCM implementation, the tag is appended to ciphertext
    ciphertext = ciphertext_with_tag[:-GCM_TAG_LENGTH]
    tag = ciphertext_with_tag[-GCM_TAG_LENGTH:]

    # Derive key from password using PBKDF2
    pbe_key = _pbkdf2_derive(password, salt)

    # Decrypt the AES key
    cipher = AES.new(pbe_key, AES.MODE_GCM, nonce=iv)
    decrypted_key = cipher.decrypt_and_verify(ciphertext, tag)

    return base64.b64encode(decrypted_key).decode('utf-8')


def generate_encrypted_aes_key_by_user_password(user_password: str) -> str:
    """
    Generate a new AES key and encrypt it with the user's password.

    Args:
        user_password: The user's password string.

    Returns:
        Base64-encoded encrypted AES key string.
    """
    aes_key = generate_aes_key()
    encryption_password = get_key_encryption_password(user_password)
    return encrypt_aes_key(aes_key, encryption_password)


def re_encrypt_aes_key(encrypted_key_str: str, old_password: str, new_password: str) -> str:
    """
    Re-encrypt an AES key with a new password.

    Args:
        encrypted_key_str: Base64-encoded encrypted key.
        old_password: Current password.
        new_password: New password to encrypt with.

    Returns:
        Base64-encoded re-encrypted key string.
    """
    key = decrypt_aes_key(encrypted_key_str, old_password)
    return encrypt_aes_key(key, new_password)


def encrypt_bytes(data: bytes, key: str) -> bytes:
    """
    Encrypt a byte array using AES/GCM.

    The encrypted output format is: IV (12 bytes) + ciphertext + tag

    Args:
        data: Bytes to encrypt.
        key: Base64-encoded AES key.

    Returns:
        Encrypted bytes (IV + ciphertext + tag).
    """
    # Generate random IV
    iv = secrets.token_bytes(GCM_IV_LENGTH)

    # Encrypt the data
    key_bytes = base64.b64decode(key)
    cipher = AES.new(key_bytes, AES.MODE_GCM, nonce=iv)
    ciphertext, tag = cipher.encrypt_and_digest(data)

    # Concatenate: IV + ciphertext + tag
    return iv + ciphertext + tag


def decrypt_bytes(iv_and_encrypted_data: bytes, key: str) -> bytes:
    """
    Decrypt a byte array using AES/GCM.

    Args:
        iv_and_encrypted_data: Encrypted bytes (IV + ciphertext + tag).
        key: Base64-encoded AES key.

    Returns:
        Decrypted bytes.
    """
    # Extract IV, ciphertext, and tag
    iv = iv_and_encrypted_data[:GCM_IV_LENGTH]
    ciphertext_with_tag = iv_and_encrypted_data[GCM_IV_LENGTH:]
    ciphertext = ciphertext_with_tag[:-GCM_TAG_LENGTH]
    tag = ciphertext_with_tag[-GCM_TAG_LENGTH:]

    # Decrypt the data
    key_bytes = base64.b64decode(key)
    cipher = AES.new(key_bytes, AES.MODE_GCM, nonce=iv)
    return cipher.decrypt_and_verify(ciphertext, tag)


def encrypt_text(plain_text: str, key: str) -> str:
    """
    Encrypt text using AES/GCM.

    Args:
        plain_text: Text to encrypt.
        key: Base64-encoded AES key.

    Returns:
        Base64-encoded encrypted text.
    """
    encrypted_bytes = encrypt_bytes(plain_text.encode('utf-8'), key)
    return base64.b64encode(encrypted_bytes).decode('utf-8')


def decrypt_text(encrypted_text: str, key: str) -> str:
    """
    Decrypt text using AES/GCM.

    Args:
        encrypted_text: Base64-encoded encrypted text.
        key: Base64-encoded AES key.

    Returns:
        Decrypted text string.
    """
    encrypted_bytes = base64.b64decode(encrypted_text)
    decrypted_bytes = decrypt_bytes(encrypted_bytes, key)
    return decrypted_bytes.decode('utf-8')

# =============================================================================
# Connection URL Encryption
# =============================================================================
# Encrypt/decrypt database connection URLs stored in the system DB.
# Uses SECRET_KEY (JWT secret) directly as the encryption key.

def _get_url_encryption_key() -> str:
    """
    Get AES-256 key for connection URL encryption.

    Uses MONGO_URL_SECRET_KEY if set, otherwise falls back to SECRET_KEY.
    SHA-256 normalizes the secret to exactly 32 bytes for AES-256.

    Not cached: decryption only happens on connection init / reconnect
    (DatabaseManager caches the connection itself), so the cost is negligible.
    """
    from instacrud.config import settings
    secret = settings.MONGO_URL_SECRET_KEY or settings.SECRET_KEY
    key_bytes = hashlib.sha256(secret.encode('utf-8')).digest()
    return base64.b64encode(key_bytes).decode('utf-8')


def is_plain_connection_url(value: str) -> bool:
    """
    Detect whether a connection URL string is plaintext (not encrypted).

    Plaintext MongoDB/Firestore URLs contain recognizable prefixes.
    Encrypted values are base64 strings that won't match these patterns.
    """
    if not value:
        return False
    lower = value.strip().lower()
    return (
        lower.startswith("mongodb://")
        or lower.startswith("mongodb+srv://")
        or lower.startswith("firestore://")
        or lower.startswith("http://")
        or lower.startswith("https://")
    )


def encrypt_connection_url(url: str) -> str:
    """Encrypt a connection URL using SECRET_KEY-derived AES key."""
    if not url:
        return url
    key = _get_url_encryption_key()
    return encrypt_text(url, key)


def decrypt_connection_url(encrypted_url: str) -> str:
    """Decrypt a connection URL using SECRET_KEY-derived AES key."""
    if not encrypted_url:
        return encrypted_url
    key = _get_url_encryption_key()
    return decrypt_text(encrypted_url, key)


async def resolve_org_mongo_url(org) -> str | None:
    """
    Return the plaintext mongo_url for an Organization, handling both
    encrypted and legacy plaintext values.

    If the stored URL is plaintext (legacy/manual entry), it is encrypted
    in-place and saved back to the system DB so subsequent reads use the
    encrypted version.

    Args:
        org: Organization document (must have mongo_url and id attributes).

    Returns:
        Plaintext mongo_url, or None if not set.
    """
    from loguru import logger

    raw = org.mongo_url
    if not raw:
        return None

    if is_plain_connection_url(raw):
        encrypted = encrypt_connection_url(raw)
        org.mongo_url = encrypted
        await org.save()
        logger.info(
            f"[CRYPTO] Organization '{org.id}' had a plaintext mongo_url. "
            f"It has been encrypted and saved back to the system DB."
        )
        return raw

    return decrypt_connection_url(raw)
