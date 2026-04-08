---
sidebar_position: 8
title: Using the AI Tools
---

# Using the AI Tools

InstaCRUD ships with a set of ready-made **LLM tool functions** in `backend/instacrud/ai/functions/` that let any AI agent read and write your data directly — without you having to build a custom tool layer. The tools cover full CRUD operations on all org entities, conversation management, and cross-model search. They work with Anthropic, OpenAI, LangChain/LangGraph, or any framework that supports function/tool calling.

---

## How it fits together

The tool layer sits on top of the [AI Framework](./using-ai-framework.md) and exposes callable Python async functions paired with JSON Schema descriptors via `ToolDef`:

```
Your LLM agent
    └── tool call (Anthropic / OpenAI / LangChain format)
            └── ToolDef adapter  (backend/instacrud/ai/tools.py)
                    └── tool function  (backend/instacrud/ai/functions/crud.py)
                            └── Security guards → Beanie / MongoDB
```

---

## ToolDef — the universal descriptor

`backend/instacrud/ai/tools.py` defines a single `ToolDef` dataclass that pairs a Python callable with its Anthropic-native JSON Schema:

```python
from instacrud.ai.tools import ToolDef, to_anthropic_tool, to_openai_tool, to_langchain_tool
from instacrud.ai.functions.crud import CRUD_LIST_TOOL, CRUD_CREATE_TOOL, ALL_TOOLS

# Anthropic
tools = [to_anthropic_tool(t) for t in ALL_TOOLS]
client.messages.create(tools=tools, ...)

# OpenAI
tools = [to_openai_tool(t) for t in ALL_TOOLS]
client.chat.completions.create(tools=tools, ...)

# LangChain / LangGraph
lc_tools = [to_langchain_tool(t) for t in ALL_TOOLS]
agent = create_react_agent(llm, lc_tools)
```

One descriptor, three adapters — no code changes needed when you switch providers.

---

## Available tools

### Generic CRUD

Works on any entity: `Client`, `Contact`, `Address`, `Project`, `ProjectDocument`, `Conversation`.

| Tool | Function | Description |
|---|---|---|
| `crud_list` | `crud_list(model_name, filters, skip, limit, sort)` | Paginated list with MongoDB filter support |
| `crud_get` | `crud_get(model_name, item_id)` | Fetch one document by ObjectId |
| `crud_create` | `crud_create(model_name, data)` | Create a new document |
| `crud_update` | `crud_update(model_name, item_id, data)` | Full replace (PUT semantics) |
| `crud_patch` | `crud_patch(model_name, item_id, data)` | Partial update (PATCH semantics) |
| `crud_delete` | `crud_delete(model_name, item_id)` | Delete by ObjectId |

### Conversations

User-scoped — tools automatically filter to the authenticated user's conversations.

| Tool | Function | Description |
|---|---|---|
| `conversations_list` | `conversations_list(skip, limit, filters)` | List the current user's conversations |
| `conversations_get` | `conversations_get(item_id)` | Fetch one conversation |
| `conversations_create` | `conversations_create(title, messages, model_id, external_uuid)` | Create a new conversation |
| `conversations_patch` | `conversations_patch(item_id, data)` | Partial update |
| `conversations_delete` | `conversations_delete(item_id)` | Delete a conversation |

### Cross-model search

| Tool | Function | Description |
|---|---|---|
| `find_entities` | `find_entities(query)` | Full-text prefix search across Clients, Contacts, Projects, ProjectDocuments |

### Direct Python use

All tool functions are plain async functions — you can call them directly without going through a tool-calling loop:

```python
from instacrud.ai.functions.crud import crud_list, crud_create, crud_get, crud_patch, crud_delete

items = await crud_list("Client", limit=5)
item  = await crud_get("Client", "507f1f77bcf86cd799439011")
new   = await crud_create("Client", {"code": "ACME", "name": "Acme Corp", "type": "COMPANY"})
saved = await crud_patch("Client", new["id"], {"name": "Acme Corp Ltd"})
await crud_delete("Client", new["id"])
```

---

## LangChain agent example

The pattern from `backend/test/ai_tools_test.py` — bind the tool list to a chat model, run a `HumanMessage`, and execute whatever tools the model calls:

