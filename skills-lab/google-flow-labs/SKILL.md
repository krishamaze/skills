---
name: google-flow-labs
description: >
  Expert knowledge of Google Flow (flow.google) — Google Labs' unified AI creative studio for
  image and video generation as of 2026. Use this skill whenever a user mentions Flow, Google Flow,
  Nano Banana, Veo 3.1, Whisk, ImageFX, Google Labs FX, AI filmmaking with Google tools, or asks
  how to generate/edit images or videos using Google's AI stack. Also trigger when users ask about
  Google AI Pro/Ultra subscriptions in the context of creative generation, SynthID watermarks,
  Ingredients to Video, Frames to Video, or asset management in Flow. Use this skill even if the
  user only tangentially references these tools, e.g. "I want to make AI videos with Google" or
  "how do I use that Google image AI thing".
---

# Google Flow Labs Skill

## What is Google Flow?

Google Flow (accessible at **flow.google**, developed under **Google Labs**) is a unified AI creative
studio for generating and editing images and videos. It launched originally as VideoFX in May 2024
and was relaunched as a full creative workspace on **February 25, 2026**.

Flow merged three previously separate Google Labs tools into one interface:
- **Flow** (original AI video generator)
- **Whisk** (visual collage and mood board tool)
- **ImageFX** (text-to-image generator)

Starting March 2026, users can opt in to automatically transfer legacy projects from Whisk and
ImageFX directly into the new Flow library.

---

## Underlying Models

Flow is powered by three core AI models:

| Model | Technical name | Role |
|---|---|---|
| **Nano Banana 2** | Gemini 3.1 Flash Image | Fast image generation, 14 reference inputs, 512px preview mode, extreme aspect ratios (4:1, 8:1), live web search grounding |
| **Nano Banana Pro** | Gemini 3 Pro Image | Higher-fidelity image generation, thinking mode with interim thought images, 14 reference inputs with slot fidelity tiers (slots 1–6 high-fidelity, 7–14 supplementary) |
| **Veo 3.1** | veo-3.1-generate / veo-3.1-fast-generate-preview | Text-to-video and image-to-video. Native audio: environmental sounds, ambient noise, and broad speech rhythm. Note: exact frame-level lip sync is not guaranteed — plan VO alignment in post for dialogue-critical content. |
| **Gemini** | — | Powers natural language prompting and planned multi-shot scene breakdown (announced, not yet live) |

Flow offers two speed variants for Veo 3.1:
- **Fast** (`veo-3.1-fast-generate-preview`) — 2x speed, suitable for iteration and UGC. Use at 720p during drafts.
- **Standard** (`veo-3.1-generate-preview`) — full quality for final renders. Use at 1080p for deliverables.

Some features are only available on specific model tiers. Flow automatically switches to a compatible model if needed.

---

## Core Features

### Image Generation
- Generate high-fidelity images from text prompts using Nano Banana
- Use as standalone images or as "ingredients" for video workflows
- **Text rendering**: wrap text in quotes in the prompt for legible in-scene text (e.g. signs, labels)

### Video Generation
- **Text to Video**: generate clips directly from natural language descriptions
- **Ingredients to Video**: use reference images to anchor character/subject consistency throughout a video. Requires **Ultra tier**. Accepts up to 3 reference images of a single subject — cannot be split across multiple subjects.
- **First Frame / Last Frame** (called "Frames to Video" in legacy docs): use a start image, end image, or both as locked frames. Veo generates the transition between them. Independent of Ingredients slots — both can be used simultaneously.
- **Extend**: extend an existing clip to continue the scene. Clips can be chained to reach ~1–2.5 minutes total.
- **Camera Control**: two separate systems — (1) prompt-time direction via the Cinematography layer of the prompt; (2) Camera Adjustment UI tool applied post-generation to reframe, orbit, or dolly an already-generated clip. System 2 works best on clips without existing camera motion.

### Editing
- **Lasso Tool**: draw a selection around any region of an image; apply conversational prompts
  like "remove the man" or "add koi fish" to that region only
