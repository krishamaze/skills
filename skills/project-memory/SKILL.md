---
name: project-memory
description: >
  Maintains three living project docs — DECISIONS.md (what + why), CONTEXT.md
  (current state + next action), STACK.md (locked versions + do-not patterns +
  failure root causes). Two modes: **Handoff** scans all AI agent state and
  resumes work; **Memory** saves current state like a save button.
  ALWAYS invoke this skill when: a user says "update memory", "log this decision",
  "save context", "remember this", "update project docs", "memory", "/memory",
  "/update-memory", "/save", "/handoff", "/continue", "capture this", "we just
  decided", "add to decisions", "document this failure", "update stack",
  "continue where X left off", "pick up codex's work", "what was the last agent
  doing", "handoff", "agent state", "read all agent logs", "consolidate agent
  work", "cross-agent continue", or wants to resume work started by a different
  AI agent. Also invoke after any completed feature, resolved blocker, version
  change, agent switch, crash recovery, or rate limit. Trigger aggressively —
  if there is any chance the conversation contains a decision, failure, state
  change, or agent handoff worth capturing, invoke this skill.
---

# project-memory

## Slash Commands

`/memory` · `/update-memory` · `/save` · `/handoff` · `/continue`

---

## Two Modes

| Mode | When | What it does |
|------|------|--------------|
| **Handoff** | Fresh session, agent switch, `/handoff`, `/continue` | Scan all agents → consolidate → update memory → resume work |
| **Memory** | Mid-session, `/memory`, `/save` | Read 3 files + git log → update what changed |

**Auto-detect:** Fresh session (no prior turns with this agent) = Handoff.
Mid-session (agent already has conversation context) = Memory.
User can force either mode with explicit slash commands.

---

## The Three Files

| File | Job | Write rule |
|------|-----|------------|
| `DECISIONS.md` | What was chosen + why. Immutable once written. | Append only |
| `CONTEXT.md` | Live state: current work, blockers, next action. | Full overwrite |
| `STACK.md` | Locked versions + do-not patterns + failure root causes. | Append only |

**These files are the single source of truth for project state.** No other
skill writes to them. This skill is the only writer.

---

## Red Flags

These thoughts mean STOP — you're skipping the skill:

| Thought | Reality |
|---------|---------|
| "I'll just read the files myself" | The skill reads AND updates. Half the job is the write. |
| "The session is too short to save" | One decision or one failure = worth saving. |
| "I remember what the other agent did" | You don't. Agent memory doesn't transfer. Scan. |
| "I'll update memory later" | You'll forget. Context is freshest now. |
| "Nothing changed" | Run the algorithm. Let git confirm that. |
| "The user didn't ask for a save" | Invoke every 5–7 turns as hygiene. |

---

## Handoff Mode

Run this on fresh sessions, agent switches, or when the user says "continue",
"handoff", "what was the last agent doing".

### Step 1 — Scan all agents

```bash
# Use `python` instead of `python3` on Windows
python3 <skill-dir>/scripts/scan_agent_state.py "$(pwd)"
```

This outputs structured JSON covering every agent. See
`references/agent-parsing-gotchas.md` for format-specific pitfalls.

If the script fails, fall back to manual reads. Read these in **parallel batches**:

**Batch 1 — Agent state (all parallel)**

| Agent | What to read | Key data |
|-------|-------------|----------|
| **Claude Code sessions** | `~/.claude/projects/-<path-dashed>/*.jsonl` (last 30 lines of newest) | Last prompt, response, stop reason |
| **Claude Code memory** | `~/.claude/projects/-<path-dashed>/memory/MEMORY.md` | Learned feedback entries |
| **Claude Code plans** | `~/.claude/plans/*.md` (5 most recent) | Plan titles and status |
| **Claude Code global** | `~/.claude.json` → `.projects["<cwd>"]` | lastCost, lastSessionId, lastModelUsage |
| **Codex config** | `~/.codex/config.toml` | Model, reasoning effort, trust level |
| **Codex history** | `~/.codex/history.jsonl` (last 10 lines) | Recent prompts (field: `text` or `prompt`) |
| **Codex sessions** | `~/.codex/sessions/YYYY/MM/DD/` (latest rollout) | Session rollouts — ⚠️ see gotchas |
| **Antigravity brain** | `~/.gemini/antigravity/brain/` (latest dir by mtime) | task.md, implementation_plan.md, walkthrough.md |
| **Antigravity knowledge** | `~/.gemini/antigravity/knowledge/` | Curated KIs with metadata.json |
| **Aider** | `<project>/.aider.chat.history.md` (last 20 lines) | Recent conversation |
| **Augment** | `~/.augment/{skills,rules,commands}/` | Installed extensions |

**Batch 1b — Unknown agents (if time permits)**

```bash
ls -d ~/.[a-z]* 2>/dev/null | grep -vE '\.(cache|config|local|ssh|git|npm|nvm|bash|profile|sudo)'
```

Check unfamiliar dotdirs for `.json`, `.jsonl`, or `.toml` files.

**Path key for Claude Code:**
`/home/user/projects/foo` → `-home-user-projects-foo` (replace `/` and `_` with `-`)

**Batch 2 — Project memory (after batch 1)**

Read CONTEXT.md, DECISIONS.md, STACK.md from project root (or `memory/`).

### Step 2 — Consolidate

Output one line per active agent:

```
[agent] — [last active] — [doing what] — [stopped because] — [next action]
```

### Step 3 — Update memory files

Run the **Update Algorithm** below with findings from the scan.

### Step 4 — Resume

