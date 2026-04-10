---
name: google-flow-prompting
description: >
  Advanced, non-obvious prompting techniques specific to Google Flow's Nano Banana 2 (image) and
  Veo 3.1 (video) models. Use this skill whenever a user wants to get better results from Flow,
  fix specific failure modes (face drift, illustration vs photo, text artifacts, audio mismatch,
  subject inconsistency), or asks how to prompt Nano Banana, Veo 3.1, or Flow for production-quality
  output. Trigger even for questions phrased as "why does my Flow generation keep doing X" or
  "how do I make Nano Banana do Y". Contains only model-specific knowledge that generic prompting
  guides and LLMs do not have — skip this skill if the user only needs general prompting concepts.
---

# Google Flow Prompting — Advanced Reference

This skill contains only things the models genuinely require that are non-obvious and specific to
these models. No generic advice about "be descriptive."

---

## Nano Banana 2 — Model Architecture You Must Understand

Nano Banana 2 (Gemini 3.1 Flash Image) is **not a pure diffusion model**. It uses a two-stage
pipeline:

1. **Reasoning stage** — Gemini 3.1's language understanding interprets the prompt first,
   resolving spatial logic, relationships, and world knowledge before any pixels are generated.
2. **Diffusion stage** — a dedicated diffusion model converts the reasoning output into the image.

**Why this matters for prompting:** Because the reasoning stage runs first, Nano Banana understands
Markdown, JSON, and structured list syntax — not just caption-style text. This is inherited from
Gemini 3.1 Flash's training on code, JSON, and agentic pipelines. You can (and should) use these
formats for complex, multi-constraint generations.

---

## Reference Images Are More Powerful Than Words — The Foundational Principle

This is the single most important thing to internalize about prompting Nano Banana and Veo 3.1.
Both models use reference images as **primary input** and text as **secondary direction**. Not
the reverse. When there is a conflict between what a reference image shows and what the text says,
**the image wins**.

This changes the entire prompting philosophy:
- **Words describe.** The model interprets, approximates, and fills gaps with training data defaults.
- **Reference images define.** Exact face structure, exact fabric texture, exact color, exact
  composition — locked, not approximated.

A face described in 200 words will still drift. The same face in 3 reference images from different
angles will not. This is not a quality difference — it is architectural. The model processes image
tokens and text tokens through the same transformer backbone but image tokens carry far higher
information density per token than text descriptions of the same subject.

**The practical rule:** Any element where precision is required — face, product, logo, specific
object, exact color, architectural detail — use a reference image. Reserve text for everything
that can tolerate interpretation: mood, camera movement, style, action.

**Verified from official Google Cloud prompting guide (March 6, 2026):**
The official formula for multimodal (reference) generation is:
`[Reference images] + [Relationship instruction] + [New scenario]`

Example: *Using the attached napkin sketch as the structure and the attached fabric sample as the
texture, transform this into a high-fidelity fashion render in a studio setting.*

The relationship instruction tells the model **how** to use each image — not just that they exist.
Without it, the model decides how to weight each reference and the result is unpredictable.

---

## Reference Image Slot Map — Verified Limits (March 2026)

### Nano Banana 2 AND Nano Banana Pro — Both Support 14 Reference Images

**Official Google Cloud docs (March 6, 2026):** *"Image inputs: You can mix up to 14 reference
object images in a single prompt"* — stated identically for both models.

| Model | Reference image limit | Slot fidelity tiers |
|---|---|---|
| **Nano Banana 2** (Gemini 3.1 Flash) | 14 images | All 14 slots equal fidelity |
| **Nano Banana Pro** (Gemini 3 Pro) | 14 images | Slots 1–6: high-fidelity / Slots 7–14: supplementary |

**The slot fidelity difference is critical for Pro.** Nano Banana Pro allocates significantly more
processing capacity to slots 1–6. Slots 7–14 still influence output but with noticeably less
precision. Load your most important references (face, hero product, exact style) into slots 1–6.
Use 7–14 for mood boards, color palette hints, and supporting atmosphere.

Nano Banana 2 does not have this tier split — all 14 slots are processed equally.

### Veo 3.1 — Three Completely Independent Slot Systems

**Veo 3.1 has three separate slot systems that do not share limits or compete with each other.**

| Slot system | Limit | What it anchors | Independent? |
|---|---|---|---|
| **Ingredients** | 3 images | Character/object/product consistency throughout video — **Ultra tier only** | ✅ Yes |
| **First Frame** | 1 image | Exact opening composition | ✅ Yes |
| **Last Frame** | 1 image | Exact closing composition | ✅ Yes |

A generation can use all five simultaneously — 3 ingredient images + 1 first frame + 1 last frame
+ text describing only what changes between the frames. None of these compete.

---

## Output-as-Input: Compositional Chaining

This is the most powerful non-obvious technique in the entire Flow pipeline. The model treats
a generated image **identically to a real photograph** as a reference input. There is no
distinction architecturally between a photo you shot and an image Nano Banana generated.

This enables multi-stage composition — building up complexity across passes that is impossible
to achieve in a single generation.

### The Core Pattern

```
Pass 1: 3 raw reference photos → generate Character image (locked face, locked costume)
Pass 2: 3 raw reference photos → generate Environment image (locked location, locked lighting)
Pass 3: Character image + Environment image + 1 style reference → generate Final Composite
Pass 4: Final Composite → Veo 3.1 First Frame → add motion
```

Each pass solves one problem independently before combining. Trying to solve character + environment
+ style in a single pass with 14 raw references produces a weaker result than solving them
separately and combining the solved outputs.

### When to Chain vs When to Use a Single Pass

**Use a single pass when:**
- The scene has 1 dominant element (one subject, simple background)
- You have strong real-world reference images that already contain the right context
- Speed matters more than maximum fidelity
- The composition is simple enough that 14 slots can cover everything without conflict