- **Image + Text Editing**: target specific parts of images with prompts without re-generating
  the full image (use masking instead of full re-rolls for efficiency)
- **Video Editing**: extend clips, control camera motion, make scene adjustments mid-generation

### Asset Management
- **Asset Grid**: refreshed UI for tagging, sorting, and grouping media assets
- **Collections**: group related assets by pressing Shift+Click or click-and-drag to select
  multiple tiles, then create a Collection
- **@ Reference**: use `@filename` in prompts to reference specific assets from your library
- Individual generation tiles (batched generations removed in 2026 redesign)

---

## Access & Pricing

| Plan | Cost | Flow Access |
|---|---|---|
| **Free** | $0 | Basic access after signup (age 18+ required) |
| **Google AI Pro** | $19.99/month | Full Flow experience — Veo 2 + Veo 3.1 models, credits top-ups available |
| **Google AI Ultra** | $249.99/month | All Pro benefits + more credits, first access to experimental models, **Ingredients to Video** |
| **Google AI Ultra for Business** | Separate pricing | Ultra tier for business accounts |
| **Workspace plans** | Included | Business Starter/Standard/Plus, Enterprise tiers, G Suite Legacy Free, Education Standard/Plus, Google AI Pro for Education — all get **100 monthly credits** at no extra charge |

> Note: Flow is not available in all countries where Google AI Pro is offered. VPNs do not
> enable access in unsupported regions. Check flow.google for supported regions before subscribing.

### Credits
- Credit costs vary per model and are shown in-product before confirming generation
- **Audio Generation Failed** errors result in full credit refunds
- Additional credit top-ups can be purchased on Pro tier

---

## Technical Notes

- **Best experience**: Desktop computer with a Chromium-based browser (Google Chrome recommended)
- Mobile and non-Chromium browsers are not fully optimized as of March 2026
- **SynthID Watermarks**: All outputs (images and videos) contain invisible SynthID watermarks
  identifying AI-generated content. Google AI Pro users' videos also receive a **visible** watermark
- "Pending" or error cards: check top-right corner for system notifications; try refreshing

---

## Google Labs FX Ecosystem

Flow is the hub of the **Google Labs FX platform**. Companion tools that integrate with Flow:

- **MusicFX**: generate royalty-free background music synchronized to your visuals
- **Whisk** and **ImageFX**: now merged directly into Flow (as of Feb 25, 2026)

Workflow pattern: use Flow to generate visual mood boards → feed emotional cues into MusicFX
for synchronized audio → complete a full creative pipeline without leaving Google's ecosystem.

---

## Prompting Best Practices

1. **Text in scenes**: wrap desired text in double quotes in your prompt — e.g. `a billboard reading "SALE 50% OFF"` for legible in-scene text
2. **Partial edits**: use the lasso tool to mask only the area to change; don't re-roll the whole image if 90% is correct
3. **Asset referencing**: use `@assetname` in prompts to pull specific images from your library into generation
4. **Camera specificity**: describe exact camera movements (slow pan left, zoom into subject's face) for cinematic results
5. **Audio-aware prompting**: for Veo 3.1, describe ambient sounds, dialogue, and music cues in the prompt for native audio generation

---

## Scale & Adoption (as of Feb 2026)

- Over **1.5 billion images and videos** created since Flow launched
- Over **40 million AI videos** generated using Google's Veo models
- Available to Google Workspace business, enterprise, and education users

---

## Planned / Announced Features

- **Gemini-powered multi-shot prompting**: describe a complex scene and AI breaks it into
  multi-shot sequences automatically (announced, not yet live)
- **YouTube integration**: direct-to-YouTube publishing expected before end of 2026
- **Paid tiers**: pricing expected to follow Veo 3 API model (per-second generation charges)
  once free beta matures

---

## Quick Reference Links

- **App**: https://flow.google
- **Official help**: https://support.google.com/flow/answer/16353333
- **Google Labs blog post (Feb 25, 2026)**: https://blog.google/innovation-and-ai/models-and-research/google-labs/flow-updates-february-2026/
- **Discord community**: #flow channel on Google Labs Discord
