# Files & Media — Delta Reference

> File upload and multimodal input concepts are known. This covers the NEW SDK syntax and new capabilities only.

## Files API (New SDK Syntax)

```python
from google import genai

client = genai.Client()

# Upload
file = client.files.upload(
    file="document.pdf",
    config={"display_name": "My Document", "name": "custom-name"}
)
print(file.uri, file.name, file.state)

# Use in request
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[file, "Summarize this"]
)

# Wait for processing (videos need time)
import time
while file.state == "PROCESSING":
    time.sleep(5)
    file = client.files.get(name=file.name)

# List / Delete
for f in client.files.list(): print(f.name, f.display_name)
client.files.delete(name=file.name)
```

**File retention:** 48 hours for Files API uploads. Use File Search stores for permanent storage.

## GCS URI Registration (New)

```python
# Register GCS file — doesn't upload, just gives API access
# Access for up to 30 days, no storage limits
```

## Media Resolution — Per-Part Control (v1alpha, New)

Per-part control over how many tokens vision uses:
```python
client = genai.Client(http_options={'api_version': 'v1alpha'})
# Per-part: media_resolution={"level": "media_resolution_high"}
```

| Setting | Image tokens | Video tokens/frame |
|---|---|---|
| `media_resolution_low` | 280 | 70 |
| `media_resolution_medium` | 560 | 70 |
| `media_resolution_high` | 1120 | 280 |
| `media_resolution_ultra_high` | — | — (per-part only) |

Higher resolution = better quality, more tokens, more cost.

## Inline Data Limits

| Type | Inline limit |
|---|---|
| Images | 20MB total request |
| PDFs | 50MB total request |
| Video (inline) | <100MB, <1 min duration |
| Video (Files API) | Free: 2GB, Paid: 20GB per file |

## YouTube Videos

Pass URL directly in contents — no file upload needed:
```python
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=["Summarize this video", "https://youtube.com/watch?v=..."]
)
```

## PDF Processing

- Up to 1000 pages per document
- Charts, diagrams, tables interpreted visually
- Extract to structured output with `response_mime_type="application/json"`

## Best Practices

- Put media **before** text in contents list for better attention
- Use `media_resolution_low` for batch/cost-sensitive work
- Use `media_resolution_high` for detail-critical analysis
- For many questions about same doc → cache it (75% token savings)
