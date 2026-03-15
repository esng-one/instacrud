import json
from typing import Type, TypeVar, List, Optional, Any
from bson import ObjectId
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from beanie import Document, PydanticObjectId
from pymongo.errors import DuplicateKeyError

from instacrud.api.validators import handle_duplicate_key, ensure_exists
from instacrud.context import current_user_context
from instacrud.config import settings
from instacrud.model.system_model import Role

# --- Security & JWT settings ---
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
TOKEN_EXPIRATION_SECONDS = settings.TOKEN_EXPIRATION_SECONDS

# --- CORS constants ---
CORS_ALLOW_ORIGINS = settings.CORS_ALLOW_ORIGINS
CORS_ALLOW_CREDENTIALS = settings.CORS_ALLOW_CREDENTIALS
CORS_ALLOW_METHODS = settings.CORS_ALLOW_METHODS
CORS_ALLOW_HEADERS = settings.CORS_ALLOW_HEADERS

# --- OAuth settings ---
GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET = settings.GOOGLE_CLIENT_SECRET
MS_CLIENT_ID = settings.MS_CLIENT_ID
MS_CLIENT_SECRET = settings.MS_CLIENT_SECRET
MS_TENANT_ID = settings.MS_TENANT_ID
FRONTEND_BASE_URL = settings.FRONTEND_BASE_URL

# --- Public endpoints (no auth) ---
PUBLIC_PATHS = {
    "/",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/signup",
    "/api/v1/signin",
    "/api/v1/session",
    "/api/v1/signin/google",
    "/api/v1/signin/google/callback",
    "/api/v1/signin/microsoft",
    "/api/v1/signin/microsoft/callback",
    "/api/v1/signup/google",
    "/api/v1/signup/google/callback",
    "/api/v1/signup/microsoft",
    "/api/v1/signup/microsoft/callback",
    "/api/v1/getSettings",
    "/api/v1/forgotPassword",
    "/api/v1/resetPassword",
}

# --- Helper: Role-based access control ---
def role_required(*allowed_roles: Role):
    async def role_checker():
        role_str = current_user_context.get().role
        if role_str is None:
            raise HTTPException(status_code=403, detail="Operation not permitted")
        try:
            user_role = Role(role_str)
        except ValueError:
            raise HTTPException(status_code=403, detail="Operation not permitted")

        if user_role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Operation not permitted")
    return role_checker

# --- Helper: Resolve model class by name dynamically ---
def _resolve_model_by_name(class_name: str) -> Optional[Type[Document]]:
    """Find a Beanie Document subclass by its class name (string)."""
    # Gather recursively all subclasses of Document to improve hit rate
    to_visit, seen = list(Document.__subclasses__()), set()
    while to_visit:
        cls = to_visit.pop()
        if cls in seen:
            continue
        seen.add(cls)
        if getattr(cls, "__name__", None) == class_name:
            return cls
        to_visit.extend(cls.__subclasses__())
    return None

# ==========================================================
#  Data normalization / validation
# ==========================================================

def _dedupe(seq):
    seen, out = set(), []
    for x in seq:
        sx = str(x)
        if sx not in seen:
            seen.add(sx)
            out.append(x)
    return out


def _normalize_fk_values(data: dict[str, Any]) -> dict[str, Any]:
    """Convert *_id / *_ids fields to ObjectIds and dedupe."""
    normalized = {}
    for key, val in data.items():
        # Single FK
        if key in ("_id", "id") or key.endswith("_id"):
            if isinstance(val, (str, PydanticObjectId, ObjectId)):
                normalized[key] = PydanticObjectId(str(val))
            elif val is None:
                normalized[key] = None
            else:
                raise HTTPException(400, f"Invalid type for '{key}'")
        # List FK
        elif key.endswith("_ids"):
            if isinstance(val, list):
                ids = [PydanticObjectId(str(v)) for v in val if v]
            elif isinstance(val, (str, PydanticObjectId, ObjectId)):
                ids = [PydanticObjectId(str(val))]
            elif val is None:
                ids = []
            else:
                raise HTTPException(400, f"Invalid type for '{key}'")
            normalized[key] = _dedupe(ids)
        else:
            normalized[key] = val
    return normalized


async def _validate_foreign_keys(model: Type[Document], payload: dict[str, Any]):
    """Check FK references exist."""
    for field, ann in getattr(model, "__annotations__", {}).items():
        if not (field.endswith("_id") or field.endswith("_ids")) or field not in payload:
            continue
        base = field.removesuffix("_ids").removesuffix("_id").capitalize()
        target = _resolve_model_by_name(base)
        if target:
            await ensure_exists(target, field, payload[field])


# ==========================================================
#  Filter parsing for GET ?filters={}
# ==========================================================

