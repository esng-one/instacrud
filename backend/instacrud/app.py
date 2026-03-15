# app.py

import os
import re
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
import uvicorn
from contextlib import asynccontextmanager
from starlette.responses import JSONResponse
from pymongo.errors import DuplicateKeyError
from pydantic import ValidationError as PydanticValidationError
from loguru import logger

from instacrud.api import organization_api, system_api, oauth_api, calendar_api, ai_api
from instacrud.api.middleware import register_middlewares
from instacrud.api.validators import handle_duplicate_key
from instacrud.database import init_system_db

def custom_generate_unique_id(route: APIRoute) -> str:
    """Strip /api/v1 prefix from operation IDs so generated client method names stay stable."""
    path = route.path
    if path.startswith("/api/v1"):
        path = path[len("/api/v1"):]
    operation_id = re.sub(r"\W", "_", f"{route.name}{path}")
    return f"{operation_id}_{list(route.methods)[0].lower()}"

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_system_db()
    yield

app = FastAPI(title="InstaCRUD", lifespan=lifespan, generate_unique_id_function=custom_generate_unique_id)

register_middlewares(app)

# --- Static files ---
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "..", "static")), name="static")

# =========================================================
# Exception Handlers
# =========================================================

# --- 422 FastAPI request validation errors ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    def _make_serializable(obj):
        if isinstance(obj, bytes):
            return obj.decode("utf-8", errors="replace")
        if isinstance(obj, dict):
            return {k: _make_serializable(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_make_serializable(v) for v in obj]
        return obj

    safe_errors = _make_serializable(exc.errors())
    body = _make_serializable(exc.body)

    logger.warning(f"422 RequestValidationError at {request.url} :: {safe_errors}")
    return JSONResponse(
        status_code=422,
        content={"detail": safe_errors, "body": body},
    )


# --- 422 Pydantic model / Beanie validation errors ---
@app.exception_handler(PydanticValidationError)
async def pydantic_validation_exception_handler(request: Request, exc: PydanticValidationError):
    logger.warning(f"422 PydanticValidationError at {request.url} :: {exc.errors()}")
    errors = [
        {
            "loc": err.get("loc", ["body"]),
            "msg": err.get("msg", str(err)),
            "type": err.get("type", "value_error"),
        }
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})

# --- 4xx/5xx HTTPException ---
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    level = "error" if exc.status_code >= 500 else "warning"
    log = logger.error if level == "error" else logger.warning
    log(f"{exc.status_code} HTTPException at {request.url} :: {exc.detail}")
    detail = exc.detail
    if isinstance(detail, list):
        content = {"detail": detail}
    else:
        content = {"detail": str(detail)}
    return JSONResponse(status_code=exc.status_code, content=content)

# --- 422 Mongo duplicate key errors ---
@app.exception_handler(DuplicateKeyError)
async def duplicate_key_exception_handler(request: Request, exc: DuplicateKeyError):
    err = handle_duplicate_key(exc, model=None)
    logger.warning(f"422 DuplicateKeyError at {request.url} :: {err.detail}")
    return JSONResponse(status_code=err.status_code, content={"detail": err.detail})


# --- Catch-all for unhandled exceptions (prevent stack trace leakage) ---
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"500 Unhandled {type(exc).__name__} at {request.url} :: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# =========================================================
# Root + Routers
# =========================================================
@app.get("/", include_in_schema=False)
async def root():
    return FileResponse(os.path.join(os.path.dirname(__file__), "..", "static", "index.html"))

app.include_router(system_api.router, prefix="/api/v1")
app.include_router(organization_api.router, prefix="/api/v1")
app.include_router(oauth_api.router, prefix="/api/v1")
app.include_router(calendar_api.router, prefix="/api/v1")
app.include_router(ai_api.router, prefix="/api/v1")

if __name__ == "__main__":
    uvicorn.run("instacrud.app:app", host="0.0.0.0", port=8000, reload=True)
