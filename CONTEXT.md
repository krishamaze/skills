# Context
**Updated:** 2026-03-28

## Current Layer
Skills repo — `skills/codex-mcp` strict invocation, current-agent-only setup, narrow gitignore rule, and repo-only source-of-truth editing. Status: verified

## Last Completed
Revised the tracked [skills/codex-mcp](/home/ubuntu/projects/3_RESOURCES/skills/skills/codex-mcp) source so future agents treat `skills/` as the only editable source of truth, configure only the invoking agent unless the user explicitly asks for more, and write only `memory/codex-threads.json` to `.gitignore`. Installed `.agents/skills/` copies are user-managed and should be refreshed via `npx skills add krishamaze/skills`, not edited directly by an agent.

## Active Blocker
No live Windows reproduction in this Linux workspace, so the wrapper fix remains syntax-checked and source-level reasoned, not end-to-end Windows-validated.

## Next Action
If desired, run one real Windows MCP tool call against the patched wrapper, then commit the docs plus wrapper changes together as the stricter current-agent-only `codex-mcp` contract. The user can refresh installed `.agents/skills/` state separately with `npx skills add krishamaze/skills`.

## Deferred
- Decide whether to add a Windows CI or fixture-based regression for the `codex.cmd` launch path instead of relying on manual validation.
- Decide later whether the same Fast and multi-agent defaults should also live in a repo `.codex/config.toml`, or remain wrapper-only.
- Deeper mode-specific checks for `debug`, `test`, and `research` on the installed v2 surface if broader confidence is needed.
