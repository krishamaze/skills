---
name: writing-agent-prompts
description: >
  Patterns for writing effective prompts for Claude Code (the VS Code / terminal agent).
  Provides verified patterns for writing effective prompts for Claude Code agents.
  ALWAYS load this skill when: writing a task for Claude Code, crafting an agent instruction,
  designing a subagent prompt, debugging Claude drift or incorrect output,
  reviewing a CLAUDE.md file, structuring a new skill, or any question about how
  to instruct Claude Code effectively.
  Trigger phrases: "prompt for claude", "tell claude to", "claude drifted", "claude did wrong",
  "how to ask claude", "agent task", "CLAUDE.md", "write a skill", "skill description",
  "claude ignored", "claude did the wrong thing".
---

# Writing Agent Prompts for Claude Code

Source-verified Feb 2026. Every rule has a citation or observed failure mode. Not trained assumptions.

**Sources:** Anthropic Claude Code docs, Anthropic agent skills best practices, morphllm.com Claude Code best practices, github.com/shanraisshan/claude-code-best-practice, empirical Flonest monorepo sessions Feb 2026.

---

## What Claude Code actually is right now (Feb 2026)

| Fact | Source |
|---|---|
| Default model: Claude Sonnet 4.6 | Anthropic docs |
| Max context: 200K (1M beta) | Anthropic docs |
| Adaptive thinking: auto, no prompting needed | Opus 4.6 docs |
| Prefill removed on Opus 4.6 — returns 400 error | Anthropic breaking changes |
| CLAUDE.md auto-loaded every session | Official guidance |
| CLAUDE.md hard limit: ~150 lines before rules get ignored | Community consensus + Anthropic guidance |
| Skill auto-invoke is unreliable | Real users confirmed — Claude often won't invoke without explicit ask |
| `/rules/*.md` — modular rules system, separate from CLAUDE.md | Claude Code changelog |
| `ultrathink` in skill body → triggers extended thinking | Official Claude Code docs |
| `!command` in skill → dynamic context injection before Claude sees content | Official Claude Code docs |
| `context: fork` in frontmatter → skill runs as subagent | Official Claude Code docs |

---

## The non-obvious things (what most people don't know)

**`ultrathink` is a trigger word, not a prompt.**
Put it anywhere in your SKILL.md body to force extended thinking for that skill's tasks.
Use it for migrations, RPC design, security decisions — not for simple CRUD.

**`!command` injects live data before Claude sees the prompt:**
```yaml
---
name: pr-summary
description: Summarize a pull request
context: fork
agent: Explore
---
## Live context
- Diff: !`gh pr diff`
- Comments: !`gh pr view --comments`

Summarize this PR.
```
Claude receives the rendered output, not the command. Use this to inject current DB schema,
current migration list, or current file contents into a skill automatically.

**Skills do NOT reliably auto-invoke.**
Anthropic says they should. Real usage says: often they don't for simple tasks.
Mitigation: make your skill description very explicit and "pushy" (see description section below).
For critical workflows, add a slash command alias alongside the skill.

---

## Core prompt rules

### 1. Anchor before acting — always
```
Read memory/DECISIONS.md and <exact-file-path> before writing anything.
```
Claude Code loads skill metadata at startup but reads files only when triggered.
Without anchoring, it writes from training knowledge, not your actual codebase.
**Observed failure:** migration written without reading schema → duplicate columns created.

### 2. One task per prompt. Two tasks = explicit sequence.
```
Two tasks. Do them in order. Do not start Task 2 until Task 1 is complete.

TASK 1: ...
TASK 2: ...
```
Claude will parallelize if not blocked.
**Observed failure:** TypeScript types generated before schema migration confirmed → type drift.

### 3. Explicit DO NOTs block "helpful drift"
```
Do NOT touch any existing tables.
Do NOT generate TypeScript yet.
Do NOT run the dev server.
Do NOT edit the original RPC — extend it in a new migration.
```
Claude is trained to be helpful. It will do adjacent useful things unless blocked.

