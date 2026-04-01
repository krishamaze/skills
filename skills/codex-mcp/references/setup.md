# Setup — platform commands and per-agent configs

`npx skills add` installs to `.agents/skills/` and symlinks into
`.claude/skills/`. The server script is already at a stable project path —
no global copy needed.

## Resolve the script path

**Unix / macOS:**

```bash
SCRIPT_PATH="$(realpath .agents/skills/codex-mcp/scripts/codex-mcp-server.mjs)"
echo "$SCRIPT_PATH"
```

**Windows PowerShell:**

```powershell
$SCRIPT_PATH = (Resolve-Path ".agents\skills\codex-mcp\scripts\codex-mcp-server.mjs").Path
$SCRIPT_PATH
```

Use this resolved absolute path in all configs below — never `~` or `$HOME`
(shell variables don't expand inside JSON/TOML values).

## Check prerequisites

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
If config is missing: `.codex/config.toml` must exist and contain a valid
`model = "..."` line before the first tool call. Running `codex` interactively
is one way; `codex mcp add ...` on Windows may create it directly.

## Per-agent configuration

Configure only the invoking agent. Do not touch other agent configs unless the
user explicitly asks.

### Claude Code

```bash
claude mcp add codex-mcp --scope project -- node "$SCRIPT_PATH"
```

This writes to `.mcp.json` in the project root. Or merge manually:

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
