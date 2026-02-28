# Files & Media Reference

## Files API — Full Workflow

```python
# Upload with display name
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

# Check processing state (videos need processing time)
import time
while file.state == "PROCESSING":
    time.sleep(5)
    file = client.files.get(name=file.name)

# List files
for f in client.files.list():
    print(f.name, f.display_name)

# Delete
client.files.delete(name=file.name)
```

## GCS URI Registration

```python
# Register GCS file (doesn't upload — just registers for access)
# Gives access for up to 30 days; no storage limits
```

## Image Understanding Capabilities

- Object detection with bounding boxes
- Image segmentation
- Visual Q&A, captioning, classification
- Multiple images in one request

**Supported MIME types:** image/jpeg, image/png, image/gif, image/webp, image/heic, image/heif

**Inline limit:** 20MB total request (images) / 50MB (PDFs)

## Audio Understanding Capabilities

- Transcription with timestamps (MM:SS format)
- Speaker diarization (identify speakers)
- Language detection + translation
- Emotion detection (Happy/Sad/Angry/Neutral)
- Summarization, Q&A

**Supported formats:** mp3, wav, flac, aac, ogg, etc.
**Not for:** real-time transcription → use Live API or Cloud Speech-to-Text

## Video Understanding Capabilities

- Summarize, Q&A, timestamp references
- Caption generation
- Content moderation

**YouTube:** Pass URL directly in contents.

**File API limits for video:**
- Free: 2GB per file
- Paid: 20GB per file  
- Process time: large videos need waiting

**Inline limit:** <100MB, <1 min duration

## Document Processing (PDF)

PDF features beyond text extraction:
- Charts, diagrams, tables interpreted visually
- Up to 1000 pages
- Extract to structured output
- Transcribe preserving layout

```python
# Inline PDF (small docs)
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf'),
        "Extract all tables as JSON"
    ]
)

# Large PDFs → use Files API (2GB limit)
```

## Media Resolution Tokens

| Setting | Images | Videos |
|---------|--------|--------|
| LOW | ~258 tokens | ~258 tokens |
| MEDIUM | ~1058 tokens | ~1058 tokens  |
| HIGH | ~2040+ tokens | Varies |

Higher resolution = better quality, more tokens, more cost.

## Prompting with Media — Best Practices

- Put media before text in contents list for better attention
- Be specific about what aspect to analyze
- Use structured output for extraction tasks
- Reference timestamps when asking about specific video moments