# Safe MongoDB operators - block dangerous ones like $where, $function, $expr
# NOTE: $regex intentionally excluded (ReDoS risk) - use search_service.py with re.escape() instead
ALLOWED_QUERY_OPS = frozenset({
    "$and", "$or", "$nor", "$not",                  # Logical
    "$eq", "$ne", "$gt", "$gte", "$lt", "$lte",     # Comparison
    "$in", "$nin", "$exists", "$type",              # Element
    "$all", "$elemMatch", "$size",                  # Array (safe)
})


def _convert_value(field: str, value: Any):
    """Convert string IDs to ObjectIds and UUIDs when needed."""
    # Handle UUID fields (must check before _id to avoid conflicts)
    if field.endswith("_uuid") and isinstance(value, str):
        try:
            return UUID(value)
        except ValueError:
            raise HTTPException(400, f"Invalid UUID format for {field}: {value}")
    # Handle ObjectId fields
    if (field in ("_id", "id") or field.endswith("_id")) and isinstance(value, str):
        return PydanticObjectId(value)
    if field.endswith("_ids") and isinstance(value, list):
        return [PydanticObjectId(v) for v in value if v]
    return value


def _parse_condition(field: str, cond: Any):
    """Handle field operator dicts like {'$in': [...]}"""
    if not isinstance(cond, dict):
        return _convert_value(field, cond)
    parsed = {}
    for op, val in cond.items():
        if op in ("$in", "$nin"):
            vals = [_convert_value(field, v) for v in (val if isinstance(val, list) else [val])]
            parsed[op] = _dedupe(vals)
        elif op in ("$eq", "$ne", "$gt", "$gte", "$lt", "$lte"):
            parsed[op] = _convert_value(field, val)
        else:
            if op.startswith("$") and op not in ALLOWED_QUERY_OPS:
                raise HTTPException(400, f"Unsupported query operator: {op}")
            parsed[op] = _parse_condition(field, val)
    return parsed


def _parse_filter(obj: Any, depth: int = 0):
    """Recursively parse query filters with operator allowlist."""
    if depth > 10:
        raise HTTPException(400, "Filter query too deeply nested")
    if isinstance(obj, dict):
        parsed = {}
        for k, v in obj.items():
            if k.startswith("$"):
                if k not in ALLOWED_QUERY_OPS:
                    raise HTTPException(400, f"Unsupported query operator: {k}")
                if k in ("$and", "$or", "$nor") and isinstance(v, list):
                    parsed[k] = [_parse_filter(x, depth + 1) for x in v]
                else:
                    parsed[k] = _parse_filter(v, depth + 1)
            else:
                parsed[k] = _parse_condition(k, v) if isinstance(v, dict) else _convert_value(k, v)
        return parsed
    if isinstance(obj, list):
        return [_parse_filter(x, depth + 1) for x in obj]
    return obj


# --- Generic CRUD router factory ---
T = TypeVar("T", bound=Document)

