---
sidebar_position: 1
title: Installation
---

# Installation & Requirements

InstaCRUD runs as a Python-based multi-tenant backend application with optional React UI and MongoDB persistence.  

This guide walks you through setting up the backend, running MongoDB, and starting the service.

---

## Requirements

Before installing InstaCRUD, ensure you have:

- **Python** with [Poetry](https://python-poetry.org/)
- **Node.js** with npm
- **Docker** or Docker Desktop
- **MongoDB** (running on `mongodb://test:test@localhost:27017/`)

---

## Clone Project

```bash
git clone https://github.com/esng-one/instacrud.git
cd instacrud
```

---

## MongoDB Setup (Docker Recommended)

From project root:

```bash
docker-compose up -d mongo
```

Default connection address:

```
mongodb://test:test@localhost:27017/
```

---

# Backend Setup

1️⃣ Enter backend folder:

```bash
cd backend
```

2️⃣ Install dependencies:

```bash
poetry install
```

3️⃣ Initialize the database:

**Option A: Generate mock data**

```bash
poetry run python -m init.init_mock_db
```

Once complete, log in with: `east_admin@test.org / eastpass`

**Option B: Initialize AI models** (tiers and model definitions):

```bash
poetry run python ./init/init_ai_models.py
```

**Option C: Empty bootstrap** (only root admin):

```bash
poetry run python ./init/init.py
```

4️⃣ Run backend server:

```bash
poetry run python instacrud/app.py
```

Service will now run on:

```
http://localhost:8000/
```

---

# Running Tests

Run tests on **mock environment**:

```bash
poetry run pytest test/lifecycle_test.py
```

Run tests on a **real server** (server must be running):

```bash
poetry run pytest test/lifecycle_test.py --type=live
```

---

# Frontend Setup

1️⃣ Go to the **frontend** folder:

```bash
cd frontend
```

2️⃣ Install dependencies:

```bash
npm install
```

3️⃣ Start the frontend:

```bash
npm run dev
```

4️⃣ (Optional) Generate API client from OpenAPI (backend must be running):

```bash
npm run generate-api
```

Admin panel will be available locally.

---

# Bruno API Testing

A [Bruno](https://www.usebruno.com/) API testing project is available in the **bruno** folder.

---

# Run with Docker

From the **instacrud** root folder, run the entire app:

```bash
docker-compose up -d
```

---

# Summary

You have now:

- MongoDB running
- Backend dependencies installed
- Database initialized
- Backend server active
- Frontend operational
- (Optional) Bruno project for API testing

Your InstaCRUD instance is ready.
