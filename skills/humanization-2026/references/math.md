# Math Reference — Bézier, Fitts's Law, Gaussian

## 1. Cubic Bézier Curve

Given 4 control points P0 (start), P1, P2, P3 (end), parameter t ∈ [0,1]:

```
B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
```

**Control point placement for human-like curves:**
- P1 placed at 30% along the path + perpendicular offset
- P2 placed at 70% along the path + smaller perpendicular offset
- Both offsets on the SAME side (arc, not S-curve)
- Offset = arc_side × random.uniform(0.1, 0.25) × distance

**Why one side only:**
Ghost-cursor research (Xetera, 2020): humans rarely make S-curves.
One-sided arcs reflect natural motor control asymmetry.

---

## 2. Fitts's Law (Shannon Form)

```
MT = a + b × log₂(D/W + 1)
```

Where:
- MT = movement time (seconds)
- D = distance from start to target center (pixels)
- W = target width in direction of movement (pixels)
- a ≈ 0.05s (motor initiation constant)
- b ≈ 0.12s/bit (motor execution constant)
- ID = log₂(D/W + 1) = Index of Difficulty (bits)

**Common MT values:**
| Target | D=100px, W=50px | D=500px, W=20px |
|--------|----------------|----------------|
| ID     | 1.58 bits      | 4.64 bits      |
| MT     | ~0.24s         | ~0.61s         |

**Human variance:** Apply ×random.uniform(0.85, 1.15) — humans vary ±15%.

---

## 3. Gaussian (Normal) Distribution for Timing

Human keystroke timing follows Gaussian distribution:
`f(x) = (1/σ√2π) × e^(-(x-μ)²/2σ²)`

**Calibrated values (from CMU keystroke dataset):**

| Metric | μ (mean) | σ (std dev) | Min clamp |
|--------|---------|-------------|-----------|
| Dwell time | 80ms | 20ms | 30ms |
| Flight time (avg typist, 60wpm) | 167ms | 58ms | 40ms |
| Flight time (fast typist, 90wpm) | 111ms | 39ms | 30ms |
| Mousedown duration | 85ms | 30ms | 30ms |

**Python:** `random.gauss(mu, sigma)` — clamp with `max(min_val, result)`

**Why not uniform random:**
Uniform distribution produces wrong histogram shape.
LSTM detectors trained on real data flag non-Gaussian distributions
even if mean and variance match.

---

## 4. Ease-In-Out Velocity Profile

Human movement accelerates then decelerates (bell curve velocity).
Approximation: adjust step delay by speed factor.

```python
# For step i in 0..N:
t = i / N
speed_factor = 1 - abs(2*t - 1)**2 * 0.5

# speed_factor ≈ 0.5 at start/end, 1.0 at midpoint
# delay = (total_duration / N) / speed_factor
```

Alternative (more accurate): sine-based ease
```python
speed_factor = math.sin(math.pi * t)
```

---

## 5. Gaussian Jitter for Micro-Tremor

Hand tremor follows zero-mean Gaussian:
```python
jitter_x = random.gauss(0, 0.5)  # μ=0, σ=0.5px
jitter_y = random.gauss(0, 0.5)
```

σ=0.5px is empirically calibrated from SapiMouse dataset.
Larger σ looks drunk. Smaller σ looks robotic.

---

## 6. Overshoot Detection Threshold

Research: humans overshoot when D > ~300px and W < ~30px.
Overshoot amount: 3-8% of total distance.

```python
if dist > 300 and target_w < 30:
    overshoot_pct = random.uniform(0.03, 0.08)
    overshoot_x = end_x + (end_x - start_x) * overshoot_pct
    overshoot_y = end_y + (end_y - start_y) * overshoot_pct
```

---

## 7. Inter-Action Timing Entropy

Detectors measure Shannon entropy of your inter-action delay distribution.
Bots: H ≈ 0 (same delay every time)
Humans: H ≈ 3-5 bits (high variability)

**Mitigation:** Never use a fixed sleep value. Always:
```python
# ❌
await asyncio.sleep(1.0)

# ✅ — varies per context
await asyncio.sleep(random.gauss(1.2, 0.4))
```