**Use chaining when:**
- Subject needs to exist in an environment they were never photographed in
- Costume or appearance transformation is required (user in a different era, style, character)
- Two distinct complex elements need equal fidelity (character AND environment both precise)
- You are building a multi-shot narrative where subjects must stay consistent across scenes

### Dynamic Flow — Decide Per-Scene, Not Per-Project

The correct approach is not a fixed pipeline. Each scene gets its own assessment:

```
Is the element visually precise AND not in any reference photo?
  → YES: it needs its own generation pass first
  → NO: it can be described in text or covered with an existing reference

Can a single reference image cover both subject AND context together?
  → YES: use it as First Frame directly into Veo
  → NO: generate subject and context separately, composite, then use as First Frame

Does the video need character consistency throughout (not just at the start)?
  → YES: use Ingredients (3 slots) in Veo
  → NO: First Frame alone is sufficient, save Ingredient slots
```

### Practical Example — Krishna Transformation Scene

```
Pass 1: User's 3–5 face photos → Nano Banana 2 → locked "modern look" portrait
Pass 2: Style reference (devotional art image) + 2 costume detail references 
        → Nano Banana Pro → Krishna-look portrait with correct costume, tilak, hair
        [relationship instruction: "Apply the style and costume from references to 
         the person's face and build from the modern portrait"]
Pass 3: Pass 2 output → Veo 3.1 First Frame → add particle drift + audio
```

Pass 1 locks the identity. Pass 2 transforms the appearance using the locked identity as anchor.
Pass 3 adds motion. Each pass is independent and correctable without redoing the others.

### Slot Allocation Strategy Per Scenario

**Scenario: User face in a new environment (e.g. transformation video)**
- Pass 1: 3–5 face photos in slots 1–5 → generate character
- Pass 2: Character output (slot 1) + environment refs (slots 2–4) + style ref (slot 5)
          → relationship instruction: *"Place the person from slot 1 into the environment
            of slots 2–4 with the color treatment from slot 5"*

**Scenario: Product in a lifestyle scene**
- Pass 1: Product close-ups in slots 1–3 → generate clean product render
- Pass 2: Product render (slot 1) + lifestyle scene refs (slots 2–5)
          → *"Place the product from slot 1 into the scene from slots 2–5, maintaining
             exact logo placement and colorway"*

**Scenario: Simple portrait — no chaining needed**
- 3 face photos directly, text handles everything else
- Single pass sufficient

### First Frame vs Ingredients — When to Use Which

| You need | Use |
|---|---|
| Exact opening shot composition | First Frame |
| Subject identity maintained *throughout* the whole video | Ingredients |
| Both | Both simultaneously — they don't compete |
| Controlled start AND end transition | First Frame + Last Frame |

When using First Frame, **the text prompt describes only what changes** — not what the frame
already shows. Redescribing the frame in text creates competing instructions and degrades both.

---

## Flow Camera Systems — Two Separate Tools

Flow has two completely independent camera systems. The skill was previously treating camera
direction as text-only. That was wrong.

### System 1 — Camera Control (Prompt-Time Direction)

Specified in the **Cinematography layer** of the Veo 3.1 prompt, before the subject. This tells
the model what camera behavior to *generate* during video creation.

**Shot types:**
| Shot | Prompt term |
|---|---|
| Full body, subject to environment | `Wide establishing shot` |
| Waist up | `Medium shot` |
| Face and shoulders | `Close-up` |
| Eyes and above | `Extreme close-up` |
| From below looking up | `Low angle shot` |
| From above looking down | `High angle / bird's eye shot` |
| From subject's perspective | `POV shot` |
| Two subjects in frame | `Two-shot` |
| Subject from behind | `Over-the-shoulder shot` |
| Overhead directly down | `Top-down / flat lay shot` |

**Camera movements:**
| Movement | Prompt term | What it does |
|---|---|---|
| Camera moves toward subject | `Dolly in` / `push in` | Builds intimacy, tension |
| Camera moves away | `Dolly out` / `pull back` | Reveals context, isolation |
| Camera slides sideways | `Tracking shot` / `lateral track` | Follows subject movement |
| Camera rotates on its axis | `Pan left` / `pan right` | Reveals environment |
| Camera tilts up or down | `Tilt up` / `tilt down` | Reveals height, scale |
| Camera rises vertically | `Crane shot` / `jib up` | Dramatic reveal, scope |
| Camera circles subject | `Orbit shot` / `360 arc` | Establishes presence |
| Camera drifts gently | `Floating shot` / `slow drift` | Dream, memory, meditation |
| No movement | `Fixed wide shot, camera locked` | Observe, documentary |
| Unstabilized | `Handheld, natural sway` | UGC, urgency, intimacy |

**Compound moves** — two movements combined describe cinematic complexity:
```
Slow push-in from a wide establishing shot into a tight close-up as neon reflections
ripple across the window.
```

### System 2 — Camera Adjustment (Post-Generation UI Tool)

Flow introduced a Camera Adjustment feature to adjust camera position, orbit, or move the dolly in any generated video.

This is a **separate UI tool**, applied *after* generation, not during it. Key facts:

- Camera Adjustment works best for clips that don't currently include camera motion. If the generated clip already has a pan or dolly, Camera Adjustment produces inconsistent results.
- Available controls: position (reframe), orbit (rotate around subject), dolly (push/pull)
- Use it as a correction tool — when the generated camera position is close but not exact
- It does not regenerate the clip from scratch; it transforms the existing video spatially

### When to Use Which System

