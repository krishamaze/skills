# Setup — platform commands and per-agent configs

## Preflight commands

### Check if global script is installed

**Unix / macOS:**

```bash
ls "$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs" 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Windows PowerShell:**

```powershell
if (Test-Path "$env:USERPROFILE\.local\share\codex-mcp\scripts\codex-mcp-server.mjs") { "EXISTS" } else { "MISSING" }
```

### Check skill source script

**Unix / macOS:**

```bash
ls <skill-dir>/scripts/codex-mcp-server.mjs 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Windows PowerShell:**

```powershell
if (Test-Path "<skill-dir>\scripts\codex-mcp-server.mjs") { "EXISTS" } else { "MISSING" }
```

If both are MISSING, the user must provide `codex-mcp-server.mjs`. Do not
proceed until it exists.

If the invoking agent already has a configured server path, inspect it
read-only. If that path and a source wrapper path under `.agent`, `.agents`,
or `.claude` do not match, treat it as an update case: after approval, update
the installed server to the source version, then tell the user to restart and
invoke the agent again in a new session.

### Check prerequisites

**Unix / macOS:**

```bash
which codex || echo "MISSING"
grep '^model' ~/.codex/config.toml 2>/dev/null || echo "MISSING"
```

**Windows PowerShell:**

```powershell
$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) { $codex.Source } else { "MISSING" }
if (Select-String -Path "$env:USERPROFILE\.codex\config.toml" -Pattern '^\s*model\s*=' -ErrorAction SilentlyContinue) { "MODEL_PRESENT" } else { "MISSING" }
```

If codex is missing, the setup plan must include: `npm install -g @openai/codex`
If config is missing: do not assume the only fix is "run `codex` once
interactively". On Windows, `codex mcp add ...` may create
`%USERPROFILE%\.codex\config.toml` directly. The real requirement is:
before the first tool call, `.codex/config.toml` must exist and contain a
valid `model = "..."` line. Running `codex` interactively is one way to get
there, not the only way.

## Deploy the wrapper script

**Unix / macOS:**

```bash
mkdir -p "$HOME/.local/share/codex-mcp/scripts"
cp <skill-dir>/scripts/codex-mcp-server.mjs "$HOME/.local/share/codex-mcp/scripts/"
SCRIPT_PATH="$(realpath "$HOME/.local/share/codex-mcp/scripts/codex-mcp-server.mjs")"
echo "Installed: $SCRIPT_PATH"
```

**Windows PowerShell:**

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.local\share\codex-mcp\scripts" | Out-Null
Copy-Item "<skill-dir>\scripts\codex-mcp-server.mjs" "$env:USERPROFILE\.local\share\codex-mcp\scripts\codex-mcp-server.mjs" -Force
$SCRIPT_PATH = (Resolve-Path "$env:USERPROFILE\.local\share\codex-mcp\scripts\codex-mcp-server.mjs").Path
Write-Output "Installed: $SCRIPT_PATH"
```

In all configs below, use the resolved absolute `$SCRIPT_PATH` — never `~` or
`$HOME` (shell variables don't expand inside JSON/TOML values).

## Per-agent configuration

Configure only the invoking agent. Do not touch other agent configs unless the
user explicitly asks.

### Claude Code — user-scoped (available across all projects)

```bash
claude mcp add codex-mcp --scope user -- node "$SCRIPT_PATH"
```

Or manually merge into `~/.claude.json` under `mcpServers`.

### Codex CLI — `~/.codex/config.toml`

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

### Gemini CLI — `~/.gemini/settings.json` or project-local `.gemini/settings.json`

Prefer the CLI first:

```bash
gemini mcp add codex-mcp node "$SCRIPT_PATH"
```

Depending on Gemini CLI version and how it was invoked, that command may
update either:
- user-global `~/.gemini/settings.json`
- project-local `.gemini/settings.json`

If editing manually, merge `codex-mcp` into the `mcpServers` object:

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

> Do not use underscores in the server name (`codex-mcp` not `codex_mcp`).
> Gemini's policy parser splits FQNs on the first `_` after `mcp_` — underscores
> in the server name break wildcard rules silently.

Tools appear as `mcp_codex-mcp_codex_run` and `mcp_codex-mcp_codex_review`.

### Cursor — `~/.cursor/mcp.json`

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

### Antigravity — `~/.gemini/antigravity/mcp_config.json`

Merge `codex-mcp` into the `mcpServers` object:

```json
{
  "mcpServers": {
    "codex-mcp": {
      "$typeName": "exa.cascade_plugins_pb.CascadePluginCommandTemplate",
      "command": "node",
      "args": ["/resolved/absolute/path/to/codex-mcp-server.mjs"],
      "env": {}
    }
  }
}
```

Access via: MCP Store → "..." → Manage MCP Servers → View raw config.
After saving, the server connects automatically — no restart needed.

### Augment Code — GUI only

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

## Gitignore (per project)

The server creates `memory/codex-threads.json` in the project root on the
first tool call:

**Unix / macOS:**

```bash
grep -q '^memory/codex-threads\.json$' .gitignore 2>/dev/null || echo 'memory/codex-threads.json' >> .gitignore
```

**Windows PowerShell:**

```powershell
if (-not (Test-Path ".gitignore")) { New-Item -ItemType File ".gitignore" | Out-Null }
if (-not (Select-String -Path ".gitignore" -Pattern '^memory/codex-threads\.json$' -Quiet -ErrorAction SilentlyContinue)) { Add-Content ".gitignore" "memory/codex-threads.json" }
```
