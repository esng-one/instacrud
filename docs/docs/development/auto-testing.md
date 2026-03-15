---
sidebar_position: 4
title: Automated Testing
---

# Automated Testing

InstaCRUD includes comprehensive automated test suites for both the backend API and the frontend UI. Tests cover authentication flows, CRUD lifecycle operations, security (penetration testing), AI features, and more.

## Backend Tests (pytest)

The backend test suite is located in `backend/test/` and uses **pytest** with support for two modes:

- **Mock mode** — spins up a MongoDB testcontainer locally, no external services needed (requires Docker running, e.g. Docker Desktop on Windows)
- **Live mode** — runs against a live database and API for integration validation

### Test categories

| Test file | What it covers |
|---|---|
| `lifecycle_test.py` | Full CRUD lifecycle and user flows |
| `pentest_test.py` | Security tests (injection, authorization, input validation) |
| `ai_agent_test.py` | AI agent functionality |
| `vector_search_test.py` | Vector search and embeddings |
| `svt_test.py` | Stress load and tenant isolation tests (see note below) |
| `firestore_test.py` | Firestore-specific operations (excluded from bulk runs) |

> **SVT note:** `svt_test.py` combines stress load testing with multi-tenant isolation checks. The default load parameters are intentionally low so the test can run routinely alongside the rest of the suite. For heavier stress testing, temporarily increase `NUM_ORGANIZATIONS` and `REQUESTS_PER_ORG` inside the file and run it in isolation — this will produce a longer execution with higher concurrency.

### Quick start

```bash
# Run all backend tests in mock mode
cd backend && poetry run python -m pytest test/run_all_test.py

# Run all backend tests against a live server
cd backend && poetry run python -m pytest test/run_all_test.py --type=live -v

# Run a specific test file
cd backend && poetry run python -m pytest test/pentest_test.py -v
```

> **Note:** Use `python -m pytest` (not bare `pytest`) — it ensures the `instacrud` package is importable from the Poetry virtualenv.

## Frontend Tests (Jest)

The frontend Jest suite is located in `frontend/test/` and uses **Jest** (via `next/jest`) for API-level integration testing against a running backend.

Jest was chosen here instead of Playwright because these tests exercise the backend API directly — they make raw `fetch` calls, assert on JSON responses, and validate HTTP status codes. No browser or UI rendering is involved. Jest is lighter-weight and faster for this kind of pure HTTP integration testing, while Playwright is reserved for scenarios that require a real browser (navigation, rendering, user interactions).

- **Live mode only** — requires a running backend and valid credentials in `test/config.ts`
- Test files follow the `*_test.ts` / `*_test.tsx` naming convention

### Test categories

| Test file | What it covers |
|---|---|
| `ai_agent_test.ts` | AI features: completions, streaming, embeddings, image generation, conversation sync |
| `tz_test.ts` | Timezone handling: `formatDate`/`formatDateTime`/`toLocalIsoDate` unit tests + Project date roundtrip integration |

### Quick start

```bash
cd frontend

# Run all Jest tests
npm run test:jest

# Run a specific test file
npm run test:ai          # AI agent tests
npm run test:tz:jest     # TZ unit + integration tests

# Run a single test by name pattern
npx jest -- --testNamePattern="formatDate"
```

## Frontend Tests (Playwright)

The frontend E2E suite is located in `frontend/test/e2e/` and uses **Playwright** for end-to-end browser testing.

### Test categories

| Test file | What it covers |
|---|---|
| `auth.spec.ts` | Authentication flows (login, logout, sessions, protected routes) |
| `lifecycle.spec.ts` | Full integration lifecycle (user flows, CRUD operations) |
| `pentest.spec.ts` | Security tests (XSS, input validation, authorization) |
| `ai-assistant.spec.ts` | AI Assistant chat interface and conversations |
| `tz.spec.ts` | Timezone: date display, flatpickr date picker, UTC save roundtrip |

### Quick start

```bash
cd frontend

# Run all E2E tests (headless)
npm run test:e2e

# Run security tests only
npm run test:pentest

# Run TZ e2e tests only
npm run test:tz

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run headed (visible browser)
npm run test:e2e -- --headed
```

> For the full guide — including test fixtures, writing new tests, CI/CD integration, reports, video/screenshot configuration, and troubleshooting — see [`frontend/test/README.md`](https://github.com/esng-one/instacrud/blob/main/frontend/test/README.md).

## Playwright for vibecoding and live debugging

Beyond the main test suite, the project includes a Playwright script that shows how browser automation can assist vibecoding workflows:

- **`frontend/test/e2e/debug-signin.spec.ts`** — a one-off debugging helper that dumps page selectors, console output, and a screenshot of the signin page. A good example of how you can ask an AI assistant to generate a quick Playwright script to inspect a misbehaving page instead of debugging manually in DevTools.

This file is not part of the regular test run — it is an example of how Playwright can be used as a live debugging and exploration tool during AI-assisted development.