| Goal | Use |
|---|---|
| Generate a specific camera move | System 1 — prompt Cinematography layer |
| Fix a wrong camera angle after generation | System 2 — Camera Adjustment UI |
| Need a complex multi-move (push + orbit) | System 1 only — System 2 cannot compound |
| Clip already has motion, need reframe | System 1 in a new generation — System 2 unreliable on motion clips |
| Quick perspective experiment without regenerating | System 2 — faster than a new generation |

### The Non-Obvious Interaction — Don't Describe Camera in Text If Using First Frame

When using First Frame mode, camera position is already established by the image.
Specifying a conflicting camera angle in the prompt forces the model to choose — and it
often chooses the text, which breaks the First Frame composition.

**Correct:** specify only motion, not position:
```
First Frame: [your locked image]
Prompt: Slow dolly in, camera breathing slightly. Audio: ...
```

**Wrong:**
```
First Frame: [your locked image]
Prompt: Wide shot, slow dolly in. [wide shot conflicts with First Frame's close-up composition]
```

---

## Nano Banana 2 — Specific Capabilities and Hard Limits

| Feature | Limit |
|---|---|
| Character consistency | 5 characters (Gemini app) / 4 characters (Developer API) |
| Object fidelity | 14 distinct objects per workflow |
| Reference images (both NB2 and NB Pro) | 14 inputs — any mix of subjects, styles, objects |
| NB Pro slot fidelity | Slots 1–6 high-fidelity / Slots 7–14 supplementary |
| Resolution tiers | 512px / 1K / 2K / 4K (512px exclusive to Nano Banana 2) |
| Unique extreme aspect ratios | 4:1, 1:4, 8:1, 1:8 (Nano Banana 2 only, not Pro) |
| Text rendering accuracy | ~90% (Nano Banana 2) vs ~94% (Pro) |
| API character limit | 4 (not 5) — sub-second latency optimization |

The **512px quick preview mode** is exclusive to Nano Banana 2 — use it for rapid iteration
before spending credits on full-resolution generations.

---

## Nano Banana 2 — What Actually Works That Isn't Documented

### Use Structured Lists for Multiple Simultaneous Edits

Because the model's text encoder understands Markdown syntax, a dashed list of edits in a single
prompt is processed as discrete, parallel instructions — not conflated into one blurry command:

```
Make ALL of the following edits to the image:
- Put a strawberry in the left eye socket.
- Replace the plate with a chocolate-chip cookie in plate shape.
- Add a mint garnish on top.
- Remove the blueberries.
- Add happy people to the background.
```

Conversational phrasing ("change X and also Y and also Z") degrades accuracy. List format preserves
individual instruction fidelity. This was empirically validated by community testing with up to
5 simultaneous edits applied correctly in one pass.

### Semantic Buzzwords Genuinely Alter Composition

Unlike older diffusion models where buzzwords were cargo cult, Nano Banana 2 was trained on
semantically annotated data (Google Images, editorial sources). Phrases like:

- `Pulitzer Prize-winning cover photo for The New York Times`
- `National Geographic wildlife photo`
- `Apple product launch keynote slide`

...do not just add aesthetic flair — they invoke trained compositional signatures: rule of thirds,
professional light balance, specific color grading, and layout norms associated with those sources.

**Use this deliberately.** If you want professional composition without specifying every detail,
anchor the image to a recognized publication or style context. Then append `Do not include any text
or watermarks.` to strip the masthead while keeping the compositional bonus.

### Hex Colors Work

The reasoning stage can interpret CSS-style hex color codes directly in prompts. You do not need to
translate to natural language:

```
A kitten with #9F2B68 and #00FF00 fur, with heterochromatic eyes matching those two colors.
```

This gives finer color precision than "purple and green" for cases where exact hue matters
(brand color matching, specific palette work).

### JSON Prompting for Complex Character Descriptions

For highly specific characters with many attributes, a JSON-style object description exploits the
model's structured output training:

```json
{
  "character": "male mage, age 30",
  "hair": "shoulder-length silver, low volume, slight wave",
  "eyes": "amber with vertical slit pupils",
  "hands": "long fingers, ink stains on right index and middle fingers",
  "clothing": "dark teal robe, open collar, no hood",
  "pose": "standing, 20 degrees rotated left, full body visible"
}
```

Do NOT use this for simple generations — it adds overhead and generic subjects don't benefit from
structural disambiguation.

### The Photorealism vs. Illustration Trap (Fantasy/Fantastical Subjects)

When generating fantastical characters (mages, elves, etc.), adding `photorealistic` or
`do not generate a digital illustration` often **fails** — the model defaults back to illustration
because the semantic anchor of the subject itself (fantasy character) pulls toward illustration
training data.

**The correct fix**: Add physicality constraints that are *difficult for an illustration to satisfy*:

```
Generate a photo featuring a closeup of the character. The character is standing rotated 20 degrees,
their complete body is visible in the frame at [a specific real-world location]. The image was taken
by a professional photographer on a Canon EOS R5 at f/2.8. The subject's feet are on wet pavement.
```

A flat illustration cannot satisfy "wet pavement reflection," "rotated 20 degrees full body," or a
specific camera body and aperture — these constraints force the model toward photorealistic
generation without explicitly forbidding illustration.

### More Reference Images = Better Subject Consistency

The model doesn't just use the *content* of reference images — it uses their *variance* to anchor
identity. Providing 17 images of a subject produced measurably better consistency than 2 images
(different angles, expressions, lighting conditions). The model infers invariant features (true
facial structure) from multiple samples, filtering out pose/lighting artifacts.

When building a character library for consistent storyboarding, collect references from multiple
angles and lighting conditions, not multiples of the same pose.

### Independent Identity vs. Style Control

Nano Banana 2 allows you to lock character identity while freely changing style or costume.
The key is to separate them syntactically:

```
Keep the character's facial structure, eye shape, and jaw from the reference image exactly.
Change the clothing to a 19th-century naval uniform.
Render in Impressionist oil painting style.
```