def create_crud_router(
    model: Type[T],
    sort_field: Optional[str] = "-updated_at",
    write_roles: List[Role] = [Role.ADMIN, Role.ORG_ADMIN, Role.USER],
    userScoped: bool = False,
) -> APIRouter:
    router = APIRouter()

    IMMUTABLE_FIELDS = {
        "id", "_id", "_revision_id",
        "created_at", "created_by",
        "updated_at", "updated_by"
    }

    def _add_user_scope(query: dict) -> dict:
        """Add user_id filter if userScoped is enabled.

        Always wraps with $and to ensure user_id cannot be bypassed via $or queries.
        """
        if not userScoped:
            return query
        user_ctx = current_user_context.get()
        if not user_ctx or not user_ctx.user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        # Always wrap with $and to prevent bypass via $or
        if query:
            return {"$and": [query, {"user_id": user_ctx.user_id}]}
        return {"user_id": user_ctx.user_id}

    # --- Create
    @router.post("", response_model=model, dependencies=[Depends(role_required(*write_roles))])
    async def create_item(item_data: model = Body(...)):
        data = _normalize_fk_values(item_data.model_dump())

        # Auto-set user_id if userScoped
        if userScoped:
            user_ctx = current_user_context.get()
            if not user_ctx or not user_ctx.user_id:
                raise HTTPException(status_code=401, detail="User not authenticated")
            data["user_id"] = user_ctx.user_id

        await _validate_foreign_keys(model, data)
        try:
            validated = model(**data)
            return await validated.insert()
        except DuplicateKeyError as e:
            raise handle_duplicate_key(e, model)

    # --- List
    @router.get("", response_model=List[model])
    async def list_items(
        skip: int = Query(0, ge=0),
        limit: int = Query(10, ge=1, le=500),
        filters: Optional[str] = Query(None)
    ):
        """
        Returns a paginated list of documents.
        Supports:
          - $in, $and, $or filters
          - Automatic ObjectId coercion for *_id / *_ids fields
        """
        query = {}
        if filters:
            try:
                query = _parse_filter(json.loads(filters))
            except json.JSONDecodeError:
                raise HTTPException(400, "Invalid JSON in filters")

        # Apply user scope filter
        query = _add_user_scope(query)

        return await model.find(query).sort(sort_field).skip(skip).limit(limit).to_list()

    # --- Get by ID
    @router.get("/{item_id}", response_model=model)
    async def get_item(item_id: str = Path(...)):
        item_obj = await model.get(item_id)
        if not item_obj:
            raise HTTPException(status_code=404, detail=f"{model.__name__} not found")

        # Verify user ownership if userScoped
        if userScoped:
            user_ctx = current_user_context.get()
            if not user_ctx or not user_ctx.user_id:
                raise HTTPException(status_code=401, detail="User not authenticated")
            if getattr(item_obj, "user_id", None) != user_ctx.user_id:
                raise HTTPException(status_code=404, detail=f"{model.__name__} not found")

        return item_obj

    # --- Update (PUT)
    @router.put("/{item_id}", response_model=model, dependencies=[Depends(role_required(*write_roles))])
    async def update_item(item_id: str, item_data: model = Body(...)):
        item_obj = await model.get(item_id)
        if not item_obj:
            raise HTTPException(status_code=404, detail=f"{model.__name__} not found")

        # Verify user ownership if userScoped
        if userScoped:
            user_ctx = current_user_context.get()
            if not user_ctx or not user_ctx.user_id:
                raise HTTPException(status_code=401, detail="User not authenticated")
            if getattr(item_obj, "user_id", None) != user_ctx.user_id:
                raise HTTPException(status_code=404, detail=f"{model.__name__} not found")

        data = _normalize_fk_values(item_data.model_dump(exclude_unset=True))
        await _validate_foreign_keys(model, data)

        # Prevent user_id from being changed if userScoped
        if userScoped and "user_id" in data:
            del data["user_id"]

        for field, value in data.items():
            if field not in IMMUTABLE_FIELDS:
                setattr(item_obj, field, value)

        try:
            from beanie.odm.operators.update.general import Set
            safe_data = {k: v for k, v in data.items() if k not in IMMUTABLE_FIELDS}
            await model.find_one({"_id": item_obj.id}).update(Set(safe_data))

            # DEMO: Invalidate FAISS if content changed on embedding-enabled model
            if "content" in safe_data and hasattr(model, "content_embedding"):
                from instacrud.ai.vector_search import invalidate_vector_search
                invalidate_vector_search()

            return await model.get(item_obj.id)  # re-fetch the updated doc
        except DuplicateKeyError as e:
            raise handle_duplicate_key(e, model)

    # --- Partial Update (PATCH)
    @router.patch("/{item_id}", response_model=model, dependencies=[Depends(role_required(*write_roles))])
    async def patch_item(item_id: str, item_data: dict = Body(...)):
        item_obj = await model.get(item_id)
        if not item_obj:
            raise HTTPException(status_code=404, detail=f"{model.__name__} not found")

        # Verify user ownership if userScoped
        if userScoped:
            user_ctx = current_user_context.get()
            if not user_ctx or not user_ctx.user_id:
                raise HTTPException(status_code=401, detail="User not authenticated")
            if getattr(item_obj, "user_id", None) != user_ctx.user_id:
                raise HTTPException(status_code=404, detail=f"{model.__name__} not found")

        data = _normalize_fk_values(item_data)
        await _validate_foreign_keys(model, data)

        # Prevent user_id from being changed if userScoped
        if userScoped and "user_id" in data:
            del data["user_id"]

        for field, value in data.items():
            if field not in IMMUTABLE_FIELDS and hasattr(item_obj, field):
                setattr(item_obj, field, value)

        try:
            from beanie.odm.operators.update.general import Set
            safe_data = {k: v for k, v in data.items() if k not in IMMUTABLE_FIELDS}
            await model.find_one({"_id": item_obj.id}).update(Set(safe_data))

            # DEMO: Invalidate FAISS if content changed on embedding-enabled model
            if "content" in safe_data and hasattr(model, "content_embedding"):
                from instacrud.ai.vector_search import invalidate_vector_search
                invalidate_vector_search()

            return await model.get(item_obj.id)
        except DuplicateKeyError as e:
            raise handle_duplicate_key(e, model)

    # --- Delete
    @router.delete("/{item_id}", status_code=204, dependencies=[Depends(role_required(*write_roles))])
    async def delete_item(item_id: str = Path(...)):
        item_obj = await model.get(item_id)
        if not item_obj:
            raise HTTPException(status_code=404, detail=f"{model.__name__} not found")

        # Verify user ownership if userScoped
        if userScoped:
            user_ctx = current_user_context.get()
            if not user_ctx or not user_ctx.user_id:
                raise HTTPException(status_code=401, detail="User not authenticated")
            if getattr(item_obj, "user_id", None) != user_ctx.user_id:
                raise HTTPException(status_code=404, detail=f"{model.__name__} not found")

        await item_obj.delete()
        return None

    return router
