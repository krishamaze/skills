---
name: project-memory
description: >
  Maintains three living project docs — DECISIONS.md (what + why), CONTEXT.md (current
  state + next action), STACK.md (locked versions + do-not patterns + failure root causes).
  ALWAYS invoke this skill when: a user says "update memory", "log this decision", "save
  context", "remember this", "update project docs", "memory", "/memory", "/update-memory",
  "capture this", "we just decided", "add to decisions", "document this failure", "update
  stack", or at any architectural decision point or post-failure resolution. Also invoke
  after any completed feature, resolved blocker, or version change. Trigger aggressively —
  if there is any chance the conversation contains a decision, failure, or state change worth
  capturing, invoke this skill.
---

# project-memory

## Slash Command Aliases

This skill responds to: `/memory` · `/update-memory`

---

## Purpose

Three files. Each has one job. Together they let any agent — or future-you — resume
work cold without losing context or repeating dead ends.

| File | Job |
|------|-----|
| `DECISIONS.md` | What was chosen + why. Immutable once written. |
| `CONTEXT.md` | Live state: current layer, blockers, next action. Overwrites each run. |
| `STACK.md` | Locked versions + **do-not** patterns + failure root causes. |

---

## Invocation Cadence

Invoke this skill:
- After any architectural or stack decision
- After any failure is diagnosed and resolved
- After any completed feature or layer
- When explicitly triggered via `/memory` or `/update-memory`
- Every 5–7 conversation turns as a background hygiene pass

---

## Initialization Protocol

**Before reading any file, check existence:**

```bash
ls DECISIONS.md CONTEXT.md STACK.md 2>&1
```

If any file is missing, create it using the empty templates below — then proceed with the
Update Algorithm. Do not error. Do not invent content.

### Empty template: DECISIONS.md
```markdown
# Decisions
<!-- ADRs appended below. Never edit existing entries. -->
```

### Empty template: CONTEXT.md
```markdown
# Context
**Updated:** YYYY-MM-DD

## Current Layer
Layer 1 — [name]. Status: [building | blocked | verified]

## Last Completed
None yet.

## Active Blocker
None.

## Next Action
[Define first task.]

## Deferred
<!-- Nothing deferred yet. -->
```

### Empty template: STACK.md
```markdown
# Stack

## Locked Versions
| Package | Version | Replaces |
|---------|---------|----------|
<!-- Append entries as they are locked. -->

## Do-Not Patterns + Root Causes
<!-- Append entries as failures are diagnosed. -->
```

---

## Rules Before Writing Anything

1. **Read all three files first.** Never update blind.
2. **Update only what changed.** One new decision? One new entry. Not a rewrite.
3. **CONTEXT.md is the only file that fully overwrites.** The other two append only.
4. **Failures are first-class.** A root cause captured is a dead end avoided.
5. **If nothing changed, say "No updates needed" and stop.**

---

## DECISIONS.md — Format

Each entry is an ADR (Architecture Decision Record). Once written, never edited.
If a decision is reversed, add a new ADR that supersedes it.

```markdown
# Decisions

## ADR-001: [Title]
**Status:** active | superseded by ADR-00X
**Decision:** One sentence — what was chosen.
**Why:** One to three sentences — the actual reason. Not obvious things.
**Do not:** What must never happen as a result of this decision.
**Failure mode:** What goes wrong if this is ignored.
```

**What earns an ADR:**
- Architectural choices (e.g. always-on vs on-demand, gatekeeper pattern)
- Stack choices (e.g. library A over library B and why)
- Security choices (e.g. localhost-only ports, no token rotation)
- Anything that, if reversed, would break something silently

**What does NOT earn an ADR:**
- Implementation details
- File naming
- Anything reversible without consequence

---

## CONTEXT.md — Format

Fully overwrites every invocation. Stays under 20 lines.

```markdown
# Context
**Updated:** YYYY-MM-DD

## Current Layer
Layer X — [name]. Status: [building | blocked | verified]

## Last Completed
[One line — what just finished and confirmed working]

## Active Blocker
[One line — what is broken or unclear right now. "None" if clear.]

## Next Action
[Exact next task. Specific enough that an agent can execute it cold.]

## Deferred
- [Thing explicitly set aside + why]
```

---

## STACK.md — Format

Two sections. Append-only except version bumps.

```markdown
# Stack

## Locked Versions
| Package | Version | Replaces |
|---------|---------|----------|
| [package] | [version] | [what it replaces and why] |

## Do-Not Patterns + Root Causes

### [Pattern name]
**Never:** [Exact thing to never do]
**Why:** [Root cause — what actually broke or will break]
**Instead:** [Correct pattern]
```

**What earns a Do-Not entry:**
- Anything that caused a real failure during this project
- Any pattern that was caught and rejected with a specific reason
- Any anti-pattern from team skills that applies here

---

## Update Algorithm

```
1. Run Initialization Protocol — create missing files if needed
2. Read DECISIONS.md, CONTEXT.md, STACK.md
3. Get real recent history via git:
     !git log --oneline -10
     !git diff --stat HEAD~5
   Use this as ground truth for what changed. Do not rely on agent memory.
4. Extract:
   a. New decisions made → append to DECISIONS.md
   b. New failures/root causes → append to STACK.md do-nots
   c. Version changes → update STACK.md locked versions
   d. Current state → overwrite CONTEXT.md
5. Write only changed files
6. Report: "Updated X, Y. Z unchanged."
```

---

## Token Budget — Enforced Sequence

**Before writing any file, count its current lines:**

```bash
wc -l DECISIONS.md STACK.md CONTEXT.md
```

**If a file would exceed its cap after your addition:**
1. **Stop. Do not write yet.**
2. Archive old entries first:
   - DECISIONS.md superseded ADRs → `references/decisions-archive.md`
   - STACK.md resolved do-nots → `references/stack-archive.md`
3. Only after archiving, write the new content.

**Hard caps:**
- `DECISIONS.md` — 60 lines max
- `CONTEXT.md` — 20 lines max (always)
- `STACK.md` — 80 lines max

**Quality check before writing:** Would removing this sentence lose information?
If no → remove it.
