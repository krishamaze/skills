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
