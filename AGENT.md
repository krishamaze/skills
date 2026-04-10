# Agent Configuration

This file provides guidance to AI coding agents when working with code in this repository.
Symlinked as `CLAUDE.md` and `GEMINI.md` so all agents share a single source of truth.

## What this repo is

A library of **Agent Skills** — self-contained instruction sets (SKILL.md + optional resources) consumed by AI coding agents via `npx skills add krishamaze/skills`. Skills tell agents *how* to do specialized tasks; they are not runnable code themselves.

## Skill structure

Every skill lives at `skills-lab/<name>/SKILL.md` with YAML frontmatter and optional subdirectories:

```
skills-lab/<name>/
├── SKILL.md          # required: YAML frontmatter (name, description) + instructions
└── references/       # optional: domain docs loaded on demand
└── scripts/          # optional: reusable helper scripts
└── assets/           # optional: templates, icons, etc.
```

**Progressive disclosure loading:**
1. `name` + `description` — always in agent context (~100 words)
2. `SKILL.md` body — loaded when skill triggers (<500 lines ideal)
3. `references/` files — loaded on demand (unlimited)

## Source vs install directories

- **`skills-lab/<name>/`** is the **editable source of truth** — all development and fine-tuning happens here
- **`.claude/skills/`** and **`.agents/skills/`** are **install artifacts** managed by `npx skills add` — never edit these directly
- Workflow: edit source → commit → push to remote → consumers run `npx skills add krishamaze/skills` to install or update
- The source directory is named `skills-lab/` (not `skills/`) so that `npx skills remove` does not detect source files as installed skills when working inside this repo (see ADR-018)

## Adding or modifying skills

- **SKILL.md body under 500 lines** — if approaching the limit, move deep content to `references/` and add clear pointers
- **Description is the trigger** — the `description` frontmatter field is what the agent uses to decide whether to invoke the skill; it must say *when* to use it as well as *what* it does. Lean toward "pushy" descriptions to avoid undertriggering.
- **Do not store skills as loose `.md` files** — they must be in their own named directory or `npx skills add` won't discover them
- **`.skill` archives are zip files for distribution** — extract into `skills-lab/` and commit the folder; never commit the `.skill` zip itself (see ADR-002)
  - When extracting: verify no stray top-level files before committing (see STACK.md for the `fastapi-2026` incident)

## skill-creator workflow (for creating/improving skills)

The `skills-lab/skill-creator-lean/` skill is the primary tool for skill development. Key scripts under `skills-lab/skill-creator-lean/scripts/`:

| Script | Purpose |
|--------|---------|
| `package_skill.py <skill-folder>` | Zip a skill into a `.skill` archive |
| `run_loop.py` | Description optimization loop (uses `claude -p`) |
| `aggregate_benchmark.py <workspace/iteration-N>` | Aggregate grading results → `benchmark.json` |
| `generate_report.py` | Launch the eval viewer in the browser |

Eval workspaces go in `<skill-name>-workspace/` as a sibling to the skill directory, organized by `iteration-<N>/eval-<name>/with_skill|without_skill|old_skill`.

## Stack constraints (from STACK.md)

| Area | Use | Never use |
|------|-----|-----------|
| Gemini SDK | `from google import genai` / `pip install google-genai` | `import google.generativeai` / `google-generativeai` |
| Python env | `uv` | pip, venv, pyenv directly |
| Next.js | App Router (15+/16+) | Pages Router |
| Stealth browser | `camoufox` (>=0.4.0) | raw Playwright |
| Fast APIs | FastAPI | Flask/Django |

## Project memory (DECISIONS.md / CONTEXT.md / STACK.md)

This repo uses three living documents at project root. See `skills-lab/project-memory/SKILL.md` for the full protocol.

- **DECISIONS.md** — append-only ADRs. Never edit existing entries.
- **CONTEXT.md** — current state, overwritten each update. Read this first on session start.
- **STACK.md** — locked versions + do-not patterns. Append-only.

## Key decisions (from DECISIONS.md)

- **ADR-003**: `project-memory` is installed via **symlink** (not copy) at project scope — always symlink when updating it so changes propagate
- **ADR-005**: API reference skills (e.g., `gemini-api-2026`) are **comprehensive and self-contained**, not delta-only — assume the consuming model may not know any specific SDK syntax or model IDs
- **ADR-012**: When `codex_run`/`codex_review` MCP tools are available, the agent is a **controller only** — it must not read files, write code, or run commands directly. All execution routes through Codex. See `skills-lab/codex-mcp/SKILL.md` for the full HARD-GATE and rationalization table.
- **ADR-018**: Source skills live in `skills-lab/` (not `skills/`) to separate source from install artifacts
- `skills-lock.json` tracks skills installed via `npx skills add` with their source and hash

## Installing skills (consumer-side)

```bash
npx skills add krishamaze/skills
```
