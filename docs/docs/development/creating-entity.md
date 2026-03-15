---
sidebar_position: 3
title: Creating a New Entity
---

# Creating a New Entity

InstaCRUD provides a streamlined approach to adding new data entities. This guide walks through creating a complete entity with backend model, API endpoints, and frontend UI.

> **Note:** This article describes a manual process. For AI-assisted coding, see [Vibecoding Best Practices](/development/vibecoding-best-practices).

---

## Overview

Adding a new entity requires changes in three areas:

1. **Backend Model** — Pydantic/Beanie model definition
2. **Backend API** — CRUD router registration
3. **Frontend** — Page and components

---

## 1. Backend Model

Create your model in `backend/instacrud/model/organization_model.py` by extending `RootModel`:

```python
from beanie import Indexed
from pydantic import Field
from typing import Annotated, Optional

from instacrud.model.system_model import RootModel

class Task(RootModel):
    code: Annotated[str, Indexed(unique=True)]
    name: Annotated[str, Indexed()]
    status: str = "pending"
    description: Optional[str] = None

    class Settings:
        name = "tasks"
```

### Key Points

- **Extend `RootModel`** — Provides `_id`, `created_at`, `created_by`, `updated_at`, `updated_by` fields automatically
- **Use `Indexed()`** — For fields you'll query or filter on
- **Set `class Settings.name`** — This becomes the MongoDB collection name

### Optional: Add Search Support

To enable text search on your entity:

```python
from beanie.odm.actions import EventTypes, before_event
from instacrud.api.search import SearchableMixin, build_search_tokens

class Task(RootModel, SearchableMixin):
    code: Annotated[str, Indexed(unique=True)]
    name: Annotated[str, Indexed()]
    # ... other fields

    @before_event(EventTypes.INSERT)
    @before_event(EventTypes.REPLACE)
    def update_search_tokens(self):
        self.search_tokens = build_search_tokens(
            self.code,
            self.name,
        )

    class Settings:
        name = "tasks"
```

---

## 2. Backend API

Register your entity's CRUD endpoints in `backend/instacrud/api/organization_api.py`:

```python
from instacrud.model.organization_model import Task

# Add with other router includes
router.include_router(
    create_crud_router(Task),
    prefix="/tasks",
    tags=["tasks"]
)
```

This automatically creates:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List items (paginated) |
| GET | `/tasks/{item_id}` | Get single item |
| POST | `/tasks` | Create item |
| PUT | `/tasks/{item_id}` | Update item |
| PATCH | `/tasks/{item_id}` | Partial update |
| DELETE | `/tasks/{item_id}` | Delete item |

### Optional: Add to Search

To include your entity in the global search:

```python
SEARCH_MODELS = [
    # ... existing models
    {"model": Task, "api": "tasks", "fields": ["name", "code"]},
]
```

---

## 3. Frontend Setup

### Generate API Client

After adding the backend model and API, regenerate the TypeScript client:

```bash
cd frontend
npm run generate-api
```

This creates types and service classes in `src/api/`.

### Create Page

Create `frontend/src/app/(admin)/(entities)/tasks/page.tsx`:

```tsx
"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircularProgress, Box, ThemeProvider } from "@mui/material";
import toast from "react-hot-toast";
import { useModal } from "@/hooks/useModal";
import { usePaginatedEntityList } from "@/hooks/usePaginatedEntityList";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useTailwindMuiTheme } from "@/app/lib/util";

import { TasksService } from "@/api/services/TasksService";
import type { Task } from "@/api/models/Task";

import TaskGrid from "@/components/entity/task/TaskGrid";
import TaskEditView from "@/components/entity/task/TaskEditView";
import TaskDetailView from "@/components/entity/task/TaskDetailView";

export default function TasksPage() {
  // Follow pattern from clients/page.tsx
  // ...
}
```

### Create Components

Create components in `frontend/src/components/entity/task/`:

- **TaskGrid.tsx** — DataGrid for list view
- **TaskEditView.tsx** — Form for create/edit
- **TaskDetailView.tsx** — Read-only detail display

Reference existing components in `frontend/src/components/entity/client/` for patterns.

---

## 4. Testing

Restart the backend server to load the new model:

```bash
poetry run python instacrud/app.py
```

Verify the endpoints:

```bash
# List items
curl http://localhost:8000/tasks

# Create item
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"code": "T001", "name": "Sample Task"}'
```

---

## Summary

To add a new entity:

1. Define model extending `RootModel` in `organization_model.py`
2. Register CRUD router in `organization_api.py`
3. Regenerate frontend API client
4. Create page and components in frontend

The `create_crud_router` utility handles all standard CRUD operations automatically.
