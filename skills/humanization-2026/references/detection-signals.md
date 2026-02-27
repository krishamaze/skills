# Detection Signals — What 2026 Anti-Bot ML Measures

## Source
Research synthesis from: DMTG (arXiv 2410.18233), Springer 2026 behavioral biometrics
paper, DataDome/Akamai Bot Manager architecture docs, ScoreDetect Jan 2026.

---

## Tier 1: Mouse Signals (Highest Weight)

| Signal | What Bots Get Wrong | Human Baseline |
|--------|-------------------|----------------|
| Trajectory curvature | Straight lines (linear) | Bézier arcs, one-sided |
| Velocity profile | Constant speed | Accelerate → peak → decelerate |
| Overshoot | Never overshoot | Overshoot >300px targets ~30% of time |
| Sub-movement count | 1 movement | 2 phases (ballistic + homing) |
| Jitter | Zero (perfect path) | Gaussian σ≈0.5px hand tremor |
| Click position | Mathematical center always | Random ±30% of bounding box |
| Movement time | Ignores D/W ratio | Scales with Fitts's Law ID |
| Mousedown duration | <5ms or >500ms | Gaussian μ=80ms σ=30ms |

**DMTG research (2024)**: Detectors use LSTM/BiLSTM trained on SapiMouse dataset.
Even with Bézier curves, bots detected at ~80-90% accuracy by unified detectors.
Best mitigation: DMTG-style diffusion trajectories (not practical without ML model).
Practical mitigation: Bézier + Fitts's timing + jitter reduces detection by 5-10%.

---

## Tier 2: Keystroke Signals (High Weight)

| Signal | Bot Behavior | Human Baseline |
|--------|-------------|----------------|
| Dwell time | 0ms (instantaneous) or fixed | Gaussian μ=80ms σ=20ms |
| Flight time | Fixed constant | Gaussian μ=100-200ms σ=40ms |
| Digraph speed | Uniform for all pairs | Common pairs 20-40% faster |
| Error rate | 0% (perfect typing) | 0.5-3% typo rate |
| Typing speed | Constant WPM | Variable ±15% over session |
| Backspace usage | Never or scripted | Natural correction behavior |

**Key insight**: Detectors look at the *distribution shape*, not just mean/variance.
Uniform random delays fail — distribution must be Gaussian/log-normal.

---

## Tier 3: Scroll Signals (Medium Weight)

| Signal | Bot | Human |
|--------|-----|-------|
| Scroll distance | Fixed per call | Variable per step |
| Scroll speed | Constant | Decreasing near content |
| Reversal rate | Never scrolls back | ~15-25% of sessions |
| Read pauses | No pauses | 0.5-4s after scroll stops |
| Scroll-to-click delay | Immediate | 200-800ms after scroll |

---

## Tier 4: Session-Level Signals (High Weight for Repeat Detection)

| Signal | Bot | Human |
|--------|-----|-------|
| Action entropy | Identical sequence every run | High variability |
| Inter-action timing | Regular intervals | Irregular, context-dependent |
| Idle periods | Never idles | Regular 3-15s idle gaps |
| Session duration | Too short or too regular | Variable 2-45min |
| Viewport interaction | Ignores viewport | Mouse stays in viewport |
| Tab focus | Always focused | Tab blur/focus events |
| Navigation pattern | Linear forward only | Backtrack 20-30% of sessions |

---

## Tier 5: What Camoufox Already Covers (Don't Duplicate)

Camoufox handles at C++ level — DO NOT try to override these:
- `navigator.webdriver` — patched to `undefined`
- CDP/Juggler protocol artifacts — isolated from page scope
- Canvas fingerprint — BrowserForge generates real distribution
- WebGL renderer/vendor — spoofed to real-world values
- AudioContext fingerprint — spoofed
- Font enumeration — returns realistic set
- Screen/hardware properties — matches fingerprint profile

---

## What Cannot Be Bypassed (2026)

**Cloudflare Interstitial (v2/v3 Turnstile)**
Uses hardware-attested browser signals via Private Access Tokens.
Checks SpiderMonkey (Firefox) engine behavior at bytecode level.
No known reliable bypass via automation as of Feb 2026.

**DataDome ML Engine**
Real-time scoring of 2000+ signals.
High confidence detection even with Bézier + Fitts's + Gaussian typing.
Best mitigation: residential proxy + persistent identity + slow interaction.

**Meta/Instagram Behavioral Engine**
Trains on YOUR account's historical interaction patterns.
After first login, your behavior is compared to your history.
→ Be consistent in timing, style, and pace across sessions.
→ Don't suddenly become 5x faster or 5x slower.

---

## Session Reputation Factors (Threads Specific)

Meta tracks at account level, not just session level:
- **Post frequency**: too many posts too fast = signal
- **Reply speed**: replying <5s after seeing a post = suspicious
- **Engagement pattern**: always liking then posting = bot pattern
- **Login location consistency**: VPS IP should stay stable (not rotate)
- **Device fingerprint history**: persistent context = one trusted "device"

**Implication**: Your persistent session IS your reputation. Guard it.
Don't reset cookies. Don't change the fingerprint. Same IP as much as possible.
