# Necessity Gate

Applies to **every `.md` file** in the skill — SKILL.md, references/*.md, agents/*.md.

Before writing any line in any `.md` file, ask:
**"Would the agent perform measurably worse on this task without this?"**

If you cannot argue yes — cut it.

Cuts apply to:
- Domain knowledge the agent already has parametrically
- "Be thorough / be careful" instructions
- Examples for tasks the agent handles zero-shot cleanly
- Explanations of what tools/APIs do if in training data

All `.md` files inject delta only: private state, format constraints, workflow steps, pointers. Not restated knowledge.

## Classification Table

Before writing any line, classify it:

| Classification | Action |
|---|---|
| Trained knowledge — timeless (principles, books, math) | `[REMIND:stable]` pointer — one line hint only |
| Trained knowledge — tool/framework/API behavior | `[REMIND:verify]` pointer — recall then cross-check if post-2024 |
| Novel / external / not in training | Write to `references/` as atomic file, add `[READ] WHEN <condition>` pointer |
| Operational instruction (how to do the step) | Stays in the `.md` body |
| Fluffy / general guidance | DELETE |

## Graph Protocol

Every `.md` file is a node. Pointers are edges. Together they form a navigable knowledge graph.

- `[READ]`, `[RUN]`, `[SPAWN]` = visible edges between nodes
- `[REMIND]` = invisible node — knowledge lives in agent's trained weights, not in any file. Referenced but not stored. Only the agent can access it.

## Explain the Why

Before writing a constraint in CAPS (ALWAYS/NEVER), ask if you can explain *why* instead. Explaining why produces more robust generalization and a leaner skill.

## 200-Line Rule

Any `.md` file approaching 200 lines gets indexed.
[READ] references/indexing-mechanic.md — WHEN any file approaches 200 lines or needs splitting

## Orphan Check

After writing all pointers, verify every file in `references/` and `agents/` has at least one incoming `[READ]`, `[RUN]`, or `[SPAWN]` pointer pointing to it.
If not — add the pointer or delete the file.