### 4. Match freedom to task fragility

| Task | Freedom | How to prompt |
|---|---|---|
| DB migration, RPC | **Low** | Provide exact SQL. "Run exactly this, no modifications." |
| Type definitions | **Medium** | Provide interface shape, let Claude fill fields. |
| UI component | **High** | Describe behaviour. Let Claude choose implementation. |

Source: Anthropic skill authoring docs (verified Feb 2026).
Wrong: giving high freedom to a migration. Wrong: giving low freedom to a UI component.

### 5. Schema first. TypeScript after schema is confirmed.
```
Migration only. Do NOT generate TypeScript. 
After migration is done, I will confirm, then we do TypeScript.
```
**Observed failure:** TypeScript generated from stale schema across 3 Flonest sessions.
Painful to unwind.

### 6. Require idempotency on all SQL
```
Idempotent: IF NOT EXISTS everywhere.
DROP POLICY IF EXISTS before CREATE POLICY.
```
**Observed failure:** 18/65 Flonest migrations were fix-migrations from non-idempotent originals.
That's 28% rework from one missing requirement.

### 7. If corrected more than twice → /clear and restart
Verified community pattern (morphllm.com, 2026):
"A clean session with a better prompt almost always outperforms a long session with accumulated corrections."
Re-anchor with the files you need, fix the original prompt, start clean.

### 8. Verify before done
```
Run tsc --noEmit and confirm zero type errors before marking complete.
```
Or for SQL:
```
Confirm the migration file is valid SQL before committing.
```

---

## CLAUDE.md — structure rules (verified)

- **Hard limit: ~150 lines.** Beyond this, rules get lost. Ruthlessly prune.
- **Delete rules Claude follows without prompting** — they waste tokens.
- **Move detailed guidance to `/rules/*.md`** — modular, path-scoped rules system.
- **Move knowledge to `memory/` files** — reference them from CLAUDE.md, don't inline.

```
# CLAUDE.md — keep this ≤150 lines
## Critical
- Read memory/DECISIONS.md before any DB change
- Read memory/CONTEXT.md at session start

## Rules
See .claude/rules/ for topic-specific rules.
```

---

## Skill description — how to write it (source: Anthropic docs)

- Write in **third person** — injected into system prompt. Inconsistent POV breaks discovery.
- Be **pushy** — Claude undertriggers skills. Say "ALWAYS use when", not "use when".
- Include **trigger phrases** — Claude uses these for selection, no classifier, pure LLM reasoning.
- Max 1024 characters.
- Name must be **gerund form**: `writing-agent-prompts`, not `agent-prompt-writer`.

**Bad (passive):**
> "Patterns for writing prompts for Claude Code"

**Good (pushy):**
> "ALWAYS use this skill when writing a task for Claude Code, crafting an agent instruction,
> or debugging why Claude drifted. Trigger on: 'prompt for claude', 'tell claude to', 'how do I ask claude'."

---

## Failure modes — reference table

| Symptom | Root cause | Fix |
|---|---|---|
| Wrong files edited | No anchor step | "Read X before writing anything" |
| Duplicate code | Two tasks in one prompt | Split, explicit sequence |
| Types don't match schema | TypeScript before schema confirmed | Schema → verify → types |
| Migration not idempotent | Not instructed | Explicit idempotency requirement |
| RPC overwritten not extended | "Update" is ambiguous | "Extend, do not replace" |
| Context lost mid-session | Auto-compaction | Re-anchor: "re-read memory/CONTEXT.md" |
| Adjacent helpful edits | No DO NOT list | Explicitly block adjacent actions |
| Skill never invokes | Passive description | Rewrite description as pushy, add slash command alias |
| Session degrades after corrections | Polluted context | /clear, fix the prompt, restart |

---

## For reference: `!command` and `context: fork` patterns

Read `references/advanced-patterns.md` when you need:
- Dynamic context injection (`!command`) into skills
- Subagent skills (`context: fork`)
- Multi-agent orchestration patterns
- `ultrathink` placement for extended thinking tasks
