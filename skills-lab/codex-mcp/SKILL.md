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

<HARD-GATE>
When codex_run and codex_review tools are present in your tool list, you are a controller.
Controllers do not read files, write code, run commands, or search the web.
Violating the letter of this rule is violating the spirit of this rule.
</HARD-GATE>

## The Iron Law
```
WHEN CODEX MCP TOOLS ARE AVAILABLE, YOU DO NOT EXECUTE WORK YOURSELF.
```

You are a **controller** — plan what to do, craft prompts, route to threads, report results.
The reason: Codex maintains its own context per thread. When you read files or write code
directly, that work is invisible to Codex's threads. Future Codex turns will contradict or
overwrite your direct changes because they don't know about them. Delegation isn't a
preference — it's how context stays consistent.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Codex returned empty so let me just do it" | Empty = signal to report, not permission to execute. The user chose delegation for a reason. |
| "This is simpler to do directly" | Simpler ≠ permitted. Every direct action breaks Codex's context chain. |
| "Codex timed out so I'll handle it" | Timeout = break the task smaller or increase timeout, then re-dispatch. |
| "I'll just check this one file quickly" | Explore mode exists for this. `codex_run(mode=explore)`. |
| "The tool errored, I need to work around it" | Report the error to the user and let them decide. Working around it silently defeats the pattern. |
| "I already know the answer from context" | Your context may be stale. Verify through Codex — it reads the current file system. |

## Interpreting codex_run results

The wrapper returns a `status` field in `structuredContent`. Use this decision tree:

| Status | How to detect | Controller action |
|---|---|---|
| `DONE` | output has content, no errors | Summarize result, proceed to next step |
| `EMPTY` | output blank/missing, no errors | Report to user: "codex returned no output on thread X." Do NOT do the work yourself. |
| `ERROR` | errors array non-empty | Surface error to user. Do not retry yourself. |
| `TIMEOUT` | error contains "timeout" | Break task smaller or pass higher `timeout=`, re-dispatch. |
| `STALE_THREAD` | thread resume fails | Start fresh thread — omit `thread_id` on next call. |

## Mode routing

Pick the right mode for the task:

| Controller does | Codex does (via tool) |
|---|---|
| Plan next step | `codex_run(mode=explore)` — read/navigate codebase |
| Targeted read-only follow-up | `codex_run(mode=inspect)` — inspect files, config, injected context |
| Craft the build prompt | `codex_run(mode=build)` — write, edit, execute code |
| Describe the bug | `codex_run(mode=debug)` — reproduce → diagnose → fix → verify |
| Request test coverage | `codex_run(mode=test)` — write and run tests |
| Need current information | `codex_run(mode=research)` — web search, no file writes |
| Request independent evaluation | `codex_review` — code review in isolated thread |

## Tools

| Tool | Modes | Thread | Purpose |
|---|---|---|---|
| `codex_run` | explore | new or resume | Read/navigate codebase — never modifies files |
| `codex_run` | inspect | new or resume | Targeted read-only checks on files, config, or injected context |
| `codex_run` | build | new or resume | Write, edit, create, and run code |
| `codex_run` | debug | new or resume | Reproduce → diagnose → fix → verify a bug |
| `codex_run` | test | new or resume | Write or run tests, report pass/fail |
| `codex_run` | research | new or resume | Web search only — no file writes |
| `codex_review` | — | isolated | Independent code review with structured targets (e.g. uncommitted changes, branches) |

Pass `thread_id` to resume an existing thread. Omit to start fresh.
`codex_review` threads are namespace-isolated — never pass a review `thread_id`
to `codex_run` or vice versa (the server enforces this with a hard error).

Use `explore` for broad discovery and mapping. Use `inspect` for narrow
read-only checks, especially when driven by injected context or a specific
file/config target.

## Prompting Codex well

Every prompt should contain: **what to do** + **where** (file paths) +
**expected outcome** + **constraints**. Pick the right mode — its baked-in
role prefix handles the rest.

**Incremental prompting:** one focused task per call, pass `thread_id` to
continue. Codex accumulates context across calls — the second call already
knows what the first found. This gives better results than broad prompts and
prevents inactivity timeouts on large scopes.

```
codex_run(explore, prompt="Map skills-lab/project-memory/")          → T1
codex_run(explore, thread_id=T1, prompt="Now map skills-lab/codex-mcp/")
```

Each mode's role prefix instructs Codex to use subagents for parallelism
(file reading, multi-file edits, test execution). This produces a denser
event stream that reduces timeout risk, but focused prompts still give
higher quality results than broad ones.

If a single call is legitimately large, pass `timeout=120` or `timeout=180`.

