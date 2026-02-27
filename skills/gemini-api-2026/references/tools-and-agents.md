# Tools & Agents — Delta Reference

> Only new/changed patterns. For basic FC concepts (modes, parallel calling), you already know them.

## Thought Signatures — Deep Dive (Gemini 3)

### Multi-Step Function Calling Flow

Turn 1, Step 1 → Model returns `FC1 + signature_A`
Turn 1, Step 2 → Send back `(FC1 + signature_A) + FR1` → Model returns `FC2 + signature_B`
Turn 1, Step 3 → Send back `(FC2 + signature_B) + FR2` → Model returns text

**Rules:**
- The FIRST function call part in each step carries the signature
- Parallel FCs: only FIRST FC has signature; subsequent FCs in same step don't
- Validation scope: only current turn validated (not older turns)
- Error: `Function call FC1 in the 1. content block is missing a thought_signature`

### Image Generation/Editing Signatures

- First part contains `thoughtSignature` — MUST be returned
- All `inlineData` parts also contain `thoughtSignature` — MUST be returned
- Missing any → **400 error**

### Bypass String

For injecting synthetic FC history or migrating from other providers:
```json
{"thoughtSignature": "context_engineering_is_the_way to_go"}
```

## Computer Use — Complete Action Reference

| Action | Arguments | Notes |
|---|---|---|
| `click_at` | `x, y` (0-999) | Normalized grid |
| `type_text_at` | `x, y, text, press_enter?, clear_before_typing?` | Defaults: enter=true, clear=true |
| `hover_at` | `x, y` | Reveal sub-menus |
| `scroll_at` | `x, y, direction, magnitude?` | magnitude default 800 |
| `scroll_document` | `direction` | Whole page scroll |
| `key_combination` | `keys` | e.g. "Control+C", "Enter" |
| `navigate` | `url` | Direct URL nav |
| `open_web_browser` | — | Open browser |
| `go_back` / `go_forward` | — | Browser history |
| `search` | — | Go to search engine |
| `wait_5_seconds` | — | Wait for dynamic content |
| `drag_and_drop` | `x, y, dest_x, dest_y` | All 0-999 |

### Coordinate Denormalization
```python
def denormalize(coord, screen_size):
    return int(coord / 1000 * screen_size)
# Model outputs 0-999, recommended screen: 1440×900
```

### Safety Decision Handling
```python
if 'safety_decision' in function_call.args:
    if function_call.args['safety_decision']['decision'] == 'require_confirmation':
        # MUST get user consent before executing
        # Include safety_acknowledgement="true" in FunctionResponse
```

### Custom Functions (e.g., Android)
```python
# Add custom FDs alongside Computer Use tool
config = types.GenerateContentConfig(
    tools=[
        types.Tool(computer_use=types.ComputerUse(
            environment=types.Environment.ENVIRONMENT_BROWSER,
            excluded_predefined_functions=["open_web_browser", "search"]
        )),
        types.Tool(function_declarations=[
            types.FunctionDeclaration.from_callable(client=client, callable=open_app),
        ]),
    ]
)
```

## URL Context — Extended

- Fetches via internal cache first, falls back to live fetch
- Combine with Google Search: `tools=[{"url_context": {}}, {"google_search": {}}]`
- Supported: HTML, JSON, plain text, images, PDFs (max 34MB each)
- **Not supported:** paywalled, YouTube, Google Workspace, video/audio files
- **Cannot combine with function calling**
- Inspect retrieval: `response.candidates[0].url_context_metadata`

## Agent Framework Integrations (2026)

| Framework | Package | Usage |
|---|---|---|
| CrewAI | `crewai[tools]` | `LLM(model='gemini/gemini-3-flash-preview')` |
| LangGraph | `langchain-google-genai` | `ChatGoogleGenerativeAI(model=...)` |
| LlamaIndex | `llama-index-llms-google-genai` | `GoogleGenAI(model=...)` |
| Temporal | `temporalio` + `google-genai` | Durable agents — each LLM/tool call = Activity with auto-retry |
| Vercel AI SDK | `@ai-sdk/google` | `createGoogleGenerativeAI()` |

### Grounding Metadata (new structure)
```python
metadata = response.candidates[0].grounding_metadata
metadata.web_search_queries      # queries used
metadata.grounding_chunks        # [{web: {uri, title}}, ...]
metadata.grounding_supports      # [{segment: {start, end, text}, grounding_chunk_indices: [0,1]}]
metadata.search_entry_point      # HTML/CSS — MUST render per ToS
```
