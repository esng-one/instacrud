---
sidebar_position: 6
---

# Python-Only Server

InstaCRUD runs perfectly without the Next.js frontend. If you only need a basic admin UI or are building a backend-focused project, you can skip Next.js entirely and serve a lightweight HTML/JS interface directly from FastAPI.

## How it works

The Python backend already serves static files out of the box:

- **`/`** — serves `backend/static/index.html`
- **`/static/...`** — serves any file under `backend/static/`

This is wired up in [`backend/instacrud/app.py`](../../../backend/instacrud/app.py) with two lines:

```python
# Mounts the static/ directory at /static
app.mount("/static", StaticFiles(directory=...), name="static")

# Serves index.html at the root URL
@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(".../static/index.html")
```

## The starter UI

A fully functional starter UI is already included at `backend/static/index.html`. It provides:

- Sign in / Sign up forms
- Tabbed data grid for all entities (Clients, Contacts, Addresses, Projects, Documents)
- Detail panel with inline editing
- Create / Edit / Delete modals
- Pagination and search
- JWT auth stored in localStorage

This is a solid starting point for an internal tool or admin panel. Just open `http://localhost:8000` after starting the backend.

## Adding your own pages

Drop any `.html`, `.js`, or `.css` files into `backend/static/` and they are served automatically. For example, `backend/static/reports.html` becomes available at `http://localhost:8000/static/reports.html`.

No build step, no bundler, no Node.js required.

## Removing the static UI entirely

If you do not need any static UI (pure API server), remove the static mount and root route shown in the **How it works** section above from `backend/instacrud/app.py`, along with their two imports (`StaticFiles` and `FileResponse`). You can then delete the `backend/static/` directory entirely.

:::tip
The API itself (`/api/v1/...`) is completely unaffected by whether the static files are present or not. Removing the static UI does not change any backend behavior.
:::
