---
name: codex-mcp
description: >
  Connect Codex CLI as an MCP server — giving you codex_execute, codex_resume,
  codex_search, codex_review, codex_debug, and codex_test as native tool calls
  instead of black-box bash commands. Each tool bakes in task-specific
  instructions so Codex performs well per task type. Use this skill whenever
  the user mentions: "set up codex MCP", "connect codex to claude",
  "codex MCP server", "install codex tools", "configure codex integration",
  or wants Codex available as native tools in Claude Code.
---

## Your role when these tools are available

If the codex MCP tools are available, delegate ALL work through them. Do not read files, search code, or run commands yourself. Pick the right tool for the task:

| You do | Codex does (via MCP tools) |
|--------|---------------------------|
| Plan what to do next | `codex_search` — read and explore the codebase |
| Craft the prompt for each turn | `codex_execute` — write, edit, and execute code |
| Pick the right tool for the task | `codex_debug` — investigate and fix bugs |
| Report results to user | `codex_test` — write and run tests |
| Decide when to resume vs start fresh | `codex_review` — independent code review |

**Incremental prompting:** don't dump everything into one call. Send focused turns, use each response to craft the next prompt. Use `codex_resume` when the next task builds on the last.

**Review pattern:** after `codex_execute` changes code, use `codex_review` in a fresh thread with the original requirement — Codex evaluates independently without self-review bias.

If the tools are NOT available, run the setup below.

## What this does

Six MCP tools wrapping Codex app-server. Each tool bakes in a role prefix — instructions that guide Codex's behavior for that task type, so quality stays consistent even after many turns.

| Tool | Thread | When to use |
|------|--------|-------------|
| `codex_execute` | new | General purpose — write code, run commands, create files |
| `codex_resume` | same | Follow up on previous turn — Codex remembers context |
| `codex_search` | new | Read/explore codebase — never modifies files |
| `codex_review` | new | Independent code review — fresh thread, no self-bias |
| `codex_debug` | new | Reproduce → diagnose → fix → verify |
| `codex_test` | new | Write or run tests, report pass/fail |

Zero external dependencies. Manages app-server lifecycle, thread state, model discovery, approval handling, and timeout transparently.

## Setup (run this automatically when skill triggers)

When this skill triggers, run these steps. The user only needs to restart Claude Code at the end.

### 1. Check prerequisites

```bash
which codex || echo "MISSING"
grep '^model' ~/.codex/config.toml 2>/dev/null || echo "MISSING"
```

If codex is missing: `npm install -g @openai/codex`
If config is missing: tell the user to run `codex` once interactively to complete setup, then come back.

### 2. Resolve the script path

The MCP server script is at `scripts/codex-mcp-server.mjs` inside this skill directory. Resolve the absolute path:

```bash
realpath <skill-dir>/scripts/codex-mcp-server.mjs
```

This skill is typically symlinked at `.claude/skills/codex-mcp` in the project root.

### 3. Write the MCP config

Check if `.mcp.json` exists in the project root. If it does, merge the codex entry. If not, create it.

```json
{
  "mcpServers": {
    "codex": {
      "command": "node",
      "args": ["<resolved-absolute-path>/codex-mcp-server.mjs"]
    }
  }
}
```

Use the absolute path from step 2. Relative paths will not work.

### 4. Tell the user to restart

Say: "Codex MCP is configured. Please restart this Claude Code session (close and reopen) to load the Codex tools. After restart, you'll have `codex_execute`, `codex_resume`, `codex_search`, `codex_review`, `codex_debug`, and `codex_test` available as native tools."

That's it. No other action needed from the user.

## Prompting Codex well

Every prompt should contain: **what to do** + **where** (file paths) + **expected outcome** + **constraints**. Pick the right tool — its baked-in role prefix handles the rest.

```
codex_search:  "List all exported functions in src/auth/ and their error handling patterns."
codex_execute: "Add null checks to all auth functions that access user.email."
codex_resume:  "Also add the same null checks to the functions in src/payment/."
codex_test:    "Write tests for the null-check cases in src/auth/. Cover: null, undefined, empty string."
codex_review:  "Read src/auth/. Requirement: every user.email access has a null check. List any gaps."
codex_debug:   "Login fails with TypeError on line 42 of src/auth.ts when email is null. Fix it."
```

## On failure

If `codex_execute` fails or times out:
1. Retry once with a simpler, more focused prompt (break the task down)
2. If it fails again, **do not fall back to direct execution** — that defeats context hygiene
3. Tell the user what failed and why, so they can decide next steps

Never silently switch to reading files or running commands yourself. The user chose MCP delegation for a reason.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Codex CLI not found" | `npm install -g @openai/codex` |
| Tools don't appear in Claude Code | Check `.mcp.json` path is absolute. Restart session. |
| Timeout errors | Increase `timeout` parameter. Break large tasks into smaller prompts. |
| "app-server exited" | Check `~/.codex/config.toml` has a valid model. Run `codex` once interactively to verify. |
| bwrap/sandbox errors | Expected in containers. The server uses `danger-full-access` sandbox mode by default. |
| Thread state lost | The MCP server keeps state in memory. If Claude Code restarts, threads reset. Use `codex_execute` to start fresh. |

## Architecture

```
Claude Code
  └─ MCP protocol (stdio)
      └─ codex-mcp-server.mjs (this script)
          └─ Codex app-server (JSON-RPC over stdio)
              └─ GPT model (reads, writes, executes)
```

The MCP server spawns one app-server process per project directory and keeps it alive across tool calls. Thread state is maintained in memory for `codex_resume` continuity. On shutdown (SIGINT/SIGTERM), all app-server processes are cleaned up.
