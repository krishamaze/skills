# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A library of **Agent Skills** — self-contained instruction sets (SKILL.md + optional resources) consumed by AI coding agents via `npx skills add krishamaze/skills`. Skills tell agents *how* to do specialized tasks; they are not runnable code themselves.

## Skill structure

Every skill lives at `skills/<name>/SKILL.md` with YAML frontmatter and optional subdirectories:

```
skills/<name>/
├── SKILL.md          # required: YAML frontmatter (name, description) + instructions
└── references/       # optional: domain docs loaded on demand
└── scripts/          # optional: reusable helper scripts
└── assets/           # optional: templates, icons, etc.
```

**Progressive disclosure loading:**
1. `name` + `description` — always in agent context (~100 words)
2. `SKILL.md` body — loaded when skill triggers (<500 lines ideal)
3. `references/` files — loaded on demand (unlimited)

## Adding or modifying skills

- **SKILL.md body under 500 lines** — if approaching the limit, move deep content to `references/` and add clear pointers
- **Description is the trigger** — the `description` frontmatter field is what the agent uses to decide whether to invoke the skill; it must say *when* to use it as well as *what* it does. Lean toward "pushy" descriptions to avoid undertriggering.
- **Do not store skills as loose `.md` files** — they must be in their own named directory or `npx skills add` won't discover them
- **`.skill` archives are zip files for distribution** — extract into `skills/` and commit the folder; never commit the `.skill` zip itself (see ADR-002)
  - When extracting: verify no stray top-level files before committing (see STACK.md for the `fastapi-2026` incident)

## skill-creator workflow (for creating/improving skills)

The `skills/skill-creator/` skill has a full eval loop. Key scripts under `skills/skill-creator/scripts/`:

| Script | Purpose |
|--------|---------|
| `package_skill.py <skill-folder>` | Zip a skill into a `.skill` archive |
| `run_loop.py` | Description optimization loop (uses `claude -p`) |
| `aggregate_benchmark.py <workspace/iteration-N>` | Aggregate grading results → `benchmark.json` |
| `generate_review.py` | Launch the eval viewer in the browser |

Eval workspaces go in `<skill-name>-workspace/` as a sibling to the skill directory, organized by `iteration-<N>/eval-<name>/with_skill|without_skill|old_skill`.

## Stack constraints (from STACK.md)

| Area | Use | Never use |
|------|-----|-----------|
| Gemini SDK | `from google import genai` / `pip install google-genai` | `import google.generativeai` / `google-generativeai` |
| Python env | `uv` | pip, venv, pyenv directly |
| Next.js | App Router (15+/16+) | Pages Router |
| Stealth browser | `camoufox` (>=0.4.0) | raw Playwright |
| Fast APIs | FastAPI | Flask/Django |

## Key decisions (from DECISIONS.md)

- **ADR-003**: `project-memory` is installed via **symlink** (not copy) at project scope — always symlink when updating it so changes propagate
- **ADR-005**: API reference skills (e.g., `gemini-api-2026`) are **comprehensive and self-contained**, not delta-only — assume the consuming model may not know any specific SDK syntax or model IDs
- `skills-lock.json` tracks skills installed via `npx skills add` with their source and hash

## Installing skills (consumer-side)

```bash
npx skills add krishamaze/skills
```
