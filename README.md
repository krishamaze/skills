# skills

NexaraTech's Agent Skills library for Claude Code and compatible AI coding agents.

Each skill is a self-contained folder under `skills/` with a `SKILL.md` and supporting
reference files. Install all skills at once or reference individual skill folders directly.

---

## Install

```bash
npx skills add krishamaze/skills
```

Or install a specific skill folder manually by copying it to your skills directory:

| Agent | Path |
|---|---|
| Claude Code (global) | `~/.claude/skills/` |
| Claude Code (project) | `.claude/skills/` |

---

## Skills in this repo

| Skill | Description |
|---|---|
| [`vyapar-migration`](skills/vyapar-migration/) | Authoritative Vyapar SQLite schema knowledge — zero assumptions, APK-verified |

---

## What skills are

Skills are folders of instructions and reference files that an AI agent loads on demand.
They follow Anthropic's [Agent Skills open standard](https://agentskills.io) — the same
format works with Claude Code, OpenAI Codex CLI, Cursor, Windsurf, and others.

Each skill activates automatically when your prompt matches its `description` field.
Reference files inside `references/` are loaded progressively — only when needed —
so they don't bloat the context window.

---

## Adding your own skill

1. Create a folder under `skills/your-skill-name/`
2. Add `SKILL.md` with frontmatter:

```yaml
---
name: your-skill-name
description: >
  What this skill does and exactly when to activate it.
  Be specific — this is how the agent decides to load it.
---

# Your Skill Name

Instructions here...
```

3. Add `references/` files for domain knowledge the agent loads on demand
4. Push — anyone installs with `npx skills add krishamaze/skills`

---

## License

MIT
