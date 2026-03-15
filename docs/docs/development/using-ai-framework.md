---
sidebar_position: 7
---

# Using the AI Framework

InstaCRUD ships with a ready-to-use AI layer in `backend/instacrud/ai/`. It is built on **[LangChain](https://www.langchain.com/)** and supports chat completion, streaming, vision, embeddings, image generation, and MCP tool use — all through a single unified client.

## What's available

| Module | What it does |
|---|---|
| `ai_service.py` | Main `AiServiceClient` — instantiate with any configured `AiModel` |
| `ai_service_completion.py` | Text/chat completion, streaming, reasoning/chain-of-thought |
| `ai_service_embedding.py` | Vector embeddings + helpers to look up the default embedding model |
| `ai_service_vision.py` | Image input (vision) and image generation |
| `mcp_client.py` | MCP tool discovery and execution |
| `usage_tracker.py` | Per-user token/cost accounting tied to subscription tiers |
| `vector_search.py` | In-memory FAISS search (see [Embeddings & vector search](#embeddings--vector-search)) |

## Basic usage

```python
from instacrud.ai.ai_service import AiServiceClient
from instacrud.model.system_model import AiModel

# Load any model from the database
model = await AiModel.find_one(AiModel.completion == True, AiModel.enabled == True)
client = AiServiceClient(model, user_id=current_user.id)

# One-shot completion
answer = await client.get_completion("Summarise this contract in three bullets.")

# Streaming
async for token in client.get_completion_streaming(messages):
    yield token

# Vision
result = await client.get_image_completion(messages_with_image)

# Embeddings
vector = await client.get_embedding("text to embed")
```

## AI Chat — provided as-is, easy to extend

The AI Chat assistant is fully wired up and works out of the box. It is intentionally kept as a standalone feature so it stays clean and unobtrusive. Because `AiServiceClient` is just a regular async class, it is straightforward to call it from any FastAPI route, background task, or Beanie document hook — for example, to auto-summarise a document on save, generate tags for a contact, or power a custom chatbot within your own entities.

## Embeddings & vector search

Embeddings are calculated via `calculate_content_embedding()` (a thin wrapper that picks the configured default model automatically) and stored as a field on your Beanie documents.

**[MongoDB Atlas](https://www.mongodb.com/atlas)** is the primary target: [Atlas Vector Search](https://www.mongodb.com/products/platform/atlas-vector-search) handles indexing and approximate nearest-neighbour queries natively with no extra infrastructure.

For environments without Atlas, a **[FAISS](https://faiss.ai/) demo** (`vector_search.py`) is included. It loads all embeddings into memory on first search and supports cosine-similarity lookup per tenant. It is good enough for local development and small datasets, but it is **not suitable for production** — the index is lost on restart and does not scale.

For a production non-Atlas setup, **[Milvus](https://milvus.io/)** is the recommended replacement. It is open-source, self-hostable, and offers persistent indexing, horizontal scaling, and a Python SDK that maps cleanly onto the existing interface.

## Pre-configured models — `init_ai_models.py`

`backend/init/init_ai_models.py` seeds the database with a curated set of popular models, ready to enable. Four providers are covered:

| Provider | Representative models |
|---|---|
| **OpenAI** | GPT-5 series, GPT-4 Turbo, GPT-4o, DALL-E 3, text-embedding-3-* |
| **Anthropic (Claude)** | Claude 4 Opus/Sonnet, Claude 3.7 Sonnet |
| **DeepInfra** | Llama 4, Qwen 3, Mistral, Gemma 3, DeepSeek R2, BAAI embeddings |
| **Ollama** | Any locally-served model (point `OLLAMA_BASE_URL` at your instance) — see [AI Assistant with Ollama](../getting-started/ollama-local-ai.md) |

Each entry includes display name, exact API model identifier, temperature, token limits, per-token pricing, capability flags (`completion`, `embedding`, `vision`, `reasoning`, `image_generation`), and the minimum subscription tier required to use it.

Run the script once after seeding to populate `AiModel` documents:

```bash
cd backend
poetry run python init/init_ai_models.py
```

### Why DeepInfra?

[DeepInfra](https://deepinfra.com/) is selected as the default open-model provider for three reasons: it offers a wide catalogue of frontier open-source models under a single OpenAI-compatible API, its pricing is among the lowest available for hosted inference, and it does not train on your data — making it a reasonable choice when privacy matters. While we recommend it and use it ourselves, adding a new provider is straightforward — there is no vendor lock-in.
