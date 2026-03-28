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
7. Treat `skills/` as the editable source of truth. Do not patch
   `.agents/skills/` install artifacts directly; the user refreshes those with
   `npx skills add krishamaze/skills`, which manages the install/symlink
   behavior.
8. After setup, tell the user to restart the agent session and wait for the
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

When this skill triggers, run these steps. The script is installed globally
once per machine — all agents and all projects share the same installation.
`memory/` is created per-project automatically on first tool call.

**Platform notes:**
- Unix-like examples below use `$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs`
- Windows uses `%USERPROFILE%\.local\share\codex-mcp\scripts\codex-mcp-server.mjs`
- Prefer the agent CLIs (`claude mcp add`, `codex mcp add`, `gemini mcp add`) over manual config edits when available. They pick the correct config file for the current platform more reliably than hard-coded paths.


### 0. Read-only preflight only

Before writing anything, gather all of the following facts read-only:
- whether the installed global script already exists
- whether the skill source script exists
- whether `codex` is installed
- whether `.codex/config.toml` exists and contains a `model = "..."` line
- which agent is invoking this skill right now
- which config file or CLI belongs to that invoking agent

Do not install, copy, edit, or append anything during this step.

Infer the invoking agent from the current runtime/context when possible. If
that identity is ambiguous, ask the user which client to configure. Do not
configure every detected agent as a fallback.

Check if already installed.

**Unix / macOS:**

```bash
ls "$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs" 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Windows PowerShell:**

```powershell
if (Test-Path "$env:USERPROFILE\.local\share\codex-mcp\scripts\codex-mcp-server.mjs") { "EXISTS" } else { "MISSING" }
```

If MISSING, check the skill source.

**Unix / macOS:**

```bash
ls <skill-dir>/scripts/codex-mcp-server.mjs 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Windows PowerShell:**

```powershell
if (Test-Path "<skill-dir>\scripts\codex-mcp-server.mjs") { "EXISTS" } else { "MISSING" }
```

If skill source is also MISSING, the user must provide `codex-mcp-server.mjs`.
Do not proceed until it exists.

### 1. Check prerequisites

**Unix / macOS:**

```bash
which codex || echo "MISSING"
grep '^model' ~/.codex/config.toml 2>/dev/null || echo "MISSING"
```

**Windows PowerShell:**

```powershell
$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) { $codex.Source } else { "MISSING" }
if (Select-String -Path "$env:USERPROFILE\.codex\config.toml" -Pattern '^\s*model\s*=' -ErrorAction SilentlyContinue) { "MODEL_PRESENT" } else { "MISSING" }
```

If codex is missing, the setup plan must include: `npm install -g @openai/codex`
If config is missing: do not assume the only fix is "run `codex` once
interactively". On Windows, `codex mcp add ...` may create
`%USERPROFILE%\.codex\config.toml` directly. The real requirement is:
before the first tool call, `.codex/config.toml` must exist and contain a
valid `model = "..."` line. Running `codex` interactively is one way to get
there, not the only way.

### 2. Present findings and wait for explicit permission

After preflight, report:
- what already exists
- what is missing
- which files or configs you intend to write
- which invoking-agent CLI/config you intend to touch

Then stop and ask for explicit user confirmation.

Do not:
- deploy the wrapper
- install Codex CLI
- run `claude mcp add`, `codex mcp add`, or `gemini mcp add`
- edit any config file
- append `memory/` to `.gitignore`

until the user explicitly approves.

### 3. Configure only the invoking agent (one-time per machine, only after approval)

The script is at `$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs`
on Unix-like systems and
`%USERPROFILE%\.local\share\codex-mcp\scripts\codex-mcp-server.mjs` on Windows.
Agent configs point to this stable path. Configure only the invoking agent.
Do not touch other agent configs unless the user explicitly asks for them.

Report findings, pause, confirm before writing. Example:

```
Invoking agent: Claude Code
  ✅ Claude Code   → configure via: claude mcp add --scope user
  ✅ Codex CLI     → configure via: ~/.codex/config.toml
  ✅ Gemini CLI    → configure via: gemini mcp add (user-global or project-local settings)
  ❌ Cursor        → not detected
  ✅ Antigravity   → configure via: ~/.gemini/antigravity/mcp_config.json
  ℹ️  Augment Code  → GUI only, show snippet

Proceed?
```

