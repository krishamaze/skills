# Stack

## Locked Versions
| Package | Version | Replaces |
|---------|---------|----------|
| npx skills | latest | manual agent config file editing |
| uv | latest | pip, venv, pyenv (per uv-python-2026 skill) |
| camoufox | >=0.4.0 | raw Playwright for stealth (per camoufox-2026 skill) |
| Next.js | 15+/16+ | App Router only (per nextjs-approuter-2026 skill) |
| FastAPI | latest | Flask/Django for async APIs (per fastapi-2026 skill) |
| google-genai | latest | google-generativeai (legacy SDK) |

## Do-Not Patterns + Root Causes

### fastapi-2026.skill stray-file extraction
**Never:** Blindly `unzip *.skill -d skills/` without checking for top-level files.
**Why:** `fastapi-2026.skill` contained a stray `SKILL.md` at archive root alongside the proper `fastapi-2026/SKILL.md` folder. Extracting wrote a junk `skills/SKILL.md`.
**Instead:** Extract, then verify no unexpected top-level files. Clean up strays before committing.

### Gemini legacy SDK import
**Never:** `import google.generativeai as genai` or `pip install google-generativeai`.
**Why:** Legacy SDK has no centralized Client, different API surface, won't support Gemini 3+ features. Causes silent feature gaps and broken code.
**Instead:** `from google import genai` / `pip install google-genai`. All calls via `client = genai.Client()`.

### Codex app-server thread-start timing
**Never:** Assume a new Codex thread is ready after an arbitrary sleep.
**Why:** `thread/start` completion is asynchronous. Fixed delays race the server, so turns can attach to the wrong thread or report the wrong `threadId`.
**Instead:** Wait for the actual `thread/start` response, serialize turns per project, and reset the app-server after timeouts.

### agent-state resume without repo reconciliation
**Never:** Resume work directly from `~/.claude`, `~/.codex`, `~/.gemini`, or an older audit note without checking current repo memory, git status, and live files.
**Why:** Home-dir agent state can be stale or disagree with the current workspace. During this audit, older agent notes claimed a clean tree and a single active thread while the live repo already had user-driven deletions and new untracked directories.
**Instead:** Use agent-home state to discover candidate threads, then reconcile against `CONTEXT.md`, `DECISIONS.md`, `STACK.md`, `git log`, `git status`, and the current filesystem before continuing.

### archive-extracted skill permissions
**Never:** Assume a `.skill` archive extracts to user-writable files and directories.
**Why:** Archive-preserved permissions left `skills/skill-creator` read-only (`dr-xr-xr-x` / `-r--r--r--`), so `rm -rf` failed with `Permission denied` even though the files were user-owned.
**Instead:** If an extracted skill tree must be edited or deleted, restore user write bits first, for example `chmod -R u+w <dir>`, then make the change.

### codex-mcp-v2 context_cmd replacement readiness
**Never:** Treat extracted `codex-mcp-v2` as a drop-in replacement for the installed `skills/codex-mcp` before validating `codex_run` with `context_cmd`.
**Why:** On 2026-03-28, isolated MCP tests showed v2 succeeds for handshake, `codex_run`, `codex_review`, thread continuation, and namespace isolation. The failure is narrower: `context_cmd: "pwd"` succeeds in installed v1 and in v2 `build`, but hangs in v2 `explore` for a context-only prompt because `explore` also injects a stricter "read codebase and return file paths/function names/line numbers" contract.
**Instead:** Keep v1 installed as the reference and patch/retest [codex-mcp-v2/scripts/codex-mcp-server.mjs](/home/ubuntu/projects/3_RESOURCES/skills/codex-mcp-v2/scripts/codex-mcp-server.mjs) before any merge or replacement.

### codex-mcp-v2 explore prompt softening
**Never:** Assume a single softer `if` clause in the v2 `explore` prefix is enough to fix context-only follow-up hangs.
**Why:** On 2026-03-28, changing the prefix to allow reporting injected read-only context preserved normal `explore` behavior, but `codex_run` with `mode: "explore"` plus `context_cmd: "pwd"` still timed out. The issue is therefore deeper than that one prompt sentence.
**Instead:** Treat the bug as an execution-path or mode-design issue: instrument the v2 `explore` turn flow further or add a lighter dedicated read-only/context-follow-up mode before replacing v1.

### codex-mcp-v2 inspect routing
**Never:** Route injected-context follow-ups or narrow read-only checks through `explore`.
**Why:** In extracted v2, `explore` remained good for broad codebase discovery, but context-only follow-ups kept stalling there even after prompt softening. Splitting a lighter `inspect` mode resolved the same `context_cmd: "pwd"` test immediately without weakening normal `explore`.
**Instead:** Use `explore` for broad codebase mapping and `inspect` for targeted read-only checks on config, files, or injected context.

### codex launcher ambient-default drift
**Never:** Rely on ambient `~/.codex/config.toml` defaults alone when a local wrapper needs stable Codex behavior.
**Why:** Wrapper behavior becomes machine- and profile-dependent. `multi_agent` can be explicitly disabled, and `service_tier = "fast"` is ignored if `fast_mode` is off in the effective feature set.
**Instead:** Pin wrapper startup with `--enable multi_agent`, `--enable fast_mode`, and `-c service_tier="fast"`, then validate with a live `config/read` or `thread/start` probe.

### codex-mcp-v2 persisted thread resume
**Never:** Feed a persisted `thread_id` directly into `turn/start` and assume it is still live in the current app-server process.
**Why:** Codex app-server thread ids persist on disk, but a fresh app-server must reload them first. Direct `turn/start` on a stale-but-valid thread id fails with `thread not found`, while review ids can also be misclassified if namespace state is tracked only in memory.
**Instead:** For resumed work, reload the conversation with `thread/resume`; keep review-vs-run namespace metadata in the persisted registry, not only in an in-memory set; and complete the turn immediately on RPC errors instead of appending a misleading inactivity timeout.

### installed codex-mcp v1 tool-name assumptions
**Never:** Call the installed `skills/codex-mcp` skill as if it still exposed the old 6-tool v1 surface.
**Why:** The installed copy was promoted to the patched v2 interface and now exposes only `codex_run` and `codex_review`. Old callers targeting removed names will fail at `tools/list`/`tools/call`, even though the server itself is healthy.
**Instead:** Route execution through `codex_run` with an explicit `mode`, and use `codex_review` only for review threads.
