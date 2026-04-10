# Decisions

## ADR-001: Skill format is folder + SKILL.md with YAML frontmatter
**Status:** active
**Decision:** Every skill lives in `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`) and optional `references/` subdirectory.
**Why:** This is the format consumed by `npx skills add` and all supported agents (Amp, Cline, Codex, Cursor, Gemini CLI, etc.). Standardizing on it means zero adapter code.
**Do not:** Store skills as loose `.md` files outside their own directory.
**Failure mode:** `npx skills add` won't discover the skill; agents won't load it.

## ADR-002: .skill files are zip archives for distribution
**Status:** active
**Decision:** Skills are packaged as `.skill` zip archives (each containing the folder structure) for transfer, then extracted into `skills/`.
**Why:** Single-file distribution that preserves directory structure including `references/`. Unzip directly into `skills/` and it's ready.
**Do not:** Commit `.skill` zip files to the repo — only the extracted folders.
**Failure mode:** Repo bloat; zip and extracted content duplicated.

## ADR-003: project-memory skill installed via symlink at project scope
**Status:** active
**Decision:** `project-memory` installed via symlink to the skills repo, scoped to this project, available to all 8 agents.
**Why:** Symlink keeps a single source of truth in the repo; project scope means it doesn't pollute global agent config.
**Do not:** Copy the skill files — always symlink so updates propagate.
**Failure mode:** Stale skill copy diverges from repo version.

## ADR-004: Skills contain delta knowledge only — not general concepts
**Status:** superseded by ADR-005. Full entry in `references/decisions-archive.md`.

## ADR-005: API skills are comprehensive and self-contained
**Status:** active
**Decision:** API reference skills (like gemini-api-2026) are self-contained with full code examples, model tables, and quick start — not delta-only.
**Why:** Delta assumption breaks when models have varying training cutoffs. A comprehensive skill works for any model. Rich reference files offload deep-dive content, keeping SKILL.md as the hub. The 500-line limit applies to SKILL.md body; reference files extend capacity.
**Do not:** Assume the consuming model knows any specific SDK syntax or model IDs.
**Failure mode:** Model uses stale imports or deprecated model IDs because delta skill didn't cover "known" basics that were actually wrong.

## ADR-006: codex-orchestrator is a pure Codex-routing behavior skill
**Status:** active
**Decision:** `skills/codex-orchestrator/SKILL.md` defines a strict orchestrator role: the agent plans, manages threads, and prompts; Codex CLI executes all coding work through the bridge script.
**Why:** The purpose of this skill is to turn a CLI agent into a reliable Codex operator, not a mixed-mode coding assistant. Routing execution through Codex keeps the control loop consistent and makes thread continuity, retries, and project targeting explicit.
**Do not:** Let an agent using this skill write code directly or mix direct file edits with Codex-driven execution for the same task.
**Failure mode:** The skill stops behaving predictably, Codex context management is bypassed, and the orchestrator no longer has a single authoritative execution path.

## ADR-007: codex-mcp exposes task-shaped Codex tools over one persistent app-server per project
**Status:** active
**Decision:** `skills/codex-mcp/scripts/codex-mcp-server.mjs` keeps a persistent Codex app-server per project directory and exposes specialized MCP tools (`codex_execute`, `codex_resume`, `codex_search`, `codex_review`, `codex_debug`, `codex_test`) instead of raw shell wrappers.
**Why:** A persistent server preserves thread continuity for `codex_resume`, while task-shaped tools let the orchestrator pick the right Codex behavior without rebuilding role instructions on every turn.
**Do not:** Spawn a fresh Codex process for every MCP call or collapse the tool surface back into one opaque bash command.
**Failure mode:** Resume semantics break, tool behavior becomes inconsistent, and MCP callers lose the predictable separation between search, execute, review, debug, and test flows.

## ADR-008: Resume from repo memory and live git state, not agent-home logs alone
**Status:** active
**Decision:** Use repo `CONTEXT.md` / `DECISIONS.md` / `STACK.md` plus current git/worktree state as the canonical resume layer; treat `~/.claude`, `~/.codex`, and `~/.gemini` state as evidence to reconcile, not truth to execute blindly.
**Why:** Agent-home memories, audits, and session logs can lag the actual repository or each other. Reconciling them against live files and git prevents stale resumptions and preserves one project-level handoff source.
**Do not:** Continue a task solely because it appears latest in one agent's home directory without checking repo memory and current git status.
**Failure mode:** An agent resumes the wrong thread, repeats finished work, or ignores newer user changes already present in the workspace.

