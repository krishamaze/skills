# Context
**Updated:** 2026-03-28

## Current Layer
Skills repo — `codex-orchestrator` rewrite plus `codex-mcp` addition. Status: verified

## Last Completed
Stabilized `skills/codex-mcp/scripts/codex-mcp-server.mjs`, corrected the Tier 1 protocol reference, and cleaned local-only files out of the commit path.

## Active Blocker
None.

## Next Action
Run an end-to-end Claude Code restart check to confirm the MCP tools load from `.mcp.json` and behave correctly against a real project.

## Deferred
- Tighten `codex-orchestrator` and `codex-mcp` trigger descriptions after a few real prompt trials.
