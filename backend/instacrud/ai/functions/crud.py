"""CRUD and Conversations tool functions for LLM tool-calling.

Each function is paired with a ToolDef descriptor so it works with any LLM framework
without any changes to the function itself:

    # Direct Python (async)
    items = await crud_list("Client", limit=5)
    item  = await crud_get("Client", "507f1f77bcf86cd799439011")
    new   = await crud_create("Client", {"code": "ACME", "name": "Acme Corp", "type": "COMPANY"})
    saved = await crud_patch("Client", new["id"], {"name": "Acme Corp Ltd"})
    await crud_delete("Client", new["id"])

    # Anthropic tool_use
    from instacrud.ai.tools import to_anthropic_tool
    tools = [to_anthropic_tool(t) for t in ALL_TOOLS]

    # OpenAI function-calling
    from instacrud.ai.tools import to_openai_tool
    tools = [to_openai_tool(t) for t in ALL_TOOLS]

    # LangChain / LangGraph
    from instacrud.ai.tools import to_langchain_tool
    lc_tools = [to_langchain_tool(t) for t in ALL_TOOLS]

Available model names (case-sensitive, match the Python class name):
  Client, Contact, Address, Project, ProjectDocument, Conversation
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4, UUID

from beanie import PydanticObjectId
from beanie.odm.operators.update.general import Set
from fastapi import HTTPException
from loguru import logger
from pymongo.errors import DuplicateKeyError

from instacrud.ai.tools import ToolDef
from instacrud.api.api_utils import _resolve_model_by_name, _parse_filter, _normalize_fk_values, _validate_foreign_keys
from instacrud.api.organization_api import _get_effective_local_only
from instacrud.config import settings
from instacrud.model.organization_model import Conversation, ConversationMessage, MessageRole
from instacrud.model.system_model import Role
from instacrud.context import current_user_context


# ── Prompt injection protection ───────────────────────────────────────────────

_INJECTION_PATTERNS: list[re.Pattern] = [
    # "ignore / disregard / forget / override / bypass [all] [previous] instructions"
    # Handles optional determiner ("all", "your", "the", "my", "any") followed by
    # an optional modifier ("previous", "prior", "earlier", etc.) so that both
    # "ignore previous instructions" and "ignore all previous instructions" are caught.
    re.compile(
        r"\b(ignore|disregard|forget|override|bypass|circumvent)\s+"
        r"(?:(?:all|your|the|my|any|these)\s+)?"
        r"(previous|above|prior|earlier|original)?\s*"
        r"(instructions?|prompts?|context|constraints?|guidelines?|rules?|directives?)\b",
        re.IGNORECASE,
    ),
    # "you are now" / "act as … uncensored|evil|jailbroken" / "pretend you are"
    re.compile(r"\byou\s+are\s+now\b", re.IGNORECASE),
    re.compile(
        r"\bact\s+as\s+(an?\s+)?(new|different|unrestricted|jailbroken|evil|uncensored|DAN)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\bpretend\s+(you\s+are|to\s+be)\b", re.IGNORECASE),
    # Role / system header injection
    re.compile(r"\bnew\s+(system\s+)?(prompt|instructions?|directives?)\s*:", re.IGNORECASE),
    re.compile(
        r"\bsystem\s*:\s*(you\s+are|your\s+role|ignore|forget|override)\b", re.IGNORECASE
    ),
    # XML/special delimiter injection used by common LLM frameworks
    re.compile(r"<\s*(system|sys|admin|prompt|instructions?)\s*>", re.IGNORECASE),
    re.compile(r"\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>|\[SYSTEM\]", re.IGNORECASE),
    # Common jailbreak keywords
    re.compile(r"\bdeveloper\s+mode\b", re.IGNORECASE),
    re.compile(r"\bjailbreak\b", re.IGNORECASE),
    # Safety-policy bypass attempts ("not bound by", "without restrictions", etc.)
    re.compile(
        r"\bnot\s+bound\s+by\b.{0,60}\b(safety|content|policy|policies|restrictions?|guidelines?|rules?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(without|no)\s+(safety|content|ethical?)\s+(restrictions?|guidelines?|filters?|constraints?|policies)\b",
        re.IGNORECASE,
    ),
    # System-prompt disclosure attempts ("reveal your system prompt", "show me your hidden instructions")
    re.compile(
        r"\b(reveal|expose|print|output|leak|dump|disclose|show)\b.{0,60}"
        r"\b(system\s+prompt|hidden\s+(?:prompt|instructions?|context|directives?)|"
        r"secret\s+(?:prompt|instructions?|context)|internal\s+instructions?|"
        r"your\s+(?:original\s+)?instructions?)\b",
        re.IGNORECASE,
    ),
]

_MAX_SCAN_DEPTH = 5  # prevent pathological nesting


def _check_prompt_injection(text: str, field_name: str = "input") -> None:
    """Raise ValueError if *text* contains a known prompt-injection pattern."""
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            raise ValueError(
                f"Potential prompt injection detected in field {field_name!r}. "
                "The value contains patterns that may attempt to override AI instructions."
            )


def _scan_data_for_injection(data: Any, field_name: str = "data", _depth: int = 0) -> None:
    """Recursively walk *data* and call _check_prompt_injection on every string."""
    if _depth > _MAX_SCAN_DEPTH:
        return
    if isinstance(data, str):
        _check_prompt_injection(data, field_name)
    elif isinstance(data, dict):
        for key, value in data.items():
            _scan_data_for_injection(value, field_name=f"{field_name}.{key}", _depth=_depth + 1)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            _scan_data_for_injection(item, field_name=f"{field_name}[{i}]", _depth=_depth + 1)


# ── Stored-XSS / SQL-injection / NoSQL data-key guards ───────────────────────

# Stored XSS: script tags, javascript: protocol, event-handler attributes
_XSS_RE = re.compile(r'<script|javascript:|on\w+\s*=', re.IGNORECASE)

# NoSQL injection via data keys: write-payload keys must not be operators
_NOSQL_OP_KEY_RE = re.compile(r'^\$')


def _scan_for_nosql_data_keys(data: Any, field_name: str = "data", _depth: int = 0) -> None:
    """Raise ValueError if any write-payload dict key is a MongoDB operator ($-prefixed)."""
    if _depth > _MAX_SCAN_DEPTH:
        return
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(key, str) and _NOSQL_OP_KEY_RE.match(key):
                raise ValueError(
                    f"NoSQL injection: operator key {key!r} is not permitted in write "
                    f"payloads (field: {field_name!r})."
                )
            _scan_for_nosql_data_keys(value, f"{field_name}.{key}", _depth + 1)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            _scan_for_nosql_data_keys(item, f"{field_name}[{i}]", _depth + 1)


def _scan_for_xss_and_sql(
    data: Any,
    field_name: str = "data",
    _depth: int = 0,
    check_xss: bool = True,
) -> None:
    """Recursively scan string values for XSS payloads."""
    if _depth > _MAX_SCAN_DEPTH:
        return
    if isinstance(data, str):
        if check_xss and _XSS_RE.search(data):
            raise ValueError(f"XSS payload detected in field {field_name!r}.")
    elif isinstance(data, dict):
        for key, value in data.items():
            _scan_for_xss_and_sql(value, f"{field_name}.{key}", _depth + 1, check_xss)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            _scan_for_xss_and_sql(item, f"{field_name}[{i}]", _depth + 1, check_xss)


def _validate_write_data(data: Any) -> None:
    """Run NoSQL-key, SQL-injection, and XSS checks on all write payloads."""
    _scan_for_nosql_data_keys(data)
    _scan_for_xss_and_sql(data)


def _validate_filter_values(filters: Any) -> None:
    """Check parsed filter values for SQL injection (NoSQL handled by _parse_filter)."""
    _scan_for_xss_and_sql(filters, field_name="filters", check_xss=False)


# ── LLM-based tool-abuse guardrail ───────────────────────────────────────────

# Matches a valid 24-hex-character MongoDB ObjectId
_OBJECT_ID_RE = re.compile(r'^[0-9a-fA-F]{24}$')

# Glob / SQL / regex wildcards that indicate enumeration attempts
_ENUM_WILDCARD_RE = re.compile(r'[*%?]|\.[\*+?]|\.\.\.|\bregex\b', re.IGNORECASE)

# MongoDB operators that can execute JS on the server — always block in filters
_DANGEROUS_FILTER_OPS: frozenset[str] = frozenset({"$where", "$function", "$accumulator"})

_GUARDRAIL_SYSTEM_PROMPT = """\
You are a security guardrail for an AI-powered CRUD API.
Classify each tool call as ALLOW or BLOCK using these exact rules.

