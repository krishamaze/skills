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
| `item/commandOutput/delta` | Server→Client | Shell command stdout/stderr chunk |
| `item/commandApproval/requested` | Server→Client | Server PAUSES turn, awaits response |

## Commands (Client→Server)

| Method | Purpose |
|---|---|
| `initialize` | Handshake (send first, always) |
| `initialized` | Acknowledge handshake (send second, always) |
| `thread/start` | Create new conversation thread |
| `thread/fork` | Fork from existing thread (= resume) |
| `turn/start` | Send user message / prompt |
| `turn/interrupt` | Cancel running turn |
| `item/commandApproval/respond` | Allow or deny a command approval request |
| `command/exec/write` | Inject stdin bytes into a running exec session |
| `command/exec/resize` | Resize PTY of running exec session |
| `command/exec/terminate` | Kill running exec session |
| `account/read` | Get auth state |
| `account/login/start` | Begin auth flow (apiKey or chatgpt) |
| `model/list` | List available models |
| `skills/list` | List AGENTS.md skills for cwd |

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

## Transport Options

| Mode | How |
|---|---|
| stdio (default) | `codex app-server` — JSONL on stdin/stdout |
| WebSocket (experimental) | `codex app-server --listen ws://127.0.0.1:4500` — do NOT use in production |
