# Codex Orchestrator — Protocol Reference

## Tier 1 — `codex exec` (Simple Automation)

Non-interactive. One prompt → Codex works → exits. Good for CI, scripts, single tasks.

```bash
# Outer LLM builds this string and shells out
codex exec "refactor src/auth.ts to use async/await" --json
# --json = JSONL events stream to stdout, final answer to stdout
```

**Resume a session:**
```bash
codex exec resume --last "now add unit tests for what you just wrote"
```

**Pipe prompt from LLM output:**
```bash
echo "fix all TypeScript errors" | codex exec -
```

**Key flags:**
```bash
# Full autonomous mode (auto-approves, keeps sandbox):
codex exec --full-auto "your prompt"

# Bypass sandbox entirely (needed in containers where bwrap fails):
codex exec --dangerously-bypass-approvals-and-sandbox "your prompt"

# Target a different directory:
codex exec -C /path/to/project "your prompt"

# Combine for fully autonomous remote edit:
codex exec --dangerously-bypass-approvals-and-sandbox -C /path/to/project "your prompt"
```

**What the outer LLM does:**
1. Decide the task
2. Build prompt string
3. Shell out `codex exec "<prompt>"` 
4. Parse stdout JSONL, decide next task
5. Repeat

**Limitation:** Approvals disabled by default in exec mode (headless, `approval_policy=never`). No mid-turn injection. Use Tier 2 for stateful or approval-aware orchestration.

---

## Tier 2 — `codex app-server` (Full LLM Orchestration)

The real mechanism. Bidirectional JSON-RPC over stdio. This is how VS Code, Xcode, JetBrains all drive Codex. An LLM spawns app-server as a child process and speaks JSONL over stdin/stdout.

### Protocol: JSON-RPC lite over JSONL stdio
- No `"jsonrpc":"2.0"` header on the wire
- One JSON object per line
- Fully bidirectional — server sends requests back to client (approvals)

### Model discovery (do this first)
Model resolution is layered: CLI `--model` flag wins, then config profile, then global `config.toml`. For app-server orchestration:
- **Option A:** Omit `model` in `thread/start` — the server uses its configured default. The `ThreadStartResponse` returns the resolved `model` and `modelProvider`.
- **Option B:** Call `model/list` first to discover available models, then pass one explicitly.
- **Quick check:** `grep '^model' ~/.codex/config.toml | cut -d'"' -f2`

Hardcoding a model name (e.g. `o4-mini`) will fail if the user's account does not support it.

### Handshake sequence (always in this order):
```jsonl
{"method":"initialize","id":0,"params":{"clientInfo":{"name":"my_llm_bot","title":"My LLM Bot","version":"1.0.0"}}}
{"method":"initialized","params":{}}
{"method":"thread/start","id":1,"params":{"model":"<MODEL_FROM_CONFIG>"}}
```

### Valid `-c` config override values
When spawning app-server with `-c` flags to override sandbox/approval behavior:
| Config key | Valid values |
|---|---|
| `sandbox_mode` | `read-only`, `workspace-write`, `danger-full-access` |
| `approval_policy` | `untrusted`, `on-failure`, `on-request`, `granular`, `never` |

### Send a turn (= what you type as human):
```jsonl
{"method":"turn/start","id":2,"params":{"threadId":"<id from thread/start response>","input":[{"type":"text","text":"fix all type errors in src/"}]}}
```

### Stream events back (LLM reads these):
```
item/started        → tool call began
item/completed      → tool call done
item/agentMessage/delta → streaming text output
turn/completed      → full turn done, token usage
turn/diff/updated   → file changes as unified diff
```

### Approval handling (server asks LLM, not human):
Server sends a **request** (has `id`) that the client must respond to:
```jsonl
// Server → Client (request, must respond):
{"method":"item/commandExecution/requestApproval","id":42,"params":{"threadId":"t","turnId":"u","itemId":"x","command":{"command":"rm -rf dist/"}}}

// Client → Server (response):
{"id":42,"result":{"decision":"accept"}}
// decisions: "accept", "acceptForSession", "deny"
```
Other approval request types: `item/fileChange/requestApproval`, `item/permissions/requestApproval`, `item/tool/requestUserInput`.