## ADR-009: codex-mcp readiness requires a live MCP handshake and real tool calls
**Status:** active
**Decision:** Consider `codex-mcp` validated only after a live stdio MCP session successfully completes `initialize`, `tools/list`, and at least one real tool call such as `codex_search` or `codex_execute` against a project.
**Why:** Static config and process startup do not prove that the wrapper can spawn Codex app-server, expose all 6 tools, and return real end-to-end results. The live handshake catches integration breakage before a user hits it in Claude Code.
**Do not:** Mark `codex-mcp` done based only on `.mcp.json` existing or the wrapper process starting.
**Failure mode:** Claude Code appears configured, but the first real MCP call hangs or fails because the bridge or nested Codex path is broken.

## ADR-010: Codex launchers pin multi-agent and Fast defaults at process startup
**Status:** active
**Decision:** Every local wrapper that spawns `codex app-server` must pass `--enable multi_agent`, `--enable fast_mode`, and `-c service_tier="fast"` in its startup argv.
**Why:** Wrapper behavior should be deterministic across machines and profiles instead of inheriting whatever the host `~/.codex/config.toml` happens to allow. `service_tier = "fast"` is the persisted Fast preference, but Fast is ignored if `fast_mode` is disabled, so both the feature and the tier must be pinned together.
**Do not:** Assume ambient Codex defaults are good enough for wrapper behavior or try to enforce Fast only at the prompt level.
**Failure mode:** The same wrapper behaves differently across environments, multi-agent tools may disappear, or Fast silently drops back to the default tier.

## ADR-011: Installed codex-mcp uses the v2 two-tool surface
**Status:** active
**Decision:** The installed `skills/codex-mcp` skill now exposes only `codex_run` and `codex_review`, with run behavior selected through `mode` (`explore`, `inspect`, `build`, `debug`, `test`, `research`).
**Why:** The v2 surface is narrower and more coherent than the old 6-tool API, and the installed copy now includes the restart-safe thread registry fixes validated on the extracted candidate before promotion.
**Do not:** Call removed v1 tool names like `codex_execute`, `codex_resume`, `codex_search`, `codex_debug`, or `codex_test` against the installed skill.
**Failure mode:** MCP callers target tools that no longer exist, or they bypass the validated v2 thread and mode routing contract.

## ADR-012: codex-mcp enforces controller role via HARD-GATE and Iron Law
**Status:** active
**Decision:** codex-mcp SKILL.md opens with a `<HARD-GATE>` block and an Iron Law that prohibit the orchestrating agent from doing any direct work when MCP tools are present.
**Why:** Without a hard enforcement mechanism, agents rationalize bypassing delegation ("Codex returned empty so I'll just do it"), breaking Codex's context chain and silently contradicting its threads.
**Do not:** Soften or remove the HARD-GATE. Status-enum table and rationalization table are load-bearing — they close the remaining escape hatches.
**Failure mode:** Agent reverts to mixed-mode execution, Codex thread context diverges from the workspace, and subsequent Codex turns overwrite direct changes.

## ADR-013: codex-mcp auto-restarts app-server on rate-limit errors
**Status:** active
**Decision:** `completeTurn()` in `codex-mcp-server.mjs` pattern-matches errors against `RATE_LIMIT_RE` (`rate limit`, `usage limit`, `429`, `quota exceeded`, `too many requests`). On match, it kills the stale app-server process and removes it from its pool so the next tool call spawns a fresh one.
**Why:** The persistent app-server inherits credentials from the environment at spawn time. When Account A hits a rate limit and the user switches to Account B, the old process keeps using Account A's stale credentials. Killing and re-spawning is the only way to pick up the new credentials.
**Do not:** Try to hot-swap credentials on a running app-server — Codex doesn't support that. Don't retry automatically within the same turn — let the orchestrator decide when to retry.
**Failure mode:** Without this, every call keeps failing with Account A's rate limit even after switching accounts, requiring a full MCP server restart.

## ADR-014: Per-mode reasoning effort in turn/start
**Status:** active
**Decision:** Each `codex_run` mode and `codex_review` now sends an `effort` field in the `turn/start` JSON-RPC params, matching the app-server's `TurnStartParams.effort` protocol field. Mapping: explore→low, inspect→medium, research→medium, build→high, test→high, review→high, debug→xhigh.
**Why:** GPT-5.4's reasoning effort directly controls thinking depth and latency. Orientation tasks (explore) don't benefit from deep reasoning — `low` saves latency. Root cause analysis (debug) is the exact use case `xhigh` is designed for. Build/test/review need reliable instruction-following at `high` without the over-engineering risk of `xhigh`.
**Do not:** Set everything to `xhigh` — it causes over-analysis on simple tasks and increases latency. Don't omit the field (falls back to config.toml's global `model_reasoning_effort`, which may not be optimal per task type).
**Failure mode:** Without per-mode effort, explore tasks waste latency on deep reasoning while debug tasks get insufficient analysis depth.

