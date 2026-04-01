# Windows troubleshooting

## 1. Config-drift check (do this first)

After a skills update the registered path in your agent config may still point
to an old global location. Check **whichever agent config is active** — this
could be `.mcp.json` (Claude Code), `~/.codex/config.toml` (Codex CLI),
`~/.gemini/settings.json` (Gemini CLI), `~/.cursor/mcp.json` (Cursor), etc.

```powershell
# Example for Codex CLI — adapt the path for your agent:
Select-String -Path "$env:USERPROFILE\.codex\config.toml" -Pattern 'codex-mcp-server' | Select-Object -ExpandProperty Line

# What the project-local path should be:
Resolve-Path ".agents\skills\codex-mcp\scripts\codex-mcp-server.mjs"
```

If they differ, update the `args` value in the config to the project-local path
and restart the agent. This is the most common cause of `Transport closed`
after a skills update.

## 2. Tools visible but transport immediately closed

If the MCP tools appear in the agent UI but the first `codex_run` call (and the
follow-up status ping) both return `Transport closed`, the transport is dead on
launch — not slow or timing out. Work through these in order:

1. **Config drift** — run the check above. Fix path, restart, retry.
2. **Script missing** — confirm the file exists at the resolved path:
   ```powershell
   Test-Path ".agents\skills\codex-mcp\scripts\codex-mcp-server.mjs"
   ```
3. **Node not found** — confirm `node` is on PATH in the shell the agent
   inherits (not just your interactive terminal):
   ```powershell
   node --version
   ```
4. If all three pass, drop to the process-level checks below.

## 3. Process-level verification

Run the two processes independently to isolate where the failure is:

1. Run the wrapper directly:
   ```powershell
   node (Resolve-Path ".agents\skills\codex-mcp\scripts\codex-mcp-server.mjs").Path
   ```
   **Healthy**: the process starts without error output and waits silently on
   stdin (it's an MCP stdio server). If it prints an error and exits, that
   error is the root cause.

2. Run Codex app-server directly:
   ```powershell
   codex app-server --enable multi_agent --enable fast_mode -c service_tier="fast" -c sandbox_mode="danger-full-access" -c approval_policy="never"
   ```
   **Healthy**: prints a JSON-RPC greeting to stdout and waits. If it exits
   immediately or errors, check `.codex/config.toml` for a valid `model` line.

If both start cleanly but MCP tool calls still fail, inspect the wrapper's
stderr around the `spawn(CODEX_BIN, ["app-server", ...])` path. Windows installs
often resolve `codex` to a `.cmd` shim — try setting `CODEX_BIN` to the full
`.exe` path (e.g. `C:\Users\<user>\AppData\Roaming\npm\codex.cmd`) and retry.
