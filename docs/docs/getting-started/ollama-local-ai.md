---
sidebar_position: 5
---

# AI Assistant with Ollama

InstaCRUD ships with a built-in [AI Assistant](../user-guide/ai-assistant.md) that works out of the box with cloud and local AI providers. [Ollama](https://ollama.com/) is the local option — it runs large language models on your own hardware with no API keys, no cloud calls, and no data leaving your machine, giving you a fully private AI assistant that works entirely offline.

---

## What Ollama is

Ollama is a free, open-source tool that downloads and serves LLMs through a local REST API compatible with the OpenAI spec. You install it once, pull the models you want, and any app that speaks OpenAI can talk to it — including InstaCRUD.

---

## Setting up Ollama

### 1. Install Ollama

Download and install Ollama from [ollama.com](https://ollama.com/). It supports macOS, Linux, and Windows.

After installation, Ollama runs as a background service and exposes its API at `http://localhost:11434`.

### 2. Configure InstaCRUD

Add (or verify) the following in your `.env` file:

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
```

That's it. InstaCRUD's AI framework connects to Ollama through the same client it uses for every other provider.

### 3. Seed the model catalogue

Run the init script to populate the database with the pre-configured Ollama models:

```bash
cd backend
poetry run python init/init_ai_models.py
```

---

## Pre-configured models

All chat models are under 15 B parameters — chosen to run realistically on a typical consumer GPU (typically 6–12 GB VRAM). The embedding models are lightweight and CPU-friendly.

### Chat & completion

| Model | Pull tag | Size | Notes |
|---|---|---|---|
| **[Mistral 7B](https://ollama.com/library/mistral)** | `mistral:latest` | 7 B | Fast general-purpose chat |
| **[Mixtral 8x7B](https://ollama.com/library/mixtral)** | `mixtral:latest` | 8×7 B MoE | Higher quality, needs more RAM |
| **[Dolphin Mixtral 8x7B](https://ollama.com/library/dolphin-mixtral)** | `dolphin-mixtral:latest` | 8×7 B MoE | Uncensored Mixtral fine-tune |
| **[DeepSeek R1 Distill 14B](https://ollama.com/library/deepseek-r1)** | `deepseek-r1:14b` | 14 B | Reasoning / chain-of-thought |
| **[Llama 3.2 Vision 11B](https://ollama.com/library/llama3.2-vision)** | `llama3.2-vision:11b` | 11 B | Vision — accepts image input |
| **[Qwen 3.5 9B](https://ollama.com/library/qwen3.5)** | `qwen3.5:9b` | 9 B | Reasoning + vision |
| **[Qwen3 VL 8B](https://ollama.com/library/qwen3-vl)** | `qwen3-vl:8b` | 8 B | Vision + reasoning |

### Embeddings

| Model | Pull tag | Notes |
|---|---|---|
| **[Nomic Embed v1.5](https://ollama.com/library/nomic-embed-text)** | `nomic-embed-text:latest` | General-purpose embeddings |
| **[BGE Large English v1.5](https://ollama.com/znbang/bge)** | `znbang/bge:large-en-v1.5-q4_k_m` | High-quality English embeddings |

---

## Pulling all models

Run these commands to download every pre-configured model. Each pull may take a few minutes depending on your connection:

```bash
# Chat models
ollama pull mistral
ollama pull mixtral
ollama pull dolphin-mixtral
ollama pull deepseek-r1:14b
ollama pull llama3.2-vision:11b
ollama pull qwen3.5:9b
ollama pull qwen3-vl:8b

# Embedding models
ollama pull nomic-embed-text
ollama pull znbang/bge:large-en-v1.5-q4_k_m
```

You don't need to pull all of them — pull only the ones you plan to enable. Start with `mistral` if you want the smallest footprint and good quality for the size.

---

## What you get

Once configured, the [AI Assistant](../user-guide/ai-assistant.md) works exactly as it does with cloud providers, with two differences:

- **Fully private** — all inference runs on your machine; nothing is sent to any external service.
- **No usage costs** — Ollama models have no per-token charges. The credit system in InstaCRUD still tracks usage internally, but no real money is spent.

Switch between Ollama and cloud models at any time from the model dropdown in the assistant.

---

## Tips

- **Not enough VRAM?** Ollama will offload layers to CPU automatically, at the cost of speed. Mistral 7B can run on CPU-only, just slowly.
- **Adding more models?** Any model available on [ollama.com/library](https://ollama.com/library) can be added to `init_ai_models.py` as a new entry with `service: AiServiceProvider.OLLAMA`. See [Using the AI Framework](../development/using-ai-framework.md) for details.
