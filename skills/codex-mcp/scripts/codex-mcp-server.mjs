#!/usr/bin/env node
// MCP server wrapping Codex app-server — zero external dependencies
// Exposes codex_run (modes: explore|inspect|build|debug|test|research) and codex_review as MCP tools
import { execSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

// --- Resolve codex binary ---
// Windows fix (3 cascading issues):
//   1. `where codex` returns multiple lines — the bare POSIX shell script AND
//      codex.cmd. .split()[0] picked the POSIX script → Node spawn() ENOENT.
//   2. shouldUseShell() checks for .cmd to set shell:true, but without .cmd it
//      always returned false.
//   3. Even with shell:true, backslash paths (C:\Users\...) break cmd.exe.
//      Normalize to forward slashes.
function resolveCodexPath() {
  try {
    const cmd = process.platform === "win32" ? "where codex" : "which codex";
    const lines = execSync(cmd, { encoding: "utf8" }).trim().split(/\r?\n/);

    let selected;
    if (process.platform === "win32") {
      // Prefer the .cmd wrapper — Node can't spawn bare POSIX scripts on Windows
      selected = lines.find((l) => /\.cmd$/i.test(l.trim())) || lines[0];
    } else {
      selected = lines[0];
    }

    // Normalize to forward slashes — cmd.exe misparses backslashes with shell:true
    return selected.trim().replace(/\\/g, "/");
  } catch {
    return null;
  }
}

function getModel() {
  try {
    const configPath = resolve(
      process.env.HOME || process.env.USERPROFILE || homedir(),
      ".codex",
      "config.toml"
    );
    const content = readFileSync(configPath, "utf8");
    const match = content.match(/^model\s*=\s*"([^"]+)"/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

const CODEX_BIN = resolveCodexPath();
const DANGEROUS = /rm\s+-rf\s+[/~]|DROP\s+TABLE|format\s+C:|\bshutdown\b|\breboot\b/i;
const SHOULD_LOG_APP_SERVER = process.platform === "win32";

function shouldUseShell(commandPath) {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(commandPath || "");
}

function formatLaunch(command, args, useShell) {
  const parts = [command, ...args].map((part) => JSON.stringify(String(part)));
  return `${useShell ? "[shell] " : ""}${parts.join(" ")}`;
}

function stderrTail(stderr, maxLines = 20) {
  const trimmed = stderr.trim();
  if (!trimmed) return "";
  const lines = trimmed.split(/\r?\n/);
  return lines.slice(-maxLines).join("\n");
}

function logAppServer(message) {
  if (!SHOULD_LOG_APP_SERVER) return;
  process.stderr.write(`[codex-mcp] ${message}\n`);
}

// --- App-server process pools (separate namespaces for run vs review) ---
const runServers    = new Map(); // projectDir → server (for codex_run)
const reviewServers = new Map(); // projectDir → server (for codex_review)
const reviewThreadIds = new Set(); // threadIds that belong to review namespace

// --- Thread registry (memory/codex-threads.json per project) ---
const initializedDirs = new Set();

function registryFile(projectDir) {
  return join(projectDir, "memory", "codex-threads.json");
}

function readRegistry(projectDir) {
  const file = registryFile(projectDir);
  let registry = { session: null, threads: [] };
  try { registry = JSON.parse(readFileSync(file, "utf8")); } catch (err) {
    if (existsSync(file)) {
      process.stderr.write(`[codex-mcp] Warning: failed to parse registry at ${file}: ${err.message}\n`);
    }
  }
  if (!Array.isArray(registry.threads)) registry.threads = [];
  return registry;
}

function writeRegistry(projectDir, registry) {
  const dir = join(projectDir, "memory");
  mkdirSync(dir, { recursive: true });
  writeFileSync(registryFile(projectDir), JSON.stringify(registry, null, 2));
}

function initRegistry(projectDir) {
  if (initializedDirs.has(projectDir)) return;
  initializedDirs.add(projectDir);
  const registry = readRegistry(projectDir);
  for (const thread of registry.threads) {
    if (thread?.tool === "codex_review" && thread.thread_id) {
      reviewThreadIds.add(thread.thread_id);
    }
  }
  registry.session = new Date().toISOString();
  writeRegistry(projectDir, registry);
}

// Parses CODEX_THREAD line from output without stripping — line stays visible to orchestrator
function parseThreadSummary(output) {
  const match = output.match(/\nCODEX_THREAD:\s*([^|\n]+?)\s*\|\s*(.+)$/m);
  if (!match) return { topic: null, summary: null };
  return { topic: match[1].trim(), summary: match[2].trim() };
}

function upsertThread(projectDir, { thread_id, tool, mode, status, topic, summary }) {
  let registry = readRegistry(projectDir);
  registry.session = new Date().toISOString();
  const existing = registry.threads.find(t => t.thread_id === thread_id);
  if (existing) {
    // Codex re-labelled the task — update topic and summary, preserve status (orchestrator owns that)
    existing.tool = tool;
    existing.mode = mode || null;
    existing.status = status;
    if (topic) existing.topic = topic;
    if (summary) existing.summary = summary;
    existing.updated_at = new Date().toISOString();
  } else {
    registry.threads.push({
      thread_id,
      tool,
      mode: mode || null,
      topic: topic || null,
      summary: summary || null,
      status,
      created_at: new Date().toISOString(),
    });
  }
  if (tool === "codex_review") {
    reviewThreadIds.add(thread_id);
  } else {
    reviewThreadIds.delete(thread_id);
  }
  writeRegistry(projectDir, registry);
}

function getThreadRecord(projectDir, threadId) {
  return readRegistry(projectDir).threads.find((t) => t.thread_id === threadId) || null;
}

function getChangedPaths(params = {}) {
  const directPaths = [
    params.path, params.filePath, params.targetPath,
    params.item?.path, params.item?.filePath, params.item?.targetPath,
  ].filter((p) => Boolean(p) && p !== "/dev/null");

  const diffPaths = [];
  if (typeof params.diff === "string") {
    diffPaths.push(
      ...[
        ...params.diff.matchAll(/^diff --git a\/.+ b\/(.+)$/gm),
        ...params.diff.matchAll(/^\+\+\+\s+(?:b\/)?(.+)$/gm),
        ...params.diff.matchAll(/^rename to (.+)$/gm),
      ]
        .map((m) => m[1])
        .filter((p) => Boolean(p) && p !== "/dev/null")
    );
  }
  return [...new Set([...directPaths, ...diffPaths])];
}

function startThread(server, params = {}) {
  const requestId = server.nextId();
  return new Promise((resolve, reject) => {
    server.pendingThreadStarts.set(requestId, { resolve, reject, method: "thread/start" });
    server.send({ method: "thread/start", id: requestId, params });
  });
}

function resumeThread(server, threadId) {
  const requestId = server.nextId();
  return new Promise((resolve, reject) => {
    server.pendingThreadStarts.set(requestId, { resolve, reject, method: "thread/resume" });
    server.send({ method: "thread/resume", id: requestId, params: { threadId } });
  });
}

function failServer(serverMap, key, server, message) {
  if (server.failed) return;
  server.failed = true;
  serverMap.delete(key);
  logAppServer(message);

  if (!server.ready) {
    server.readyReject?.(new Error(message));
  }

  for (const pendingThread of server.pendingThreadStarts.values()) {
    pendingThread.reject(new Error(message));
  }
  server.pendingThreadStarts.clear();

  for (const pending of server.pending.values()) {
    if (!pending.done) {
      pending.errors.push(message);
      completeTurn(pending);
    }
  }
}

function spawnServer(projectDir, serverMap, sandboxMode = "danger-full-access", approvalPolicy = "never") {
  if (serverMap.has(projectDir)) return serverMap.get(projectDir);
  const key = projectDir;
  const appServerArgs = [
    "app-server",
    "--enable", "multi_agent",
    "--enable", "fast_mode",
    "-c", "service_tier=\"fast\"",
    "-c", `sandbox_mode="${sandboxMode}"`,
    "-c", `approval_policy="${approvalPolicy}"`,
  ];
  const useShell = shouldUseShell(CODEX_BIN);
  const launchSummary = formatLaunch(CODEX_BIN, appServerArgs, useShell);

  logAppServer(`starting app-server for ${projectDir}: ${launchSummary}`);

  const proc = spawn(CODEX_BIN, appServerArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: projectDir,
    shell: useShell,
    windowsHide: true,
  });

  const rl = createInterface({ input: proc.stdout });
  const server = {
    proc,
    rl,
    threadId: null,
    idCounter: 10,
    ready: false,
    readyPromise: null,
    readyResolve: null,
    readyReject: null,
    pending: new Map(), // id → { resolve, reject, output, diffs, errors, filesModified, tokenUsage, timer }
    pendingThreadStarts: new Map(),
    currentTurn: null,
    turnQueue: Promise.resolve(),
    stderr: "",
    failed: false,
    launchSummary,
  };

  // Create ready promise
  server.readyPromise = new Promise((resolve, reject) => {
    server.readyResolve = resolve;
    server.readyReject = reject;
  });

  const send = (msg) => proc.stdin.write(JSON.stringify(msg) + "\n");
  server.send = send;
  server.nextId = () => ++server.idCounter;

  // Event loop
  rl.on("line", (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }

    // Handshake response
    if (msg.id === 0 && msg.result) {
      send({ method: "initialized", params: {} });
      const model = getModel();
      startThread(server, model ? { model } : {})
        .then((threadId) => {
          server.threadId = threadId;
          server.ready = true;
          logAppServer(`app-server ready for ${projectDir}; thread ${threadId}`);
          server.readyResolve?.();
        })
        .catch((error) => {
          server.readyReject?.(error);
        });
      return;
    }

    // thread/start response
    if (msg.id !== undefined && server.pendingThreadStarts.has(msg.id)) {
      const pendingThread = server.pendingThreadStarts.get(msg.id);
      server.pendingThreadStarts.delete(msg.id);

      if (msg.error) {
        pendingThread.reject(new Error(`${pendingThread.method} failed: ${JSON.stringify(msg.error)}`));
        return;
      }

      const nextThreadId = msg.result?.thread?.id || msg.result?.id || null;
      if (!nextThreadId) {
        pendingThread.reject(new Error(`${pendingThread.method} returned no thread id: ${line}`));
        return;
      }

      server.threadId = nextThreadId;
      pendingThread.resolve(nextThreadId);
      return;
    }

    if (msg.error) {
      const activeTurn = server.currentTurn;
      if (activeTurn) {
        activeTurn.errors.push(`RPC error: ${JSON.stringify(msg.error)}`);
        completeTurn(activeTurn);
      }
      return;
    }

    // Find active pending turn
    const activeTurn = server.currentTurn;

    if (!activeTurn) return;

    // Reset timeout on any activity
    if (activeTurn.timer) {
      clearTimeout(activeTurn.timer);
      activeTurn.timer = setTimeout(() => {
        activeTurn.errors.push("Inactivity timeout");
        completeTurn(activeTurn);
      }, activeTurn.timeoutMs);
    }

    // Agent text output
    if (msg.method === "item/agentMessage/delta") {
      activeTurn.output += msg.params?.delta ?? "";
    }

    // Server-side error notification (e.g. rate limit exceeded, system error).
    // These arrive as {method: "error", params: {error: {message: "..."}}} —
    // distinct from JSON-RPC error responses which have msg.error at top level.
    if (msg.method === "error") {
      const errMsg = msg.params?.error?.message || JSON.stringify(msg.params);
      activeTurn.errors.push(`Codex error: ${errMsg}`);
    }

    // Token usage
    if (msg.method === "thread/tokenUsage/updated") {
      activeTurn.tokenUsage = msg.params?.tokenUsage;
    }

    // Diffs
    if (msg.method === "turn/diff/updated") {
      activeTurn.diffs.push(msg.params?.diff ?? msg.params);
      activeTurn.filesModified.push(...getChangedPaths(msg.params));
    }

    // File changes
    if (msg.method === "item/completed" && msg.params?.item?.type === "fileWrite") {
      activeTurn.filesModified.push(...getChangedPaths(msg.params));
    }

    // --- Approval handling ---
    // Command execution approval (original handler)
    if (msg.method === "item/commandExecution/requestApproval") {
      const { command } = msg.params || {};
      const safe = !DANGEROUS.test(command?.command || "");
      send({ id: msg.id, result: { decision: safe ? "accept" : "deny" } });
      if (!safe) activeTurn.errors.push(`Denied dangerous command: ${command?.command}`);
      return;
    }

    // File change approval — auto-accept (matches approval_policy="never")
    if (msg.method === "item/fileChange/requestApproval") {
      send({ id: msg.id, result: { decision: "accept" } });
      return;
    }

    // Permissions approval — auto-accept (matches approval_policy="never")
    if (msg.method === "item/permissions/requestApproval") {
      send({ id: msg.id, result: { decision: "accept" } });
      return;
    }

    // Tool forwarding — not supported by this wrapper. Return error so
    // the app-server doesn't hang waiting for a tool result.
    if (msg.method === "item/tool/requestUserInput" || msg.method === "item/tool/call") {
      send({ id: msg.id, error: { code: -32601, message: "Tool forwarding not supported by codex-mcp wrapper" } });
      return;
    }

    // Turn complete
    if (msg.method === "turn/completed") {
      // Extract error from failed turns (e.g. rate limit, model error)
      const turnError = msg.params?.turn?.error;
      if (turnError?.message && !activeTurn.errors.some(e => e.includes(turnError.message))) {
        activeTurn.errors.push(`Turn failed: ${turnError.message}`);
      }
      completeTurn(activeTurn);
      return;
    }

    // --- Catch-all for unhandled server requests ---
    // Notifications (no id) are safe to ignore. Requests (have id) must get
    // a response or the app-server blocks forever.
    if (msg.method && msg.id !== undefined) {
      process.stderr.write(`[codex-mcp] Unhandled server request: ${msg.method} (id=${msg.id})\n`);
      send({ id: msg.id, error: { code: -32601, message: `Method not handled: ${msg.method}` } });
    }
  });

  proc.stderr.on("data", (chunk) => {
    server.stderr += chunk.toString();
  });

  proc.on("error", (error) => {
    const detail = `app-server failed to start for ${projectDir}: ${server.launchSummary}; ${error.message}`;
    failServer(serverMap, key, server, detail);
  });

  proc.on("close", (code, signal) => {
    const stderr = stderrTail(server.stderr);
    const status = signal ? `signal ${signal}` : `code ${code}`;
    const detail = stderr ? `; stderr tail:\n${stderr}` : "";
    const phase = server.ready ? "exited" : "exited during startup";
    failServer(
      serverMap,
      key,
      server,
      `app-server ${phase} for ${projectDir} (${status}): ${server.launchSummary}${detail}`
    );
  });

  // Start handshake
  send({
    method: "initialize",
    id: 0,
    params: { clientInfo: { name: "codex-mcp", title: "Codex MCP Server", version: "1.0.0" } },
  });

  serverMap.set(key, server);
  return server;
}

