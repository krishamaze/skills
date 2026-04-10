# Improving the Skill

## Three Principles

1. **Generalize from feedback** — optimize for a million future invocations, not the 3 test cases. If something is stubborn, try a different metaphor or pattern before adding more constraints.

2. **Apply the Necessity Gate** — remove anything not pulling its weight. Read transcripts (not just outputs) — if the agent wastes time on something, find the skill line causing it and cut it. If evals degrade after a cut, the cut content was real delta — restore it.

3. **Bundle repeated work** — if all test runs independently wrote the same helper script, put it in `scripts/` and add a `[RUN]` pointer in SKILL.md.

## Iteration Loop

[DO] Apply improvements to skill
[DO] Rerun all test cases into `iteration-N+1/`
[RUN] eval-viewer/generate_review.py — WHEN relaunching viewer, add `--previous-workspace <workspace>/iteration-N`
[DO] Wait for user review
[DO] Repeat until: user says done, all feedback empty, or no meaningful progress
