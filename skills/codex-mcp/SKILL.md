---
name: codex-mcp
description: >
  Connect Codex CLI as an MCP server — giving you codex_run and codex_review
  as native tool calls instead of black-box bash commands. codex_run covers
  six modes: explore (broad codebase discovery), inspect (targeted read-only
  and injected-context follow-up), build (write/edit code), debug
  (reproduce→diagnose→fix→verify), test (write/run tests), research (web
  search only). codex_review runs independent code review in an isolated
  thread. Each mode bakes in task-specific instructions so Codex performs well
  per task type. Use this skill whenever the user mentions: "set up codex MCP",
  "connect codex to claude", "codex MCP server", "install codex tools",
  "configure codex integration", or wants Codex available as native tools in
  any agent. Distributed via `npx skills add` — no global install needed.
---

## Your role when these tools are available

If the codex MCP tools are available, delegate ALL work through them. Do not
read files, search code, or run commands yourself. Pick the right mode for
the task:

| You do | Codex does (via MCP tools) |
|--------|---------------------------|
| Plan what to do next | `codex_run(mode=explore)` — read and navigate codebase |
| Handle a targeted read-only follow-up | `codex_run(mode=inspect)` — inspect files, config, or injected context without writing |
| Craft the prompt for each turn | `codex_run(mode=build)` — write, edit, and execute code |
| Route to the right thread | `codex_run(mode=debug)` — reproduce → diagnose → fix → verify |
| Report results to user | `codex_run(mode=test)` — write and run tests |
| Decide when to resume vs start fresh | `codex_review` — independent code review |

**Incremental prompting:** don't dump everything into one call. Send focused
turns, use each response to craft the next prompt. Pass `thread_id` to
continue a previous run with full context.

**Review pattern:** after `codex_run(mode=build)` changes code, use
`codex_review` in a fresh thread with the original requirement — Codex
evaluates independently without self-review bias.

If the tools are NOT available, run the setup below.

## Non-Negotiable Workflow

When this skill is invoked, follow this contract strictly:

1. Do not proceed with the user's actual task through direct local work.
2. First check whether `codex_run` / `codex_review` are already available.
3. If the tools are missing, do only the setup workflow in this skill.
4. During setup, do read-only detection first and stop for explicit user
   permission before any install, copy, config write, or `.gitignore` edit.
5. If the user does not approve setup changes, stop. Do not bypass MCP by
   reading files, editing code, or running the task directly yourself.
6. Configure only the invoking agent by default. Do not modify other agent
   configs unless the user explicitly asks for multi-agent setup.
7. After setup, tell the user to restart the agent session and wait for the
   restarted session to use the MCP tools. Do not continue the original task
   in the same non-MCP turn.

## What this does

Two MCP tools wrapping Codex app-server. Each call bakes in a role prefix —
instructions that guide Codex's behavior for that task type, so quality stays
consistent even after many turns.

| Tool | Modes | Thread | When to use |
|------|-------|--------|-------------|
| `codex_run` | explore | new or resume | Read/navigate codebase — never modifies files |
| `codex_run` | inspect | new or resume | Targeted read-only checks on files, config, or injected context |
| `codex_run` | build | new or resume | Write, edit, create, and run code |
| `codex_run` | debug | new or resume | Reproduce → diagnose → fix → verify a bug |
| `codex_run` | test | new or resume | Write or run tests, report pass/fail |
| `codex_run` | research | new or resume | Web search only — no file writes |
| `codex_review` | — | isolated | Independent code review — fresh thread, no self-bias |

Pass `thread_id` to `codex_run` to resume an existing run thread. Omit to
start fresh. `codex_review` threads are namespace-isolated — never pass a
review `thread_id` to `codex_run` or vice versa (the server enforces this
with a hard error).

Use `explore` for broad discovery and mapping. Use `inspect` for narrow
read-only checks, especially when the turn is driven by injected context or a
specific config/file target.

Zero external dependencies. Manages app-server lifecycle, thread state, model
discovery, approval handling, and timeout transparently.

## Setup (run this automatically when skill triggers)

`npx skills add` already places the server script at a stable project path:
`.agents/skills/codex-mcp/scripts/codex-mcp-server.mjs` (symlinked into
`.claude/skills/`). No global copy is needed. Setup just wires the MCP entry.

See `references/setup.md` for per-agent config snippets and Windows commands.

Follow these steps in order:

1. **Read-only preflight** — gather facts without writing anything:
   - Resolve the absolute path to `.agents/skills/codex-mcp/scripts/codex-mcp-server.mjs`
   - Check `codex` CLI is installed
   - Check `.codex/config.toml` has a `model` line
   - **Config-drift check**: read the `args` value for `codex-mcp` in the
     active agent config and compare it to the resolved project-local path above.
     If they differ (e.g. a stale global path is still registered), flag this as
     a required fix — the config must be updated before setup is considered done.
   - Identify which agent is invoking this skill
2. **Present findings and wait** — report what exists, what's missing, what you
   intend to write. Stop and wait for explicit user approval before any writes.
3. **Configure the invoking agent only** — add the MCP entry pointing to the
   resolved absolute path of the project-local script. Use resolved absolute
   paths in config values (never `~` or `$HOME`). Do not copy the script
   elsewhere.
