#!/usr/bin/env node
// Thin bridge: Claude Code ↔ Codex app-server (one turn per invocation)
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config ---
function getModel() {
  try {
    const out = execSync('grep "^model" ~/.codex/config.toml', { encoding: "utf8" });
    const match = out.match(/"([^"]+)"/);
    return match ? match[1] : "gpt-5.4";
  } catch { return "gpt-5.4"; }
}

// --- Args ---
const resume = process.argv.includes("--resume");
const cIdx = process.argv.indexOf("-C");
const projectDir = cIdx !== -1 && process.argv[cIdx + 1]
  ? resolve(process.argv[cIdx + 1])
  : resolve(__dirname, "..", "..", "..");
const stateKey = projectDir.replace(/[^a-zA-Z0-9]/g, "_");
const STATE_FILE = resolve(__dirname, `codex-state-${stateKey}.json`);
const prompt = process.argv
  .filter((arg, idx) => {
    if (idx < 2 || arg === "--resume" || arg === "-C") return false;
    if (cIdx !== -1 && idx === cIdx + 1) return false;
    return true;
  })
  .join(" ");
if (!prompt) {
  console.error("Usage: node codex-bridge.mjs [--resume] [-C <project-dir>] \"<prompt>\"");
  process.exit(1);
}

// --- State ---
let savedState = {};
if (resume && existsSync(STATE_FILE)) {
  savedState = JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

// --- Spawn app-server ---
const proc = spawn("codex", [
  "app-server",
  "-c", 'sandbox_mode="danger-full-access"',
  "-c", 'approval_policy="never"',
], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: projectDir,
});

const rl = createInterface({ input: proc.stdout });
let threadId = savedState.threadId || null;
let idCounter = 10;
let output = "";
let diffs = [];
let errors = [];
let handshakeDone = false;

const send = (msg) => proc.stdin.write(JSON.stringify(msg) + "\n");
const nextId = () => ++idCounter;

// --- Dangerous command check ---
const DANGEROUS = /rm\s+-rf\s+[/~]|DROP\s+TABLE|format\s+C:|shutdown|reboot/i;

// --- Timeout: kill after 120s ---
const timeout = setTimeout(() => {
  errors.push("Timeout: turn did not complete in 120s");
  finish();
}, 300_000);

function finish() {
  clearTimeout(timeout);
  const result = { output: output.trim(), diffs, errors, threadId };
  // Save state for resume
  writeFileSync(STATE_FILE, JSON.stringify({ threadId }, null, 2));
  console.log(JSON.stringify(result, null, 2));
  proc.kill();
  process.exit(errors.length > 0 ? 1 : 0);
}

// --- Event loop ---
rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  // Handshake response: initialize
  if (msg.id === 0 && msg.result) {
    // Send initialized + thread/start
    send({ method: "initialized", params: {} });
    if (resume && threadId) {
      send({ method: "thread/fork", id: 1, params: { threadId } });
    } else {
      send({ method: "thread/start", id: 1, params: { model: getModel() } });
    }
    return;
  }

  // thread/start or thread/fork response
  if (msg.id === 1 && msg.result) {
    threadId = msg.result?.thread?.id || msg.result?.id || threadId;
    // Now send the turn
    send({
      method: "turn/start",
      id: nextId(),
      params: { threadId, input: [{ type: "text", text: prompt }] },
    });
    handshakeDone = true;
    return;
  }

  // Agent text output
  if (msg.method === "item/agentMessage/delta") {
    output += msg.params?.delta ?? "";
  }

  // Diffs
  if (msg.method === "turn/diff/updated") {
    diffs.push(msg.params?.diff ?? msg.params);
  }

  // Command approval
  if (msg.method === "item/commandExecution/requestApproval") {
    const { command } = msg.params || {};
    const safe = !DANGEROUS.test(command?.command || "");
    send({ id: msg.id, result: { decision: safe ? "accept" : "deny" } });
    if (!safe) errors.push(`Denied dangerous command: ${command?.command}`);
  }

  // Turn complete
  if (msg.method === "turn/completed") {
    finish();
  }

  // Errors
  if (msg.error) {
    errors.push(`RPC error: ${JSON.stringify(msg.error)}`);
  }
});

// Stderr capture
let stderrBuf = "";
proc.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });

proc.on("close", (code) => {
  if (code !== 0 && !handshakeDone) {
    errors.push(`app-server exited with code ${code}: ${stderrBuf.trim()}`);
    const result = { output: "", diffs: [], errors, threadId: null };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
});

// --- Start handshake ---
send({
  method: "initialize",
  id: 0,
  params: { clientInfo: { name: "claude-code-bridge", title: "Claude Code Bridge", version: "1.0.0" } },
});
