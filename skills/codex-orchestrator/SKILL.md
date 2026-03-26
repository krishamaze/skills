---
name: codex-orchestrator
description: >
  Authoritative guide for making an LLM fully operate OpenAI Codex CLI as its
  assistant — replacing the human at the keyboard. Covers all three orchestration
  tiers: codex exec (simple automation), codex app-server JSON-RPC (full stateful
  multi-turn control), and command/exec/write (interactive stdin / PTY passthrough
  for y/n prompts, passwords, OTP). Use this skill whenever the user mentions:
  "automate Codex", "LLM controls Codex", "outer LLM + Codex", "Codex orchestration",
  "programmatic Codex", "non-human Codex", or "LLM operate CLI". Do NOT use raw
  PTY injection into the Codex TUI — that is brittle and confirmed broken by
  upstream (see references/pty-tui-wall.md).
---

# Codex Orchestrator Skill

## Ground Truth (research-verified, March 2026)

Three official, stable mechanisms exist. Choose based on task complexity:

```
Simple one-shot task          →  Tier 1: codex exec
Multi-turn / stateful / LLM   →  Tier 2: codex app-server (JSON-RPC)
Interactive stdin (y/n, OTP)  →  Tier 3: command/exec/write (inside app-server)
```

> **Note:** 'Use Codex for everything' means route simple tasks through Tier 1 (codex exec), not app-server. Tier 2 is only needed for stateful multi-turn or LLM-in-the-loop orchestration.

---

## Tier 1 — `codex exec` (Simple Automation)

Non-interactive. One prompt → Codex works → exits. Good for CI, scripts, single tasks.

```bash
# Outer LLM builds this string and shells out
codex exec "refactor src/auth.ts to use async/await" --json
# --json = JSONL events stream to stdout, final answer to stdout
```

**Resume a session:**
```bash
codex exec --last "now add unit tests for what you just wrote"
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
4. Read stdout, decide next task
5. Repeat

**Limitation:** No approval handling. No mid-turn injection. Use Tier 2 for anything stateful.

---

## Tier 2 — `codex app-server` (Full LLM Orchestration)

The real mechanism. Bidirectional JSON-RPC over stdio. This is how VS Code, Xcode, JetBrains all drive Codex. An LLM spawns app-server as a child process and speaks JSONL over stdin/stdout.

### Protocol: JSON-RPC lite over JSONL stdio
- No `"jsonrpc":"2.0"` header on the wire
- One JSON object per line
- Fully bidirectional — server sends requests back to client (approvals)

### Model discovery (do this first)
Before writing any orchestrator, detect the configured model so thread/start uses the right value:
```bash
grep '^model' ~/.codex/config.toml | cut -d'"' -f2
```
Hardcoding a model name (e.g. o4-mini) will fail silently if the user's account does not support it. Always read from config.toml first.

### Handshake sequence (always in this order):
```jsonl
{"method":"initialize","id":0,"params":{"clientInfo":{"name":"my_llm_bot","title":"My LLM Bot","version":"1.0.0"}}}
{"method":"initialized","params":{}}
{"method":"thread/start","id":1,"params":{"model":"<MODEL_FROM_CONFIG>"}}
```

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
```jsonl
// Server sends (no id = notification the LLM must respond to):
{"method":"item/commandApproval/requested","params":{"itemId":"x","command":"rm -rf dist/"}}

// LLM responds:
{"method":"item/commandApproval/respond","id":99,"params":{"itemId":"x","decision":"allow"}}
// or "deny"
```

### Minimal Node.js orchestrator:
```javascript
import { spawn } from "node:child_process";
import readline from "node:readline";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const MODEL = process.env.CODEX_MODEL || "gpt-5.4"; // discover from config.toml
const proc = spawn("codex", ["app-server"], {
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
  if (msg.method === "item/commandApproval/requested") {
    const { itemId, command } = msg.params;
    const safe = await outerLLMApprove(command); // your LLM judges safety
    send({ method: "item/commandApproval/respond", id: Date.now(),
           params: { itemId, decision: safe ? "allow" : "deny" } });
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
app-server streams: item/commandOutput/delta with text "Do you want to continue? [y/N]"
           ↓
Outer LLM reads the delta, detects prompt pattern
           ↓
LLM calls: command/exec/write  → sends "y\n"
           ↓
Process continues
```

### command/exec/write call:
```jsonl
{"method":"command/exec/write","id":55,"params":{"sessionId":"<exec-session-id>","data":"y\n"}}
```

For resize:
```jsonl
{"method":"command/exec/resize","id":56,"params":{"sessionId":"<id>","cols":220,"rows":50}}
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

## Anti-patterns (Do NOT do these)

| Anti-pattern | Why wrong |
|---|---|
| PTY-inject keystrokes into Codex TUI | Brittle. Ratatui owns the TTY. Confirmed broken upstream (issue #15355). |
| `node-pty` to wrap `codex` TUI | Same problem. Two TTY owners conflict. |
| Parse TUI terminal escape codes | Fragile, breaks on any version update |
| `codex exec` for multi-turn | No state continuity between exec calls |
| `--full-auto` in sandboxed containers | `bwrap` fails silently → all writes fail. Use `--dangerously-bypass-approvals-and-sandbox` instead. |

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
// Fork from a previous session (= codex resume equivalent)
send({ method: "thread/fork", id: 3, params: { threadId: "prev-thread-id" } });

// Codex persists session rollout files — use --ephemeral to skip:
// spawn("codex", ["app-server", "--ephemeral"])
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
- **Tier 1:** Use `--dangerously-bypass-approvals-and-sandbox` instead of `--full-auto`
- **Tier 2:** Spawn with `--dangerously-bypass-approvals-and-sandbox`: `spawn("codex", ["app-server", "--dangerously-bypass-approvals-and-sandbox"])`
- **Root cause:** bubblewrap (`bwrap`) requires `CAP_NET_ADMIN` to configure loopback. Containers typically drop this capability.

---

## References
- `references/appserver-events.md` — Full event type catalogue
- `references/pty-tui-wall.md` — Why PTY injection into TUI fails (upstream issue #15355)
