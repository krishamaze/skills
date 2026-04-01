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
  any agent. Install globally once — works across all projects and all agents.
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

**Always pass `project_dir`:** the server is installed globally and uses
`process.cwd()` as fallback, which may not be the project root depending on
how the agent spawns it. Always pass `project_dir` explicitly:
```
codex_run(mode=explore, project_dir="/absolute/path/to/project", prompt="...")
```

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

The server installs globally once per machine — all agents and all projects
share the same installation. `memory/` is created per-project on first tool call.

See `references/setup.md` for platform-specific commands and per-agent config
snippets. Prefer agent CLIs (`claude mcp add`, `codex mcp add`, `gemini mcp add`)
over manual config edits when available.

Follow these steps in order:

1. **Read-only preflight** — gather facts without writing anything: whether the
   global script exists at `~/.local/share/codex-mcp/scripts/codex-mcp-server.mjs`
   (Unix) or `%USERPROFILE%\.local\share\codex-mcp\scripts\` (Windows), whether
   `codex` CLI is installed, whether `.codex/config.toml` has a `model` line,
   which agent is invoking this skill, and any existing configured server path.
   Do not configure every detected agent as a fallback — infer the invoking
   agent or ask.
2. **Present findings and wait** — report what exists, what's missing, what you
   intend to write, which agent config you'll touch. Stop and wait for explicit
   user approval before any writes.
3. **Configure the invoking agent only** — deploy the wrapper script to the
   global path, then register it with the invoking agent's MCP config using
   resolved absolute paths (never `~` or `$HOME` in config values). If an
   existing configured path mismatches a source wrapper path under `.agent`,
   `.agents`, or `.claude`, update the installed server to the source version.
4. **Add `memory/codex-threads.json` to project `.gitignore`** — per project,
   not per machine.
5. **Tell the user to restart** — do not continue the original task in the same
   session unless MCP tools are already loaded.

## Thread registry

The MCP wrapper keeps a local registry in `memory/codex-threads.json` so
the orchestrating agent can route calls to the right thread by topic, not by
recency. Persisted thread ids are resumable across MCP server restarts because
the wrapper reloads them with Codex `thread/resume`.

### Schema

```json
{
  "session": "2026-03-28T22:00:00Z",
  "threads": [
    {
      "thread_id": "T1",
      "tool": "codex_run",
      "mode": "explore",
      "topic": "auth/map",
      "status": "active",
      "created_at": "2026-03-28T22:01:00Z"
    },
    {
      "thread_id": "R1",
      "tool": "codex_review",
      "mode": null,
      "topic": "auth/2FA-check",
      "status": "review",
      "created_at": "2026-03-28T22:15:00Z"
    }
  ]
}
```

**`topic` format:** `{module}/{action}` — short, scannable. Examples:
`auth/map`, `auth/2FA-build`, `payment/debug-timeout`.

**`status` values:**
- `active` — eligible for routing to `codex_run`
- `review` — `codex_review` follow-ups only, never routed to `codex_run`
- `done` — task complete, skip in routing, keep for reference

**`session`:** ISO timestamp last written by the wrapper when it touched the
registry. Useful for debugging, but not a reason by itself to expire threads.

### Maintenance rules

Run these after every tool call:

**After `codex_run` with no `thread_id`** (new thread started):
→ ADD row: derive topic from prompt, status=`active`

**After `codex_run` with `thread_id`** (resumed existing thread):
→ UPDATE row: refresh topic if task scope changed, otherwise leave

**After `codex_review` with no `thread_id`** (new review):
→ ADD row: derive topic from prompt, status=`review`

**After `codex_review` with `thread_id`** (follow-up on existing review):
→ No new row. No update needed.

**When a task is complete** (tests pass, feature shipped, bug confirmed fixed):
→ Mark thread status=`done`. Do not delete — keeps history visible.

### Routing decision tree

Run this before every `codex_run` call:

**Step 0 — Scan active threads.**  
Filter registry to `status=active` only.

For targeted read-only follow-ups driven by injected context or one narrow
file/config question, prefer `inspect` over `explore`.

**Case 1 — Single topic match.**  
Task scope overlaps exactly one active thread by module.
→ Pass that `thread_id`. Not the most recent one. The matching one.

Key sub-case: `explore → build` on the same module. The explore thread has
the map — the build task needs it. Match on module, not on mode.

```
Registry:  T1  explore  auth/map   active
Next task: "add 2FA to auth module"
→ module match: T1 → pass thread_id=T1
```

**Case 2 — No match.**  
Task is genuinely new, no active thread covers it.
→ Omit `thread_id`. After the call, add new row to registry.

**Case 3 — Multi-thread span.**  
Task touches multiple active threads (e.g. integrate auth into payment).
→ Omit `thread_id` (fresh thread). Synthesize findings from both threads
explicitly in the prompt — the orchestrating agent already has prior outputs
in context:

```
codex_run(mode=build, project_dir="/abs/path/to/project", prompt="""
From auth exploration (T1): [key findings]
From payment exploration (T2): [key findings]

Task: integrate auth tokens into payment flow...
""")
```

**Review follow-ups are separate.**  
`review` status threads never appear in routing. To follow up on a review,
pass the review `thread_id` to `codex_review` directly. Do not route through
the decision tree.

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

If `codex_run` fails or times out:
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
| `Transport closed` on Windows | See `references/troubleshooting-windows.md` — verify wrapper and app-server independently. |
| bwrap/sandbox errors | Expected in containers. The server uses `danger-full-access` sandbox mode by default. |
| Thread state lost after restart | Expected — server state is in-memory. Registry staleness check (Step 0) handles this automatically. |
| Wrong thread routed | Check `memory/codex-threads.json`. Topics are human-readable — correct a wrong entry manually. |
| Cross-namespace thread_id error | You passed a review thread_id to codex_run or vice versa. Check registry status column. |

## Architecture

```
Agent (Claude Code / Gemini CLI / Cursor / Codex CLI / Antigravity / Augment)
  └─ MCP protocol (stdio)
      └─ codex-mcp-server.mjs  (~/.local/share/codex-mcp/scripts/)
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