```
codex_run(explore): "List all exported functions in src/auth/ and their error handling patterns."
codex_run(inspect): "Use the injected `pwd` output and report the exact project root."
codex_run(build):   "Add null checks to all auth functions that access user.email."
codex_run(build, thread_id=T1): "Also add the same null checks in src/payment/."
codex_run(test):    "Write tests for the null-check cases in src/auth/. Cover: null, undefined, empty string."
codex_review:       "Read src/auth/. Requirement: every user.email access has a null check. List any gaps."
codex_run(debug):   "Login fails with TypeError on line 42 of src/auth.ts when email is null. Fix it."
```

**Review pattern:** after `codex_run(mode=build)` changes code, use
`codex_review` with a structured target (`target="uncommitted_changes"`) to automatically evaluate your local workspace diff against the original requirement in a fresh thread, completely isolated from self-review bias. Use `target="base_branch", branch="main"` for PR-level reviews.

## Thread registry

The server tracks threads in `memory/codex-threads.json` — mapping thread IDs
to topics so you route to the right thread by topic, not by recency.
Threads persist across server restarts via `thread/resume`.

See `references/thread-registry.md` for the full schema, maintenance rules
(when to add/update/close rows), and the routing decision tree (how to pick
the right `thread_id` before each call).

## Setup workflow

If the tools are NOT available, run this setup. Do not proceed with the
user's actual task through direct local work.

`npx skills add` already places the server script at a stable project path:
`.agents/skills/codex-mcp/scripts/codex-mcp-server.mjs` (symlinked into
`.claude/skills/`). No global copy is needed. Setup just wires the MCP entry.

See `references/setup.md` for per-agent config snippets and Windows commands.

1. **Read-only preflight** — gather facts without writing anything:
   - Resolve the absolute path to `.agents/skills/codex-mcp/scripts/codex-mcp-server.mjs`
   - Check `codex` CLI is installed
   - Check `.codex/config.toml` has a `model` line
   - **Config-drift check**: read the `args` value for `codex-mcp` in the
     active agent config and compare it to the resolved project-local path.
     If they differ, flag as a required fix.
   - Identify which agent is invoking this skill
2. **Present findings and wait** — report what exists, what's missing, what you
   intend to write. Stop and wait for explicit user approval before any writes.
3. **Configure the invoking agent only** — add the MCP entry pointing to the
   resolved absolute path. Use resolved absolute paths (never `~` or `$HOME`).
   Do not copy the script elsewhere. Do not modify other agent configs unless
   the user explicitly asks.
4. **Add `memory/codex-threads.json` to project `.gitignore`** — per project.
5. **Tell the user to restart** — do not continue the original task in the same
   session unless MCP tools are already loaded.
6. **Post-restart health probe** — in the new session, make one lightweight
   `codex_run(mode=inspect, prompt="echo ok")` call before starting real work.
   If this returns `Transport closed` or fails, setup is **not done** — go to
   the "On failure" section.

## On failure

**Tools visible but transport immediately closed:**
1. Do not retry blindly. The transport is dead, not slow.
2. Check for config-path drift: does the registered `args` path match the
   actual project-local script path? Fix and restart.
3. If the path is correct, verify wrapper and app-server independently:
   - **Windows**: see `references/troubleshooting-windows.md`
   - **Unix / macOS**: run the wrapper directly
     (`node "$(realpath .agents/skills/codex-mcp/scripts/codex-mcp-server.mjs)"`);
     then run `codex app-server` standalone.
4. Tell the user exactly which step failed.

**General failure or timeout:**
1. Run a follow-up task to check status.
2. If it fails again, report to the user — do not fall back to direct execution.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Codex CLI not found" | `npm install -g @openai/codex` |
| Tools don't appear in agent | Check config path is absolute. Restart agent session. |
| Wrong project used for `memory/` | Always pass `project_dir` explicitly. |
| Timeout errors | Pass `timeout=120` or `180`. Break work into resumable `thread_id` steps. |
| "app-server exited" | Check `.codex/config.toml` has a valid model. |
| `Transport closed` (any platform) | Check config-path drift first. Then see references for platform-specific diagnosis. |
| Turn hangs then times out | Likely an unhandled approval request. Update wrapper to latest version. |
| "Codex completed with no output" | Check the `errors` field — rate limits and model errors surface there. |
| bwrap/sandbox errors | Expected in containers. Server uses `danger-full-access` sandbox mode. |
| Thread state lost after restart | Expected — server state is in-memory. Registry handles this. |
| Wrong thread routed | Check `memory/codex-threads.json`. Topics are human-readable. |
| Cross-namespace thread_id error | You passed a review thread_id to codex_run or vice versa. |

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
directory and keeps it alive across tool calls. On shutdown (SIGINT/SIGTERM),
all app-server processes are cleaned up.

The wrapper handles the core protocol surface: turn lifecycle, text output,
diffs, file writes, command/file/permissions approvals, and token usage. Some
newer methods (`thread/fork`, `turn/steer`, tool forwarding via
`item/tool/call`) are not yet supported — unhandled server requests receive a
JSON-RPC `-32601` error to prevent silent hangs.
