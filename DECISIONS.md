# Decisions

## ADR-001: Skill format is folder + SKILL.md with YAML frontmatter
**Status:** active
**Decision:** Every skill lives in `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`) and optional `references/` subdirectory.
**Why:** This is the format consumed by `npx skills add` and all supported agents (Amp, Cline, Codex, Cursor, Gemini CLI, etc.). Standardizing on it means zero adapter code.
**Do not:** Store skills as loose `.md` files outside their own directory.
**Failure mode:** `npx skills add` won't discover the skill; agents won't load it.

## ADR-002: .skill files are zip archives for distribution
**Status:** active
**Decision:** Skills are packaged as `.skill` zip archives (each containing the folder structure) for transfer, then extracted into `skills/`.
**Why:** Single-file distribution that preserves directory structure including `references/`. Unzip directly into `skills/` and it's ready.
**Do not:** Commit `.skill` zip files to the repo — only the extracted folders.
**Failure mode:** Repo bloat; zip and extracted content duplicated.

## ADR-003: project-memory skill installed via symlink at project scope
**Status:** active
**Decision:** `project-memory` installed via symlink to the skills repo, scoped to this project, available to all 8 agents.
**Why:** Symlink keeps a single source of truth in the repo; project scope means it doesn't pollute global agent config.
**Do not:** Copy the skill files — always symlink so updates propagate.
**Failure mode:** Stale skill copy diverges from repo version.

## ADR-004: Skills contain delta knowledge only — not general concepts
**Status:** active
**Decision:** Skills teach only what a 2024-trained model doesn't know. General concepts (streaming, embeddings, FC basics) are omitted.
**Why:** Skills are context-window budget. Repeating known knowledge wastes tokens and dilutes the new information that actually matters. A skill is a patch, not a manual.
**Do not:** Include tutorials for concepts the model already knows (e.g., "what is streaming", "how does function calling work").
**Failure mode:** Skill bloats to 1000+ lines, exceeding the 500-line SKILL.md limit and burying critical delta knowledge in noise.

