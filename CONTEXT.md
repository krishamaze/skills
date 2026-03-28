# Context
**Updated:** 2026-03-28

## Current Layer
Skills repo — installed `skills/codex-mcp` promoted to the patched v2 interface and smoke-validated. Status: verified

## Last Completed
Copied the patched extracted [codex-mcp-v2](/home/ubuntu/projects/3_RESOURCES/skills/codex-mcp-v2) into [skills/codex-mcp](/home/ubuntu/projects/3_RESOURCES/skills/skills/codex-mcp) and revalidated the installed path with a live MCP smoke test: `initialize`, `tools/list`, fresh `codex_run(mode=inspect, context_cmd="pwd")`, fresh `codex_review`, server restart, resumed run thread, and resumed review thread all passed with no errors.

## Active Blocker
None.

## Next Action
If desired, commit the installed `skills/codex-mcp` v2 upgrade and decide whether to keep or remove the untracked extracted [codex-mcp-v2](/home/ubuntu/projects/3_RESOURCES/skills/codex-mcp-v2) reference copy.

## Deferred
- Decide whether to keep the untracked extracted [codex-mcp-v2](/home/ubuntu/projects/3_RESOURCES/skills/codex-mcp-v2) directory as a reference branch or remove it after commit.
- Decide later whether the same Fast and multi-agent defaults should also live in a repo `.codex/config.toml`, or remain wrapper-only.
- Deeper mode-specific checks for `debug`, `test`, and `research` on the installed v2 surface if broader confidence is needed.
