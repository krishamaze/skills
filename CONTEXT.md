# Context
**Updated:** 2026-04-03

## Current Layer
Skills repo — Explicit `Controller Mindset` rules added to `codex-mcp`.

## Last Completed
- Verified `codex-mcp` wrapper behavior and app-server source regarding state and compaction.
- Added explicit `Controller Mindset` and `Planning Context` to `codex-mcp/SKILL.md` to be "pushy".
- Rejected pushing `thread/compact` or `session-state.json` side-effects into the MCP wrapper to preserve stability.

## Active Blocker
None.

## Next Action
None. Await next user instruction.

## Deferred
- Windows CI or fixture-based regression for `.cmd` shim launch path.
- Decide if multi-agent / Fast defaults should also live in repo `.codex/config.toml`.
- Potentially investigate whether `thread/compact` can be surfaced cleanly as an explicit tool or left out.