```python
import json
from langchain_core.messages import HumanMessage, ToolMessage

from instacrud.ai.ai_service import AiServiceClient
from instacrud.ai.tools import to_langchain_tool
from instacrud.model.system_model import AiModel
from instacrud.database import init_org_db
from instacrud.context import current_user_context, CurrentUserContext
from instacrud.ai.functions.crud import (
    CRUD_CREATE_TOOL, CRUD_LIST_TOOL, CRUD_GET_TOOL,
    CRUD_UPDATE_TOOL, CRUD_PATCH_TOOL, CRUD_DELETE_TOOL,
    FIND_ENTITIES_TOOL,
)

ALL_TOOLS = [
    CRUD_CREATE_TOOL, CRUD_LIST_TOOL, CRUD_GET_TOOL,
    CRUD_UPDATE_TOOL, CRUD_PATCH_TOOL, CRUD_DELETE_TOOL,
    FIND_ENTITIES_TOOL,
]

async def run_agent(prompt: str, org_id: str, user_id: str, role: str = "USER") -> str:
    """Run a tool-calling loop for one prompt and return the final text."""
    token = current_user_context.set(CurrentUserContext(
        user_id=user_id,
        email="agent@example.com",
        role=role,
        organization_id=org_id,
    ))
    try:
        await init_org_db(org_id)

        # Resolve any enabled completion model from the DB — provider-agnostic
        ai_model = await AiModel.find_one(AiModel.completion == True, AiModel.enabled == True)
        client = AiServiceClient(ai_model, user_id=user_id)

        lc_tools = [to_langchain_tool(t) for t in ALL_TOOLS]
        bound = client.model.bind_tools(lc_tools)
        messages = [HumanMessage(content=prompt)]

        for _ in range(10):                         # safety cap on iterations
            response = await bound.ainvoke(messages)
            messages.append(response)

            if not getattr(response, "tool_calls", None):
                return response.content             # model is done

            for tc in response.tool_calls:
                tdef = next(t for t in ALL_TOOLS if t.name == tc["name"])
                try:
                    result = await tdef.fn(**tc["args"])
                    content = json.dumps(result, default=str)
                except Exception as exc:
                    content = f"Error: {exc}"
                messages.append(ToolMessage(content=content, tool_call_id=tc["id"]))

        return ""
    finally:
        current_user_context.reset(token)
```

### Example prompts

These are representative of the prompts used in `ai_tools_test.py`:

```python
# Simple read — list active companies
await run_agent(
    "List up to 5 clients of type COMPANY.",
    org_id=org_id, user_id=user_id,
)

# Full CRUD lifecycle
await run_agent(
    "Create a client with code 'ACME', name 'Acme Corp', type 'COMPANY'. "
    "Confirm it exists, rename it to 'Acme Corp Ltd', then delete it. Reply DONE.",
    org_id=org_id, user_id=user_id,
)

# Search then update — model decides which tools to chain
await run_agent(
    "The greenthumb company name needs updating. Rename it to 'GreenThumb Global Solutions'.",
    org_id=org_id, user_id=user_id,
)

# Date arithmetic — model reads the record, calculates the new date, patches it
await run_agent(
    "The gardening project is running behind schedule. "
    "Push its end date forward by exactly 2 months.",
    org_id=org_id, user_id=user_id,
)
```

`AiServiceClient` resolves the underlying LangChain model (`client.model`) from the `AiModel` record in the database, so the loop above works with any configured provider — OpenAI, Anthropic, DeepInfra, or Ollama — without any code changes. To target a specific model, use `AiModel.find_one(AiModel.model_identifier == "gpt-5-mini")` or `AiServiceClient.from_id(model_id)` instead. For the raw Anthropic SDK (no LangChain), use `to_anthropic_tool` and handle `stop_reason == "tool_use"` manually, as shown in `_anthr_tool_loop` in the test file.

---

## Security layers

Every tool call passes through multiple independent security checks before touching the database.

### 1. Authentication and role guards

`_require_auth()` verifies that there is a logged-in user in the current context. Write tools additionally call `_require_write_role()`, which blocks `RO_USER` accounts. Both respect the global killswitches in `.env`:

| Setting | Default | Effect |
|---|---|---|
| `ALLOW_AI_TOOLS` | `true` | Master switch — disables all AI tool functions when `false` |
| `ALLOW_AI_RW_ACCESS` | `true` | Makes all tools read-only when `false` |
| `ALLOW_AI_SYSTEM_ACCESS` | `false` | Blocks access to system models (User, Organization, AiModel, …) |

