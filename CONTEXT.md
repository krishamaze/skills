# Context
**Updated:** 2026-04-02

## Current Layer
Skills repo — `codex-mcp` code review isolation implemented and project-memory loading fix deployed. Status: ready to test locally or commit.

## Last Completed
- Unbiased code review performed and saved to `review_codex_mcp_server.md`.
- Implemented native `review/start` protocol (ADR-015): Replaced separate process pool (`reviewServers`) with detached internal delivery inside single `runServers` pool.
- Included structured review targeting via `uncommitted_changes`, `base_branch`, `commit`, and `custom` to `REVIEW_SCHEMA`.
- Fixed bug in Rate Limiter regexp matching inside output.
- Shortened `project-memory` SKILL.md description below 1024 characters to prevent startup loading warnings.

## Active Blocker
None.

## Next Action
Commit these final workflow changes and optimizations.

## Deferred
- Windows CI or fixture-based regression for `.cmd` shim launch path.
- Decide if multi-agent / Fast defaults should also live in repo `.codex/config.toml`.
