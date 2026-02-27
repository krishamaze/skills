# Embeddings & RAG — Delta Reference

> Embedding concepts are known. This covers the NEW SDK syntax, new model, and the entirely new File Search managed RAG.

## Embeddings (New SDK Syntax)

```python
from google import genai
from google.genai import types

client = genai.Client()

# Single text
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents="What is machine learning?"
)
print(result.embeddings[0].values)  # float list

# Batch
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents=["text one", "text two", "text three"]
)

# With task type (improves quality for specific use cases)
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents="Search query",
    config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
)
```

**Task types:** RETRIEVAL_QUERY, RETRIEVAL_DOCUMENT, SEMANTIC_SIMILARITY, CLASSIFICATION, CLUSTERING

### Models
| Model | Status | Notes |
|---|---|---|
| `gemini-embedding-001` | GA, shutdown July 14, 2026 | Recommended |
| `text-embedding-004` | **Shutdown Jan 14, 2026** | Migrate NOW |

## File Search — Managed RAG (Entirely New)

Server-side chunking + embedding + retrieval. Free storage/query — only pay for indexing.

### Full Workflow
```python
from google import genai
from google.genai import types
import time

client = genai.Client()

# 1. Create store
store = client.file_search_stores.create(
    config={'display_name': 'knowledge-base'}
)
print(store.name)  # e.g., fileSearchStores/abc123

# 2a. Direct upload (recommended)
operation = client.file_search_stores.upload_to_file_search_store(
    file='document.pdf',
    file_search_store_name=store.name,
    config={'display_name': 'My Document'}
)
while not operation.done:
    time.sleep(5)
    operation = client.operations.get(operation)

# 2b. Or: upload then import (two-step)
file = client.files.upload(file='doc.txt', config={'name': 'my-file'})
op = client.file_search_stores.import_file(
    file_search_store_name=store.name,
    file_name=file.name
)
while not op.done:
    time.sleep(5)
    op = client.operations.get(op)

# 3. Query with File Search tool
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="What does the document say about pricing?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(
            file_search=types.FileSearch(
                file_search_store_names=[store.name]
            )
        )]
    )
)
print(response.text)
# Citations: response.candidates[0].grounding_metadata
```

### Custom Chunking
```python
operation = client.file_search_stores.upload_to_file_search_store(
    file='doc.txt',
    file_search_store_name=store.name,
    config={
        'chunking_config': {
            'white_space_config': {
                'max_tokens_per_chunk': 200,
                'max_overlap_tokens': 20
            }
        }
    }
)
```

### File Metadata Filtering
```python
# Add metadata during import
op = client.file_search_stores.import_file(
    file_search_store_name=store.name,
    file_name=file.name,
    custom_metadata=[
        {"key": "author", "string_value": "Robert Graves"},
        {"key": "year", "numeric_value": 1934}
    ]
)

# Query with filter
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Tell me about the book",
    config=types.GenerateContentConfig(
        tools=[types.Tool(file_search=types.FileSearch(
            file_search_store_names=[store.name],
            metadata_filter="author=Robert Graves",
        ))]
    )
)
```

### Store Management
```python
# List
for store in client.file_search_stores.list(): print(store)

# Get
store = client.file_search_stores.get(name='fileSearchStores/my-store')

# Delete (force=True deletes even with docs inside)
client.file_search_stores.delete(name='fileSearchStores/my-store', config={'force': True})

# Manage docs in store
for doc in client.file_search_stores.documents.list(parent='fileSearchStores/my-store'):
    print(doc)
client.file_search_stores.documents.delete(name='fileSearchStores/my-store/documents/my_doc')
```

### Supported models
Gemini 3.1 Pro Preview, 3 Flash Preview, 2.5 Pro, 2.5 Flash-Lite

### Structured Output + File Search (Gemini 3 only)
```python
from pydantic import BaseModel, Field

class Money(BaseModel):
    amount: str = Field(description="The numerical part")
    currency: str = Field(description="The currency")

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="What is the minimum hourly wage?",
    config=types.GenerateContentConfig(
        tools=[types.Tool(file_search=types.FileSearch(
            file_search_store_names=[store.name]
        ))],
        response_mime_type="application/json",
        response_schema=Money.model_json_schema()
    )
)
result = Money.model_validate_json(response.text)
```

## RAG Decision Guide

| Approach | When to use |
|---|---|
| **File Search tool** | Easiest; managed chunking+indexing; free storage; use when convenience > control |
| **Embeddings + vector DB** | Need custom chunking, hybrid search, or full control |
| **Long context (no RAG)** | Docs fit in 1M token window; simpler; use caching for cost |
| **Deep Research agent** | Complex multi-step research; autonomous web search + your data |

## Deep Research + File Search
```python
interaction = client.interactions.create(
    input="Compare our Q4 report to public market trends",
    agent="deep-research-pro-preview-12-2025",
    background=True,
    tools=[{
        "type": "file_search",
        "file_search_store_names": ["fileSearchStores/my-store"]
    }]
)
# Combines web search (automatic) + your indexed files
```
