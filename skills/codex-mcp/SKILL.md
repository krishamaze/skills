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

### 0. Deploy the MCP server script globally (one-time per machine)

Check if already installed:

```bash
ls "$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs" 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If MISSING, check the skill source:

```bash
ls <skill-dir>/scripts/codex-mcp-server.mjs 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If skill source is also MISSING, the user must provide `codex-mcp-server.mjs`.
Do not proceed until it exists.

Install globally:

```bash
mkdir -p "$HOME/.local/share/codex-mcp/scripts"
cp <skill-dir>/scripts/codex-mcp-server.mjs "$HOME/.local/share/codex-mcp/scripts/"
echo "Installed: $HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs"
```

If already EXISTS and the user is not explicitly reinstalling, skip this step.

### 1. Check prerequisites

```bash
which codex || echo "MISSING"
grep '^model' ~/.codex/config.toml 2>/dev/null || echo "MISSING"
```

If codex is missing: `npm install -g @openai/codex`
If config is missing: tell the user to run `codex` once interactively to
complete setup, then come back.

### 2. Configure agents globally (one-time per machine)

The script is at `$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs`.
All agent configs point to this stable path. Configure only the agents the
user has installed.

**Detect installed agents:**

```bash
which claude   2>/dev/null && echo "CLAUDE_CODE=yes"  || echo "CLAUDE_CODE=no"
which codex    2>/dev/null && echo "CODEX_CLI=yes"    || echo "CODEX_CLI=no"
which gemini   2>/dev/null && echo "GEMINI_CLI=yes"   || echo "GEMINI_CLI=no"
[ -d "$HOME/.cursor" ]                       && echo "CURSOR=yes"      || echo "CURSOR=no"
[ -f "$HOME/.gemini/antigravity/mcp_config.json" ] && echo "ANTIGRAVITY=yes" || echo "ANTIGRAVITY=no"
```

Report findings, pause, confirm before writing. Example:

```
Detected agents:
  ✅ Claude Code   → configure via: claude mcp add --scope user
  ✅ Codex CLI     → configure via: ~/.codex/config.toml
  ✅ Gemini CLI    → configure via: ~/.gemini/settings.json
  ❌ Cursor        → not detected
  ✅ Antigravity   → configure via: ~/.gemini/antigravity/mcp_config.json
  ℹ️  Augment Code  → GUI only, show snippet

Proceed?
```

Wait for confirmation, then write only confirmed agents.
In all configs below, use the resolved absolute path — never `~` or `$HOME`
(shell variables don't expand inside JSON/TOML values).

**Resolve path first:**
```bash
SCRIPT_PATH="$(realpath "$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs")"
echo "$SCRIPT_PATH"
```

---

**Claude Code — user-scoped (available across all projects):**

```bash
claude mcp add codex-mcp --scope user -- node "$SCRIPT_PATH"
```

Or manually merge into `~/.claude.json` under `mcpServers`.

---

**Codex CLI — `~/.codex/config.toml`:**

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

**Gemini CLI — `~/.gemini/settings.json`:**

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

Or via CLI:

```bash
gemini mcp add codex-mcp node "$SCRIPT_PATH"
```

> ⚠️ Do not use underscores in the server name (`codex-mcp` not `codex_mcp`).
> Gemini's policy parser splits FQNs on the first `_` after `mcp_` — underscores
> in the server name break wildcard rules silently.

Tools appear as `mcp_codex-mcp_codex_run` and `mcp_codex-mcp_codex_review`.

---

**Cursor — `~/.cursor/mcp.json`:**

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

### 3. Add `memory/` to project .gitignore (per project, not per machine)

The server creates `memory/codex-threads.json` in the project root on the
first tool call. Run this in each project that uses this skill:

```bash
grep -q '^memory/' .gitignore 2>/dev/null || echo 'memory/' >> .gitignore
```

### 4. Tell the user to restart

Say: "Codex MCP is configured. Please restart your agent session to load
the Codex tools. After restart, you'll have `codex_run` and `codex_review`
available as native tools."

That's it. No other action needed from the user.

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
chose MCP delegation for a reason.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Codex CLI not found" | `npm install -g @openai/codex` |
| Tools don't appear in agent | Check config path is absolute. Restart agent session. |
| Wrong project used for `memory/` | Always pass `project_dir` explicitly in tool calls. Do not rely on `process.cwd()`. |
| Timeout errors | Increase `timeout` parameter. Break large tasks into smaller prompts. |
| "app-server exited" | Check `~/.codex/config.toml` has a valid model. Run `codex` once interactively to verify. |
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
