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

<HARD-RULE: INTENT BEFORE STRUCTURE>

## Iron Law: Never draw the skeleton until intent is confirmed by the user.

The skill must solve the user's actual problem — not what the agent assumes the problem is.
Structure, pointers, and reference nodes are worthless if built for the wrong intent.

**Mandatory questions — ask these, one at a time, wait for answers:**
1. What do you do today without this skill — and where does that break or feel wrong?
2. What should change after the skill exists?
3. What does "this skill is working" look like to you?

**After answers received:**
[DO] Summarise intent back in 2–3 sentences.
[DO] Ask: "Is this what you want the skill to do?"
[DO] Wait for explicit user confirmation — "yes" or correction.
Only after confirmation → proceed to SKELETON FIRST.

**BANNED before intent is confirmed:**
- Drawing any skeleton
- Creating any reference file
- Writing any pointer
- Assuming intent from domain knowledge alone
- Proceeding because "the request seems clear"

**Self-check before touching any file:**
"Did the user explicitly confirm what this skill should do?"
If no → STOP → ask the intent questions first.

**Violation example:**
Agent understood "project memory" domain well. Built technically correct
skill with ADR format, handoff modes, token budgets. User installed it.
Intent was assumed, not confirmed. Skill solved the agent's interpretation —
not the user's actual workflow gap. 368 lines of wrong direction.

</HARD-RULE: INTENT BEFORE STRUCTURE>

---

<HARD-RULE: SKELETON FIRST>

## Iron Law: Never write content before the skeleton is confirmed.

Before writing any line of content in any `.md` file — output the full
SKILL.md skeleton first. Headers and pointers only. Zero content. Zero prose.

**BANNED before skeleton is confirmed:**
Writing templates, formats, algorithms, examples, or any prose into SKILL.md
or any reference file.

**The skeleton looks like this:**
```
## Section Name
[READ] references/file.md — WHEN <condition>
[DO] one line operational step
```

**Self-check before writing any content:**
"Have I shown the skeleton and confirmed it with the user?"
If no → STOP → output skeleton first.

**Violation example:**
Agent wrote full ADR format, bash commands, and templates directly into
SKILL.md — 368 lines — before any reference files existed.
Map pattern was completely lost under content pressure.

</HARD-RULE: SKELETON FIRST>

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