1. Identify the **most recently active agent's unfinished work**
2. If multiple agents worked on different things → ask user which to continue
3. If the work needs a specific tool (e.g., Codex MCP) → say so, don't pretend
4. Execute the next action from consolidated state

---

## Memory Mode

Run this mid-session, on `/memory`, `/save`, or every 5–7 turns as hygiene.

### Invocation cadence

- After any architectural or stack decision
- After any failure is diagnosed and resolved
- After any completed feature or layer
- When explicitly triggered
- Every 5–7 turns as background hygiene

---

## Initialization Protocol

**Check both root and `memory/` — never create duplicates:**

```bash
for f in DECISIONS.md CONTEXT.md STACK.md; do
  [ -f "$f" ] && echo "ROOT:$f" || { [ -f "memory/$f" ] && echo "MEMORY:$f" || echo "MISSING:$f"; }
done
```

If a file exists in `memory/`, use that path for all reads and writes.
If missing entirely, create in the same location as existing files (root if
others are in root, `memory/` if others are in `memory/`, default to root
for brand-new projects). **Never create a root copy when `memory/` copy exists.**

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

## Rules Before Writing

1. **Read all three files first.** Never update blind.
2. **Update only what changed.** One new decision → one new entry.
3. **CONTEXT.md fully overwrites.** The other two append only.
4. **Failures are first-class.** A root cause captured = a dead end avoided.
5. **If nothing changed, say "No updates needed" and stop.**
6. **Don't move files.** If they exist in root, keep them there. Only create under `memory/` for new projects.

---

## DECISIONS.md — Format

Each entry is an ADR. Once written, never edited. Reversals get a new ADR.

```markdown
# Decisions

## ADR-001: [Title]
**Status:** active | superseded by ADR-00X
**Decision:** One sentence — what was chosen.
**Why:** One to three sentences — the actual reason. Use conversation context.
**Do not:** What must never happen as a result.
**Failure mode:** What breaks if ignored.
```

**Earns an ADR:** Architecture choices, stack choices, security choices,
anything that breaks silently if reversed.

**Does NOT earn an ADR:** Implementation details, file naming, anything
reversible without consequence.

---

## CONTEXT.md — Format

Full overwrite every invocation. Under 20 lines.

```markdown
# Context
**Updated:** YYYY-MM-DD

## Current Layer
Layer X — [name]. Status: [building | blocked | verified]

## Last Completed
[One line — what finished and confirmed working]

## Active Blocker
[One line. "None" if clear.]

## Next Action
[Exact next task. Specific enough for a cold-start agent.]

## Deferred
- [Thing set aside + why]
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
**Why:** [Root cause — what broke]
**Instead:** [Correct pattern]
```

**Earns a Do-Not entry:**
- Anything that caused a real failure during this project
- Any pattern caught and rejected with a specific reason
- Any anti-pattern from team skills that applies here

---

## Update Algorithm

```
1. Run Initialization Protocol — create missing files if needed
2. Read DECISIONS.md, CONTEXT.md, STACK.md (from wherever they live)
3. Get ground truth via git:
     git log --oneline -10
     git diff --stat HEAD~5 2>/dev/null || git diff --stat HEAD
   Use git as truth. Do not rely on agent memory.
   If not a git repo or shallow clone: skip git, rely on agent scan + files.
4. If Handoff mode: also use scan results from Step 1
5. Extract:
   a. New decisions → append to DECISIONS.md
   b. New failures/root causes → append to STACK.md do-nots
   c. Version changes → update STACK.md locked versions
   d. Current state → overwrite CONTEXT.md
6. Write only changed files
7. Report: "Updated X, Y. Z unchanged."
```

---

## Token Budget

**Count lines before writing:**

```bash
# Linux/macOS:
wc -l DECISIONS.md STACK.md CONTEXT.md

# Windows (PowerShell):
(Get-Content DECISIONS.md, STACK.md, CONTEXT.md -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
```

**If a file would exceed its cap after your addition:**
1. Stop. Do not write yet.
2. Archive first:
   - DECISIONS.md superseded ADRs → `references/decisions-archive.md`
   - STACK.md resolved do-nots → `references/stack-archive.md`
3. Only after archiving, write.

**Hard caps:**
- `DECISIONS.md` — 150 lines
- `CONTEXT.md` — 20 lines (always)
- `STACK.md` — 200 lines

**Quality check:** Would removing this sentence lose information? If no → remove it.

---

## Edge Cases

| Situation | Action |
|-----------|--------|
| Agent hit rate limit | Note reset time, continue with different agent or direct work |
| No session logs found | Check if project was opened in that agent (look in global config) |
| Session log is just `/clear` → `/exit` | Skip it, find previous substantive session |
| Large SQLite files | Use `history.jsonl` instead — lightweight equivalent |
| Guardian subagent messages in Codex | Filter: risk assessments ≠ real user prompts |
| Project memory files are stale | Use session logs + git as ground truth, update files |
| Multiple agents worked on different things | Ask user which to continue |
| Agent needs specific tools (e.g. Codex MCP) | Say so — don't pretend you have tools you don't |
| Shallow clone or no git | Skip `git diff --stat HEAD~5`, use `git diff --stat HEAD` or skip git entirely |
| Files in `memory/` not root | Use `memory/` path for all reads/writes — never create root duplicates |
| Unknown dotdir found | Check for `.json`/`.jsonl`/`.toml` — might be a new agent |

---

## References

- `references/agent-parsing-gotchas.md` — format-specific pitfalls for each agent's state files
- `scripts/scan_agent_state.py` — automated agent state scanner (all agents, JSON output)
