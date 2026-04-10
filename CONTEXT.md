# Context
**Updated:** 2026-04-10

## Current Layer
Skills repo — Source directory renamed from `skills/` to `skills-lab/` to separate source from install artifacts.

## Last Completed
- Renamed `skills/` → `skills-lab/` to prevent `npx skills remove` from detecting source files as installed skills.
- Unified agent config: `AGENT.md` is source of truth, `CLAUDE.md` and `GEMINI.md` are relative symlinks to it.
- Added `skill-creator-lean` as the primary skill development tool (replacing legacy `skill-creator`).
- Removed all previously installed skills, reinstalled only `codex-mcp` and `skill-creator-lean`.
- Added behavioral rules to `~/.gemini/GEMINI.md`: file-reading iron law and experiment-over-speculation iron law.

## Active Blocker
None.

## Next Action
- Update DECISIONS.md with ADRs for skills-lab rename and AGENT.md unification.
- Update STACK.md with new do-not pattern for source directory conventions.

## Deferred
- Windows CI or fixture-based regression for `.cmd` shim launch path.
- Decide if multi-agent / Fast defaults should also live in repo `.codex/config.toml`.
- Potentially investigate whether `thread/compact` can be surfaced cleanly as an explicit tool or left out.
