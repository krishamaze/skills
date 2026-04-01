# Windows-first troubleshooting

Before concluding Windows config is wrong, verify the two processes separately:

1. Run the wrapper directly:
   `node C:\Users\<user>\.local\share\codex-mcp\scripts\codex-mcp-server.mjs`
2. Run Codex app-server directly:
   `codex app-server --enable multi_agent --enable fast_mode -c service_tier="fast" -c sandbox_mode="danger-full-access" -c approval_policy="never"`
3. If both commands start cleanly but MCP tool calls still fail, inspect the
   wrapper's stderr around the `spawn(CODEX_BIN, ["app-server", ...])` path.
   Windows installs often resolve `codex` to a shim, so child-process launch
   details matter more than the agent UI's generic `Transport closed` message.