function completeTurn(turn) {
  if (turn.done) return;
  turn.done = true;
  clearTimeout(turn.timer);
  const uniqueFiles = [...new Set(turn.filesModified)];
  turn.server.pending.delete(turn.id);
  if (turn.server.currentTurn === turn) {
    turn.server.currentTurn = null;
  }
  turn.resolve({
    output: turn.output.trim(),
    diffs: turn.diffs,
    errors: turn.errors,
    threadId: turn.threadId,
    filesModified: uniqueFiles,
    tokenUsage: turn.tokenUsage,
  });
}

async function executeTurn(projectDir, prompt, options = {}) {
  const { threadId = null, timeout = 60, contextCmd = null, serverMap = runServers } = options;
  const server = spawnServer(projectDir, serverMap);
  await server.readyPromise;

  const runTurn = async () => {
    // Use provided threadId or start a new thread
    let activeThreadId = threadId;
    if (activeThreadId) {
      if (server.threadId !== activeThreadId) {
        activeThreadId = await resumeThread(server, activeThreadId);
      }
    } else {
      const model = getModel();
      activeThreadId = await startThread(server, model ? { model } : {});
    }

    // Build prompt with context
    let fullPrompt = prompt;
    if (contextCmd) {
      try {
        const ctx = execSync(contextCmd, { cwd: projectDir, encoding: "utf8", timeout: 10_000 }).trim();
        fullPrompt = "Context:\n" + ctx + "\n\n" + prompt;
      } catch (e) {
        fullPrompt = "Context (failed): " + e.message + "\n\n" + prompt;
      }
    }

    const turnId = server.nextId();

    return new Promise((resolvePromise, reject) => {
      const turn = {
        id: turnId,
        server,
        threadId: activeThreadId,
        output: "",
        diffs: [],
        errors: [],
        filesModified: [],
        tokenUsage: null,
        done: false,
        resolve: resolvePromise,
        reject,
        timeoutMs: timeout * 1000,
        timer: setTimeout(() => {
          turn.errors.push(`Inactivity timeout: no events for ${timeout}s`);
          completeTurn(turn);
          turn.server.proc.kill();
        }, timeout * 1000),
      };

      server.pending.set(turnId, turn);
      server.currentTurn = turn;

      server.send({
        method: "turn/start",
        id: turnId,
        params: {
          threadId: activeThreadId,
          input: [{ type: "text", text: fullPrompt }],
        },
      });
    });
  };

  const resultPromise = server.turnQueue.then(runTurn, runTurn);
  server.turnQueue = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

// --- MCP Protocol Handler ---
const mcpRl = createInterface({ input: process.stdin });

function mcpSend(response) {
  process.stdout.write(JSON.stringify(response) + "\n");
}

function mcpResult(id, result) {
  mcpSend({ jsonrpc: "2.0", id, result });
}

function mcpError(id, code, message) {
  mcpSend({ jsonrpc: "2.0", id, error: { code, message } });
}

function formatResult(result) {
  const summary = [];
  if (result.output) summary.push(result.output);
  if (result.filesModified.length > 0) {
    summary.push(`\nFiles modified: ${result.filesModified.join(", ")}`);
  }
  if (result.errors.length > 0) {
    summary.push(`\nErrors: ${result.errors.join("; ")}`);
  }

  // Status signal matching the SKILL.md enum (DONE/EMPTY/ERROR/TIMEOUT)
  let status = "DONE";
  if (result.errors.some((e) => /timeout/i.test(e))) status = "TIMEOUT";
  else if (result.errors.length > 0) status = "ERROR";
  else if (!result.output?.trim()) status = "EMPTY";

  return {
    content: [{ type: "text", text: summary.join("\n") || `Status: EMPTY — codex produced no output.` }],
    structuredContent: {
      status,
      output: result.output,
      diffs: result.diffs,
      errors: result.errors,
      threadId: result.threadId,
      filesModified: result.filesModified,
      tokenUsage: result.tokenUsage,
    },
    isError: result.errors.length > 0,
  };
}

// --- Role prefixes: injected per turn so behavioral contract holds even deep in context ---
const ROLE_PREFIX = {
  explore:  "EXPLORE MODE: Read and navigate the local codebase only. Treat any attempt to write, create, or delete files as a hard error — stop and report it instead. Return structured findings: file paths, function names, line numbers, and a concise summary. Use subagents to parallelize file reading across directories.",
  inspect:  "INSPECT MODE: Perform targeted read-only checks using explicitly provided files, injected context, or a narrow local scope. Do NOT write, create, or delete files. If the task reads code or config, cite file paths and line numbers when relevant. If the task is driven by injected context or another explicitly provided read-only input, report that input directly and concisely. Use subagents if checking multiple files or configs.",
  build:    "BUILD MODE: Write, edit, create, and run code. Make minimal targeted changes unless explicitly asked to refactor. After completing, state clearly what you changed and why. Use subagents to parallelize work across files when touching multiple files.",
  debug:    "DEBUG MODE: Follow this exact sequence — (1) REPRODUCE: run the failing command or test to confirm the issue. (2) DIAGNOSE: trace the root cause through file reads and searches, do not guess. (3) FIX: make the minimal change that resolves the root cause. (4) VERIFY: run the failing command or test again and confirm it passes. Report each step. Use subagents to parallelize diagnosis across files.",
  test:     "TEST MODE: Write or run tests as requested. Cover edge cases and failure modes, not just the happy path. After running: report total passed, total failed, and for each failure — file path, test name, and assertion detail. Use subagents to parallelize test writing and execution.",
  research: "RESEARCH MODE: Use web search to gather current, accurate information. Do NOT write, create, or modify any files. Return a structured summary with: key findings, relevant sources with URLs, and any caveats about recency or reliability. Use subagents to search multiple topics in parallel.",
};

const RUN_SCHEMA = {
  type: "object",
  properties: {
    mode: {
      type: "string",
      enum: ["explore", "inspect", "build", "debug", "test", "research"],
      description: "explore: broad local codebase discovery | inspect: targeted read-only or context-driven checks | build: write/edit/run code | debug: reproduce→diagnose→fix→verify | test: write/run tests | research: web search only, no file writes",
    },
    prompt: { type: "string", description: "The task for Codex. Include file paths, function names, expected outcome, and constraints." },
    thread_id: { type: "string", description: "Continue an existing run thread. Omit to start a new thread. Never pass a thread_id returned by codex_review." },
    project_dir: { type: "string", description: "Project directory. Defaults to cwd." },
    timeout: { type: "number", description: "Inactivity timeout in seconds. Default 60." },
    context_cmd: { type: "string", description: "Shell command whose stdout is prepended as context before the prompt." },
  },
  required: ["mode", "prompt"],
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    prompt: { type: "string", description: "What to review. Always include: (1) the original requirement, (2) what was built. Codex reads code fresh — give it the context it needs to evaluate correctly." },
    thread_id: { type: "string", description: "Continue an existing review thread for follow-up questions. Omit to start a fresh review. Never pass a thread_id returned by codex_run." },
    project_dir: { type: "string", description: "Project directory. Defaults to cwd." },
    timeout: { type: "number", description: "Inactivity timeout in seconds. Default 60." },
  },
  required: ["prompt"],
};

