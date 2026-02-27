---
name: gemini-api-2026
description: >
  Google Gemini API patterns for 2026 — DELTA KNOWLEDGE ONLY. This skill
  corrects stale training data and teaches NEW API surfaces. Use whenever
  writing code that calls Gemini models. Covers the new google-genai SDK
  (NOT the legacy google.generativeai), Gemini 3 models, thought signatures,
  thinking config, Interactions API, File Search (managed RAG), Computer Use,
  URL Context, Nano Banana image gen, Live API, and ephemeral tokens.
  ALWAYS prefer `from google import genai` over any legacy import.
---

# Gemini API 2026 — Delta Knowledge

> **This skill only contains what a 2024-trained model doesn't know.**
> General concepts (streaming, chat, embeddings, function calling basics,
> safety categories, HTTP errors) are omitted — you already know those.

**Scraped:** 2026-02-27 from ai.google.dev

---

## Critical Gotchas

1. **SDK import changed:** `from google import genai` — NOT `import google.generativeai as genai`
2. **Package changed:** `pip install google-genai` — NOT `google-generativeai`
3. **Client architecture:** All calls go through `client = genai.Client()` → `client.models.generate_content(...)`. No more `genai.GenerativeModel()`
4. **Temperature:** Default is **1.0** for Gemini 3. Do NOT lower it — causes loops/degraded reasoning
5. **Thought signatures:** Gemini 3 returns `thoughtSignature` on function calls. You MUST echo it back or get **400 error**. SDKs handle this automatically in chat mode
6. **Thinking params split:** Gemini 3 uses `thinking_level` (string). Gemini 2.5 uses `thinking_budget` (int). Cannot mix them — 400 error
7. **API default:** SDK uses `v1beta`. Use `http_options={'api_version': 'v1alpha'}` for experimental features (media_resolution, ephemeral tokens)
8. **REST auth header:** `x-goog-api-key: $GEMINI_API_KEY` (not `Authorization: Bearer`)
9. **Safety filters default OFF** in Gemini 2.5/3 (changed from older models)

---

## Models (Feb 2026)

### Gemini 3 (Current)
| Model | ID | Context | Price (in/out per 1M) |
|---|---|---|---|
| 3.1 Pro Preview | `gemini-3.1-pro-preview` | 1M/64k | $2/$12 (<200k), $4/$18 (>200k) |
| 3 Flash Preview | `gemini-3-flash-preview` | 1M/64k | $0.50/$3 |
| Nano Banana Pro | `gemini-3-pro-image-preview` | 65k/32k | $2 text / $0.134 img |
| Nano Banana 2 | `gemini-3.1-flash-image-preview` | 128k/32k | $0.25 text / $0.067 img |

**⚠️ `gemini-3-pro-preview` shuts down March 9, 2026 → use `gemini-3.1-pro-preview`**

### Gemini 2.5 (Stable, shutting down)
| Model | ID | Shutdown |
|---|---|---|
| 2.5 Pro | `gemini-2.5-pro` | June 17, 2026 |
| 2.5 Flash | `gemini-2.5-flash` | June 17, 2026 |
| 2.5 Flash Lite | `gemini-2.5-flash-lite` | July 22, 2026 |
| 2.5 Flash Image | `gemini-2.5-flash-image` | Oct 2, 2026 |

### Specialized
| Purpose | Model ID |
|---|---|
| Embeddings | `gemini-embedding-001` (shutdown July 14, 2026) |
| TTS | `gemini-2.5-flash-preview-tts` |
| Live API | `gemini-2.5-flash-native-audio-preview-12-2025` |
| Computer Use | `gemini-2.5-computer-use-preview-10-2025` or `gemini-3-flash-preview` |
| Deep Research | `deep-research-pro-preview-12-2025` (Interactions API only) |
| Video (Veo) | `veo-3.1-generate-preview` |
| Images (Imagen) | `imagen-4.0-generate-001` (shutdown June 24, 2026) |
| Music (Lyria) | `models/lyria-realtime-exp` |

### Aliases
`gemini-pro-latest` → `gemini-3-pro-preview` | `gemini-flash-latest` → `gemini-3-flash-preview`

---

## New SDK Syntax

