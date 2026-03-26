# App-Server Event Catalogue

Source: codex-rs/app-server/README.md (verified March 2026)

## Turn Lifecycle Events

| Event | Direction | Payload |
|---|---|---|
| `turn/started` | Server→Client | `{ turn }` with id, empty items, status: "inProgress" |
| `turn/completed` | Server→Client | `{ turn }` where status = completed/interrupted/failed |
| `turn/diff/updated` | Server→Client | `{ threadId, turnId, diff }` unified diff snapshot |

## Item Lifecycle (per tool call / message)

| Event | Direction | Notes |
|---|---|---|
| `item/started` | Server→Client | Tool call or message began |
| `item/completed` | Server→Client | Tool call or message done |
| `item/agentMessage/delta` | Server→Client | Streaming text output chunk |
| `item/commandExecution/outputDelta` | Server→Client | In-turn shell command stdout/stderr chunk |
| `item/commandExecution/requestApproval` | Server→Client | Server PAUSES turn, awaits approval response |
| `item/commandExecution/terminalInteraction` | Server→Client | Terminal stdin prompt detected (for interactive injection) |
| `item/fileChange/requestApproval` | Server→Client | File write approval request |
| `item/fileChange/outputDelta` | Server→Client | apply_patch tool call response |
| `item/permissions/requestApproval` | Server→Client | Permissions change approval request |
| `item/tool/requestUserInput` | Server→Client | Tool needs user input |
| `item/autoApprovalReview/started` | Server→Client | Guardian auto-approval review began |
| `item/autoApprovalReview/completed` | Server→Client | Guardian auto-approval review done |
| `item/reasoning/summaryDelta` | Server→Client | Streaming reasoning summary |
| `item/reasoning/textDelta` | Server→Client | Raw reasoning text (OSS models) |
| `item/mcpToolCall/progress` | Server→Client | MCP tool call progress |

## Standalone command/exec events

| Event | Direction | Notes |
|---|---|---|
| `command/exec/outputDelta` | Server→Client | Base64-encoded output for standalone command/exec (not in-turn) |

## Commands (Client→Server)

| Method | Purpose |
|---|---|
| `initialize` | Handshake (send first, always) |
| `initialized` | Acknowledge handshake (send second, always) |
| `thread/start` | Create new conversation thread |
| `thread/resume` | Resume existing thread (continues in place) |
| `thread/fork` | Fork from existing thread (branches history into new thread) |
| `turn/start` | Send user message / prompt |
| `turn/interrupt` | Cancel running turn |
| `turn/steer` | Steer active turn with additional guidance |
| `command/exec` | Run standalone command in sandbox (no thread/turn) |
| `command/exec/write` | Inject base64 stdin bytes (`deltaBase64`) into a running exec session |
| `command/exec/resize` | Resize PTY of running exec session (`size: {rows, cols}`) |
| `command/exec/terminate` | Kill running exec session |
| `account/read` | Get auth state |
| `account/login/start` | Begin auth flow (apiKey or chatgpt) |
| `model/list` | List available models |
| `skills/list` | List AGENTS.md skills for cwd |
| `config/mcpServer/reload` | Reload MCP server config |
| `review/start` | Start guardian review |

## Token Usage

| Event | Notes |
|---|---|
| `thread/tokenUsage/updated` | Streams separately from turn events |

## Error Codes

| Code | Meaning |
|---|---|
| -32001 | Server overloaded — retry with exponential backoff + jitter |
| "Not initialized" | initialize not sent yet |
| "Already initialized" | initialize sent twice |

## Additional Notifications

| Event | Direction | Notes |
|---|---|---|
| `thread/archived` | Server→Client | Thread was archived |
| `thread/unarchived` | Server→Client | Thread was unarchived |
| `thread/closed` | Server→Client | Thread was closed |
| `thread/name/updated` | Server→Client | Thread name changed |
| `skills/changed` | Server→Client | Available skills changed |
| `turn/plan/updated` | Server→Client | Turn plan updated |
| `model/rerouted` | Server→Client | Model was rerouted |
| `configWarning` | Server→Client | Configuration warning |
| `serverRequest/resolved` | Server→Client | Server request resolved |

## Transport Options

| Mode | How |
|---|---|
| stdio (default) | `codex app-server` — JSONL on stdin/stdout |
| WebSocket (experimental) | `codex app-server --listen ws://127.0.0.1:4500` — do NOT use in production |