"Facial structure, eye shape, jaw" = identity lock.
"Clothing" = costume change.
"Impressionist oil painting" = style change.

These are processed as independent parameters in the reasoning stage — mixing them in one clause
causes the model to blend them incorrectly.

---

## Veo 3.1 — What Breaks It and How to Fix It

### Subject Drift Is Caused by Late or Vague Subject Definition

Face drift, clothing shifts, and proportion changes between frames all originate from the same root
cause: the model has to *guess* what the subject is and locks in that guess during early token
generation. If your subject description is vague or arrives late in the prompt, it anchors on
the wrong assumption.

**Fix**: Front-load a precise physical descriptor with material-level specificity as the very first
sentence:

```
A woman in her late 30s, sharp jawline, dark brown eyes set close together, wearing a
charcoal silk blouse with a notched collar and small silver stud earrings.
```

**Material cues specifically stabilize subjects during motion.** Descriptors like `charcoal cotton`,
`waxed canvas`, `brushed nickel` give Veo a light-reflection profile that the renderer can hold
consistently as the subject moves. Abstract color terms ("navy," "dark") don't carry enough
rendering specificity to prevent drift.

### Physics in Veo 3.1 — What Works, What Breaks, How to Activate It

Veo 3.1 has a built-in physics engine (trained on world-model physics simulation), but it is
**not automatically activated by physical scenes**. The model defaults to visually plausible
motion unless physics cues are explicitly embedded in the Context layer of the prompt.

#### The Context Layer Is Where Physics Lives

The C.S.A.C.S. prompt formula places physics in the **Context** position (4th element):

```
[Cinematography] + [Subject] + [Action] + [Context ← physics goes here] + [Style]
```

Generic: `rocks crashing down a cliff`
Physics-activated: `rocks crashing down a cliff, dust plumes dispersing in the crosswind,
smaller debris bouncing ahead of larger boulders, impact craters forming on contact`

The difference: the physics-activated version describes the *consequences* of physical forces,
not just the event. Veo interprets consequence descriptions as simulation targets.

#### Quantify Physical Forces — Never Say "Realistic"

`realistic water` does nothing. The word "realistic" is invisible to the physics engine.
**Quantified force descriptors** are what activate simulation:

| Instead of | Use |
|---|---|
| `realistic water splash` | `waves rising 4–6 meters, spray dispersing at 20mph crosswind` |
| `dramatic explosion` | `shockwave expanding radially, debris arcing at 45 degrees, pressure wave flattening grass within 10 meters` |
| `heavy rain` | `rain at 40mm/hr, pooling on flat surfaces, streaming in rivulets off angled edges` |
| `realistic fire` | `flame column 2 meters high, turbulent convection visible at the crown, embers carried upward by thermal draft` |

Veo has been trained on physics-annotated data. It can parse unit-scale descriptors and map them
to corresponding simulation behaviors.

#### Material Descriptors Double as Physics Activators

Material-level specificity (already recommended for subject stability) also activates the correct
physics simulation for that material's behavior during motion:

- `brushed stainless steel bowl` → correct light-reflection and inertia during sliding/impact
- `borosilicate glass` → correct shattering pattern vs. `thick glass` (which bends instead of shatters)
- `loose dry sand` → correct flow angle vs. `wet compacted sand` (which holds edges)
- `raw wool fabric` → correct drape and fold behavior vs. `polyester` (which snaps back)

A glass hitting a marble floor shattered correctly in community testing when the prompt specified
`borosilicate glass shattering on polished Carrara marble` — the same prompt with just `glass`
and `floor` produced clay-like deformation.

#### Slow Motion Is a Physics Cheat Code

Veo 3.1 allocates more rendering computation to slow-motion sequences because each second of
perceived time requires more generated frames. This means:

- Slow motion prompts produce **visibly better physics** than the same scene at normal speed
- Use `shot at 240fps slowed to 10% playback` or `extreme slow motion, 1000fps equivalent` for
  any scene requiring precise physical accuracy (impacts, splashes, fabric billowing, combustion)
- The audio system auto-adjusts: slow motion scenes generate pitch-shifted, time-stretched audio
  that matches the visual pace — you do not need to specify this separately

#### Physics Failures That Cannot Be Fixed With Prompting (as of Veo 3.1)

These are **known hard limits** — prompting workarounds exist for some, but fundamentally Veo 3.1
does not reliably handle them:

| Failure mode | What happens | Workaround |
|---|---|---|
| Finger physics | Fingers merge, split, or pass through objects during grip | Use gloves, tools, or keep hands out of frame |
| Long chain reactions | >3 sequential physics events lose coherence (domino chains, Rube Goldberg) | Break into separate 4–8 sec clips via Extend |
| Microscale physics | Liquid meniscus, insect movement, fabric weave detail | Extreme close-up + slow motion + material specificity (partial improvement) |
| Rigid body stacking | 4+ objects stacked — lower objects clip | Use First/Last Frame to set stable start state |
| Hair during wind | Strands merge at high motion | Describe hair as a single mass: `hair whipping as a single wave` |

**Veo 3.2 note**: Leaked API logs suggest a future "Artemis" world model engine that shifts from
pixel prediction to true physics simulation — but this is **not in Veo 3.1** and not officially
confirmed. Do not rely on it in current productions.

#### Physics + Audio Sync Is Automatic for Named Events

Veo 3.1's audio engine listens for named physical events in the prompt and auto-generates
synchronized sound for them. You do not need to specify every sound — only name the physics event:

```
A ceramic mug falls from a counter edge and shatters on concrete floor.
```

The model generates: the impact crack, the scatter sound of ceramic shards, the resonant tap of
the largest piece spinning to a stop. This only works when the **material and surface are both
named** — `a mug falls and breaks` generates generic impact noise without material-specific sound.