=== TOOL REFERENCE ===
READ  (lower risk): crud_get, crud_list, find_entities
WRITE (higher risk): crud_create, crud_update, crud_patch, crud_delete

=== BLOCK RULES — evaluate in order; first match wins ===

SCRAPE-1       crud_list | limit > 50  AND filters is null, {}, or empty string
SCRAPE-2       crud_list | skip ≥ 100  AND filters is null, {}, or empty string
SCRAPE-3       crud_list | limit × skip > 2000 (deep-pagination scraping, even with a filter)
DDOS           any call  | limit = 500 (hard server ceiling; no legitimate single-call need)
ENUM           find_entities | query has ≤ 1 non-whitespace character,
               or contains SQL/glob/regex wildcards (%, *, ?, .*, .+, "regex")
BULK_DEL       crud_delete | item_id is absent, empty, "all", "*", or not a 24-hex ObjectId
BULK_WRITE     crud_update or crud_patch | item_id is absent, empty, or not a 24-hex ObjectId
EMPTY_PATCH    crud_update or crud_patch | data is null, {}, or contains only immutable keys
               (immutable keys: _id, id, created_at, created_by, updated_at, updated_by)
IMMUTABLE_OVR  crud_update or crud_patch | data contains ONLY immutable keys and nothing else
               (subset of EMPTY_PATCH — cite whichever fires first)
