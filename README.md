# skills

Agent Skills library — self-contained instruction sets for AI coding agents.

Each skill is a folder under `skills/` with a `SKILL.md` (YAML frontmatter + markdown
instructions) and optional `references/` for domain knowledge loaded on demand.

---

## Install

```bash
npx skills add krishamaze/skills
```

Select the skills you need during the interactive prompt. Supports symlink and copy modes,
project or global scope, and 40+ agents including Claude Code, Cursor, Copilot, and Codex.

---

## Adding a skill

1. Create `skills/your-skill-name/SKILL.md`:

```yaml
---
name: your-skill-name
description: >
  What this skill does and when to activate it.
---

# Instructions here...
```

2. Add `references/` files for supplementary domain knowledge
3. Push — anyone installs with `npx skills add krishamaze/skills`

---

## License

MIT
