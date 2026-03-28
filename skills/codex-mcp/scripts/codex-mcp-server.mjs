#!/usr/bin/env node
// MCP server wrapping Codex app-server — zero external dependencies
// Exposes codex_execute, codex_resume, codex_review as MCP tools
import { execSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// --- Resolve codex binary ---
function resolveCodexPath() {
  try {
    const cmd = process.platform === "win32" ? "where codex" : "which codex";
    return execSync(cmd, { encoding: "utf8" }).trim().split(/\r?\n/)[0];
  } catch {
    return null;
  }
}

function getModel() {
  try {
    const configPath = resolve(
      process.env.HOME || process.env.USERPROFILE || "~",
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
const DANGEROUS = /rm\s+-rf\s+[/~]|DROP\s+TABLE|format\s+C:|shutdown|reboot/i;

// --- App-server process pool (one per projectDir) ---
const servers = new Map(); // projectDir → { proc, rl, threadId, ready, pending }

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
    server.pendingThreadStarts.set(requestId, { resolve, reject });
    server.send({ method: "thread/start", id: requestId, params });
  });
}

function spawnServer(projectDir, sandboxMode = "danger-full-access", approvalPolicy = "never") {
  const key = projectDir;
  if (servers.has(key)) return servers.get(key);

  const proc = spawn(CODEX_BIN, [
    "app-server",
    "-c", `sandbox_mode="${sandboxMode}"`,
    "-c", `approval_policy="${approvalPolicy}"`,
  ], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: projectDir,
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
        pendingThread.reject(new Error(`thread/start failed: ${JSON.stringify(msg.error)}`));
        return;
      }

      const nextThreadId = msg.result?.thread?.id || msg.result?.id || null;
      if (!nextThreadId) {
        pendingThread.reject(new Error(`thread/start returned no thread id: ${line}`));
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

    // Approval handling
    if (msg.method === "item/commandExecution/requestApproval") {
      const { command } = msg.params || {};
      const safe = !DANGEROUS.test(command?.command || "");
      send({ id: msg.id, result: { decision: safe ? "accept" : "deny" } });
      if (!safe) activeTurn.errors.push(`Denied dangerous command: ${command?.command}`);
    }

    // Turn complete
    if (msg.method === "turn/completed") {
      completeTurn(activeTurn);
    }
  });

  proc.stderr.on("data", (chunk) => {
    server.stderr += chunk.toString();
  });

  proc.on("close", (code) => {
    servers.delete(key);
    if (!server.ready) {
      const stderr = server.stderr.trim();
      const detail = stderr ? `: ${stderr}` : "";
      server.readyReject?.(new Error(`app-server exited during startup (code ${code})${detail}`));
    }

    for (const pendingThread of server.pendingThreadStarts.values()) {
      pendingThread.reject(new Error(`app-server exited before thread/start completed (code ${code})`));
    }
    server.pendingThreadStarts.clear();

    // Fail all pending turns
    for (const pending of server.pending.values()) {
      if (!pending.done) {
        pending.errors.push(`app-server exited (code ${code})`);
        completeTurn(pending);
      }
    }
  });

  // Start handshake
  send({
    method: "initialize",
    id: 0,
    params: { clientInfo: { name: "codex-mcp", title: "Codex MCP Server", version: "1.0.0" } },
  });

  servers.set(key, server);
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
    threadId: turn.server.threadId || turn.threadId,
    filesModified: uniqueFiles,
    tokenUsage: turn.tokenUsage,
  });
}