4. **Add `memory/codex-threads.json` to project `.gitignore`** — per project.
5. **Tell the user to restart** — do not continue the original task in the same
   session unless MCP tools are already loaded.
6. **Post-restart health probe** — in the new session, make one lightweight
   `codex_run(mode=inspect, prompt="echo ok")` call before starting real work.
   If this returns `Transport closed` or fails, setup is **not done** — go to
   the "On failure" section. Do not treat tool visibility alone as proof of a
   healthy transport.

## Thread registry

The server tracks threads in `memory/codex-threads.json` — mapping thread IDs
to topics so the agent routes to the right thread by topic, not by recency.
Threads persist across server restarts via `thread/resume`.

See `references/thread-registry.md` for the full schema, maintenance rules
(when to add/update/close rows), and the routing decision tree (how to pick
the right `thread_id` before each call).

## Prompting Codex well

Every prompt should contain: **what to do** + **where** (file paths) +
**expected outcome** + **constraints**. Pick the right mode — its baked-in
role prefix handles the rest.

```
codex_run(explore): "List all exported functions in src/auth/ and their error handling patterns."
codex_run(inspect): "Use the injected `pwd` output and report the exact project root. Do not modify any files."
codex_run(build):   "Add null checks to all auth functions that access user.email."
codex_run(build, thread_id=T1): "Also add the same null checks in src/payment/."
codex_run(test):    "Write tests for the null-check cases in src/auth/. Cover: null, undefined, empty string."
codex_review:       "Read src/auth/. Requirement: every user.email access has a null check. List any gaps."
codex_run(debug):   "Login fails with TypeError on line 42 of src/auth.ts when email is null. Fix it."
```

## On failure

**Tools visible but transport immediately closed** — if the MCP tools appear in
the agent but the very first `codex_run` call (or the follow-up status ping)
returns `Transport closed`:
1. Do not retry blindly. The transport is dead, not slow.
2. Check for config-path drift: does the registered `args` path in the
   **invoking agent's** config (not just `~/.codex/config.toml`) match the
   actual project-local script path? A stale global path is the most common
   cause after a skills update. Fix the config and restart.
3. If the path is correct, verify the wrapper and app-server independently:
   - **Windows**: see `references/troubleshooting-windows.md` for PowerShell
     commands and diagnosis sequence.
   - **Unix / macOS**: run the wrapper directly
     (`node "$(realpath .agents/skills/codex-mcp/scripts/codex-mcp-server.mjs)"`);
     then run `codex app-server` standalone. If both start cleanly, inspect
     stderr from the wrapper's `spawn()` call.
4. Tell the user exactly which step failed and what to check next.

**General failure or timeout:**
1. Run a follow-up task to check status (ping "status" to see if it's still running)
2. If it fails again, **do not fall back to direct execution** — that defeats
   context hygiene
3. Tell the user what failed and why, so they can decide next steps

Never silently switch to reading files or running commands yourself. The user
chose MCP delegation for a reason, and invoking this skill means the agent
must stay inside this workflow.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Codex CLI not found" | `npm install -g @openai/codex` |
| Tools don't appear in agent | Check config path is absolute. Restart agent session. |
| Wrong project used for `memory/` | Always pass `project_dir` explicitly in tool calls. Do not rely on `process.cwd()`. |
| Timeout errors | Increase `timeout` parameter. Break large tasks into smaller prompts. |
| "app-server exited" | Check `.codex/config.toml` has a valid model. If needed, run `codex` once interactively to verify the CLI itself works, but do not assume interactive setup is the only valid fix. |
| `Transport closed` (any platform) | Check config-path drift first (most common cause). Then see `references/troubleshooting-windows.md` (Windows) or run wrapper + app-server standalone (Unix). |
| bwrap/sandbox errors | Expected in containers. The server uses `danger-full-access` sandbox mode by default. |
| Thread state lost after restart | Expected — server state is in-memory. Registry staleness check (Step 0) handles this automatically. |
| Wrong thread routed | Check `memory/codex-threads.json`. Topics are human-readable — correct a wrong entry manually. |
| Cross-namespace thread_id error | You passed a review thread_id to codex_run or vice versa. Check registry status column. |

## Architecture

```
Agent (Claude Code / Gemini CLI / Cursor / Codex CLI / Antigravity / Augment)
  └─ MCP protocol (stdio)
      └─ codex-mcp-server.mjs  (.agents/skills/codex-mcp/scripts/)
          ├─ runServers map    (per projectDir, codex_run threads)
          ├─ reviewServers map (per projectDir, codex_review threads, isolated)
          └─ Codex app-server (JSON-RPC over stdio)
              └─ GPT model (reads, writes, executes)

<project-root>/memory/codex-threads.json
  └─ thread registry (topic-based routing, managed by the orchestrating agent)
     created automatically on first tool call, isolated per project
```

The MCP server spawns one app-server process per namespace per project
directory and keeps it alive across tool calls. Thread state is maintained in
memory — registry in `memory/codex-threads.json` maps thread IDs to topics so
routing survives context growth. On shutdown (SIGINT/SIGTERM), all app-server
processes are cleaned up.