### Audio Must Be Separated Into Its Own Sentence

Veo 3.1 generates audio natively, but it parses audio instructions separately from visual ones.
Mixing audio cues into the visual description degrades both:

**Wrong:**
```
A chef in a kitchen with the sound of sizzling and clinking plates preparing pasta.
```

**Correct:**
```
A chef in a professional kitchen preparing pasta, flour dusting the stainless counter.
Audio: The rhythmic sizzle of a hot pan, the metallic clink of tongs against a bowl, the
low ambient hum of kitchen ventilation. No background music.
```

For dialogue, wrap speech in quotes with a speaker attribution:
```
Audio: A woman says, "We have to leave now." Distant thunder rumbles. Wind through trees.
```

### Negative Prompts Don't Work the Way You Think

Veo 3.1 (and Nano Banana 2) don't reliably respond to `no X` phrasing because the model still
has to represent `X` internally to avoid it. Use **replacement framing** instead:

| What you want | Wrong | Correct |
|---|---|---|
| No buildings | "no man-made structures" | "a barren, undeveloped plain" |
| No music | "no background music" | "Audio: ambient only — wind, footsteps, breathing" |
| No talking | "no dialogue" | "Audio: silent scene, only ambient environment sounds" |
| No camera movement | "static camera" | "Fixed wide shot, camera locked, no movement" |

Exception: `Do not include any text or watermarks.` works reliably for Nano Banana because it's
disambiguated by the reasoning stage, not the diffusion stage.

### First/Last Frame Workflow — Nano Banana as the Frame Generator

The most controlled video generation workflow in Flow is:

1. Use **Nano Banana 2** to generate precise start and end frames as images (full control over
   composition, lighting, subject identity).
2. Feed both images into Veo 3.1's **First and Last Frame** mode with a bridging prompt.
3. Veo generates only the *transition* — not the frames themselves.

This is how professional teams (WPP, QuickFrame) achieve narrative control. The bridging prompt
describes the motion/transition, not the subject (which is already locked in the frames):

```
The camera slowly dollies in as the scene shifts from day to evening.
The subject walks toward the camera, expression softening.
Audio: Street ambience fading to evening quiet, footsteps on concrete.
```

### Add/Remove Object Uses Veo 2, Not Veo 3.1

The **Add Object** and **Remove Object** features in Flow currently run on the **Veo 2 model** —
not Veo 3.1. This means they **do not generate audio**, and quality is lower than Veo 3.1
generations. Plan for post-processing audio separately if using these features.

---

## Credit Cost Reference (Flow)

| Action | Credits |
|---|---|
| Nano Banana 2 image (any res) | 0 (free to all Flow users) |
| Nano Banana Pro image | 12 credits |
| Veo 3.1 video (Pro plan) | Varies by duration/res |
| Audio generation failure | Full refund |

Nano Banana 2 was made **free (0 credits)** for all Flow users as of February 2026. Use it
aggressively for iteration and storyboarding before spending Veo credits on video.

---

## When to Use Which Model

| Task | Model |
|---|---|
| Storyboard frames / iteration | Nano Banana 2 (free, 512px mode) |
| Final hero images, brand assets | Nano Banana Pro (higher text accuracy) |
| Consistent characters across 3+ shots | Nano Banana 2 (up to 14 references, 5 chars) |
| Video with native audio and dialogue | Veo 3.1 |
| Controlled start→end transition video | Nano Banana 2 (frames) → Veo 3.1 (transition) |
| Object add/remove in existing video | Veo 2 (via Flow UI, no audio) |
| Extreme panoramic or banner aspect ratios | Nano Banana 2 (4:1, 8:1 exclusive) |

---

## Critical Gaps — What LLMs Genuinely Don't Know About These Models

---

### Gap 1 — Search Grounding Is Nano Banana 2's Most Unique Capability (No Other Model Has It)

Nano Banana 2 can query Google Search during generation to retrieve real-world references. Ask it to render the Sagrada Familia at golden hour, and it pulls actual reference imagery rather than relying on training data alone. No other model does this.

This is not a background feature — it is the most important differentiator for any prompt involving real-world subjects: specific buildings, current products, named locations, real people, live data visualization, and brand accuracy.

**Grounding activates automatically** when the subject exists in the real world and is specific enough to have Google Search results. But it can be triggered deliberately with syntax the model recognizes:

```
Based on current Google Search data for [subject], render...
Create an accurate 2026 visual of [subject] using live web references.
```

**Where grounding changes the result dramatically:**
- Named buildings, landmarks, monuments — renders actual architectural details, not a plausible approximation
- Current product models — correct 2026 physical design, not the 2023 training data version
- Real people in fictional scenes — accurate likeness from current web images
- Infographics with current data — pulls live statistics instead of making up numbers
- Local/regional subjects — accurate geographic context, cultural specifics, signage in correct script

**Where grounding does NOT help:**
- Purely fictional or stylized subjects — nothing to search for
- Abstract concepts, moods, styles — no reference to retrieve
- Time-sensitive data that changes faster than search indexing (stock prices, live scores)

**Nano Banana Pro does NOT have live search grounding.** Pro uses static training data with higher reasoning depth. NB2 is the correct choice when real-world accuracy on current subjects matters. NB Pro is correct when maximum fidelity on complex fictional or stylized compositions matters.

---

### Gap 2 — Edit, Don't Re-roll (Conversational Editing Is a Different Workflow)

The skill has been treating every correction as a new generation. That is the wrong default.

If an image is 80% correct, do not generate a new one from scratch. Instead, simply ask for the specific change you need. The model is exceptionally good at understanding conversational edits — "That's great, but change the lighting to sunset and make the text neon blue."