CROSS_DUMP     crud_list | model_name is "Conversation" AND filters is null or {}
               (Conversation records are user-scoped; listing without a filter leaks other users' data)

=== ALLOW — respond ALLOW for all of these ===
- Any READ op with a specific filter or limit ≤ 50
- Any WRITE op targeting a single document with a valid 24-hex ObjectId as item_id
- crud_create with any data payload
- crud_list("Conversation") with a filter (e.g. filtering by user_id or title)
- Anything that does not match a BLOCK rule above

Respond with JSON only. No markdown fences, no extra text:
{"action": "ALLOW", "reason": "one phrase"}
or
{"action": "BLOCK", "reason": "one sentence citing the rule name"}"""


# Module-level AiServiceClient cache keyed by model_identifier
_guardrail_client_cache: dict[str, Any] = {}


async def _resolve_guardrail_client() -> Any | None:
    """Lazily resolve and cache an AiServiceClient for the configured guardrail model.

    Uses the instacrud AiServiceClient — provider-agnostic, works with OpenAI,
    Anthropic, DeepInfra, Ollama, or any provider configured in the AiModel collection.
    The client is cached in-process so the DB is queried only once per model_identifier.
    """
    model_id = settings.TOOLS_GUARDRAIL_MODEL
    if not model_id:
        return None
    if model_id in _guardrail_client_cache:
        return _guardrail_client_cache[model_id]

    # Lazy imports to avoid circular deps at module load time
    from instacrud.model.system_model import AiModel
    from instacrud.ai.ai_service import AiServiceClient

    ai_model = await AiModel.find_one(AiModel.model_identifier == model_id)
    if not ai_model:
        logger.warning(
            "[guardrail] model '{}' not found in AiModel collection — LLM check disabled",
            model_id,
        )
        return None

    client = AiServiceClient(ai_model=ai_model, user_id=None, track_usage=False)
    _guardrail_client_cache[model_id] = client
    return client


def _pre_guardrail(tool_name: str, kwargs: dict[str, Any]) -> str | None:
    """Deterministic rule-based pre-check — no LLM, no network, zero latency.

    Returns a block-reason string on a clear violation, or None to proceed
    to the LLM stage.
    """
    # ENUM — find_entities: trivial or wildcard query
    if tool_name == "find_entities":
        q = (kwargs.get("query") or "").strip()
        if len(q) <= 1:
            return "ENUM: query too short to be meaningful (≤ 1 non-whitespace character)"
        if _ENUM_WILDCARD_RE.search(q):
            return f"ENUM: query contains wildcard / regex pattern: {q!r}"

    # SCRAPE / DDOS — crud_list: excessive limit or skip without filters
    if tool_name == "crud_list":
        try:
            limit = int(kwargs.get("limit") or 10)
            skip = int(kwargs.get("skip") or 0)
        except (TypeError, ValueError):
            return "DDOS: non-integer limit or skip value"
        filters = kwargs.get("filters")
        no_filter = not filters or filters in ({}, "{}", "null", "")
        if limit >= 500:
            return f"DDOS: limit={limit} is at or above the server maximum (500)"
        if limit > 50 and no_filter:
            return f"SCRAPE-1: limit={limit} with no filters would dump the entire collection"
        if skip >= 100 and no_filter:
            return f"SCRAPE-2: skip={skip} with no filters indicates a pagination dump"
        if limit * skip > 2000:
            return f"SCRAPE-3: limit={limit} × skip={skip} = {limit * skip} exceeds deep-pagination ceiling"
        if no_filter and kwargs.get("model_name") == "Conversation":
            return "CROSS_DUMP: crud_list on Conversation without a filter leaks other users' data"

    # BULK_DEL / BULK_WRITE — delete/update/patch: item_id must be a valid ObjectId
    if tool_name in {"crud_delete", "crud_update", "crud_patch"}:
        item_id = str(kwargs.get("item_id") or "").strip()
        if not item_id or item_id.lower() in {"all", "*", "null", "none", ""}:
            return f"BULK_DEL/WRITE: item_id {item_id!r} is not a valid target"
        if not _OBJECT_ID_RE.match(item_id):
            return f"BULK_DEL/WRITE: item_id {item_id!r} is not a 24-hex MongoDB ObjectId"

    # EMPTY_PATCH — update/patch with no mutable fields (data is empty or only immutable keys)
    if tool_name in {"crud_update", "crud_patch"}:
        data = kwargs.get("data")
        data_dict = data if isinstance(data, dict) else {}
        mutable_keys = set(data_dict.keys()) - IMMUTABLE_FIELDS
        if not mutable_keys:
            return "EMPTY_PATCH: data contains no mutable fields — nothing to update"

    # DDOS — any call: dangerous server-side JS operators in filters
    try:
        filters_raw = json.dumps(kwargs.get("filters") or {})
    except (TypeError, ValueError):
        filters_raw = ""
    for op in _DANGEROUS_FILTER_OPS:
        if op in filters_raw:
            return f"DDOS: filter contains dangerous server-side operator {op!r}"

    return None


async def _llm_guardrail(tool_name: str, kwargs: dict[str, Any]) -> None:
    """Two-stage tool-abuse guard.

    Stage 1 — _pre_guardrail: synchronous, deterministic, zero cost.
    Stage 2 — LangChain LLM call via TOOLS_GUARDRAIL_MODEL (provider-agnostic:
               OpenAI, Anthropic, DeepInfra, Ollama, …).

    Raises ValueError on any BLOCK decision.
    Stage 2 fails open (logs, allows) on transient LLM errors so an API outage
    never breaks legitimate traffic; Stage 1 always runs and always enforces.
    """
    # Stage 1 — deterministic (always runs regardless of config)
    block_reason = _pre_guardrail(tool_name, kwargs)
    if block_reason:
        logger.warning("[guardrail:pre] BLOCK tool={} reason={}", tool_name, block_reason)
        raise ValueError(f"Tool call '{tool_name}' blocked: {block_reason}")

    # Stage 2 — instacrud AiServiceClient (skipped when TOOLS_GUARDRAIL_MODEL is not configured)
    client = await _resolve_guardrail_client()
    if not client:
        return

    from langchain_core.messages import HumanMessage, SystemMessage  # noqa: PLC0415

    payload = json.dumps({"tool": tool_name, "args": kwargs}, default=str)
    try:
        raw = await client.get_completion(
            [SystemMessage(content=_GUARDRAIL_SYSTEM_PROMPT), HumanMessage(content=payload)]
        )
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(raw)
        if result.get("action") == "BLOCK":
            reason = result.get("reason", "policy violation")
            logger.warning("[guardrail:llm] BLOCK tool={} reason={}", tool_name, reason)
            raise ValueError(f"Tool call '{tool_name}' blocked by security guardrail: {reason}")
        logger.debug("[guardrail:llm] ALLOW tool={}", tool_name)
    except ValueError:
        raise
    except Exception as exc:
        logger.warning(
            "[guardrail:llm] check failed (fail-open): tool={} error={}", tool_name, exc
        )


# ── Security helpers ──────────────────────────────────────────────────────────

# System models accessible only by ADMIN (global/cross-org resources).
# Mirrors system_api.py: create/delete org, tier management, AI model config,
# billing, and security tokens are all ADMIN-only operations.
_ADMIN_ONLY_SYSTEM_MODELS: frozenset[str] = frozenset({
    "Organization", "Tier", "AiModel", "Usage", "UsageHistory",
    "OAuthSession", "PasswordResetToken",
})

# System models that ORG_ADMIN may also access (org-scoped resources).
# Mirrors system_api.py: ORG_ADMIN can manage users and invitations within
# their own organisation.
_ORG_ADMIN_SYSTEM_MODELS: frozenset[str] = frozenset({
    "User", "Invitation",
})

# Union — any model in either set requires elevated access.
_SYSTEM_MODEL_NAMES: frozenset[str] = _ADMIN_ONLY_SYSTEM_MODELS | _ORG_ADMIN_SYSTEM_MODELS


_WRITE_ROLES: frozenset[Role] = frozenset({Role.ADMIN, Role.ORG_ADMIN, Role.USER})


def _require_auth():
    """Raise ValueError if AI tools are disabled or there is no authenticated user in context."""
    if not settings.ALLOW_AI_TOOLS:
        raise ValueError(
            "AI tools are disabled by the administrator (ALLOW_AI_TOOLS=false). "
            "Do not retry — this call will not succeed until the setting is changed server-side."
        )
    ctx = current_user_context.get()
    if not ctx or not ctx.user_id:
        raise ValueError("Not authenticated — AI tool functions require a logged-in user")
    return ctx


def _require_write_role() -> None:
    """Raise ValueError if the current user cannot perform write operations.

    Checks ALLOW_AI_RW_ACCESS first (applies to all entities), then mirrors
    the role_required(ADMIN, ORG_ADMIN, USER) guard — RO_USER is excluded.
    """
    if not settings.ALLOW_AI_RW_ACCESS:
        raise ValueError(
            "AI write operations are disabled (ALLOW_AI_RW_ACCESS=false)."
        )
    ctx = _require_auth()
    if not ctx.role:
        raise ValueError("No role assigned — write operations are not permitted")
    try:
        role = Role(ctx.role)
    except ValueError:
        raise ValueError(f"Unknown role '{ctx.role}' — write operations are not permitted")
    if role not in _WRITE_ROLES:
        raise ValueError(f"Role '{role}' does not have write access")


def _check_system_access(model_name: str) -> None:
    """Raise ValueError if the current user may not access model_name as a system model.

    Mirrors the role differentiation in system_api.py:
    - Non-system models: always permitted.
    - ALLOW_AI_SYSTEM_ACCESS=false: all system models are blocked.
    - ADMIN: may access all system models when the killswitch is on.
    - ORG_ADMIN: may access only User and Invitation (org-scoped models).
    - All other roles: blocked from all system models.
    """
    if model_name not in _SYSTEM_MODEL_NAMES:
        return
    if not settings.ALLOW_AI_SYSTEM_ACCESS:
        raise ValueError(
            f"Access to system model '{model_name}' is disabled "
            "(ALLOW_AI_SYSTEM_ACCESS=false)."
        )
    # Killswitch is on — differentiate by role.
    ctx = current_user_context.get()
    try:
        role = Role(ctx.role) if ctx and ctx.role else None
    except ValueError:
        role = None
    if role == Role.ADMIN:
        return
    if role == Role.ORG_ADMIN and model_name in _ORG_ADMIN_SYSTEM_MODELS:
        return
    raise ValueError(
        f"Role '{role}' is not permitted to access system model '{model_name}' via AI tools. "
        f"Required: ADMIN"
        + (f" or ORG_ADMIN" if model_name in _ORG_ADMIN_SYSTEM_MODELS else "")
        + "."
    )


async def _validate_fk(model, data: dict) -> None:
    """Run FK reference checks, translating HTTPException to ValueError."""
    try:
        await _validate_foreign_keys(model, data)
    except HTTPException as exc:
        detail = exc.detail
        msg = detail[0]["msg"] if isinstance(detail, list) and detail else str(detail)
        raise ValueError(msg)


def _check_dup_key(exc: DuplicateKeyError) -> None:
    """Translate a DuplicateKeyError into a ValueError."""
    msg = str(exc)
    field = "unknown"
    if "index:" in msg:
        try:
            field = msg.split("index:")[1].split()[1].split("_")[0]
        except Exception:
            pass
    raise ValueError(f"{field.capitalize()} already exists")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _doc_to_dict(doc) -> dict[str, Any]:
    """Serialize a Beanie Document to a JSON-safe plain dict."""
    return json.loads(doc.model_dump_json())


def _require_model(model_name: str):
    """Resolve a model class by name or raise ValueError."""
    model = _resolve_model_by_name(model_name)
    if model is None:
        raise ValueError(
            f"Unknown model '{model_name}'. "
            "Available: Client, Contact, Address, Project, ProjectDocument, Conversation"
        )
    return model


def _parse_filters_arg(filters: Any) -> dict:
    """Accept filters as a JSON string, a dict, or None."""
    if filters is None:
        return {}
    if isinstance(filters, str):
        try:
            filters = json.loads(filters)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in filters: {exc}") from exc
    return _parse_filter(filters)


IMMUTABLE_FIELDS = {"id", "_id", "created_at", "created_by", "updated_at", "updated_by"}


# ── Generic CRUD ──────────────────────────────────────────────────────────────

async def crud_list(
    model_name: str,
    filters: Optional[Any] = None,
    skip: int = 0,
    limit: int = 10,
    sort: str = "-updated_at",
) -> list[dict[str, Any]]:
    _require_auth()
    _check_system_access(model_name)
    await _llm_guardrail("crud_list", {"model_name": model_name, "filters": filters, "skip": skip, "limit": limit, "sort": sort})
    logger.info("[tool:crud_list] model={} filters={} skip={} limit={} sort={}", model_name, filters, skip, limit, sort)
    """Return a paginated list of documents from any CRUD model.

    Args:
        model_name: Python class name of the Beanie model (e.g. "Client").
        filters:    MongoDB query filter — dict or JSON string.
                    Supports $and, $or, $in, $eq, $ne, $gt, $gte, $lt, $lte, etc.
                    Example: {"type": "COMPANY"} or '{"code": {"$in": ["ACME", "FOO"]}}'
        skip:       Number of documents to skip (for pagination).
        limit:      Maximum number of documents to return (1–500).
        sort:       Sort expression, e.g. "-updated_at" (descending) or "name".

    Returns:
        List of serialised document dicts.
    """
    model = _require_model(model_name)
    query = _parse_filters_arg(filters)
    _validate_filter_values(query)
    limit = max(1, min(limit, 500))
    docs = await model.find(query).sort(sort).skip(skip).limit(limit).to_list()
    return [_doc_to_dict(d) for d in docs]


async def crud_get(model_name: str, item_id: str) -> dict[str, Any]:
    _require_auth()
    _check_system_access(model_name)
    logger.info("[tool:crud_get] model={} item_id={}", model_name, item_id)
    """Fetch a single document by its MongoDB ObjectId.

    Args:
        model_name: Python class name of the Beanie model (e.g. "Project").
        item_id:    24-hex-character ObjectId string.

    Returns:
        Serialised document dict.

    Raises:
        ValueError: if the document is not found.
    """
    model = _require_model(model_name)
    doc = await model.get(item_id)
    if doc is None:
        raise ValueError(f"{model_name} with id={item_id!r} not found")
    return _doc_to_dict(doc)


async def crud_create(model_name: str, data: dict[str, Any]) -> dict[str, Any]:
    _require_write_role()
    _check_system_access(model_name)
    _scan_data_for_injection(data)
    _validate_write_data(data)
    await _llm_guardrail("crud_create", {"model_name": model_name, "data": data})
    logger.info("[tool:crud_create] model={} data={}", model_name, data)
    """Create a new document.

    Args:
        model_name: Python class name of the Beanie model (e.g. "Client").
        data:       Field values for the new document.
                    All *_id / *_ids fields are automatically coerced to ObjectIds.

    Returns:
        Serialised document dict of the newly created object (includes id).
    """
    model = _require_model(model_name)
    data = _normalize_fk_values({k: v for k, v in data.items() if k not in IMMUTABLE_FIELDS})
    await _validate_fk(model, data)
    try:
        doc = model(**data)
        await doc.insert()
        return _doc_to_dict(doc)
    except DuplicateKeyError as exc:
        _check_dup_key(exc)


async def crud_update(model_name: str, item_id: str, data: dict[str, Any]) -> dict[str, Any]:
    _require_write_role()
    _check_system_access(model_name)
    _scan_data_for_injection(data)
    _validate_write_data(data)
    await _llm_guardrail("crud_update", {"model_name": model_name, "item_id": item_id, "data": data})
    logger.info("[tool:crud_update] model={} item_id={} data={}", model_name, item_id, data)
    """Replace all mutable fields of a document (full update / PUT semantics).

    Args:
        model_name: Python class name of the Beanie model.
        item_id:    24-hex-character ObjectId string.
        data:       New field values. Immutable fields (id, created_at, …) are ignored.

    Returns:
        Serialised document dict of the updated object.

    Raises:
        ValueError: if the document is not found.
    """
    model = _require_model(model_name)
    doc = await model.get(item_id)
    if doc is None:
        raise ValueError(f"{model_name} with id={item_id!r} not found")
    safe = _normalize_fk_values({k: v for k, v in data.items() if k not in IMMUTABLE_FIELDS})
    await _validate_fk(model, safe)
    try:
        await doc.update(Set(safe))
        return _doc_to_dict(await model.get(doc.id))
    except DuplicateKeyError as exc:
        _check_dup_key(exc)


async def crud_patch(model_name: str, item_id: str, data: dict[str, Any]) -> dict[str, Any]:
    _require_write_role()
    _check_system_access(model_name)
    _scan_data_for_injection(data)
    _validate_write_data(data)
    await _llm_guardrail("crud_patch", {"model_name": model_name, "item_id": item_id, "data": data})
    logger.info("[tool:crud_patch] model={} item_id={} data={}", model_name, item_id, data)
    """Partially update a document (PATCH semantics — only provided fields are changed).

    Args:
        model_name: Python class name of the Beanie model.
        item_id:    24-hex-character ObjectId string.
        data:       Fields to update. Omitted fields are left unchanged.
                    Immutable fields (id, created_at, …) are silently ignored.

    Returns:
        Serialised document dict of the updated object.

    Raises:
        ValueError: if the document is not found.
    """
    model = _require_model(model_name)
    doc = await model.get(item_id)
    if doc is None:
        raise ValueError(f"{model_name} with id={item_id!r} not found")
    safe = _normalize_fk_values({k: v for k, v in data.items() if k not in IMMUTABLE_FIELDS})
    await _validate_fk(model, safe)
    try:
        await doc.update(Set(safe))
        return _doc_to_dict(await model.get(doc.id))
    except DuplicateKeyError as exc:
        _check_dup_key(exc)


async def crud_delete(model_name: str, item_id: str) -> dict[str, Any]:
    _require_write_role()
    _check_system_access(model_name)
    await _llm_guardrail("crud_delete", {"model_name": model_name, "item_id": item_id})
    logger.info("[tool:crud_delete] model={} item_id={}", model_name, item_id)
    """Delete a document by id.

    Args:
        model_name: Python class name of the Beanie model.
        item_id:    24-hex-character ObjectId string.

    Returns:
        {"deleted": true, "id": "<item_id>"}

    Raises:
        ValueError: if the document is not found.
    """
    model = _require_model(model_name)
    doc = await model.get(item_id)
    if doc is None:
        raise ValueError(f"{model_name} with id={item_id!r} not found")
    await doc.delete()
    return {"deleted": True, "id": item_id}


# ── Conversations ─────────────────────────────────────────────────────────────

def _current_user_id() -> PydanticObjectId:
    ctx = current_user_context.get()
    if not ctx or not ctx.user_id:
        raise ValueError("No authenticated user in context")
    return ctx.user_id


async def conversations_list(
    skip: int = 0,
    limit: int = 10,
    filters: Optional[Any] = None,
) -> list[dict[str, Any]]:
    _require_write_role()
    logger.info("[tool:conversations_list] skip={} limit={} filters={}", skip, limit, filters)
    """List conversations for the current user, sorted by most recent message.

    Args:
        skip:    Number of conversations to skip.
        limit:   Maximum number of conversations to return (1–500).
        filters: Optional MongoDB query filter (dict or JSON string) applied on top
                 of the implicit user_id scope.
                 Example: {"title": {"$exists": true}}

    Returns:
        List of serialised Conversation dicts (newest first).
    """
    user_id = _current_user_id()
    limit = max(1, min(limit, 500))
    base: dict[str, Any] = {"user_id": user_id}
    if filters:
        extra = _parse_filters_arg(filters)
        query: dict = {"$and": [extra, base]}
    else:
        query = base
    docs = await Conversation.find(query).sort("-last_message_at").skip(skip).limit(limit).to_list()
    return [_doc_to_dict(d) for d in docs]


async def conversations_get(item_id: str) -> dict[str, Any]:
    _require_write_role()
    logger.info("[tool:conversations_get] item_id={}", item_id)
    """Fetch a single conversation by id (must belong to the current user).

    Args:
        item_id: 24-hex-character ObjectId string of the conversation.

    Returns:
        Serialised Conversation dict.

    Raises:
        ValueError: if the conversation is not found or belongs to another user.
    """
    user_id = _current_user_id()
    doc = await Conversation.get(item_id)
    if doc is None or doc.user_id != user_id:
        raise ValueError(f"Conversation id={item_id!r} not found")
    return _doc_to_dict(doc)


async def conversations_create(
    title: Optional[str] = None,
    messages: Optional[list[dict[str, Any]]] = None,
    model_id: Optional[str] = None,
    external_uuid: Optional[str] = None,
) -> dict[str, Any]:
    _require_write_role()
    if title:
        _check_prompt_injection(title, field_name="title")
        _scan_for_xss_and_sql(title, field_name="title")
    for i, m in enumerate(messages or []):
        if isinstance(m.get("content"), str):
            _check_prompt_injection(m["content"], field_name=f"messages[{i}].content")
            _scan_for_xss_and_sql(m["content"], field_name=f"messages[{i}].content")
    logger.info("[tool:conversations_create] title={} model_id={}", title, model_id)
    """Create a new conversation for the current user.

    Args:
        title:         Optional display title (auto-generated from first message if omitted).
        messages:      Initial message list. Each message is a dict with keys:
                         role ("user" | "assistant" | "system"), content (str),
                         and optionally image_url, image_data, reasoning_content.
        model_id:      ObjectId string of the AiModel to associate with this conversation.
        external_uuid: Client-side UUID for idempotent upsert (prevents duplicates on retry).

    Returns:
        Serialised Conversation dict of the newly created object (includes id).
    """
    user_id = _current_user_id()
    if await _get_effective_local_only(user_id):
        raise ValueError("Conversation sync is disabled for this organization")

    # Idempotent upsert by external_uuid
    if external_uuid:
        ext = UUID(external_uuid)
        existing = await Conversation.find_one({"external_uuid": ext, "user_id": user_id})
        if existing:
            return _doc_to_dict(existing)

    parsed_messages: list[ConversationMessage] = []
    for m in (messages or []):
        parsed_messages.append(ConversationMessage(
            role=MessageRole(m["role"]),
            content=m["content"],
            image_data=m.get("image_data"),
            image_url=m.get("image_url"),
            reasoning_content=m.get("reasoning_content"),
        ))

    doc = Conversation(
        user_id=user_id,
        external_uuid=UUID(external_uuid) if external_uuid else uuid4(),
        title=title,
        messages=parsed_messages,
        model_id=PydanticObjectId(model_id) if model_id else None,
        last_message_at=datetime.now(tz=timezone.utc),
    )
    await doc.insert()
    return _doc_to_dict(doc)


async def conversations_patch(
    item_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    _require_write_role()
    _scan_data_for_injection(data)
    _validate_write_data(data)
    logger.info("[tool:conversations_patch] item_id={} data={}", item_id, data)
    """Partially update a conversation (only the current user's conversations).

    Commonly updated fields: title, messages, model_id, last_message_at.
    Immutable fields (id, user_id, created_at, …) are silently ignored.

    Args:
        item_id: 24-hex-character ObjectId string of the conversation.
        data:    Fields to update.

    Returns:
        Serialised Conversation dict after update.

    Raises:
        ValueError: if the conversation is not found or belongs to another user.
    """
    user_id = _current_user_id()
    if await _get_effective_local_only(user_id):
        raise ValueError("Conversation sync is disabled for this organization")
    doc = await Conversation.get(item_id)
    if doc is None or doc.user_id != user_id:
        raise ValueError(f"Conversation id={item_id!r} not found")

    immutable = {"id", "_id", "created_at", "created_by", "user_id"}
    for field, value in data.items():
        if field in immutable or not hasattr(doc, field):
            continue
        if field == "last_message_at" and isinstance(value, str):
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        setattr(doc, field, value)
    await doc.save()
    return _doc_to_dict(doc)


async def conversations_delete(item_id: str) -> dict[str, Any]:
    _require_write_role()
    logger.info("[tool:conversations_delete] item_id={}", item_id)
    """Delete a conversation (must belong to the current user).

    Args:
        item_id: 24-hex-character ObjectId string of the conversation.

    Returns:
        {"deleted": true, "id": "<item_id>"}

    Raises:
        ValueError: if the conversation is not found or belongs to another user.
    """
    user_id = _current_user_id()
    doc = await Conversation.get(item_id)
    if doc is None or doc.user_id != user_id:
        raise ValueError(f"Conversation id={item_id!r} not found")
    await doc.delete()
    return {"deleted": True, "id": item_id}


# ── Cross-model search ────────────────────────────────────────────────────────

async def find_entities(query: str) -> dict[str, Any]:
    _require_auth()
    """Search across all CRUD models (Client, Contact, Project, ProjectDocument).

    Uses prefix-token search (same engine as the /find API endpoint).

    Args:
        query: Search string (minimum 3 characters).

    Returns:
        {"entities": [{"api": str, "id": str, "name": str}, ...]}
        Each hit includes the REST API path (e.g. "clients"), the document id, and a display name.

    Raises:
        ValueError: if query is shorter than 3 characters.
    """
    _check_prompt_injection(query, field_name="query")
    await _llm_guardrail("find_entities", {"query": query})
    logger.info("[tool:find_entities] query={}", query)
    if len(query) < 3:
        raise ValueError("Search query must be at least 3 characters long")

    # Lazy import to avoid circular dependency with organization_api
    from instacrud.api.organization_api import SEARCH_MODELS
    from instacrud.api.search_service import SearchService

    search_service = SearchService()
    hits = await search_service.search(query=query, model_entries=SEARCH_MODELS, limit=20)
    entities = []
    for api, doc in hits:
        entities.append({
            "api": api,
            "id": str(doc.id),
            "name": getattr(doc, "name", getattr(doc, "code", "")),
        })
    logger.info("[tool:find_entities] query={} → {} hits", query, len(entities))
    return {"entities": entities}


# ── ToolDef registry ──────────────────────────────────────────────────────────

_MODEL_NAME_PROP = {
    "type": "string",
    "description": (
        "Python class name of the Beanie model. "
        "One of: Client, Contact, Address, Project, ProjectDocument, Conversation."
    ),
    "enum": ["Client", "Contact", "Address", "Project", "ProjectDocument", "Conversation"],
}

_ITEM_ID_PROP = {
    "type": "string",
    "description": "24-hex-character MongoDB ObjectId string.",
}

_FILTERS_PROP = {
    "type": ["object", "string", "null"],
    "description": (
        "MongoDB query filter as a dict or JSON string. "
        "Supported operators: $and, $or, $nor, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, "
        "$exists, $type, $all, $elemMatch, $size. "
        'Example: {"type": "COMPANY"} or \'{"code": {"$in": ["ACME", "FOO"]}}\''
    ),
}

CRUD_LIST_TOOL = ToolDef(
    name="crud_list",
    description=(
        "Return a paginated list of documents from any CRUD model. "
        "Use this to query Clients, Contacts, Projects, ProjectDocuments, Addresses, or Conversations."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "model_name": _MODEL_NAME_PROP,
            "filters": _FILTERS_PROP,
            "skip": {"type": "integer", "description": "Number of documents to skip.", "default": 0},
            "limit": {"type": "integer", "description": "Max documents to return (1–500).", "default": 10},
            "sort": {
                "type": "string",
                "description": 'Sort field. Prefix with "-" for descending. Default: "-updated_at".',
                "default": "-updated_at",
            },
        },
        "required": ["model_name"],
    },
    fn=crud_list,
)

CRUD_GET_TOOL = ToolDef(
    name="crud_get",
    description="Fetch a single document by its MongoDB ObjectId from any CRUD model.",
    input_schema={
        "type": "object",
        "properties": {
            "model_name": _MODEL_NAME_PROP,
            "item_id": _ITEM_ID_PROP,
        },
        "required": ["model_name", "item_id"],
    },
    fn=crud_get,
)

CRUD_CREATE_TOOL = ToolDef(
    name="crud_create",
    description=(
        "Create a new document in any CRUD model. "
        "All *_id / *_ids fields in `data` are automatically coerced to ObjectIds."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "model_name": _MODEL_NAME_PROP,
            "data": {
                "type": "object",
                "description": "Field values for the new document.",
            },
        },
        "required": ["model_name", "data"],
    },
    fn=crud_create,
)

CRUD_UPDATE_TOOL = ToolDef(
    name="crud_update",
    description=(
        "Replace all mutable fields of a document (full update / PUT semantics). "
        "Immutable fields (id, created_at, …) in `data` are silently ignored."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "model_name": _MODEL_NAME_PROP,
            "item_id": _ITEM_ID_PROP,
            "data": {
                "type": "object",
                "description": "New field values for the document.",
            },
        },
        "required": ["model_name", "item_id", "data"],
    },
    fn=crud_update,
)

CRUD_PATCH_TOOL = ToolDef(
    name="crud_patch",
    description=(
        "Partially update a document (PATCH semantics). "
        "Only the fields present in `data` are changed; all other fields are left untouched."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "model_name": _MODEL_NAME_PROP,
            "item_id": _ITEM_ID_PROP,
            "data": {
                "type": "object",
                "description": "Fields to update. Omit fields you want to leave unchanged.",
            },
        },
        "required": ["model_name", "item_id", "data"],
    },
    fn=crud_patch,
)

CRUD_DELETE_TOOL = ToolDef(
    name="crud_delete",
    description="Permanently delete a document by id from any CRUD model.",
    input_schema={
        "type": "object",
        "properties": {
            "model_name": _MODEL_NAME_PROP,
            "item_id": _ITEM_ID_PROP,
        },
        "required": ["model_name", "item_id"],
    },
    fn=crud_delete,
)

CONVERSATIONS_LIST_TOOL = ToolDef(
    name="conversations_list",
    description=(
        "List the current user's conversations sorted by most recent message. "
        "Returns id, title, messages, model_id, last_message_at."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "skip": {"type": "integer", "description": "Number of conversations to skip.", "default": 0},
            "limit": {"type": "integer", "description": "Max conversations to return (1–500).", "default": 10},
            "filters": _FILTERS_PROP,
        },
    },
    fn=conversations_list,
)

CONVERSATIONS_GET_TOOL = ToolDef(
    name="conversations_get",
    description="Fetch a single conversation by id (must belong to the current user).",
    input_schema={
        "type": "object",
        "properties": {
            "item_id": _ITEM_ID_PROP,
        },
        "required": ["item_id"],
    },
    fn=conversations_get,
)

CONVERSATIONS_CREATE_TOOL = ToolDef(
    name="conversations_create",
    description=(
        "Create a new conversation for the current user. "
        "Optionally supply an external_uuid for idempotent upsert (safe to retry)."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "Display title. Auto-generated from the first user message if omitted.",
            },
            "messages": {
                "type": "array",
                "description": "Initial messages.",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {
                            "type": "string",
                            "enum": ["user", "assistant", "system"],
                        },
                        "content": {"type": "string"},
                        "image_url": {"type": "string"},
                        "image_data": {"type": "string", "description": "Base64 encoded image."},
                        "reasoning_content": {"type": "string"},
                    },
                    "required": ["role", "content"],
                },
            },
            "model_id": {
                "type": "string",
                "description": "ObjectId of the AiModel to associate.",
            },
            "external_uuid": {
                "type": "string",
                "description": "Client UUID for idempotent upsert (e.g. a UUID v4 string).",
            },
        },
    },
    fn=conversations_create,
)

CONVERSATIONS_PATCH_TOOL = ToolDef(
    name="conversations_patch",
    description=(
        "Partially update a conversation (title, messages, model_id, last_message_at). "
        "Only the provided fields are changed. Scoped to the current user."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "item_id": _ITEM_ID_PROP,
            "data": {
                "type": "object",
                "description": (
                    "Fields to update. Common keys: title (string), "
                    "messages (array of message objects), model_id (string), "
                    "last_message_at (ISO-8601 datetime string)."
                ),
            },
        },
        "required": ["item_id", "data"],
    },
    fn=conversations_patch,
)

CONVERSATIONS_DELETE_TOOL = ToolDef(
    name="conversations_delete",
    description="Permanently delete a conversation (must belong to the current user).",
    input_schema={
        "type": "object",
        "properties": {
            "item_id": _ITEM_ID_PROP,
        },
        "required": ["item_id"],
    },
    fn=conversations_delete,
)

FIND_ENTITIES_TOOL = ToolDef(
    name="find_entities",
    description=(
        "Search across all CRUD models (Client, Contact, Project, ProjectDocument) "
        "using prefix-token full-text search. Returns matching entity references with "
        "their API path, id, and display name. Use this to look up an entity by name "
        "before fetching its full record with crud_get."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search string (minimum 3 characters).",
                "minLength": 3,
            },
        },
        "required": ["query"],
    },
    fn=find_entities,
)

# ── All tools in registration order ───────────────────────────────────────────

ALL_TOOLS = [
    CRUD_LIST_TOOL,
    CRUD_GET_TOOL,
    CRUD_CREATE_TOOL,
    CRUD_UPDATE_TOOL,
    CRUD_PATCH_TOOL,
    CRUD_DELETE_TOOL,
    CONVERSATIONS_LIST_TOOL,
    CONVERSATIONS_GET_TOOL,
    CONVERSATIONS_CREATE_TOOL,
    CONVERSATIONS_PATCH_TOOL,
    CONVERSATIONS_DELETE_TOOL,
    FIND_ENTITIES_TOOL,
]
