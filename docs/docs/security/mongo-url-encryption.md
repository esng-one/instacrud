---
sidebar_position: 3
title: Mongo URL Encryption
---

# Mongo URL Encryption

When `MONGO_USE_ORG_DB` is enabled (or the system runs in Firestore mode), each organization can have its own MongoDB connection URL stored in the system database. These URLs contain credentials and hostnames — sensitive data that must be encrypted at rest.

InstaCRUD encrypts all organization `mongo_url` values using **AES-256-GCM** before persisting them.

---

## Why It's Needed

A connection URL like `mongodb://admin:s3cret@prod-cluster:27017/orgdb?tls=true` contains:

- Database credentials (username and password)
- Infrastructure hostnames and ports
- Database names

If the system database is compromised, plaintext connection URLs would give an attacker direct access to every organization's data. Encryption ensures that even with a full dump of the system database, the URLs are unreadable without the encryption key.

---

## How It Works

### Encryption Key

The encryption key is derived from the `MONGO_URL_SECRET_KEY` environment variable using SHA-256. If not set, `SECRET_KEY` (the JWT signing key) is used as a fallback.

```bash
# .env — recommended: set a dedicated key
MONGO_URL_SECRET_KEY="your-dedicated-encryption-key"
```

:::warning
If you rely on the `SECRET_KEY` fallback and later rotate `SECRET_KEY` (e.g. after a JWT compromise), **all encrypted organization URLs will become unreadable**. Always set `MONGO_URL_SECRET_KEY` separately.
:::

### Encrypt on Write

When an organization is created or its database URL is assigned, the URL is encrypted before being stored:

```
plaintext URL → AES-256-GCM encrypt → base64 → saved to organizations.mongo_url
```

### Decrypt on Read

When the middleware resolves an organization's database connection, it decrypts the stored value:

```
organizations.mongo_url → base64 decode → AES-256-GCM decrypt → plaintext URL
```

Each encryption uses a random 12-byte IV, so the same URL produces different ciphertexts each time. This prevents an attacker from correlating which organizations share the same database.

---

## Backward Compatibility

InstaCRUD supports **automatic migration** of plaintext URLs. If the middleware encounters a `mongo_url` that starts with a recognized scheme (`mongodb://`, `mongodb+srv://`, `firestore://`, etc.), it:

1. Returns the plaintext URL for immediate use (no downtime)
2. Encrypts the URL and saves it back to the database
3. Logs the migration: `[CRYPTO] Organization 'xxx' had a plaintext mongo_url. It has been encrypted and saved back to the system DB.`

Subsequent reads will find the encrypted value and decrypt it normally. This means upgrading from an older version that stored URLs in plaintext requires **zero manual migration** — URLs are encrypted transparently on first access.

---

## Emergency URL Restoration

:::caution
This is an emergency-only procedure for situations where a database URL needs to be changed extremely fast, especially across many organizations in bulk. Under normal circumstances, use the admin API to manage organization database connections.
:::

If an organization's database connection is lost or corrupted, you can restore it by inserting a plaintext URL directly into MongoDB:

```javascript
db.organizations.updateOne(
  { code: "my_org" },
  { $set: { mongo_url: "mongodb://user:pass@new-host:27017/orgdb" } }
)
```

After updating, log in to the application under the affected organization. The backward compatibility logic will:

1. Detect the plaintext URL
2. Use it immediately to connect
3. Encrypt and persist it automatically

No application restart is required.

---

## Configuration Checklist

- [ ] `MONGO_URL_SECRET_KEY` is set to a strong, unique value (separate from `SECRET_KEY`)
- [ ] `MONGO_URL_SECRET_KEY` is backed up securely — losing it means losing access to all encrypted URLs
- [ ] `MONGO_URL_SECRET_KEY` is consistent across all application instances in a cluster
