---
name: skill-creator-lean
description: >
  Create new skills, modify and improve existing skills, and measure skill
  performance. Use when users want to create a skill from scratch, edit, or
  optimize an existing skill, run evals to test a skill, benchmark skill
  performance with variance analysis, or optimize a skill's description for
  better triggering accuracy. Also trigger when user says "make a skill",
  "turn this into a skill", "package this", "write a SKILL.md", or asks how
  to structure agent knowledge — even if they don't say "skill" explicitly.
  Enforces the map pattern: SKILL.md is an index of pointers, not a knowledge
  dump. All skills produced must use [REMIND], [READ], [RUN], [SPAWN], [DO]
  pointer syntax.
---

# Skill Creator

## Process
1. Capture intent → write SKILL.md → test → eval → improve → repeat
2. When satisfied: description optimization → package → return

Jump in at whatever stage the user is at.

---

## 1. Capture Intent

[DO] Extract from conversation first — tools used, steps taken, corrections made, observed I/O
[DO] Fill gaps by asking: What enables the agent? When trigger? Expected output? Test cases needed?

---

## 2. Write SKILL.md

[READ] references/necessity-gate.md — BEFORE writing any line in any .md file
[READ] references/pointer-syntax.md — WHEN writing any pointer or structuring the map
[READ] references/skill-anatomy.md — WHEN deciding skill folder structure or progressive disclosure
[READ] references/frontmatter.md — WHEN writing name, description, or compatibility fields

---

## 3. Test Cases

[READ] references/test-cases.md — WHEN writing eval prompts or assertions

---

## 4. Run and Evaluate

[READ] references/platform-notes.md — BEFORE running any evals
[READ] references/eval-process.md — WHEN running test cases, grading, and reviewing results

---

## 5. Improve

[READ] references/improving.md — WHEN applying feedback and iterating on the skill

---

## 6. Blind Comparison

[SPAWN] agents/comparator.md — WHEN doing blind A/B comparison between two skill versions
[SPAWN] agents/analyzer.md — WHEN analyzing why one version beat another
Requires subagents.

---

## 7. Description Optimization

[READ] references/description-optimization.md — WHEN optimizing trigger description

---

## Packaging

[RUN] scripts/package_skill.py `<path/to/skill-folder>`
[DO] Present the resulting `.skill` file to the user.