**Why this matters architecturally:** Nano Banana 2 and Pro maintain a conversational context window. A follow-up edit prompt has access to the visual state of the previous generation — it modifies tokens, it does not re-run the full generation. Re-rolling destroys what was correct. Editing preserves it.

**The 80/20 rule for edit vs re-roll:**
- **Edit** when: composition is right, one element is wrong, color needs adjusting, text is wrong, one object needs to change
- **Re-roll** when: the fundamental composition failed, the wrong subject was generated, style is fundamentally off

**Lasso tool for surgical edits:** For precise regional edits in Flow UI, the lasso tool + conversational prompt is more accurate than a full re-roll. Select the region, describe only what changes inside it. Everything outside the lasso stays pixel-identical.

---

### Gap 3 — Thinking Mode Has Levels (Default / Advanced / Dynamic)

The skill mentions "thinking mode" in passing. It has three levels with different use cases.

Default, Advanced, and Dynamic thinking modes exist. Advanced Thinking Mode ensures mechanically plausible or spatially complex compositions — objects that must fit together logically, not just visually.

| Level | When to use | Cost |
|---|---|---|
| **Default** | Simple subjects, fast iteration, single focal point | Base |
| **Advanced** | Spatial complexity ("behind/inside/through"), multi-object logic, physics accuracy | Higher |
| **Dynamic** | Complex multi-constraint prompts, architecture, mechanically precise scenes | Highest |

**NB Pro thinking mode generates "interim thought images"** — not billed as generations — before producing the final output. These thought images refine composition before rendering the final output, allowing for data analysis and solving visual problems. Do not mistake thought images for failed generations.

**Spatial prepositions that require Advanced mode:**
- "behind", "underneath", "inside", "partially obscured by", "through", "between"
- NB2 on Default often places objects incorrectly for these. Advanced resolves the spatial logic first.

---

### Gap 4 — Veo Has Two Speed Variants (Fast vs Standard)

Veo 3.1 Fast (`veo-3.1-fast-generate-preview`) is not a stripped-down version. It optimizes inference algorithms and compute resource allocation to achieve 2x speed while keeping quality in the "High Quality" bracket.

**When to use Fast:**
- Iteration passes — testing composition, camera, subject before a final render
- Short UGC clips where cinematic quality is intentionally reduced by the imperfection stack
- High-volume batch generation (ad variants, social content)
- Any clip under 6s where extended rendering time has diminishing returns

**When to use Standard:**
- First/Last Frame transitions requiring precise visual continuity
- Ingredient-anchored character generation where fidelity matters
- Dialogue clips requiring tighter lip-sync
- Final renders for any client-facing or commercial output

Use **Fast at 720p during iteration**, switch to **Standard at 1080p for final output**. This is the cost-efficient production pattern — Fast/720p costs a fraction of Standard/1080p.

---

### Gap 5 — Clip Duration Affects What the Model Generates

Use shorter durations (4–6s) for action-heavy beats, then extend when stable. Duration is not just a length preference — it changes what the model prioritizes during generation.

| Duration | Best for | Why |
|---|---|---|
| **4s** | Fast action, impact, cut transitions | Less temporal space = model focuses on single peak moment |
| **6s** | Standard scenes, UGC hooks, product reveals | Balanced — enough time for motion arc, not enough to drift |
| **8s** | Dialogue, slow atmosphere, complex physics | Full temporal budget — more generation compute per frame |

**8 seconds is the hard single-generation cap.** In the Veo 3.1 era, longer sequences are built by using extend/sequence workflows in Flow to build length beyond 8s. With Video Extension, clips can reach ~1–2.5 minutes through chained extension calls.

**Generate edit handles:** Specify 6–8s even when you only need 4s of usable footage. Generate handles — the first/last ~0.5s — for smoother cuts. This gives you breathing room for transitions in your NLE without visible cut artifacts.

**Always declare specs at the END of the prompt:**
```
[Full scene description]...
Audio: [audio description]
Specs: 9:16, 1080p, 8s
```
If you omit specs, you get defaults. Declare aspect ratio, resolution, and length at the end of your prompt. Specs at the start get weighted as part of the subject description.

---

### Gap 6 — Seed Control for Iteration

Veo and Nano Banana both use seeds to control generation variance. The skill doesn't mention this at all.

Keep a fixed seed for minor variations; change seed when you're stuck in a "look rut."

- **Fixed seed + changed prompt** = same visual direction, different subject detail — use for iterating on a composition while keeping consistent lighting/mood
- **New seed + same prompt** = completely different interpretation — use when the model has locked into a wrong interpretation and every iteration looks the same
- **New seed + new prompt** = full reset

Available in AI Studio and the Gemini API. Not currently exposed as a direct UI control in Flow — use AI Studio for seed-controlled generation, then bring outputs into Flow.

---

### Gap 7 — Lip Sync Is Not Guaranteed in Veo 3.1

The skill implies dialogue generation works reliably. The honest truth:

While Veo can generate dialogue-like audio, exact lip-sync is not guaranteed. For projects requiring precise lip movement, plan for VO alignment and possible retiming in your NLE.

**What Veo 3.1 audio reliably does:**
- Environmental/ambient sound synchronized to visual events (confirmed reliable)
- Named physical event sounds (ceramic shattering, wind, rain) synchronized correctly
- Voice tonality and speech rhythm broadly matching visible mouth movement

**What is unreliable:**
- Frame-exact lip sync for specific scripted dialogue
- Precise phoneme-to-mouth-shape matching
- Multi-person dialogue where two speakers alternate

**Practical workflow for dialogue-dependent content:**
1. Generate Veo clip with approximate dialogue in the audio prompt (gets tone/rhythm right)
2. Record or source clean VO separately
3. Use the Veo audio as timing reference during NLE assembly
4. Replace with clean VO in post

