> This file is one of three mirrored context files. If you modify this file, apply the same changes to the other two:
> - `../AGENTS.md` (OpenAI / Codex)
> - `../.claude/CLAUDE.md` (Claude Code)

# InstaCRUD

AI-enabled CRUD starter with a **Next.js 15** frontend and **FastAPI** backend, backed by **MongoDB** (via Beanie/Motor).

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS — lives in `frontend/`
- **Backend:** FastAPI, Python 3.10+, Beanie ODM — lives in `backend/`
- **DB:** MongoDB
- **Auth:** JWT + optional OAuth (Authlib)
- **AI:** LangChain with OpenAI / Anthropic integrations

## Dev Commands

### Frontend (`frontend/`)

All frontend commands run from `frontend/`:
```
npm run dev          # start Next.js dev server
npm run build        # production build
npm run lint         # ESLint
npm run generate-api # regenerate API client from OpenAPI spec (backend must be running)
```

## API Client

The frontend uses a generated TypeScript client in `frontend/src/api/`. **Never edit files in `frontend/src/api/` directly — they are auto-generated.** Run `npm run generate-api` (with backend running on `:8000`) to regenerate it after backend changes.

### Frontend tests (`frontend/`)

Two test frameworks in use:

**Playwright e2e** — specs live in `test/e2e/`:
```
npm run test:e2e          # run all Playwright specs
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:debug    # headed debug mode
npm run test:lifecycle    # lifecycle.spec.ts only
npm run test:pentest      # pentest.spec.ts only
npm run test:tz           # tz.spec.ts — TZ display & date picker e2e
```

To debug a frontend issue with a one-off test, follow the pattern in `test/e2e/debug-signin.spec.ts` and run it with `npx playwright test test/e2e/debug-signin.spec.ts --debug`.

**Jest** — `test/*_test.ts`:
```
npm run test:jest         # run all Jest tests (ai_agent_test.ts, tz_test.ts, …)
npm run test:ai           # ai_agent_test.ts only
npm run test:tz:jest      # tz_test.ts only (TZ unit + integration)
```

### Backend (`backend/`)

All backend commands run from `backend/`:
```
poetry install
poetry run uvicorn instacrud.main:app --reload  # dev server on :8000
poetry run python -c "..."  # one-off scripts
```

### Backend tests (`backend/test/`)
```
# Run all tests (mock MongoDB via testcontainer, excludes firestore_test.py)
poetry run python -m pytest test/run_all_test.py

# Run all tests against live DB
poetry run python -m pytest test/run_all_test.py --type=live

# Run firestore_test.py separately (real GCP operations — requires GCP creds)
poetry run python -m pytest test/firestore_test.py -v

# Run a single test file
poetry run python -m pytest test/<name>_test.py -v
```

> **Note:** Use `python -m pytest` (not bare `pytest`) so that the `instacrud` package on the Poetry path is importable. `poetry run pytest` resolves the pytest binary but skips the package path setup that `python -m pytest` provides.

### Querying the test DB for debugging

Tests spin up a MongoDB testcontainer. To inspect its state while tests are paused (or after a failure with a breakpoint), connect directly with Motor (run from `backend/`):

```bash
poetry run python << 'EOF'
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://test:test@localhost:27017/"

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    dbs = await client.list_database_names()
    print("Databases:", dbs)

    db = client["instacrud_test"]   # adjust to the actual db name
    for col in await db.list_collection_names():
        count = await db[col].count_documents({})
        docs = await db[col].find().to_list(5)
        print(f"\n{col} ({count} docs):", docs)

    client.close()

asyncio.run(main())
EOF
```

The testcontainer credentials are `test:test` and it binds to `localhost:27017` by default. Adjust the db/collection names to match what you're debugging.

### Typical dev setup

Both servers run simultaneously in hot-reload mode:
- **Backend:** from `backend/` — `poetry run uvicorn instacrud.main:app --reload` (port 8000)
- **Frontend:** `npm run dev` (port 3000)

### Docker
```
docker compose up    # full stack locally
```

## Conventions

- Backend routes follow FastAPI router pattern; models use Beanie `Document` subclasses
- Frontend API calls go through the generated client in `src/api/`
- Env vars: copy `etalon.env` to `.env` and fill in secrets
