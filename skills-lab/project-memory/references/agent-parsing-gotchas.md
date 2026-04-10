# Agent Parsing Gotchas

Read this before manually parsing agent state files. Each agent stores state
differently — these are the things that waste your time if you don't know them.

---

## Claude Code JSONL

| Gotcha | Detail |
|--------|--------|
| `isMeta: true` messages | System-injected, not user messages — **skip them** |
| `error: "rate_limit"` on assistant messages | Claude hit its limit — that's why work stopped |
| Tool use blocks | `type: "tool_use"` inside `content[]` — useful for what Claude did, but not text responses |
| Multiple sessions same mtime | Read tail of each to find actual work (not just `/clear` → `/exit`) |
| Path key formula | `/home/user/projects/foo` → `-home-user-projects-foo` (replace both `/` and `_` with `-`) |

---

## Codex Rollout JSONL

| Gotcha | Detail |
|--------|--------|
| Guardian subagent messages | Look like `USER:` but are risk assessment prompts — **not the real user** |
| Actual work output | In `assistant` messages with `content` containing code/text |
| SQLite files | Can be 84MB+ — **use `history.jsonl`** for quick overview, skip SQLite |
| Session directories | Organized by date (`sessions/YYYY/MM/DD/`), not by project |

---

## Antigravity (Gemini)

| Gotcha | Detail |
|--------|--------|
| `.pb` files | Binary protobuf — **not human-readable**, don't cat them |
| `brain/<convo-id>/` directories | Contain markdown artifacts that ARE readable |
| `overview.txt` | In `brain/<id>/.system_generated/logs/` — full conversation transcript as plain text |
| Knowledge items | In `~/.gemini/antigravity/knowledge/` — each has `metadata.json` + `artifacts/` |

---

## Aider

| Gotcha | Detail |
|--------|--------|
| State is project-local | `.aider.chat.history.md` lives in project root, not `~/` |
| Global dir | `~/.aider/` contains analytics only, not session data |
| History format | Plain markdown, not JSONL — just read the tail |

---

## Augment

| Gotcha | Detail |
|--------|--------|
| Minimal local state | Only `~/.augment/{skills,rules,commands}/` — no session logs |
| GUI-only config | MCP servers configured through Settings Panel, not config files |

---

## Unknown Agents

Scan for unrecognized dotdirs:

```bash
ls -d ~/.[a-z]* 2>/dev/null | grep -vE '\.(cache|config|local|ssh|git|npm|nvm|bash|profile|sudo)'
```

Check unfamiliar dotdirs for `.json`, `.jsonl`, or `.toml` files — those signal
an agent config directory.