```python
# OLD (legacy — do NOT use)
import google.generativeai as genai
model = genai.GenerativeModel('gemini-pro')
response = model.generate_content('Hello')

# NEW (2026)
from google import genai
from google.genai import types

client = genai.Client()  # reads GEMINI_API_KEY env var
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Hello",
    config=types.GenerateContentConfig(
        system_instruction="You are helpful.",
        temperature=1.0,
    )
)
print(response.text)
```

```javascript
// OLD: import { GoogleGenerativeAI } from "@google/generative-ai";
// NEW:
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});
const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Hello",
});
```

**Centralized client services:** `client.models`, `client.chats`, `client.files`, `client.caches`, `client.tunings`, `client.interactions`, `client.file_search_stores`, `client.auth_tokens`

---

## Thinking Config

### Gemini 3 — `thinking_level` (string)
| Level | 3.1 Pro | 3 Flash | Description |
|---|---|---|---|
| `minimal` | ❌ | ✅ | Near-zero thinking. May still think on complex code. Not guaranteed off |
| `low` | ✅ | ✅ | Fast, low-cost |
| `medium` | ✅ | ✅ | Balanced |
| `high` | ✅ (default) | ✅ (default) | Maximum reasoning depth |

```python
config=types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(thinking_level="low")
)
```

### Gemini 2.5 — `thinking_budget` (integer)
| Model | Range | Disable | Dynamic |
|---|---|---|---|
| 2.5 Pro | 128–32768 | Cannot disable | `-1` (default) |
| 2.5 Flash | 0–24576 | `0` | `-1` (default) |
| 2.5 Flash Lite | 512–24576 | `0` | `-1` |

```python
config=types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(thinking_budget=1024)
    # thinking_budget=0  → disable  |  thinking_budget=-1  → dynamic
)
```

### Thought Summaries (new)
```python
config=types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(include_thoughts=True)
)
for part in response.candidates[0].content.parts:
    if part.thought:
        print("Thought:", part.text)
    else:
        print("Answer:", part.text)
```

---

## Thought Signatures (Critical for Gemini 3)

Gemini 3 returns `thoughtSignature` on response parts. **You must echo them back.**

| Context | Validation | What to do |
|---|---|---|
| **Function calling** | **Strict — 400 error if missing** | Return ALL signatures in history |
| **Image gen/editing** | **Strict — 400 error if missing** | Return signatures on first part + all `inlineData` parts |
| **Text/Chat** | Recommended (not enforced) | Include for better reasoning quality |

**SDK handles this automatically in chat mode.** Only manual handling needed for REST or custom history.

**Rules for manual FC:**
- **Single FC:** The `functionCall` part has a signature → return it
- **Parallel FC:** Only the FIRST `functionCall` part has the signature → preserve part order
- **Multi-step (sequential):** Each step's FC has a signature → return ALL accumulated signatures

**Bypass dummy string** (for migrating from other models or injecting synthetic FC):
```json
{"thoughtSignature": "context_engineering_is_the_way to_go"}
```

---

## URL Context (New Tool)

Fetches and reads URLs inline. Up to 20 URLs per request, max 34MB per URL.
```python
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Summarize https://example.com/doc.pdf",
    config=types.GenerateContentConfig(
        tools=[{"url_context": {}}]
    )
)
# Combine with Google Search:
# tools=[{"url_context": {}}, {"google_search": {}}]
```
**Limitation:** Cannot combine with function calling.

---

## Interactions API (New)

Stateful, server-managed conversation alternative to `generateContent`.
```python
# Basic
interaction = client.interactions.create(
    model="gemini-3-flash-preview",
    input="Tell me a joke"
)
print(interaction.outputs[-1].text)

# Stateful follow-up (server remembers history)
interaction2 = client.interactions.create(
    model="gemini-3-flash-preview",
    input="Tell me another",
    previous_interaction_id=interaction.id
)

# Deep Research (background agent)
interaction = client.interactions.create(
    agent="deep-research-pro-preview-12-2025",
    input="Research quantum computing advances in 2025",
    background=True
)
```

---

## File Search — Managed RAG (New)

