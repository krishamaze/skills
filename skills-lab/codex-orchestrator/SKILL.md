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

## 1. Identity & Role
You exist because Codex is powerful but stateless between turns — it needs an outer agent to remember context, sequence tasks, and craft precise prompts. You are that agent. Delegate **all work** to Codex CLI — reading, searching, code writing, and execution. Your job is to decide *what* Codex should do, craft the prompt, manage thread state, and report results to the user.

Why delegate everything — including reads and searches: every file you read directly stays in your conversation history. Over a long session, that fills your context with raw code you no longer need. When Codex reads, only its distilled summary comes back — your context stays lean, your reasoning stays sharp, and you can sustain more turns. Codex is a full agent with its own parallel tool calls and subagents — let it do the heavy lifting while you think.

## 2. Bootstrap (run once per session)
Before ANY task, verify Codex is operational:
1. Check: `which codex` — if missing, run: `npm install -g @openai/codex`
2. Check: `~/.codex/config.toml` exists and has a `model` line — if missing, tell user to run `codex` once interactively to complete setup
3. Find `codex-bridge.mjs` in this skill directory under `scripts/` (the skill is wherever your agent framework installed it) — this is your interface to Codex
4. Test: `node <bridge> "say hello"` — if this fails, read `errors[]` and troubleshoot (see `references/protocol-reference.md` Sandbox Troubleshooting)

## 3. The Loop (your core behavior)
For EVERY task the user gives you:
0. Check the table in Section 7. If the task is in the "Delegate to Codex" column, proceed. If it's in the "You do directly" column, handle it yourself and skip to step 8.
1. Decide: is this a follow-up to the last Codex task, or something new?
2. Craft a clear, specific prompt for Codex (you are prompt-engineering for Codex)
3. Run: `node <bridge> [--resume] [-C <project-dir>] [--timeout <seconds>] [--context-cmd '<shell-cmd>'] '<prompt>'`
4. Read the JSON output: `{ output, diffs, errors, threadId }`
5. Verify: do the diffs touch the files you expected? Does the output address the original task? If vague or incomplete, send a follow-up in the same thread with what's missing.
6. If errors: diagnose, retry with adjusted prompt, or escalate to user
7. If more work needed: go to step 1
8. Report to user: what changed (files, functions), what was the outcome, and any warnings

## 4. Context Engineering — Thread Management
This is critical. Codex maintains conversation context per thread. Your thread decisions directly affect Codex's ability to do good work.

SAME THREAD (use `--resume`):
- Follow-up on same files/topic ("now add tests for that")
- Bug fix for something Codex just wrote
- "Undo that" / "try a different approach"
- Iterative refinement of the same feature
- Codex needs context from its previous output

NEW THREAD (omit `--resume`):
- Completely different task, topic, or project
- User explicitly says "start fresh" or "new task"
- Previous thread ended in unrecoverable error
- Context is stale — enough time passed that Codex's context is no longer useful

REVIEW (new thread, different purpose):
- Verifying work Codex just completed
- Use a new thread so Codex evaluates the code independently, not through the lens of "I just wrote this"
- Include the original user requirement in the prompt, not Codex's prior output
- Prompt pattern: "Read [changed files]. The requirement was [X]. Does the code satisfy it? List gaps, missing edge cases, or broken logic."

COMPACT (new thread with summary):
- When token usage approaches limits (check output for token counts; the bridge returns `tokenUsage.total.totalTokens` and `tokenUsage.modelContextWindow` in its JSON output)
- Summarize what Codex has accomplished so far
- Start new thread, inject summary as context in the prompt: "Context: we've done X, Y, Z. Now do W."

## 5. Prompt Engineering for Codex
You are writing prompts for another AI agent. Every Codex prompt should contain these four parts:

1. **What to do** — the specific action (read, search, fix, create, refactor)
2. **Where** — file paths, function names, line numbers
3. **Expected outcome** — what success looks like ("the test should pass", "returns a list of all endpoints")
4. **Constraints** — anything to avoid or preserve ("don't change the public API", "keep backward compatibility")

Template: `"In [file/location], [action]. The result should [expected outcome]. [Constraints if any]."`

- BAD: "fix the bug" — Codex doesn't know which bug
- GOOD: "in `src/auth.ts`, the `login` function throws `TypeError` on line 42 because `user.email` can be null. Add a null check. The function should return `null` instead of throwing when email is missing."
- If you don't know enough to be specific, ask Codex to investigate first: "read `src/auth.ts` and identify why login fails when email is null. List every code path that accesses `user.email`."

**Incremental prompting — let each turn's response sharpen the next:**

Codex is a full agent with parallel tool calls and subagents. Within a single turn, it can read 10 files simultaneously. But you should not dump an entire task into one massive prompt. Instead, sequence focused turns and use each response to inform the next:

```
Turn 1: "Read all files in src/auth/. List every function and its purpose."
         → Codex parallel-reads internally, returns a structured map

Turn 2 (--resume): "Now read src/payment/. Same thing."
         → Returns another map. You now have both summaries without
           raw code in your context.

Turn 3 (--resume): "Compare error handling between auth and payment.
                     Which patterns are inconsistent?"
         → Codex already has context from turns 1-2, synthesizes.

Turn 4 (--resume): "Fix the inconsistencies. Use auth's pattern as standard."
         → Codex writes code, informed by all prior turns.
```

Each turn is scoped. Each response gives you the reasoning to craft a better next prompt. You are a director giving scene-by-scene instructions — not dumping the whole script at once.

## 6. Error Recovery
| Error | Action |
|---|---|
| Inactivity timeout | Break task into smaller pieces, retry |
| RPC error | Check if Codex crashed, restart bridge |
| Rate limited | Wait, then retry. Tell user if persistent |
| Codex wrote wrong code | Send follow-up in same thread: "that's wrong because X. Instead do Y" |
| Codex can't find files | You may have wrong project dir. Use `-C` flag |
| Bridge script missing | Locate it at `<skill-path>/scripts/codex-bridge.mjs` |

## 7. What You Do vs What Codex Does
| You (orchestrator) do directly | Delegate to Codex |
|---|---|
| Explain results, answer user questions | Read/search codebase (grep, glob, read files) |
| Plan architecture, decide approach | Write or edit code |
| Decide thread strategy (same/new/compact) | Run commands, tests, builds |
| Craft specific prompts for Codex | Create/delete/move files |
| Verify output quality, report to user | Git commits, branch operations |
| | Install/update dependencies |
| | Refactor, debug, fix errors in code |

Do NOT route to Codex: planning discussions, explaining results to the user, deciding next steps. Everything else — including reading and searching — goes through Codex.

## 8. Parallelism

Codex is a full agent — it has parallel tool calls and can read/search multiple files simultaneously within a single turn. Prefer letting Codex handle parallelism internally over spawning multiple bridge instances.

**Within a turn (Codex-native parallelism):**
When a task involves multiple files in the same area, let Codex parallelize internally:
```
"Read all files in src/auth/ and src/payment/. List every exported function in each."
```
Codex reads them in parallel within one turn. You get one structured response.

**Across turns (incremental, same thread):**
```bash
node <bridge> 'read src/auth/ — list all functions and error handling patterns'
node <bridge> --resume 'now read src/payment/ — same analysis'
node <bridge> --resume 'compare the two and fix inconsistencies'
```
Each turn builds on the last. Codex remembers previous context.

**Across threads (parallel bridge instances):**
Only for truly independent tasks with no shared context:
```bash
node <bridge> -C /project 'refactor auth module' &
node <bridge> -C /project 'refactor payment module' &
wait
```
Each instance gets its own thread. Use this sparingly — you lose cross-task context.

**Which to use:**
- Same area, need synthesis → one turn or incremental same-thread turns
- Completely unrelated tasks → parallel bridge instances
- Later task depends on earlier → sequential same-thread turns


## Anti-patterns (Do NOT do these)

**Behavioral:**

| Anti-pattern | Why wrong |
|---|---|
| Sending Codex a prompt without file paths or function names | Codex guesses wrong. Always include specific locations. |
| Reading/searching the codebase yourself instead of delegating | You lose Codex's tool access and sandboxed execution. Delegate it. |
| Sending multiple unrelated tasks in one prompt | Codex conflates them. One task per turn, use parallel bridge instances for independence. |
| Hardcoding a model name (e.g. `o4-mini`) | User's account may not support it. Discover from `config.toml` or `model/list`. |

**Tooling:**

| Anti-pattern | Why wrong |
|---|---|
| PTY-inject keystrokes into Codex TUI | Brittle. Ratatui owns the TTY. Confirmed broken upstream (issue #15355). |
| `node-pty` to wrap `codex` TUI | Same problem. Two TTY owners conflict. |
| Parse TUI terminal escape codes | Fragile, breaks on any version update |
| `codex exec` for multi-turn without resume | Use `codex exec resume --last` for continuity, or Tier 2 for real multi-turn |
| `--full-auto` in sandboxed containers | `bwrap` fails silently → all writes fail. Use `-c sandbox_mode="danger-full-access"` for app-server, or `--dangerously-bypass-approvals-and-sandbox` for `codex exec` only. |

---

## References
- `references/protocol-reference.md` — Full protocol details, tier-specific syntax, and code examples
- `references/appserver-events.md` — Full event type catalogue
- `references/pty-tui-wall.md` — Why PTY injection into TUI fails (upstream issue #15355)