const REVIEW_ROLE_PREFIX = "REVIEW MODE: Evaluate the code independently — read files fresh. Do NOT fix anything. List: bugs, gaps, missing edge cases, deviations from the stated requirement. Be specific with file paths and line numbers.";

// Appended to every prompt — Codex self-labels the thread. Output is NOT stripped; line is visible to orchestrator.
const THREAD_SUFFIX = `

---
At the very end of your response, after all other content, append exactly one line in this format:
CODEX_THREAD: {module/action} | {one sentence: what was done or found}
Example: CODEX_THREAD: auth/map | Mapped all exported auth functions and identified 3 missing null checks`;

const TOOLS = [
  {
    name: "codex_run",
    description: "Execute a task through Codex. Choose mode: explore|inspect|build|debug|test|research. Pass thread_id to continue, omit to start fresh.",
    inputSchema: RUN_SCHEMA,
  },
  {
    name: "codex_review",
    description: "Independent code review in an isolated Codex thread. Pass thread_id to follow up within an existing review.",
    inputSchema: REVIEW_SCHEMA,
  },
];

mcpRl.on("line", async (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    mcpError(null, -32700, "Parse error");
    return;
  }

  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      mcpResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "codex-mcp", version: "1.0.0" },
      });
      break;

    case "notifications/initialized":
      // Client acknowledgement, no response needed
      break;

    case "resources/list":
      // This server exposes tools only — return empty list so clients don't error
      mcpResult(id, { resources: [] });
      break;

    case "tools/list":
      mcpResult(id, { tools: TOOLS });
      break;

    case "tools/call": {
      const { name, arguments: args = {} } = params || {};

      if (!CODEX_BIN) {
        mcpResult(id, {
          content: [{ type: "text", text: "Codex CLI not found. Install with: npm install -g @openai/codex" }],
          isError: true,
        });
        break;
      }

      if (name !== "codex_run" && name !== "codex_review") {
        mcpError(id, -32602, `Unknown tool: ${name}`);
        break;
      }

      if (typeof args.prompt !== "string" || args.prompt.trim() === "") {
        mcpError(id, -32602, "Missing required string argument: prompt");
        break;
      }

      const projectDir = resolve(args.project_dir || process.cwd());
      if (!existsSync(projectDir)) {
        mcpResult(id, {
          content: [{ type: "text", text: `Project directory does not exist: ${projectDir}` }],
          isError: true,
        });
        break;
      }

      const timeout = args.timeout || 60;

      try {
        if (name === "codex_run") {
          const mode = args.mode;
          if (!ROLE_PREFIX[mode]) {
            mcpError(id, -32602, `Invalid mode: "${mode}". Must be one of: explore, inspect, build, debug, test, research`);
            break;
          }

          // Namespace isolation — reject review thread_ids in run
          const threadRecord = args.thread_id ? getThreadRecord(projectDir, args.thread_id) : null;
          if (args.thread_id && (threadRecord?.tool === "codex_review" || reviewThreadIds.has(args.thread_id))) {
            mcpError(id, -32602, `thread_id "${args.thread_id}" belongs to a review thread. Use codex_review to continue it.`);
            break;
          }

          const fullPrompt = ROLE_PREFIX[mode] + "\n\n" + args.prompt + THREAD_SUFFIX;
          initRegistry(projectDir);
          const result = await executeTurn(projectDir, fullPrompt, {
            threadId: args.thread_id || null,
            timeout,
            contextCmd: args.context_cmd || null,
            serverMap: runServers,
          });

          if (result.threadId) {
            const { topic, summary } = parseThreadSummary(result.output);
            upsertThread(projectDir, {
              thread_id: result.threadId,
              tool: "codex_run",
              mode,
              status: "active",
              topic,
              summary,
            });
          }

          mcpResult(id, formatResult(result));

        } else {
          // codex_review

          // Namespace isolation — reject run thread_ids in review
          const threadRecord = args.thread_id ? getThreadRecord(projectDir, args.thread_id) : null;
          if (args.thread_id && threadRecord?.tool && threadRecord.tool !== "codex_review") {
            mcpError(id, -32602, `thread_id "${args.thread_id}" belongs to a run thread. Use codex_run to continue it.`);
            break;
          }
          if (args.thread_id && !threadRecord && !reviewThreadIds.has(args.thread_id)) {
            mcpError(id, -32602, `Unknown review thread_id "${args.thread_id}". Resume only thread_ids previously returned by codex_review.`);
            break;
          }

          const fullPrompt = REVIEW_ROLE_PREFIX + "\n\n" + args.prompt + THREAD_SUFFIX;
          initRegistry(projectDir);
          const result = await executeTurn(projectDir, fullPrompt, {
            threadId: args.thread_id || null,
            timeout,
            serverMap: reviewServers,
          });

          // Register threadId in review namespace
          if (result.threadId) {
            const { topic, summary } = parseThreadSummary(result.output);
            upsertThread(projectDir, {
              thread_id: result.threadId,
              tool: "codex_review",
              mode: null,
              status: "review",
              topic,
              summary,
            });
          }

          mcpResult(id, formatResult(result));
        }
      } catch (err) {
        mcpResult(id, {
          content: [{ type: "text", text: `Codex error: ${err.message}` }],
          isError: true,
        });
      }
      break;
    }

    default:
      // Notifications and unknown methods — ignore gracefully
      if (id !== undefined) {
        mcpError(id, -32601, `Method not found: ${method}`);
      }
      break;
  }
});

// Clean shutdown
process.on("SIGINT", () => {
  for (const server of runServers.values()) server.proc.kill();
  for (const server of reviewServers.values()) server.proc.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  for (const server of runServers.values()) server.proc.kill();
  for (const server of reviewServers.values()) server.proc.kill();
  process.exit(0);
});

process.stderr.write("[codex-mcp] server started\n");