Server-side chunking, embedding, and retrieval. Free storage/query — you only pay for indexing embeddings.
```python
# 1. Create store + upload
store = client.file_search_stores.create(config={'display_name': 'my-docs'})
op = client.file_search_stores.upload_to_file_search_store(
    file='data.pdf', file_search_store_name=store.name,
    config={'display_name': 'data.pdf'}
)
while not op.done:
    import time; time.sleep(5)
    op = client.operations.get(op)

# 2. Query with File Search tool
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="What does the data show?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(file_search=types.FileSearch(
            file_search_store_names=[store.name]
        ))]
    )
)
# Citations: response.candidates[0].grounding_metadata
```

---

## Computer Use (New)

Model sees screenshots, outputs UI actions on a **1000×1000 normalized grid**.
Supported models: `gemini-2.5-computer-use-preview-10-2025`, `gemini-3-flash-preview`

```python
config = types.GenerateContentConfig(
    tools=[types.Tool(computer_use=types.ComputerUse(
        environment=types.Environment.ENVIRONMENT_BROWSER,
        excluded_predefined_functions=["drag_and_drop"]
    ))]
)
# Response contains function_call with name="click_at", args={"x": 371, "y": 470}
# Denormalize: actual_x = int(x / 1000 * SCREEN_WIDTH)
```

**Actions:** `click_at`, `type_text_at`, `hover_at`, `scroll_at`, `scroll_document`, `key_combination`, `navigate`, `open_web_browser`, `go_back`, `go_forward`, `search`, `wait_5_seconds`, `drag_and_drop`

**Safety:** Response may include `safety_decision.decision == "require_confirmation"` → must get user consent before executing.

---

## Nano Banana Image Gen (New)

Native image generation via Gemini models (not Imagen).
```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",  # or gemini-3.1-flash-image-preview
    contents="A tropical beach at sunset",
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio="16:9",  # 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9
            image_size="4K"       # 1k, 2k, 4k
        )
    )
)
for part in response.parts:
    if part.inline_data:
        part.as_image().save('output.png')
```
**Thought signatures required** for multi-turn image editing.

---

## Media Resolution (New, v1alpha)

Per-part control over vision token usage:
```python
client = genai.Client(http_options={'api_version': 'v1alpha'})
# Per-part: media_resolution={"level": "media_resolution_high"}
```
| Setting | Image tokens | Video tokens/frame |
|---|---|---|
| `media_resolution_low` | 280 | 70 |
| `media_resolution_medium` | 560 | 70 (same as low) |
| `media_resolution_high` | 1120 | 280 |
| `media_resolution_ultra_high` | — | — (per-part only) |

---

## Ephemeral Tokens (New, Live API only)

Short-lived tokens for client-side WebSocket connections. Requires `v1alpha`.
```python
client = genai.Client(http_options={'api_version': 'v1alpha'})
token = client.auth_tokens.create(config={
    'uses': 1,
    'expire_time': now + datetime.timedelta(minutes=30),
    'new_session_expire_time': now + datetime.timedelta(minutes=1),
})
# Pass token.name to client as API key
```

---

## Structured Output + Tools (Gemini 3 only)

Gemini 3 can combine structured output with built-in tools (Google Search, URL Context, File Search, FC):
```python
response = client.models.generate_content(
    model="gemini-3.1-pro-preview",
    contents="Search for the latest Euro results",
    config={
        "tools": [{"google_search": {}}, {"url_context": {}}],
        "response_mime_type": "application/json",
        "response_json_schema": MySchema.model_json_schema(),
    }
)
```

---

## OpenAI Compatibility (3-line change)

```python
from openai import OpenAI
client = OpenAI(
    api_key="GEMINI_API_KEY",
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
response = client.chat.completions.create(model="gemini-3-flash-preview", messages=[...])
```

---

## Deep Dives (Reference Files)

Read these only when you need more detail on a specific topic:

| File | When to read |
|---|---|
| `references/tools-and-agents.md` | Implementing thought signatures manually, building Computer Use agents, URL Context integration, agent framework setup |
| `references/generation.md` | Image gen (Nano Banana), video gen (Veo 3.1), TTS voices, music gen (Lyria) |
| `references/embeddings-and-rag.md` | File Search full workflow (chunking, metadata filtering, store management), embeddings API, RAG decision guide |
| `references/advanced-features.md` | Caching/Batch API syntax, Interactions API extended (multimodal, TTS, Deep Research), Live API features, ephemeral tokens, API versions |
| `references/files-and-media.md` | Files API syntax, GCS URI registration, media resolution per-part, inline limits |
