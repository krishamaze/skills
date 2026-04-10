# Why PTY Injection Into Codex TUI Fails

## Upstream Confirmation

GitHub issue #15355 (openai/codex, raised March 2026):

> "Today, local orchestration around a running Codex TUI session often falls back to
> terminal injection... In practice this makes local automation brittle. It also
> discourages safer local integrations because the only widely available option is
> 'pretend to be the terminal'."

OpenAI themselves acknowledge this is an open gap. No supported ingress exists
for an already-running interactive TUI session.

## Why It Breaks

Codex TUI is built on **Ratatui** (Rust). Ratatui:
- Takes full ownership of the terminal (alternate screen mode)
- Manages its own input event loop (crossterm events)
- Renders by writing raw escape codes to stdout

When you inject keystrokes via PTY:
- Ratatui may buffer, drop, or misinterpret them depending on timing
- Escape sequences for special keys (Enter, Tab, Ctrl+C) are not stable across terminal emulators
- Output scraping requires parsing ANSI escape codes that change with themes/versions

## What OpenAI Recommends Instead

From issue #15355 and official docs:
- **Use `codex app-server`** for structured programmatic control
- **Use `codex exec`** for non-interactive automation
- PTY injection is explicitly called out as "the only widely available option" but "brittle"

## Bottom Line

Do not build on PTY injection. Use app-server JSON-RPC.
The `command/exec/write` method in app-server gives you legitimate stdin injection
INTO commands that Codex itself spawns — which is what you actually want.
