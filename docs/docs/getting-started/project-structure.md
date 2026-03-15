---
sidebar_position: 2
title: Project Structure
---

# Project Structure

InstaCRUD is organized into backend and frontend directories with supporting tooling.

---

## Repository Root

```
instacrud/
├── backend/                    # Python API server
├── frontend/                   # Next.js admin UI
├── bruno/InstaCRUD/            # Bruno API testing collection
├── docs/                       # Docusaurus documentation site
├── nginx/                      # Nginx reverse proxy config
├── docker-compose.yml          # Local stack orchestration
├── docker-compose.vps.yml      # VPS deployment compose
├── README.md
└── LICENSE
```

---

## Backend (Python)

```
backend/
├── instacrud/                  # Main application package
│   ├── ai/                     # AI services (completion, embedding, vision, MCP)
│   ├── api/                    # REST endpoints, DTOs, middleware
│   ├── helpers/                # Platform helpers (e.g. GCP/Firebase)
│   ├── mailer/                 # Email services (Brevo, file-based)
│   │   └── templates/          # Email templates (HTML/TXT)
│   ├── model/                  # Data models (organization, system)
│   ├── app.py                  # Application entry point
│   ├── config.py               # Configuration loading
│   ├── context.py              # Request context
│   ├── database.py             # Database connection
│   └── utils.py                # Shared utilities
├── init/                       # DB initialization and migration scripts
├── test/                       # Test suite
├── static/                     # Static file serving
├── etalon.env                  # Example environment variables
├── pyproject.toml              # Poetry dependencies
└── Dockerfile
```

Key backend modules:

- **api/** — Organization, system, OAuth, calendar, AI, and search endpoints plus DTOs, middleware, rate limiting, and validators
- **ai/** — LLM completion, embeddings, vision, vector search, MCP client
- **mailer/** — Email delivery with Brevo integration
- **model/** — Pydantic models for organizations and system entities
- **helpers/** — Platform-specific integrations (GCP Firebase)

Run backend:

```bash
poetry run python instacrud/app.py
```

---

## Frontend (Next.js)

```
frontend/
├── src/
│   ├── api/                    # Generated API client
│   │   ├── core/               # HTTP client infrastructure
│   │   ├── models/             # TypeScript types
│   │   └── services/           # Service classes
│   └── app/                    # Next.js App Router
│       └── (admin)/
│           ├── (entities)/     # CRUD views
│           │   ├── addresses/
│           │   ├── aimodels/
│           │   ├── clients/
│           │   ├── contacts/
│           │   ├── documents/
│           │   ├── invitations/
│           │   ├── organizations/
│           │   ├── projects/
│           │   ├── tiers/
│           │   └── users/
│           └── (others-pages)/ # Utility pages
│               ├── ai-assistant/
│               ├── calendar/
│               └── profile/
├── public/                     # Static assets
├── scripts/                    # Build utilities
├── package.json
└── Dockerfile
```

Run frontend:

```bash
npm run dev
```

Generate API client from OpenAPI spec:

```bash
npm run generate-api
```

---

## Bruno

```
bruno/InstaCRUD/
├── bruno.json              # Collection config
├── collection.bru          # Collection-level auth settings
├── environments/           # Environment configs (user-created)
├── system/                 # Auth & system endpoints
├── admin/                  # Organization & user management
├── clients/                # Client entity CRUD
├── contacts/               # Contact entity CRUD
├── projects/               # Project entity CRUD
├── documents/              # Document entity CRUD
├── addresses/              # Address entity CRUD
├── conversations/          # Conversation entity CRUD
├── search/                 # Full-text & semantic search
├── ai/                     # AI completions, embeddings, MCP
├── oauth/                  # OAuth login/signup flows
└── calendar/               # Calendar events
```

See [Using Bruno](./using-bruno.md) for setup and usage details.

---

## Documentation

```
docs/
├── docs/                   # Markdown documentation pages
├── src/                    # Docusaurus theme customizations
├── static/                 # Static assets (images, etc.)
├── docusaurus.config.js    # Site configuration
├── sidebars.js             # Sidebar navigation
└── package.json
```

Run docs locally:

```bash
cd docs && npm start -- --host 0.0.0.0 --port 3002
```

Port 3002 is used to avoid colliding with the frontend on port 3000.

---

## Docker

Run the full stack locally:

```bash
docker-compose up -d
```

Services:

| Service            | Container        | Port  | Description              |
|--------------------|------------------|-------|--------------------------|
| **instacrud**      | `instacrud`      | 8000  | Python API server        |
| **mongo**          | `mongo`          | 27017 | MongoDB 8.x database    |
| **instacrud-ui**   | `instacrud-ui`   | 3000  | Next.js frontend         |

For VPS deployment with Nginx and SSL, use `docker-compose.vps.yml`.

---

## Nginx

```
nginx/
├── Dockerfile
├── docker-entrypoint.sh        # Container entrypoint
├── init-letsencrypt.sh         # Let's Encrypt SSL setup
├── nossl.conf                  # HTTP-only config
└── ssl.conf.template           # HTTPS config template
```

Used for production/VPS deployments as a reverse proxy with optional SSL termination.