### 2. Input validation

All write payloads go through three checks before the database is touched:

- **Prompt injection** — `_check_prompt_injection()` scans every string value for known jailbreak and instruction-override patterns (e.g. "ignore previous instructions", "act as uncensored AI", `<system>` tags).
- **NoSQL injection** — `_scan_for_nosql_data_keys()` rejects any dict key that starts with `$`, preventing operator injection in write payloads.
- **XSS** — `_scan_for_xss_and_sql()` blocks `<script>`, `javascript:`, and inline event handlers in stored values.

These run recursively on nested structures up to a configurable depth.

### 3. Two-stage abuse guardrail

`_llm_guardrail()` runs on every tool call that can affect data or produce large reads:

**Stage 1 — deterministic (always runs, zero cost):** Pattern-based rules block obvious abuse without any LLM call:

| Rule | What it catches |
|---|---|
| `SCRAPE-1/2` | `crud_list` with large `limit` or `skip` and no filters |
| `SCRAPE-3` | Deep pagination (`limit × skip > 2000`) |
| `DDOS` | `limit = 500` (hard ceiling) |
| `ENUM` | `find_entities` with single-char or wildcard queries |
| `BULK_DEL` | `crud_delete` without a valid 24-hex ObjectId |
| `BULK_WRITE` | `crud_update`/`crud_patch` without a valid ObjectId |
| `EMPTY_PATCH` | Updates with no mutable fields |
| `CROSS_DUMP` | `crud_list("Conversation")` without a filter |

**Stage 2 — LLM classification (optional):** When `TOOLS_GUARDRAIL_MODEL` is set to a model identifier (e.g. `"gpt-5-mini"`), every call that passes Stage 1 is reviewed by the model, which returns `ALLOW` or `BLOCK` with a cited rule. Stage 2 fails open — a transient API error logs a warning but does not block legitimate traffic.

```env
# .env
TOOLS_GUARDRAIL_MODEL="gpt-5-mini"   # leave empty to disable Stage 2
```

The guardrail uses the same provider-agnostic `AiServiceClient` as the rest of the framework — it works with OpenAI, Anthropic, DeepInfra, or [Ollama](../getting-started/ollama-local-ai.md) equally well.

---

## Adding your own tools

1. Write an async Python function that accepts and returns plain JSON-serialisable values.
2. Wrap it in a `ToolDef` with an Anthropic-style `input_schema`.
3. Pass the adapter output to your LLM's tool list.

```python
from instacrud.ai.tools import ToolDef, to_langchain_tool

async def summarise_project(project_id: str) -> str:
    doc = await crud_get("Project", project_id)
    # ... call AiServiceClient, return summary
    return summary

SUMMARISE_TOOL = ToolDef(
    name="summarise_project",
    description="Return a one-paragraph summary of a project.",
    input_schema={
        "type": "object",
        "properties": {"project_id": {"type": "string"}},
        "required": ["project_id"],
    },
    fn=summarise_project,
)

lc_tool = to_langchain_tool(SUMMARISE_TOOL)
```

For the full AI framework reference — `AiServiceClient`, embeddings, vision, streaming, usage tracking — see [Using the AI Framework](./using-ai-framework.md).

---

## Testing

The tool layer has its own test file: `backend/test/ai_tools_test.py`.

Security guard tests run in mock mode with no API keys needed:

```bash
cd backend
poetry run python -m pytest test/ai_tools_test.py -v
```

LLM tool-calling integration tests (live tool use end-to-end) require `--type=live` and valid API keys:

```bash
poetry run python -m pytest test/ai_tools_test.py --type=live -v
```

See [Automated Testing](./auto-testing.md) for the full test suite overview.

---

## See also

- [Using the AI Framework](./using-ai-framework.md) — `AiServiceClient`, embeddings, streaming, vision, and model configuration
- [AI Assistant](../user-guide/ai-assistant.md) — the built-in chat UI powered by the same AI layer
- [AI Assistant with Ollama](../getting-started/ollama-local-ai.md) — run all AI features (including the guardrail) fully offline
- [Vibecoding Best Practices](./vibecoding-best-practices.md) — using AI coding assistants to build on top of InstaCRUD