## ADR-015: Native review/start protocol, drop reviewServers pool
**Status:** active
**Decision:** `codex_review` now uses the app-server's native `review/start` JSON-RPC method with `delivery: "detached"` instead of `turn/start` with a review role prefix. The separate `reviewServers` process pool is removed — a single `runServers` pool serves all operations. Structured review targets are exposed: `uncommitted_changes`, `base_branch`, `commit`, `custom`. Follow-up reviews still use `turn/start` on the detached review thread.
**Why:** `review/start` tells the app-server to gather git diffs natively (staged + unstaged + untracked), format them, and inject into the model context. The old approach relied on the model running `git diff` itself — unreliable. Detached delivery creates an isolated review thread without needing a second persistent process. Structured targets enable reliable "review this branch" or "review this commit" workflows.
**Do not:** Use `review/start` for follow-up messages on an existing review thread — that starts a NEW review. Use `turn/start` for follow-ups instead. Don't use `delivery: "inline"` — it pollutes the run thread with review context.
**Failure mode:** Without native review/start, reviews depend on the model correctly invoking git commands, which fails on partial stages, untracked files, and large diffs.

## ADR-016: codex-mcp enforces explicit Controller Mindset
**Status:** active
**Decision:** Added "The Controller Mindset" to SKILL.md with 3 rules: define outcome before dispatch, one job per call, and verify before next step. Explicitly state the plan stays with the controller.
**Why:** HARD-GATE only told agents what not to do (execute directly), but left ambiguity on how to coordinate tasks efficiently. The mindset rules and separating planning context set a positive operational contract.
**Do not:** Pass entire master plans, checklists, or unbounded scopes to Codex threads.
**Failure mode:** Threads diverge, over-analyze scope, or get stuck and the controller loses the overall workflow.

## ADR-017: codex-mcp wrapper excludes background auto-compression
**Status:** active
**Decision:** The `codex-mcp-server` node wrapper will not track `session-state.json` side-effects or hijack JSON-RPC loops to trigger `thread/compact` autonomously.
**Why:** The wrapper was recently stabilized with critical rate limiting and approval logic. Adding async state tracking or autonomous RPC calls introduces significant complexity. The Rust app-server already handles its own compaction internally if requested. The Node wrapper should remain a thin, stable passthrough layer.
**Do not:** Add background file monitoring, autonomous thread hydration, or side-effect loop tasks into the MCP node wrapper.
**Failure mode:** Race conditions with thread state tracking, stalled JSON-RPC streams, and regressions in connection stability.

## ADR-018: Source skills live in `skills-lab/`, not `skills/`
**Status:** active
**Decision:** Renamed the source directory from `skills/` to `skills-lab/` to separate skill source code from `npx skills` install artifacts.
**Why:** When working inside the skills repo, `npx skills remove` scanned all `SKILL.md` files — including the source `skills/` directory — and listed source files as removable. This meant you could accidentally delete your own source. The rename puts source outside the install tool's local scan paths while `npx skills add` still discovers them from the remote (it scans recursively for `SKILL.md` files, not just `skills/`).
**Do not:** Rename back to `skills/` or create a `skills/` directory for source. The name `skills-lab/` is the source convention for this repo.
**Failure mode:** Source files detected as installed skills by `npx skills remove`, leading to accidental deletion.

## ADR-019: Unified agent config via AGENT.md with symlinks
**Status:** active
**Decision:** `AGENT.md` is the single source of truth for agent instructions. `CLAUDE.md` and `GEMINI.md` are relative symlinks to `AGENT.md`.
**Why:** Multiple agents read different config files (`CLAUDE.md` for Claude Code, `GEMINI.md` for Gemini CLI). A single source with symlinks ensures all agents get identical instructions without content drift.
**Do not:** Edit `CLAUDE.md` or `GEMINI.md` directly — they are symlinks. Edit `AGENT.md` instead. Do not use absolute-path symlinks — they break on clone.
**Failure mode:** Agent-specific configs drift apart, causing inconsistent behavior across agents.
