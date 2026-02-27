# Generation Reference

## Nano Banana (Image Generation) Models

| Name | Model String | Best For |
|------|-------------|---------|
| Nano Banana 2 | `gemini-3.1-flash-image-preview` | Speed, high-volume |
| Nano Banana Pro | `gemini-3-pro-image-preview` | Quality, text accuracy, complex instructions |
| Nano Banana | `gemini-2.5-flash-image` | Speed/efficiency, high-volume |

All support: text-to-image, image editing, conversational image iteration.  
All images include SynthID watermark.

## Native Image Gen — Conversational Editing

```python
# Text to image
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents="A minimalist logo for a tech startup, blue and white"
)

# Image edit (pass existing image + instruction)
response = client.models.generate_content(
    model="gemini-3.1-flash-image-preview",
    contents=[
        types.Part.from_bytes(data=existing_image_bytes, mime_type='image/png'),
        "Make the background black and add a sunset"
    ]
)

for part in response.parts:
    if part.inline_data:
        img = part.as_image()
        img.save("result.png")
    elif part.text:
        print(part.text)
```

## Combine with Grounding (Search for accuracy)

```python
tools = [{"url_context": {}}, {"google_search": {}}]
# Model can search for reference images, get current info, then generate
```

## Imagen (Standalone Image Model)

```python
response = client.models.generate_images(
    model='imagen-4.0-generate-001',
    prompt='Photorealistic mountain landscape at golden hour',
    config=types.GenerateImagesConfig(
        number_of_images=4,
        aspect_ratio="16:9",          # optional
        safety_filter_level="BLOCK_MEDIUM_AND_ABOVE"  # optional
    )
)

for img in response.generated_images:
    # img.image.image_bytes — raw bytes
    img.image.show()  # PIL display
```

## Veo 3.1 (Video Generation)

```python
# Text to video
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="Aerial shot of city at night with car light trails",
    config=types.GenerateVideoConfig(
        aspect_ratio="16:9",      # or "9:16" for portrait
        number_of_videos=1,
    )
)

# With first frame image
first_frame = types.Image.from_file("first_frame.jpg")
operation = client.models.generate_videos(
    model="veo-3.1-generate-preview",
    prompt="The scene continues...",
    image=first_frame,
)

# Poll and download
while not operation.done:
    time.sleep(10)
    operation = client.operations.get(operation)

if operation.done and not operation.error:
    video = operation.response.generated_videos[0]
    client.files.download(file=video.video)
    video.video.save("output.mp4")
```

**Veo capabilities:**
- 8-second clips, 720p/1080p/4K
- Natively generated audio
- Portrait (9:16) or landscape (16:9)
- Video extension (extend prior Veo outputs)
- First frame + last frame specification
- Up to 3 reference images for content guidance

## TTS Voice Names (Prebuilt)

Available voices include: Aoede, Kore, Charon, Fenrir, Orbit, Puck, and more.  
Check AI Studio Voice Library for full list with audio previews.

## Music Generation Config Options

```python
config = types.LiveMusicGenerationConfig(
    bpm=120,                                    # beats per minute
    temperature=1.0,                            # creativity (recommended)
    scale=types.Scale.C_MAJOR_A_MINOR,          # musical scale
    music_generation_mode=types.MusicGenerationMode.QUALITY,  # or SPEED
    audio_format="pcm16",
    sample_rate_hz=44100,
)
```

After BPM or scale change → call `session.reset_context()` for smooth transition.

Weighted prompts: weight ≠ 0; 1.0 is neutral starting point. Can mix multiple styles:
```python
prompts = [
    types.WeightedPrompt(text="Jazz", weight=0.7),
    types.WeightedPrompt(text="Electronic", weight=0.3),
]
```
