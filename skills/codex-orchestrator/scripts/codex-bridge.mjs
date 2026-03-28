#!/usr/bin/env node
// Thin bridge: Claude Code ↔ Codex app-server (one turn per invocation)
import { execSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
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
    const configPath = resolve(process.env.HOME || process.env.USERPROFILE || "~", ".codex", "config.toml");
    const content = readFileSync(configPath, "utf8");
    const match = content.match(/^model\s*=\s*"([^"]+)"/m);
    return match ? match[1] : null;
  } catch { return null; }
}

// --- Args ---
const resume = process.argv.includes("--resume");
const cIdx = process.argv.indexOf("-C");
const tIdx = process.argv.indexOf("--timeout");
const ctxIdx = process.argv.indexOf("--context-cmd");
const sandboxIdx = process.argv.indexOf("--sandbox");
const approvalIdx = process.argv.indexOf("--approval");
const inactivityMs = (tIdx !== -1 && process.argv[tIdx + 1]) ? parseInt(process.argv[tIdx + 1]) * 1000 : 60_000;
const projectDir = cIdx !== -1 && process.argv[cIdx + 1]
  ? resolve(process.argv[cIdx + 1])
  : process.cwd();
const sandboxMode = sandboxIdx !== -1 && process.argv[sandboxIdx + 1] ? process.argv[sandboxIdx + 1] : "danger-full-access";
const approvalPolicy = approvalIdx !== -1 && process.argv[approvalIdx + 1] ? process.argv[approvalIdx + 1] : "never";
const stateKey = projectDir.replace(/[^a-zA-Z0-9]/g, "_");
const STATE_DIR = resolve(projectDir, ".codex");
mkdirSync(STATE_DIR, { recursive: true });
const STATE_FILE = resolve(STATE_DIR, `bridge-state-${stateKey}.json`);
const contextCmd = ctxIdx !== -1 && process.argv[ctxIdx + 1] ? process.argv[ctxIdx + 1] : null;
const prompt = process.argv
  .filter((arg, idx) => {
    if (idx < 2 || arg === "--resume" || arg === "-C" || arg === "--timeout" || arg === "--context-cmd" || arg === "--sandbox" || arg === "--approval") return false;
    if (cIdx !== -1 && idx === cIdx + 1) return false;
    if (tIdx !== -1 && idx === tIdx + 1) return false;
    if (ctxIdx !== -1 && idx === ctxIdx + 1) return false;
    if (sandboxIdx !== -1 && idx === sandboxIdx + 1) return false;
    if (approvalIdx !== -1 && idx === approvalIdx + 1) return false;
    return true;
  })
  .join(" ");
if (!prompt) {
  console.error("Usage: node codex-bridge.mjs [--resume] [-C <project-dir>] [--timeout <seconds>] [--context-cmd <shell-cmd>] [--sandbox <mode>] [--approval <policy>] \"<prompt>\"");
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
  "-c", `sandbox_mode="${sandboxMode}"`,
  "-c", `approval_policy="${approvalPolicy}"`,
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
let turnCompleted = false;
let finished = false;

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
  if (finished) return;
  finished = true;
  clearTimeout(inactivityTimer);
  const uniqueFiles = [...new Set(filesModified)];
  const result = { output: output.trim(), diffs, errors, threadId, tokenUsage };
  process.stderr.write(`[codex] done: ${uniqueFiles.length} files changed${errors.length ? `, ${errors.length} errors` : ""}\n`);
  // Save state for resume
  writeFileSync(STATE_FILE, JSON.stringify({
    threadId,
    tokenUsage: tokenUsage || null,
    filesModified: uniqueFiles,
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

  // Track file changes silently — summary printed once at completion
  if (msg.method === "item/completed" && msg.params?.item?.type === "fileWrite") {
    filesModified.push(...getChangedPaths(msg.params));
  }

  // Handshake response: initialize
  if (msg.id === 0 && msg.result) {
    // Send initialized + thread/start
    send({ method: "initialized", params: {} });
    if (resume && threadId) {
      send({ method: "thread/fork", id: 1, params: { threadId } });
    } else {
      const model = getModel();
      send({ method: "thread/start", id: 1, params: model ? { model } : {} });
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
    turnCompleted = true;
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
  if (handshakeDone && !turnCompleted && !finished) {
    errors.push(`app-server crashed mid-turn (exit code ${code})`);
    finish();
  }
});

// --- Start handshake ---
send({
  method: "initialize",
  id: 0,
  params: { clientInfo: { name: "claude-code-bridge", title: "Claude Code Bridge", version: "1.0.0" } },
});
