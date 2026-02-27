# Stack

## Locked Versions
| Package | Version | Replaces |
|---------|---------|----------|
| npx skills | latest | manual agent config file editing |
| uv | latest | pip, venv, pyenv (per uv-python-2026 skill) |
| camoufox | >=0.4.0 | raw Playwright for stealth (per camoufox-2026 skill) |
| Next.js | 15+/16+ | App Router only (per nextjs-approuter-2026 skill) |
| FastAPI | latest | Flask/Django for async APIs (per fastapi-2026 skill) |

## Do-Not Patterns + Root Causes

### fastapi-2026.skill stray-file extraction
**Never:** Blindly `unzip *.skill -d skills/` without checking for top-level files.
**Why:** `fastapi-2026.skill` contained a stray `SKILL.md` at archive root alongside the proper `fastapi-2026/SKILL.md` folder. Extracting wrote a junk `skills/SKILL.md`.
**Instead:** Extract, then verify no unexpected top-level files. Clean up strays before committing.