---

### Gap 8 — Conflicting Style Cues Break Prompt Adherence Silently

The model averages opposites — mutually exclusive cues (e.g., "dark noir" plus "bright sunny colors") blunt adherence, producing a muddy look and confused motion.

This is a silent failure. The model does not error — it produces output that looks slightly wrong in every direction without obvious cause. Common conflicts:

| Conflicting pair | What happens |
|---|---|
| `Dark noir` + `bright warm tones` | Desaturated mid-tones, wrong contrast |
| `Handheld authentic` + `perfectly stabilized` | Neither quality fully expressed |
| `Slow meditative` + `fast-paced energetic` | Pacing stalls mid-clip |
| `Ultra-sharp 4K crisp` + `film grain vintage` | Grain is applied over an over-sharpened base — looks digital, not analog |
| `Minimalist clean` + `richly detailed ornate` | Background and foreground fight for detail allocation |

**Rule:** One clear intent per axis. Conflicting axes require separate clips connected by First/Last Frame transitions.

---

### Gap 9 — Character Identifier System for Multi-Image Consistency (NB2)

By assigning unique identifiers to characters in a prompt sequence, Nano Banana 2 can maintain the same facial features and clothing across multiple generated scenes.

The syntax pattern:
```
[Character A: Maya] — tall woman, late 20s, short natural hair, dark brown skin, wearing a red structured blazer
[Character B: Theo] — stocky man, early 40s, salt-and-pepper beard, light skin, grey turtleneck

Generate: Maya and Theo sitting across from each other at a cafe table. Maya is showing Theo something on her phone.
```

By labeling characters with bracketed names at the start of the description, NB2 can be given the same labels in subsequent prompts to recall the visual profile:

```
[Character A: Maya] alone, standing at a window, same red blazer, looking out at rain.
```

The model uses the label as an anchor to the stored visual profile from the session context. This does not persist across new sessions — it is within-session only. For cross-session consistency, reference images remain the only reliable anchor.

---

## Production Assembly — Background, Props, Color Plate, Realism

This section covers what competitors like Higgsfield engineer at the platform level.
In Flow, you achieve the same results through deliberate prompting and the chaining workflow.

---

### Layer 1 — Background as a Dedicated Generation Pass

The most common failure in single-pass generation: background and subject compete for
the model's attention and both come out compromised.

**The correct pattern:** background is its own Nano Banana generation pass with its own reference
images and its own prompt. Subject is generated separately. Both are composited in Pass 3.

**Background prompt structure:**
```
[Location type] + [Time of day + light source] + [Surface materials] + [Depth layers]
+ [Imperfection or lived-in detail] + [No people, no subject]
```

Example:
```
A lived-in apartment living room, late afternoon, warm window light entering from camera
right casting long shadows across a worn oak floor. Foreground: a cluttered coffee table
with a half-drunk glass of water and a folded magazine. Midground: a fabric sofa with
slightly misaligned cushions. Background: bookshelves out of focus, a trailing houseplant.
Dust particles visible in the light shaft. Shot at f/2.2, 35mm lens equivalent.
Do not include any people.
```

**Why the imperfection detail matters:** the half-drunk water glass, misaligned cushions, and
dust particles are not decoration — they are anti-AI signals. The model's default is to generate
clean, symmetrical, magazine-ready environments. Specific disorder breaks that default and
produces a believably inhabited space.

**Props as anchors:** Named props with materials also function as lighting anchors. A glass of
water catches and scatters the window light. A copper lamp creates a warm practical light source.
The model generates the light interactions correctly when the props that would cause them are named.

---

### Layer 2 — Color Plate Construction

A color plate is the unified visual logic of hue, contrast, and tone across your entire scene.
Without it, Nano Banana and Veo default to auto-balanced, neutral color — which reads as AI.

**The three-element color plate:**
```
[Dominant hue / color temperature] + [Contrast ratio] + [Grade reference or film stock]
```

| Look | Plate prompt |
|---|---|
| UGC / authentic | `natural daylight color balance, low contrast, slightly underexposed, no color grade` |
| Cinematic warm | `warm teal/orange grade, golden hour color temperature, 2:1 contrast ratio` |
| Moody / dramatic | `low-key lighting, deep shadows, desaturated midtones, motivated practical light only` |
| Clean commercial | `soft diffused studio lighting, neutral white balance, high key, minimal shadow` |
| Retro / analog | `shot on 35mm Kodak Portra 400, warm grain, slight halation on highlights, lifted blacks` |
| Devotional / glowing | `high saturation, warm amber-gold skin tone, soft bloom on highlights, richly lit` |

**Specify the color plate in the Style layer of every prompt, every pass.** If you specify it
only in Pass 3 but not Pass 1, the subject and background will have conflicting color logic
that compositing cannot fix.

**Film stock vocabulary the model responds to:**
- `Kodak Portra 400` — warm, creamy skin tones, fine grain, lifted blacks
- `Kodak Vision3 500T` — cinematic tungsten, pushed contrast, deep shadows
- `Fuji Velvia 50` — saturated, punchy, high contrast, used for landscape/commercial
- `Ilford HP5 B&W` — classic black and white, medium grain, strong contrast
- `ARRI Alexa LF` — flat, wide dynamic range, latitude for color work, "cinematic digital"
- `RED KOMODO 6K` — clinical sharpness, high saturation, no halation

These are not aesthetic tags — the model was trained on annotated photography and film archives.
Each film stock name activates a different trained color behavior.

---

### Layer 3 — Realism Stack (The Popcorn Equivalent in Flow)