Wait for confirmation, then write only the approved invoking-agent config.
In all configs below, use the resolved absolute path — never `~` or `$HOME`
(shell variables don't expand inside JSON/TOML values).

If the installed wrapper script was missing during preflight, deploy it now.

**Unix / macOS:**

```bash
mkdir -p "$HOME/.local/share/codex-mcp/scripts"
cp <skill-dir>/scripts/codex-mcp-server.mjs "$HOME/.local/share/codex-mcp/scripts/"
echo "Installed: $HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs"
```

**Windows PowerShell:**

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.local\share\codex-mcp\scripts" | Out-Null
Copy-Item "<skill-dir>\scripts\codex-mcp-server.mjs" "$env:USERPROFILE\.local\share\codex-mcp\scripts\codex-mcp-server.mjs" -Force
Write-Output "Installed: $env:USERPROFILE\.local\share\codex-mcp\scripts\codex-mcp-server.mjs"
```

**Resolve path first. Unix / macOS:**
```bash
SCRIPT_PATH="$(realpath "$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs")"
echo "$SCRIPT_PATH"
```

**Windows PowerShell:**

```powershell
$SCRIPT_PATH = (Resolve-Path "$env:USERPROFILE\.local\share\codex-mcp\scripts\codex-mcp-server.mjs").Path
$SCRIPT_PATH
```

---

**Claude Code — user-scoped (available across all projects):**

Run this section only if the invoking agent is Claude Code.

```bash
claude mcp add codex-mcp --scope user -- node "$SCRIPT_PATH"
```

Or manually merge into `~/.claude.json` under `mcpServers`.

---

**Codex CLI — `~/.codex/config.toml`:**

Run this section only if the invoking agent is Codex CLI.

Merge this block (don't overwrite existing entries):

```toml
[mcp_servers.codex-mcp]
command = "node"
args = ["/resolved/absolute/path/to/codex-mcp-server.mjs"]
```

Or via CLI:

```bash
codex mcp add codex-mcp -- node "$SCRIPT_PATH"
```

---

**Gemini CLI — usually `~/.gemini/settings.json`, but some installs write project-local `.gemini/settings.json`:**

Run this section only if the invoking agent is Gemini CLI.

Prefer the CLI first:

```bash
gemini mcp add codex-mcp node "$SCRIPT_PATH"
```

Depending on Gemini CLI version and how it was invoked, that command may
update either:
- user-global `~/.gemini/settings.json`
- project-local `.gemini/settings.json`

If editing manually, update whichever settings file the CLI is already using
and merge `codex-mcp` into the `mcpServers` object:

```json
{
  "mcpServers": {
    "codex-mcp": {
      "command": "node",
      "args": ["/resolved/absolute/path/to/codex-mcp-server.mjs"]
    }
  }
}
```

> ⚠️ Do not use underscores in the server name (`codex-mcp` not `codex_mcp`).
> Gemini's policy parser splits FQNs on the first `_` after `mcp_` — underscores
> in the server name break wildcard rules silently.

Tools appear as `mcp_codex-mcp_codex_run` and `mcp_codex-mcp_codex_review`.

---

**Cursor — `~/.cursor/mcp.json`:**

Run this section only if the invoking agent is Cursor.

Merge `codex-mcp` into the `mcpServers` object:

```json
{
  "mcpServers": {
    "codex-mcp": {
      "command": "node",
      "args": ["/resolved/absolute/path/to/codex-mcp-server.mjs"]
    }
  }
}
```

---

**Antigravity — `~/.gemini/antigravity/mcp_config.json`:**

Run this section only if the invoking agent is Antigravity.

Merge `codex-mcp` into the `mcpServers` object:

```json
{
  "mcpServers": {
    "codex-mcp": {
      "command": "node",
      "args": ["/resolved/absolute/path/to/codex-mcp-server.mjs"]
    }
  }
}
```

Access via: MCP Store → "..." → Manage MCP Servers → View raw config.
After saving, the server connects automatically — no restart needed.

---

**Augment Code — GUI only:**

Run this section only if the invoking agent is Augment Code.

Settings Panel → MCP section → Import from JSON → paste:

```json
{
  "mcpServers": {
    "codex-mcp": {
      "command": "node",
      "args": ["/resolved/absolute/path/to/codex-mcp-server.mjs"]
    }
  }
}
```

### 4. Add only `memory/codex-threads.json` to project .gitignore (per project, not per machine, only after approval)

The server creates `memory/codex-threads.json` in the project root on the
first tool call. Run this in each project that uses this skill:

**Unix / macOS:**

```bash
grep -q '^memory/codex-threads\.json$' .gitignore 2>/dev/null || echo 'memory/codex-threads.json' >> .gitignore
```

**Windows PowerShell:**

```powershell
if (-not (Test-Path ".gitignore")) { New-Item -ItemType File ".gitignore" | Out-Null }
if (-not (Select-String -Path ".gitignore" -Pattern '^memory/codex-threads\.json$' -Quiet -ErrorAction SilentlyContinue)) { Add-Content ".gitignore" "memory/codex-threads.json" }
```

### 5. Tell the user to restart and stop there

Say: "Codex MCP is configured. Please restart your agent session to load
the Codex tools. After restart, you'll have `codex_run` and `codex_review`
available as native tools."

That's it. Do not continue the original task in the same session unless the
MCP tools are already available and loaded.

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
1. Retry once with a simpler, more focused prompt (break the task down)
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
| `Transport closed` on Windows | Run the wrapper directly with `node <installed-path>\\codex-mcp-server.mjs` and run `codex app-server ...` directly. If both start but the client still fails on `tools/call`, inspect wrapper stderr for the child-process launch details around `spawn(CODEX_BIN, ["app-server", ...])`. |
| bwrap/sandbox errors | Expected in containers. The server uses `danger-full-access` sandbox mode by default. |
| Thread state lost after restart | Expected — server state is in-memory. Registry staleness check (Step 0) handles this automatically. |
| Wrong thread routed | Check `memory/codex-threads.json`. Topics are human-readable — correct a wrong entry manually. |
| Cross-namespace thread_id error | You passed a review thread_id to codex_run or vice versa. Check registry status column. |

### Windows-first troubleshooting

Before concluding Windows config is wrong, verify the two processes separately:

1. Run the wrapper directly:
   `node C:\Users\<user>\.local\share\codex-mcp\scripts\codex-mcp-server.mjs`
2. Run Codex app-server directly:
   `codex app-server --enable multi_agent --enable fast_mode -c service_tier="fast" -c sandbox_mode="danger-full-access" -c approval_policy="never"`
3. If both commands start cleanly but MCP tool calls still fail, inspect the
   wrapper's stderr around the `spawn(CODEX_BIN, ["app-server", ...])` path.
   Windows installs often resolve `codex` to a shim, so child-process launch
   details matter more than the agent UI's generic `Transport closed` message.

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
