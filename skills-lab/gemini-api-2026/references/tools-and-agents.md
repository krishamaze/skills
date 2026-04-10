# Tools & Agents Reference

## Function Calling Modes

```python
tool_config=types.ToolConfig(
    function_calling_config=types.FunctionCallingConfig(
        mode="AUTO",           # Model decides when to call (default)
        # mode="ANY",          # Model must call a function (choose from allowed)
        # mode="NONE",         # No function calls
        allowed_function_names=["fn1", "fn2"]  # Restrict which functions (ANY mode)
    )
)
```

## Parallel Function Calling

Model may return multiple function calls in one response:
```python
for part in response.candidates[0].content.parts:
    if part.function_call:
        # Execute each function, collect results
        results.append(execute(part.function_call))
# Send all results back in one turn
```

## Thought Signatures — Multi-Step Example (Gemini 3)

Turn 1, Step 1 → Model returns `FC1 + signature_A`  
Turn 1, Step 2 → Send back `(FC1 + signature_A) + FR1` → Model returns `FC2 + signature_B`  
Turn 1, Step 3 → Send back `(FC2 + signature_B) + FR2` → Model returns text

**Rule:** The FIRST function call part in each step must have its signature.  
**Parallel:** Signature only on the FIRST parallel FC; subsequent FCs in same step don't need one.  
**Validation scope:** Only current turn is validated (not older turns).

Error example: `Function call FC1 in the 1. content block is missing a thought_signature`

## Grounding Metadata Structure

```python
metadata = response.candidates[0].grounding_metadata
metadata.web_search_queries  # list of search queries used
metadata.grounding_chunks    # [{web: {uri, title}}, ...]
metadata.grounding_supports  # [{segment: {start, end, text}, grounding_chunk_indices: [0,1]}]
metadata.search_entry_point  # HTML/CSS for required Search Suggestions widget
```

Must render `searchEntryPoint` per Terms of Service when using grounding.

## Computer Use — Supported Actions

Actions the model can generate:
- `click_at(x, y)` — mouse click
- `type_text_at(x, y, text, press_enter)` — type text
- `scroll(x, y, direction, amount)` — scroll
- `drag_and_drop(start, end)` — drag
- `key_press(keys)` — keyboard shortcut
- `screenshot()` — capture state

Coordinates: normalized 0-999 → convert to actual pixels before execution.

## Agent Frameworks

| Framework | Package | Gemini Integration |
|-----------|---------|-------------------|
| CrewAI | `crewai[tools]` | `LLM(model='gemini/gemini-3-flash-preview')` |
| LangGraph | `langchain-google-genai` | `ChatGoogleGenerativeAI(model=...)` |
| LlamaIndex | `llama-index-llms-google-genai` | `GoogleGenAI(model=...)` |
| Temporal | `temporalio` + `google-genai` | Direct SDK; Temporal adds durability |
| Vercel AI SDK | `@ai-sdk/google` | `createGoogleGenerativeAI()` |

## Durable Agents (Temporal Pattern)

Key insight: Each LLM call and tool call becomes a Temporal Activity — auto-retried on failure, no conversation lost.

```python
from temporalio import workflow, activity

@activity.defn
async def call_gemini(prompt: str) -> str:
    client = genai.Client()
    response = client.models.generate_content(model="gemini-3-flash-preview", contents=prompt)
    return response.text
```

## Partner Integration Paths

| You are | Recommended path |
|---------|-----------------|
| Enterprise gateway / ecosystem framework | Google GenAI SDK |
| Edge platform, aggregator needing full features | Direct REST API |
| Aggregator needing only text, using OpenAI SDK | OpenAI compatibility layer |

All partners: send `x-goog-api-client` header for proper attribution.