### Minimal Node.js orchestrator:
```javascript
import { spawn } from "node:child_process";
import readline from "node:readline";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const MODEL = process.env.CODEX_MODEL || "gpt-5.4"; // discover from config.toml
// NOTE: On Windows, resolve full path first: execSync("where codex").trim() — see scripts/codex-bridge.mjs for cross-platform implementation
const proc = spawn("codex", ["app-server", "-c", 'sandbox_mode="danger-full-access"', "-c", 'approval_policy="never"'], {
  stdio: ["pipe", "pipe", "inherit"],
  cwd: "/your/project",
});

const rl = readline.createInterface({ input: proc.stdout });
let threadId = null;
let turnBuffer = "";

const send = (msg) => proc.stdin.write(JSON.stringify(msg) + "\n");

rl.on("line", async (line) => {
  const msg = JSON.parse(line);

  // Capture thread ID
  if (msg.id === 1 && msg.result?.thread?.id) {
    threadId = msg.result.thread.id;
    await sendNextTurn("fix all TypeScript errors in src/");
  }

  // Collect agent output
  if (msg.method === "item/agentMessage/delta") {
    turnBuffer += msg.params?.delta ?? "";
  }

  // Turn complete → outer LLM decides next step
  if (msg.method === "turn/completed") {
    const next = await outerLLMDecide(turnBuffer);
    turnBuffer = "";
    if (next === "DONE") { proc.kill(); return; }
    await sendNextTurn(next);
  }

  // Handle approvals — LLM decides allow/deny
  if (msg.method === "item/commandExecution/requestApproval") {
    const { command } = msg.params;
    const safe = await outerLLMApprove(command?.command ?? ""); // your LLM judges safety
    send({ id: msg.id, result: { decision: safe ? "accept" : "deny" } });
  }
});

async function sendNextTurn(prompt) {
  send({ method: "turn/start", id: Date.now(),
         params: { threadId, input: [{ type: "text", text: prompt }] } });
}

async function outerLLMDecide(codexOutput) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514", max_tokens: 500,
    system: "You orchestrate Codex. Based on its last output, decide the next prompt to send. Reply DONE if goal achieved.",
    messages: [{ role: "user", content: `Codex output:\n${codexOutput}` }]
  });
  return res.content[0].text.trim();
}

async function outerLLMApprove(command) {
  // Replace with your LLM safety check
  const dangerous = /rm\s+-rf|DROP\s+TABLE|format\s+/i;
  return !dangerous.test(command);
}

// Handshake
send({ method: "initialize", id: 0, params: { clientInfo: { name: "bot", title: "Bot", version: "1.0" } } });
send({ method: "initialized", params: {} });
send({ method: "thread/start", id: 1, params: { model: MODEL } });
```

---

## Tier 3 — `command/exec/write` (Interactive stdin / PTY passthrough)

When Codex itself runs a shell command that asks for input (y/n, sudo password, OTP), the app-server exposes a `command/exec/write` method to inject stdin bytes into that running process.

### The LLM flow:
```
app-server streams: item/commandExecution/outputDelta with "Do you want to continue? [y/N]"
           ↓
Outer LLM reads the delta, detects prompt pattern
           ↓
LLM calls: command/exec/write  → sends "y\n"
           ↓
Process continues
```

### command/exec/write call:
```jsonl
{"method":"command/exec/write","id":55,"params":{"processId":"<process-id>","deltaBase64":"eQo=","closeStdin":false}}
```
`deltaBase64` is base64-encoded stdin bytes (`"eQo="` = `"y\n"`). Set `closeStdin: true` to close stdin after writing.

For resize:
```jsonl
{"method":"command/exec/resize","id":56,"params":{"processId":"<process-id>","size":{"rows":50,"cols":220}}}
```

### OTP pipeline (email OTP example):
```
app-server output: "Enter verification code:"
        ↓
Outer LLM detects pattern
        ↓
LLM calls Gmail MCP → search inbox for "verification code" last 2 min
        ↓
Extract 6-digit code
        ↓
command/exec/write → sends "123456\n"
```

### OTP types — what's solvable:
| Prompt | Solvable | Method |
|---|---|---|
| y/n / Enter | ✅ | command/exec/write |
| sudo password | ✅ | command/exec/write (inject known password) |
| CLI OTP (TOTP app) | ✅ | Generate via totp(secret) tool, inject |
| Email OTP | ✅ | Gmail MCP → extract → inject |
| SMS OTP | ⚠️ Hard | Needs SMS inbox MCP or Twilio API |
| Hardware key (YubiKey) | ❌ | Physical device, unsolvable |

---
## Slash command equivalents

| Human types | LLM does via app-server |
|---|---|
| `/clear` | `thread/start` (new thread) |
| `/compact` | Summarize `turnBuffer`, inject as context in next `turn/start` |
| `@src/auth.ts` | Just say "read src/auth.ts" — Codex uses its Read tool |
| `/model gpt-5.4` | Set in `thread/start` params |
| Enter mid-turn | `turn/start` with follow-up (server queues it) |
| Tab (queue next) | Send next `turn/start` after `turn/completed` |

---

## Session continuity

```javascript
// Resume an existing session (continues in place):
send({ method: "thread/resume", id: 3, params: { threadId: "prev-thread-id" } });

// Fork from a previous session (branches history into new thread):
send({ method: "thread/fork", id: 4, params: { threadId: "prev-thread-id" } });

// Ephemeral threads (in-memory only, not persisted to disk):
// Pass ephemeral: true in thread/start or thread/fork params
send({ method: "thread/start", id: 5, params: { ephemeral: true } });
```

---

## Schema generation (type safety)

```bash
# Generate TypeScript types for your exact Codex version:
codex app-server generate-ts --out ./schemas

# Or JSON Schema:
codex app-server generate-json-schema --out ./schemas
```

Always generate from your installed version. Protocol can drift between releases.

---

## Sandbox Troubleshooting

If `codex exec` or `apply_patch` fails with:
```
bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
```
The environment cannot create network namespaces (common in containers, VMs, CI). Fix:
- **Tier 1 (`codex exec`):** Use `--dangerously-bypass-approvals-and-sandbox` instead of `--full-auto`
- **Tier 2 (`codex app-server`):** Use `-c` flags when spawning: `codex app-server -c sandbox_mode="danger-full-access" -c approval_policy="never"`
- **Root cause:** bubblewrap (`bwrap`) requires `CAP_NET_ADMIN` to configure loopback. Containers typically drop this capability.

---
