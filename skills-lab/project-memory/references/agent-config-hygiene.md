# Agent Config Hygiene

Run this on every project-memory invocation as a final hygiene step.
Agents auto-inject their config file (CLAUDE.md, GEMINI.md, etc.) — the
symlink mechanism is invisible to them. This protocol maintains it silently.

---

## Step 1: Detect

```
Scan project root for: AGENT.md, CLAUDE.md, GEMINI.md
Classify each: regular file | relative symlink | absolute symlink | missing
```

## Step 2: Identify master

- If AGENT.md exists as regular file → it's the master
- If no AGENT.md but one or more others exist as regular files → the longest one is the master candidate; rename it to AGENT.md

## Step 3: Extract knowledge dumps

If master file is >40 lines, it contains knowledge that belongs in `memory/`:

1. Parse the file — identify knowledge blocks:
   - Stack constraint tables → `memory/stack-constraints.md`
   - Decision summaries → already in DECISIONS.md, just cut the duplicate
   - Architecture/structure docs → `memory/<topic>.md`
   - Tool/workflow docs → `memory/<topic>.md`
2. Each extracted file: one concept, ≤50 lines, descriptive filename
3. Remove extracted content from master file

## Step 4: Write lean protocols

Replace master file content with operational protocols only (~25 lines).
The content is behavioral instructions, not knowledge:

```markdown
# Agent Configuration

## On session start

Read `CONTEXT.md` — current state, blockers, and next action.
Scan `memory/` filenames — check if any are relevant to your task.

## While working

- Before touching a module, check `memory/` for notes on it.
- When you discover a gotcha, constraint, or pattern — note it for memory.
- When you make an architectural decision or hit a failure — invoke `/memory`.

## After completing work

Write what you learned to `memory/`:
- What worked and why
- What broke and the root cause
- Patterns to follow or avoid next time

One concept per file, ≤50 lines. Create new files freely.

## Key files

| File | Purpose | Write rule |
|------|---------|------------|
| `CONTEXT.md` | Current state + next action | Overwrite (via `/memory`) |
| `DECISIONS.md` | Architectural decisions | Append only (via `/memory`) |
| `STACK.md` | Locked versions + do-nots | Append only (via `/memory`) |
| `memory/` | Knowledge graph | Read freely, write on learning |
```

Adapt this template to the project — if it's a skills repo, add source-vs-install
protocol. If it uses specific tools, note them. But never exceed ~35 lines.

## Step 5: Fix symlinks

- CLAUDE.md should be relative symlink → AGENT.md. If regular file → extract knowledge → `ln -sf AGENT.md CLAUDE.md`
- GEMINI.md should be relative symlink → AGENT.md. If regular file → extract knowledge → `ln -sf AGENT.md GEMINI.md`
- If any symlink is absolute → recreate as relative: `ln -sf AGENT.md <name>.md`
- If any symlink is broken → recreate: `ln -sf AGENT.md <name>.md`

## When NOT to touch agent config

- If no agent config files exist at all and the project has no `memory/` — skip. Not every project uses this pattern.
- If the master file is already ≤40 lines — skip extraction, just verify symlinks.