async function executeTurn(projectDir, prompt, options = {}) {
  const { resume = false, newThread = false, timeout = 60, contextCmd = null } = options;
  const server = spawnServer(projectDir);
  await server.readyPromise;

  const runTurn = async () => {
    if (newThread && !resume) {
      const model = getModel();
      await startThread(server, model ? { model } : {});
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
        threadId: server.threadId,
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
          threadId: server.threadId,
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

  return {
    content: [{ type: "text", text: summary.join("\n") || "Codex completed with no output." }],
    structuredContent: {
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

// --- Role prefixes: baked-in instructions per task type ---
// These are prepended to the user's prompt so Codex behaves correctly
// even if the orchestrator's skill instructions have faded from context.
const ROLE_PREFIX = {
  codex_search: "You are in SEARCH mode. Read and explore only — do NOT modify, create, or delete any files. Return structured findings: file paths, function names, line numbers, and a brief summary of what you found. Be thorough but concise.",
  codex_review: "You are in REVIEW mode. Evaluate the code independently — read the files fresh. Do NOT fix anything unless explicitly asked. List: bugs, gaps, missing edge cases, deviations from the stated requirement. Be specific with file paths and line numbers.",
  codex_debug: "You are in DEBUG mode. Follow this sequence: (1) reproduce the issue — run the failing command or test, (2) diagnose — trace the root cause with file reads and searches, (3) fix — make the minimal change that resolves the issue, (4) verify — run the test/command again to confirm the fix works. Report each step.",
  codex_test: "You are in TEST mode. Write or run tests as requested. Cover edge cases and failure modes, not just the happy path. After running tests, report: total passed, total failed, and list each failure with file path and assertion details.",
};

const BASE_SCHEMA = {
  type: "object",
  properties: {
    prompt: { type: "string", description: "The task for Codex. Include file paths, function names, expected outcome." },
    project_dir: { type: "string", description: "Project directory. Defaults to cwd." },
    timeout: { type: "number", description: "Inactivity timeout in seconds. Default 60." },
  },
  required: ["prompt"],
};

const EXECUTE_SCHEMA = {
  type: "object",
  properties: {
    ...BASE_SCHEMA.properties,
    context_cmd: { type: "string", description: "Shell command whose output is prepended as context." },
  },
  required: ["prompt"],
};

const TOOLS = [
  {
    name: "codex_execute",
    description: "Send a task to Codex in a new thread. General-purpose: writing code, running commands, creating files, refactoring. Use this when no specialized tool fits. Codex is a full agent with parallel tool calls; give it focused, specific prompts.",
    inputSchema: EXECUTE_SCHEMA,
  },
  {
    name: "codex_resume",
    description: "Follow up in the same Codex thread. Codex remembers everything from previous turns. Use for: iterative refinement, \"now do X with what you just found\", multi-step sequences, or \"undo that and try Y instead\".",
    inputSchema: BASE_SCHEMA,
  },
  {
    name: "codex_search",
    description: "Explore and read the codebase without modifying anything. Use for: understanding code structure, finding functions, listing dependencies, answering questions about existing code. Codex reads files in parallel and returns structured findings. Always use this instead of reading files yourself.",
    inputSchema: BASE_SCHEMA,
  },
  {
    name: "codex_review",
    description: "Independent code review in a fresh thread. Use after codex_execute to verify work — Codex reads files fresh without self-review bias. Include the original requirement in the prompt, not Codex's prior output. Reports bugs, gaps, and deviations.",
    inputSchema: BASE_SCHEMA,
  },
  {
    name: "codex_debug",
    description: "Investigate and fix a bug. Codex will: reproduce the issue, diagnose root cause, apply minimal fix, verify the fix works. Include: the error message, failing test or command, and any context about when it started failing.",
    inputSchema: EXECUTE_SCHEMA,
  },
  {
    name: "codex_test",
    description: "Write or run tests. Codex will cover edge cases and failure modes, not just happy paths. After running, reports pass/fail counts and failure details. Include: what to test, which test framework, and expected behavior.",
    inputSchema: BASE_SCHEMA,
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
        protocolVersion: "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "codex-mcp", version: "1.0.0" },
      });
      break;

    case "notifications/initialized":
      // Client acknowledgement, no response needed
      break;

    case "tools/list":
      mcpResult(id, { tools: TOOLS });
      break;

    case "tools/call": {
      const { name, arguments: args = {} } = params || {};

      // Pre-flight checks
      if (!CODEX_BIN) {
        mcpResult(id, {
          content: [{ type: "text", text: "Codex CLI not found. Install with: npm install -g @openai/codex" }],
          isError: true,
        });
        break;
      }

      if (!TOOLS.find((tool) => tool.name === name)) {
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
        // Prepend role prefix if one exists for this tool
        const prefix = ROLE_PREFIX[name];
        const fullPrompt = prefix ? prefix + "\n\n" + args.prompt : args.prompt;

        let result;

        if (name === "codex_resume") {
          result = await executeTurn(projectDir, fullPrompt, {
            resume: true,
            timeout,
          });
        } else {
          // All other tools: new thread, optional context_cmd
          result = await executeTurn(projectDir, fullPrompt, {
            newThread: true,
            timeout,
            contextCmd: args.context_cmd,
          });
        }

        mcpResult(id, formatResult(result));
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
  for (const server of servers.values()) {
    server.proc.kill();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  for (const server of servers.values()) {
    server.proc.kill();
  }
  process.exit(0);
});

process.stderr.write("[codex-mcp] server started\n");