Higgsfield's Popcorn feature lets you specify `ARRI Alexa LF + 24mm Signature Prime + circular
dolly + golden hour`. In Flow you build the same stack in the prompt's Style layer:

```
[Camera body] + [Lens focal length + aperture] + [Lens character] + [Sensor behavior]
```

**Camera + lens combinations that activate different realism profiles:**

| Target look | Prompt stack |
|---|---|
| UGC / smartphone authentic | `shot on iPhone 15 Pro, 26mm equivalent, slight barrel distortion, auto-exposure, no stabilization` |
| Indie film | `shot on ARRI Alexa Mini LF, 35mm Zeiss Master Prime, f/2.8, natural bokeh, slight focus breathing` |
| Commercial / luxury | `shot on RED V-RAPTOR 8K, 50mm Sigma Art, f/4, clinical sharpness, deep depth of field` |
| Documentary | `shot on Sony FX3, 28mm, handheld, slight rolling shutter on fast moves, natural exposure` |
| Vintage / nostalgic | `shot on Super 8mm film, 25mm fixed lens, slight vignette, flickering exposure, warm halation` |

**Lens character terms the model understands:**
- `focus breathing` — lens shifts slightly when focus is pulled, used in narrative cinematography
- `chromatic aberration` — color fringing at edges, adds analog realism
- `lens vignette` — darkened corners, natural in wide aperture/vintage lenses  
- `barrel distortion` — slight curve on straight lines, smartphone and wide lens authentic
- `halation` — light blooms around bright edges, film authentic
- `anamorphic lens flare` — horizontal blue streak on light sources, used in cinematic work

Do not stack more than 2–3 lens character traits. Conflicts (sharp + heavily aberrated) produce
inconsistent output.

---

### Layer 4 — Intentional Imperfections (UGC Realism)

The default output of Nano Banana and Veo is too clean to read as authentic UGC. The model
optimizes for quality unless you explicitly instruct otherwise.

**The imperfection vocabulary — verified to work in Nano Banana + Veo:**

**Subject-level imperfections:**
- `asymmetrical smile, one side slightly higher`
- `flyaway hairs, 2–3 strands out of place`
- `slight skin texture visible, pores on nose and cheeks`
- `natural eye asymmetry, left eye slightly narrower`
- `slightly wrinkled collar, not freshly pressed`
- `visible makeup crease near eye fold`

**Camera-level imperfections (Veo):**
- `handheld micro-sway, natural breathing motion, not stabilized`
- `slight auto-focus hunting at shot start, snapping to sharp at 0.5s`
- `natural camera re-frame mid-shot, slight left correction`
- `subtle lens flicker, natural exposure variation`
- `water droplet on lens, lower left corner`

**Environment-level imperfections:**
- `slightly messy background, not staged`
- `uneven practical lighting, one side slightly brighter`
- `fingerprint smudge on nearby glass surface`
- `corner of a cable or bag visible at frame edge`

**The asymmetry principle:** Real footage is never symmetrical. Faces, framing, lighting,
and environments all have micro-asymmetries. Prompting for one specific asymmetry per element
is more effective than prompting for "natural" or "authentic" — both of which the model
interprets as high-quality, not as genuinely imperfect.

**For UGC ads specifically**, combine:
```
[Imperfect subject descriptor] + [Smartphone lens stack] + [Lived-in background] +
[Natural color plate] + handheld micro-sway + slight focus breathing
```

---

### Layer 5 — Multi-Clip Identity Anchoring (No SoulID Equivalent in Flow)

Higgsfield's SoulID maintains character identity across separate sessions automatically.
Flow has no equivalent. Identity must be re-anchored manually in every clip.

**The Flow method for cross-clip consistency:**

**Rule 1: Repeat exact identity phrasing verbatim across every clip prompt.**
Do not paraphrase. Copy the exact subject descriptor from Clip 1 into Clip 2, Clip 3, etc.
Even minor rephrasing shifts what the model generates.

**Rule 2: Repeat exact lens + color plate verbatim across every clip.**
```
Shot on Sony FX3, 35mm, f/2.0, soft window light from camera left, warm natural color balance
```
This line appears identically in every clip prompt in a sequence.

**Rule 3: Use First Frame from the previous clip's last frame.**
Extract the last frame of Clip N using a frame extraction tool. Feed it as the First Frame of
Clip N+1. This is the closest Flow equivalent to SoulID for sequential clips.

**Rule 4: Re-feed the original character reference images as Ingredients into every Veo call.**
Do not assume the model remembers. Each generation is stateless. Ingredients must be
re-supplied explicitly for every clip that requires the same subject.

**Clip-by-clip structured prompting for sequences:**
Veo 3.1 accepts `Clip 1 / Clip 2 / Clip 3` structured prompts within a single generation call:

```
Clip 1 (2s): [Wide establishing shot description]
Clip 2 (3s): [Medium shot description, same identity cues]
Clip 3 (3s): [Close-up description, same identity cues]
```

Each clip block gets its own camera, action, and audio direction. Identity cues repeat in
every block. This produces a cut-ready sequence in one Veo generation call.

---

### What Higgsfield Does That Flow Cannot Replicate

For transparency — these are architectural gaps, not prompting gaps:

| Higgsfield capability | Flow equivalent | Gap |
|---|---|---|
| SoulID cross-session identity | Manual re-anchoring per clip | Sessions are stateless in Flow |
| 70+ cinema camera presets | Must describe in text | No preset library |
| Multi-model in same project (Sora+Kling+Veo) | Veo 3.1 only | Single model per generation |
| Built-in micro-drift handheld engine | Must prompt explicitly | Prompting achieves ~80% of same result |
| Popcorn: exact film/sensor combo UI | Film stock prompting | Text activation, not UI-level control |
| Automatic temporal consistency across clips | Manual frame chaining | Requires deliberate workflow |

These gaps close through the chaining workflow and deliberate prompting — the results are
achievable but require more intentional pipeline design than Higgsfield's one-click equivalents.
