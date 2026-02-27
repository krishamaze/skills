# Advanced Claude Code Patterns
Source-verified: Feb 2026 from code.claude.com/docs/en/skills

---

## `!command` — Dynamic Context Injection

Syntax: `!`backtick`command`backtick`` in skill body.
The command runs BEFORE Claude sees the content. Claude receives rendered output.

```yaml
---
name: schema-aware-migration
description: Write a migration with full awareness of current schema state
---
## Current schema state
- Active migrations: !`ls supabase/migrations/ | tail -5`
- Last migration content: !`cat $(ls supabase/migrations/*.sql | tail -1)`

## Your task
Write the next migration for: $ARGUMENTS
```

Use this for: current file lists, latest migration, current env vars, git log.
Do NOT use for: secrets, credentials, anything that shouldn't be in context.

---

## `context: fork` — Subagent Execution

Skill content becomes the task. A subagent with scoped tools executes it.

```yaml
---
name: exploring-codebase
description: Deep read-only exploration of codebase for a given question
context: fork
agent: Explore
---
Research $ARGUMENTS thoroughly:
1. Find relevant files using Glob and Grep
2. Read and analyze
3. Return findings with file paths and line numbers
```

Agent types:
- `Explore` — read-only, Glob + Grep + Read
- `Task` — full tools, can write files
- `Plan` — generates a plan, no execution

---

## `ultrathink` — Extended Thinking Trigger

Place the word `ultrathink` anywhere in SKILL.md body.
Extended thinking activates for tasks using that skill.

Use for: DB schema design, RPC design, security policy decisions, migration planning.
Do NOT use for: simple CRUD, file renames, straightforward component writes.

```yaml
---
name: designing-rpc
description: Design a Supabase RPC with full security and concurrency analysis
---
ultrathink

Design the RPC for: $ARGUMENTS

Consider:
- Tenant isolation (org_id enforcement)
- Concurrency (SELECT ... FOR UPDATE where needed)
- Idempotency
- RLS bypass requirements (SECURITY DEFINER vs INVOKER)
```

---

## Slash Command Alias Pattern

Skills may not auto-invoke reliably. Add a slash command alongside the skill
for explicit invocation without typing the full skill name.

```
.claude/
  skills/
    writing-agent-prompts/
      SKILL.md
  commands/
    prompt.md    ← same content, invoked as /prompt
```

This is the pragmatic workaround until auto-invoke is reliable.

---

## `/rules/*.md` — Modular Rules (2026)

New system separate from CLAUDE.md. Path-scoped. Claude loads rules relevant to
the current working directory.

```
.claude/
  rules/
    supabase.md        # DB rules — loaded when working in supabase/
    typescript.md      # TS rules — loaded when editing .ts files
    migrations.md      # Applies only to supabase/migrations/**
```

Frontmatter for path scoping:
```yaml
---
applies-to: "supabase/migrations/**"
---
All migrations must be idempotent. IF NOT EXISTS everywhere.
```

Use this to get CLAUDE.md under 150 lines — move topic rules here.
