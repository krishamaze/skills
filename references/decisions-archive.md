
## ADR-004: Skills contain delta knowledge only — not general concepts
**Status:** superseded by ADR-005
**Decision:** Skills teach only what a 2024-trained model doesn't know. General concepts (streaming, embeddings, FC basics) are omitted.
**Why:** Skills are context-window budget. Repeating known knowledge wastes tokens and dilutes the new information that actually matters. A skill is a patch, not a manual.
**Do not:** Include tutorials for concepts the model already knows (e.g., "what is streaming", "how does function calling work").
**Failure mode:** Skill bloats to 1000+ lines, exceeding the 500-line SKILL.md limit and burying critical delta knowledge in noise.
