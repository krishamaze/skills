# Context
**Updated:** 2026-03-28

## Current Layer
Skills repo — `skills/codex-mcp` strict invocation and permission-gated setup workflow. Status: verified

## Last Completed
Patched both the tracked [skills/codex-mcp](/home/ubuntu/projects/3_RESOURCES/skills/skills/codex-mcp) source and the live [`.agents/skills/codex-mcp`](/home/ubuntu/projects/3_RESOURCES/skills/.agents/skills/codex-mcp) copy so invocation now enforces a strict MCP-only workflow: read-only preflight first, explicit user approval before any install or config write, no direct task execution when tools are missing, and stop-after-restart guidance.

## Active Blocker
No live Windows reproduction in this Linux workspace, so the wrapper fix remains syntax-checked and source-level reasoned, not end-to-end Windows-validated.

## Next Action
If desired, run one real Windows MCP tool call against the patched wrapper, then commit the docs plus wrapper changes together as the stricter `codex-mcp` contract.

## Deferred
- Decide whether to add a Windows CI or fixture-based regression for the `codex.cmd` launch path instead of relying on manual validation.
- Decide later whether the same Fast and multi-agent defaults should also live in a repo `.codex/config.toml`, or remain wrapper-only.
- Deeper mode-specific checks for `debug`, `test`, and `research` on the installed v2 surface if broader confidence is needed.
