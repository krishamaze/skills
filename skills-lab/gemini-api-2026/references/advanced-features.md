# Advanced Features — Delta Reference

> Only new API surfaces and syntax. Caching/batch concepts are known — this covers the NEW SDK syntax.

## Context Caching (New SDK Syntax)

```python
# Create cache (paid tier required, min TTL 60s)
cache = client.caches.create(
    model="gemini-3-flash-preview",
    config=types.CreateCachedContentConfig(
        contents=[large_text_content],
        system_instruction="Expert analyst",
        ttl="3600s",
        display_name="doc-cache"
    )
)

# Use cache in requests
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents="Question about cached doc",
    config=types.GenerateContentConfig(cached_content=cache.name)
)

# Manage: update TTL, list, delete
client.caches.update(name=cache.name, config={"ttl": "7200s"})
for c in client.caches.list(): print(c.name, c.expire_time)
client.caches.delete(name=cache.name)
```

### Implicit Caching (New)
- Auto-activates for 2048+ token prefixes
- 75% discount vs standard input pricing
- Check: `response.usage_metadata.cached_content_token_count`

## Batch API (New SDK Syntax)

```python
# Input JSONL:
# {"key": "req1", "request": {"model": "models/gemini-3-flash-preview", "contents": [...]}}

job = client.batches.create(
    model="gemini-3-flash-preview",
    src="gs://bucket/requests.jsonl",
    config=types.CreateBatchJobConfig(dest="gs://bucket/responses/")
)

# Poll: job.state in [JOB_STATE_PENDING, JOB_STATE_RUNNING,
#        JOB_STATE_SUCCEEDED, JOB_STATE_FAILED, JOB_STATE_CANCELLED]
while job.state not in ["JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED"]:
    import time; time.sleep(30)
    job = client.batches.get(name=job.name)
```

## Interactions API — Extended (New)

```python
# Stateful multi-turn (server manages history)
i1 = client.interactions.create(model="gemini-3-flash-preview", input="Hi, my name is Phil.")
i2 = client.interactions.create(
    model="gemini-3-flash-preview",
    input="What is my name?",
    previous_interaction_id=i1.id    # Server remembers context
)

# Retrieve past interaction
past = client.interactions.get("<ID>", include_input=True)

# Multimodal input
interaction = client.interactions.create(
    model="gemini-3-flash-preview",
    input=[
        {"type": "text", "text": "Describe this image."},
        {"type": "image", "uri": "https://...", "mime_type": "image/png"}
    ]
)

# Image generation via Interactions
interaction = client.interactions.create(
    model="gemini-3-pro-image-preview",
    input="A futuristic city",
    response_modalities=["IMAGE"],
    generation_config={"image_config": {"aspect_ratio": "16:9", "image_size": "4k"}}
)

# TTS via Interactions
interaction = client.interactions.create(
    model="gemini-2.5-flash-preview-tts",
    input="Say: Hello world!",
    response_modalities=["AUDIO"],
    generation_config={"speech_config": {"language": "en-us", "voice": "kore"}}
)

# Deep Research (background, autonomous)
interaction = client.interactions.create(
    agent="deep-research-pro-preview-12-2025",
    input="Research quantum computing advances in 2025",
    background=True
)
# Stored by default (store=True), 30-day retention
```

## Live API — New Features

### Audio Transcription
```python
config = {
    "response_modalities": ["AUDIO"],
    "output_audio_transcription": {},    # Transcribe model's audio
    # "input_audio_transcription": {},   # Transcribe user's audio
}
async for response in session.receive():
    if response.server_content.output_transcription:
        print("Transcript:", response.server_content.output_transcription.text)
```

### GoAway Message (connection timeout ~10min)
```python
async for response in session.receive():
    if response.go_away:
        time_left = response.go_away.time_left
        # Save state, prepare to reconnect
```

### Session Resumption
```python
config = {"session_resumption": {}}  # Enable reconnection within token TTL
```

## Ephemeral Tokens (New, v1alpha, Live API only)

```python
import datetime
client = genai.Client(http_options={'api_version': 'v1alpha'})
now = datetime.datetime.now(tz=datetime.timezone.utc)

token = client.auth_tokens.create(config={
    'uses': 1,
    'expire_time': now + datetime.timedelta(minutes=30),
    'new_session_expire_time': now + datetime.timedelta(minutes=1),
})

# Lock to specific config (keep system instructions server-side)
token = client.auth_tokens.create(config={
    'uses': 1,
    'live_connect_constraints': {
        'model': 'gemini-2.5-flash-native-audio-preview-12-2025',
        'config': {'session_resumption': {}, 'temperature': 0.7, 'response_modalities': ['AUDIO']}
    },
    'http_options': {'api_version': 'v1alpha'},
})
# Client uses token.name as API key
```

## API Version Guide

| Version | Features |
|---|---|
| `v1alpha` | Per-part media_resolution, ephemeral tokens, Lyria music gen, experimental Live |
| `v1beta` (SDK default) | All standard features, caching, batch, interactions, File Search, Live API |
| `v1` (stable) | generateContent, embeddings, generateAnswer only |

```python
# Switch version
client = genai.Client(http_options={'api_version': 'v1alpha'})
```
