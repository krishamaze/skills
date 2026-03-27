#!/usr/bin/env node
// Thin bridge: Claude Code ↔ Codex app-server (one turn per invocation)
import { execSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Resolve codex binary (npm global wrappers aren't found by spawn on Windows) ---
function resolveCodexPath() {
  try {
    const cmd = process.platform === "win32" ? "where codex" : "which codex";
    return execSync(cmd, { encoding: "utf8" }).trim().split(/\r?\n/)[0];
  } catch {
    return "codex"; // fallback to bare name
  }
}
const CODEX_BIN = resolveCodexPath();

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
const tIdx = process.argv.indexOf("--timeout");
const ctxIdx = process.argv.indexOf("--context-cmd");
const inactivityMs = (tIdx !== -1 && process.argv[tIdx + 1]) ? parseInt(process.argv[tIdx + 1]) * 1000 : 60_000;
const projectDir = cIdx !== -1 && process.argv[cIdx + 1]
  ? resolve(process.argv[cIdx + 1])
  : resolve(__dirname, "..", "..", "..");
const stateKey = projectDir.replace(/[^a-zA-Z0-9]/g, "_");
const STATE_FILE = resolve(__dirname, `codex-state-${stateKey}.json`);
const contextCmd = ctxIdx !== -1 && process.argv[ctxIdx + 1] ? process.argv[ctxIdx + 1] : null;
const prompt = process.argv
  .filter((arg, idx) => {
    if (idx < 2 || arg === "--resume" || arg === "-C" || arg === "--timeout" || arg === "--context-cmd") return false;
    if (cIdx !== -1 && idx === cIdx + 1) return false;
    if (tIdx !== -1 && idx === tIdx + 1) return false;
    if (ctxIdx !== -1 && idx === ctxIdx + 1) return false;
    return true;
  })
  .join(" ");
if (!prompt) {
  console.error("Usage: node codex-bridge.mjs [--resume] [-C <project-dir>] [--timeout <seconds>] [--context-cmd <shell-cmd>] \"<prompt>\"");
  process.exit(1);
}

// --- State ---
let savedState = {};
if (existsSync(STATE_FILE)) {
  savedState = JSON.parse(readFileSync(STATE_FILE, "utf8"));
}

// --- Spawn app-server ---
const proc = spawn(CODEX_BIN, [
  "app-server",
  "-c", 'sandbox_mode="danger-full-access"',
  "-c", 'approval_policy="never"',
], {
  stdio: ["pipe", "pipe", "pipe"],
  cwd: projectDir,
});

const rl = createInterface({ input: proc.stdout });
let threadId = resume ? savedState.threadId || null : null;
let idCounter = 10;
let output = "";
let diffs = [];
let errors = [];
let tokenUsage = null;
let filesModified = [];
let handshakeDone = false;

const send = (msg) => proc.stdin.write(JSON.stringify(msg) + "\n");
const nextId = () => ++idCounter;

// --- Dangerous command check ---
const DANGEROUS = /rm\s+-rf\s+[/~]|DROP\s+TABLE|format\s+C:|shutdown|reboot/i;

// --- Inactivity timeout ---
let inactivityTimer;

function resetTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    errors.push(`Inactivity timeout: no events for ${Math.floor(inactivityMs / 1000)}s`);
    finish();
  }, inactivityMs);
}

function getChangedPaths(params = {}) {
  const directPaths = [
    params.path,
    params.filePath,
    params.targetPath,
    params.item?.path,
    params.item?.filePath,
    params.item?.targetPath,
  ].filter((path) => Boolean(path) && path !== "/dev/null");

  const diffPaths = [];
  if (typeof params.diff === "string") {
    diffPaths.push(...[
      ...params.diff.matchAll(/^diff --git a\/.+ b\/(.+)$/gm),
      ...params.diff.matchAll(/^\+\+\+\s+(?:b\/)?(.+)$/gm),
      ...params.diff.matchAll(/^rename to (.+)$/gm),
    ].map((match) => match[1]).filter((path) => Boolean(path) && path !== "/dev/null"));
  }

  return [...new Set([...directPaths, ...diffPaths])];
}

function getChangedPathInfo(params = {}) {
  const changedPaths = getChangedPaths(params);
  return changedPaths.length > 0 ? changedPaths.join(", ") : "unknown";
}

function finish() {
  clearTimeout(inactivityTimer);
  const result = { output: output.trim(), diffs, errors, threadId, tokenUsage };
  // Save state for resume
  writeFileSync(STATE_FILE, JSON.stringify({
    threadId,
    tokenUsage: tokenUsage || null,
    filesModified: [...new Set(filesModified)],
    turnCount: (savedState.turnCount || 0) + 1,
    lastPrompt: prompt,
    lastActivity: new Date().toISOString(),
  }, null, 2));
  console.log(JSON.stringify(result, null, 2));
  proc.kill();
  process.exit(errors.length > 0 ? 1 : 0);
}

// --- Event loop ---
resetTimer();

rl.on("line", (line) => {
  resetTimer();
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  if (msg.method === "item/started" && msg.params?.item?.type === "reasoning") {
    process.stderr.write("[codex] reasoning...\n");
  }
  if (msg.method === "item/started" && msg.params?.item?.type === "command") {
    process.stderr.write(`[codex] executing: ${msg.params.item.command?.command || "command"}\n`);
  }
  if (msg.method === "item/completed" && msg.params?.item?.type === "fileWrite") {
    process.stderr.write(`[codex] file changed: ${getChangedPathInfo(msg.params)}\n`);
  }
  if (msg.method === "turn/diff/updated") {
    process.stderr.write(`[codex] file changed: ${getChangedPathInfo(msg.params)}\n`);
  }
  if (msg.method === "turn/completed") {
    process.stderr.write("[codex] turn complete\n");
  }

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
    let contextOutput = "";
    if (contextCmd) {
      try {
        contextOutput = execSync(contextCmd, { cwd: projectDir, encoding: "utf8", timeout: 10_000 }).trim();
      } catch (e) {
        contextOutput = "context-cmd failed: " + e.message;
      }
    }
    const fullPrompt = contextOutput ? "Context:\n" + contextOutput + "\n\n" + prompt : prompt;
    // Now send the turn
    send({
      method: "turn/start",
      id: nextId(),
      params: { threadId, input: [{ type: "text", text: fullPrompt }] },
    });
    handshakeDone = true;
    return;
  }

  // Agent text output
  if (msg.method === "item/agentMessage/delta") {
    output += msg.params?.delta ?? "";
  }

  if (msg.method === "thread/tokenUsage/updated") {
    tokenUsage = msg.params?.tokenUsage;
  }

  // Diffs
  if (msg.method === "turn/diff/updated") {
    diffs.push(msg.params?.diff ?? msg.params);
    filesModified.push(...getChangedPaths(msg.params));
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
    const result = { output: "", diffs: [], errors, threadId: null, tokenUsage };
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
