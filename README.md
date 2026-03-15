# InstaCRUD

**InstaCRUD** is a production-ready, extendable AI Starter and CRUD foundation built in Python. It is designed for multi-tenant SaaS applications and internal admin tooling, providing **strong isolated multi-tenancy** with per-tenant MongoDB instances, out-of-the-box **OAuth** integrations, a **TailAdmin-based UI**, and **AI support** with multi-model management.

### Key Features

* **Strong isolated multi-tenancy**: separate MongoDB instances per tenant for full data isolation.
* **Multiple persistence backends**: native MongoDB and Firestore support, plus external Mongo-compatible data sources.
* **Security & audit**: authentication, user/org management, RBAC, audit logging, and system security APIs.
* **OAuth**: Google and Microsoft OAuth support built-in.
* **Admin UI**: [TailAdmin](https://tailadmin.com/)-based interface for user/org management, audit logs, and CRUD workflows.
* **AI-ready**: multi-model manager with metadata and artifact storage, inference/audit logging.

## Why choose InstaCRUD?

* **Speed**: ships with UI, auth, OAuth and audit primitives so teams can focus on business logic.
* **Security-focused multi-tenancy**: per-tenant DB isolation is ideal for high-compliance environments.
* **Flexible persistence**: native Mongo + Firestore and adapters for other Mongo-compatible stores.
* **Multi-Vendor AI Support**: Completions, embeddings, image generation, and built-in AI chat with [LangChain](https://www.langchain.com/).
* **Extensible**: modular architecture lets teams swap components (DB, auth, UI) with minimal friction.


## Development Setup

### Requirements

* Python (with [Poetry](https://python-poetry.org/))
* Node.js (with npm)
* Docker or Docker Desktop
* MongoDB (running on `mongodb://test:test@localhost:27017/`)

You can start MongoDB using Docker from the top **instacrud** folder:

```bash
docker-compose up -d mongo
```

### Backend

1. Go to the **backend** folder:

```bash
cd backend
```

2. Install dependencies (only needed once before first run):

```bash
poetry install
```

3. Initialize the database:

* Generate mock data. Once it's done you can log in to the system using the following credentials: `east_admin@test.org / eastpass`.


```bash
poetry run python -m init.init_mock_db
```

* Initialize AI models (tiers and model definitions):

```bash
poetry run python ./init/init_ai_models.py
```

* Or keep the DB empty and just create the root admin:

```bash
poetry run python ./init/init.py
```

4. Run the server:

```bash
poetry run python instacrud/app.py
```


### Running Tests

* Run tests on **mock environment**:

```bash
poetry run pytest test/lifecycle_test.py
```

* Run tests on a **real server** (server must be running):

```bash
poetry run pytest test/lifecycle_test.py --type=live
```


### Frontend

1. Go to the **frontend** folder:

```bash
cd frontend
```

2. Start the frontend:

```bash
npm run dev
```

3. (Optional) Generate API client from OpenAPI (backend must be running):

```bash
npm run generate-api
```


### Bruno Project

A [Bruno](https://www.usebruno.com/) API testing project is available in the **bruno** folder.


## Run the Whole App with Docker

From the **instacrud** root folder, run:

```bash
docker-compose up -d
```


## 🧾 Licenses

InstaCRUD itself is MIT-licensed. Documentation in the [docs/](docs/) folder is licensed separately under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). InstaCRUD uses many open-source components. Full lists can be found in the third-party license files: [backend/THIRD-PARTY-LICENSES.txt](backend/THIRD-PARTY-LICENSES.txt) and [frontend/THIRD-PARTY-LICENSES.txt](frontend/THIRD-PARTY-LICENSES.txt).

Most dependencies use permissive licenses (MIT, Apache 2.0, BSD). The one exception is [ApexCharts](https://github.com/apexcharts/apexcharts.js), the charting library that came bundled with TailAdmin. ApexCharts uses a dual-license model: free for individuals and organizations under $2M annual revenue (Community License), but requiring a commercial license for larger organizations. See [apexcharts.com/license](https://apexcharts.com/license) for details.

We are considering replacing ApexCharts with a permissive equivalent in future versions to simplify licensing.

InstaCRUD and the InstaCRUD logo are trademarks of ESNG One LLC.


## Next Steps

Fork now and start creating your winning application right away!

- [Comprehensive Documentation](https://docs.instacrud.it)
- [Live Demo](https://instacrud.it/demo)

---

© 2026 ESNG One LLC. Original developers: [r0x07k](https://github.com/r0x07k) · [dmytro-iovenko](https://github.com/dmytro-iovenko) · [mr-hermit](https://github.com/mr-hermit)