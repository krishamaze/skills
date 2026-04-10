# Edge Cases

| Situation | Action |
|-----------|--------|
| Agent hit rate limit | Note reset time, continue with different agent or direct work |
| No session logs found | Check if project was opened in that agent (look in global config) |
| Session log is just `/clear` → `/exit` | Skip it, find previous substantive session |
| Large SQLite files | Use `history.jsonl` instead — lightweight equivalent |
| Guardian subagent messages in Codex | Filter: risk assessments ≠ real user prompts |
| Project memory files are stale | Use session logs + git as ground truth, update files |
| Multiple agents worked on different things | Ask user which to continue |
| Agent needs specific tools (e.g. Codex MCP) | Say so — don't pretend you have tools you don't |
| Shallow clone or no git | Skip `git diff --stat HEAD~5`, use `git diff --stat HEAD` or skip git entirely |
| Files in `memory/` not root | Use `memory/` path for all reads/writes — never create root duplicates |
| Unknown dotdir found | Check for `.json`/`.jsonl`/`.toml` — might be a new agent |
| Agent config file is a dump (>40 lines) | Extract knowledge blocks to `memory/`, leave lean protocols |
| AGENT.md missing but CLAUDE.md/GEMINI.md exists | Rename richest to AGENT.md, symlink the rest |
