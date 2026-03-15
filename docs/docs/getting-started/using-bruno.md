---
sidebar_position: 4
title: Using Bruno
---

# Using Bruno

[Bruno](https://www.usebruno.com/) is an open-source API client included with InstaCRUD for testing and debugging endpoints. The project includes a pre-configured Bruno collection in the `bruno/InstaCRUD/` folder.

---

## Opening the Collection

1. Download and install [Bruno](https://www.usebruno.com/)
2. Open Bruno and select **Open Collection**
3. Navigate to the `bruno/InstaCRUD/` folder in the InstaCRUD repository

---

## Collection Structure

```
bruno/InstaCRUD/
├── bruno.json              # Bruno collection config
├── collection.bru          # Collection-level settings
├── environments/           # Environment configs (add your own)
├── system/                 # Auth & system endpoints
│   ├── Signin.bru
│   ├── Signup.bru
│   ├── Heartbeat.bru
│   ├── Get Settings.bru
│   ├── Forgot Password.bru
│   ├── Reset Password.bru
│   └── Change Password.bru
├── admin/                  # Organization & user management
│   ├── Onboard Organization.bru
│   ├── List Users.bru
│   ├── List Organizations.bru
│   ├── Invite User.bru
│   └── ...
├── clients/                # Client entity CRUD
├── contacts/               # Contact entity CRUD
├── projects/               # Project entity CRUD
├── documents/              # Document entity CRUD
├── addresses/              # Address entity CRUD
├── conversations/          # Conversation entity CRUD
├── search/                 # Search endpoints
├── ai/                     # AI & embeddings endpoints
├── oauth/                  # OAuth login/signup flows
└── calendar/               # Calendar events
```

---

## Environment Setup

The collection uses a `{{baseUrl}}` variable in all request URLs. You need to create an environment to define it:

1. In Bruno, click the environment dropdown in the top bar
2. Select **Configure**
3. Create a new environment (e.g. `local`) with:

| Variable  | Value                    |
|-----------|--------------------------|
| `baseUrl` | `http://localhost:8000`  |

4. Select your new environment from the dropdown

---

## Authentication

Most endpoints require a bearer token. The collection auth is set to `none` by default, and individual requests use `auth: inherit`.

### 1. Sign Up (New Organization)

Run **system > Signup** to create a new user and organization:

```json
{
  "email": "you@example.com",
  "password": "yourpassword",
  "name": "Your Name",
  "role": "admin"
}
```

Optional query parameters (enable by removing the `~` prefix in the Params tab):
- `organization_name` — name for the new organization
- `load_mock_data` — populate with sample data

### 2. Sign In

Run **system > Signin** with your credentials:

```json
{
  "email": "you@example.com",
  "password": "yourpassword"
}
```

The response returns a JWT:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### 3. Set the Token

To apply the token to all requests, update the collection-level auth:

1. Click the collection name (**InstaCRUD**) in Bruno's sidebar
2. Go to the **Auth** tab
3. Change mode to **Bearer Token**
4. Paste your `access_token` value

All requests that use `auth: inherit` will now include this token.

---

## Running Requests

### Entity CRUD

Each entity folder (clients, contacts, projects, etc.) contains standard CRUD requests:

| Request      | Method   | URL Pattern                        |
|--------------|----------|------------------------------------|
| List Items   | `GET`    | `{{baseUrl}}/api/v1/{entity}`      |
| Get Item     | `GET`    | `{{baseUrl}}/api/v1/{entity}/:item_id` |
| Create Item  | `POST`   | `{{baseUrl}}/api/v1/{entity}`      |
| Update Item  | `PUT`    | `{{baseUrl}}/api/v1/{entity}/:item_id` |
| Patch Item   | `PATCH`  | `{{baseUrl}}/api/v1/{entity}/:item_id` |
| Delete Item  | `DELETE` | `{{baseUrl}}/api/v1/{entity}/:item_id` |

### Example: List Clients

1. Ensure the backend is running
2. Open **clients > List Items**
3. Click **Send**

### Example: Create a Client

1. Open **clients > Create Item**
2. Fill in the relevant fields in the JSON body (you can leave system fields like `_id`, `created_at`, etc. empty — the server populates those):

```json
{
  "code": "CLI001",
  "name": "Acme Corp",
  "type": "COMPANY",
  "description": "Test client"
}
```

3. Click **Send**

### Example: Get a Specific Item

1. Open **clients > Get Item**
2. In the **Params** tab, set the `item_id` path parameter to the ID returned from a list or create request
3. Click **Send**

---

## Query Parameters

List requests support these optional parameters (disabled by default — enable by removing the `~` prefix in the Params tab):

| Parameter | Description              | Example              |
|-----------|--------------------------|----------------------|
| `skip`    | Items to skip (offset)   | `10`                 |
| `limit`   | Max items to return      | `25`                 |
| `filters` | JSON filter object       | `{"type":"COMPANY"}` |

---

## Response Examples

Each request file includes example responses (200 and 422) showing the expected response shape. You can view these in the **Examples** tab of any request in Bruno.

---

## Summary

The Bruno collection provides requests for:

- **System** — signup, signin, password management, heartbeat, settings
- **Admin** — organization onboarding, user management, invitations
- **Entity CRUD** — clients, contacts, projects, documents, addresses, conversations
- **Search** — full-text and semantic search
- **AI** — completions, embeddings, image generation, MCP tools
- **OAuth** — login/signup via OAuth providers
- **Calendar** — calendar event retrieval
