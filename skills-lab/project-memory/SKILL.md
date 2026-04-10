---
name: project-memory
description: >
  Maintains DECISIONS.md, CONTEXT.md, STACK.md, and a flat `memory/`
  knowledge graph. Handles agent handoffs by scanning agent state,
  consolidating unfinished work, updating memory, and resuming the next
  action. Also keeps agent config files lean by extracting dumps into
  `memory/` and maintaining `AGENT.md` symlinks. Invoke when the user says
  "memory", "save context", "log this decision", "update project docs",
  "/memory", "/save", "/handoff", "/continue", "resume from another agent",
  or "what was the last agent doing", or after architectural decisions,
  resolved failures, completed features, version changes, agent switches,
  crashes, or rate limits. Trigger aggressively whenever a decision, failure,
  state change, or handoff should be captured.
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

**Auto-detect:** Fresh session (no prior turns) = Handoff. Mid-session = Memory.
User can force either mode with explicit slash commands.

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

Run on fresh sessions, agent switches, or "continue" / "handoff".

### Step 1 — Scan all agents

```bash
# Use `python` instead of `python3` on Windows
python3 <skill-dir>/scripts/scan_agent_state.py "$(pwd)"
```

[READ] references/agent-parsing-gotchas.md — WHEN script fails, fall back to manual reads

### Step 2 — Consolidate

[DO] Output one line per active agent:
```
[agent] — [last active] — [doing what] — [stopped because] — [next action]
```

### Step 3 — Update memory files

[DO] Run the Update Algorithm below with findings from the scan.

### Step 4 — Resume

[DO] Identify the most recently active agent's unfinished work
[DO] If multiple agents worked on different things → ask user which to continue
[DO] If the work needs a specific tool (e.g., Codex MCP) → say so, don't pretend
[DO] Execute the next action from consolidated state

---

## Memory Mode

Run mid-session, on `/memory`, `/save`, or every 5–7 turns as hygiene.

[DO] Read 3 structured files + git log → run Update Algorithm

---

## Update Algorithm

[READ] references/initialization.md — WHEN files are missing or first run

1. [DO] Read DECISIONS.md, CONTEXT.md, STACK.md (from wherever they live)
2. [DO] Get ground truth via git:
   ```
   git log --oneline -10
   git diff --stat HEAD~5 2>/dev/null || git diff --stat HEAD
   ```
   Use git as truth. If not a git repo or shallow clone: skip git, rely on agent scan + files.
3. [DO] If Handoff mode: also use scan results from Step 1
4. [DO] Extract:
   - New decisions → append to DECISIONS.md
   - New failures/root causes → append to STACK.md do-nots
   - Version changes → update STACK.md locked versions
   - Current state → overwrite CONTEXT.md
   - Learned knowledge → write to memory/ as atomic files

[READ] references/decisions-format.md — WHEN writing to DECISIONS.md
[READ] references/context-format.md — WHEN writing to CONTEXT.md
[READ] references/stack-format.md — WHEN writing to STACK.md
[READ] references/knowledge-graph.md — WHEN writing learned knowledge to memory/
[READ] references/token-budget.md — WHEN any file approaches its line cap

5. [DO] Write only changed files
6. [DO] Report: "Updated X, Y. Z unchanged."

---

## Agent Config Hygiene (every invocation)

[READ] references/agent-config-hygiene.md — WHEN checking agent config structure
[DO] Run silently on every invocation as final step:
- Detect agent config files at project root (AGENT.md, CLAUDE.md, GEMINI.md)
- If any is a dump (>40 lines) → extract knowledge to memory/, leave lean protocols
- Verify symlinks: CLAUDE.md and GEMINI.md should be relative symlinks to AGENT.md

---

## Rules Before Writing

1. **Read all three files first.** Never update blind.
2. **Update only what changed.** One new decision → one new entry.
3. **CONTEXT.md fully overwrites.** The other two append only.
4. **Failures are first-class.** A root cause captured = a dead end avoided.
5. **If nothing changed, say "No updates needed" and stop.**

---

## Edge Cases

[READ] references/edge-cases.md — WHEN encountering an unexpected scenario

---

## References

- `references/agent-parsing-gotchas.md` — agent state format pitfalls
- `references/agent-config-hygiene.md` — symlink + dump detection + repair
- `references/knowledge-graph.md` — memory/ structure and conventions
- `references/initialization.md` — file creation protocol
- `references/decisions-format.md` — ADR format + template
- `references/context-format.md` — CONTEXT.md format + template
- `references/stack-format.md` — STACK.md format + template
- `references/token-budget.md` — line caps + archive protocol
- `references/edge-cases.md` — edge case table
- `scripts/scan_agent_state.py` — automated agent state scanner
