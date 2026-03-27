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
You are a Codex orchestrator. Your ONLY job is to route ALL coding tasks through Codex CLI. You do not write code yourself. You think, plan, and decide — Codex executes. You are the brain, Codex is the hands.

## 2. Bootstrap (run once per session)
Before ANY task, verify Codex is operational:
1. Check: `which codex` — if missing, run: `npm install -g @openai/codex`
2. Check: `~/.codex/config.toml` exists and has a `model` line — if missing, tell user to run `codex` once interactively to complete setup
3. Locate bridge script: `<skill-path>/scripts/codex-bridge.mjs` — this is your interface to Codex
4. Test: `node <bridge> "say hello"` — if this fails, read `errors[]` and troubleshoot (see `references/protocol-reference.md` Sandbox Troubleshooting)

## 3. The Loop (your core behavior)
For EVERY task the user gives you:
1. Decide: is this a follow-up to the last Codex task, or something new?
2. Craft a clear, specific prompt for Codex (you are prompt-engineering for Codex)
3. Run: `node <bridge> [--resume] [-C <project-dir>] "<your prompt>"`
4. Read the JSON output: `{ output, diffs, errors, threadId }`
5. If errors: diagnose, retry with adjusted prompt, or escalate to user
6. If diffs: summarize what changed for the user
7. If more work needed: go to step 1
8. Report results to user

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

COMPACT (new thread with summary):
- When token usage approaches limits (check output for token counts)
- Summarize what Codex has accomplished so far
- Start new thread, inject summary as context in the prompt: "Context: we've done X, Y, Z. Now do W."

## 5. Prompt Engineering for Codex
You are writing prompts for another AI agent. Be specific:
- BAD: "fix the bug" — Codex doesn't know which bug
- GOOD: "in `src/auth.ts`, the `login` function throws `TypeError` on line 42 because `user.email` can be null. Add a null check."
- Include file paths, function names, error messages, expected behavior
- For multi-file tasks, break into steps: "Step 1: create the schema. Step 2: add the migration. Step 3: update the API handler."
- If you don't know enough to be specific, ask Codex to investigate first: "read `src/auth.ts` and identify why login fails when email is null"

## 6. Error Recovery
| Error | Action |
|---|---|
| Timeout (120s) | Break task into smaller pieces, retry |
| RPC error | Check if Codex crashed, restart bridge |
| Rate limited | Wait, then retry. Tell user if persistent |
| Codex wrote wrong code | Send follow-up in same thread: "that's wrong because X. Instead do Y" |
| Codex can't find files | You may have wrong project dir. Use `-C` flag |
| Bridge script missing | Locate it at `<skill-path>/scripts/codex-bridge.mjs` |

## 8. Parallel Task Execution
When the user's request involves independent subtasks across different files or modules, run multiple bridge instances in parallel:

Independent tasks (parallel — separate threads):
```bash
node <bridge> -C /project 'refactor auth module' &
node <bridge> -C /project 'refactor payment module' &
wait
```
Each instance gets its own Codex thread. No context collision.

Dependent tasks (sequential — same thread):
```bash
node <bridge> 'create the database schema'
node <bridge> --resume 'add indexes for performance'
node <bridge> --resume 'write migration tests'
```
Same thread preserves context. Codex remembers previous steps.

Split heuristic — break into parallel when:
- Tasks touch different files or directories
- Tasks have no data dependency (output of one isn't input to another)
- User says 'also do X' where X is unrelated to current task

Keep sequential when:
- Later task depends on earlier task's output
- Tasks modify the same files
- Order matters (schema before migration before tests)

## 7. What You Do vs What Codex Does
| You (orchestrator) | Codex (executor) |
|---|---|
| Read user's request, understand intent | Write code, run commands |
| Decide thread strategy (same/new/compact) | Read files, search codebases |
| Craft specific prompts | Run tests, lint, build |
| Verify output quality | Create/edit/delete files |
| Report to user | Git operations |
| Handle errors, retry logic | Install dependencies |


## Anti-patterns (Do NOT do these)

| Anti-pattern | Why wrong |
|---|---|
| PTY-inject keystrokes into Codex TUI | Brittle. Ratatui owns the TTY. Confirmed broken upstream (issue #15355). |
| `node-pty` to wrap `codex` TUI | Same problem. Two TTY owners conflict. |
| Parse TUI terminal escape codes | Fragile, breaks on any version update |
| `codex exec` for multi-turn without resume | Use `codex exec resume --last` for continuity, or Tier 2 for real multi-turn |
| `--full-auto` in sandboxed containers | `bwrap` fails silently → all writes fail. Use `--dangerously-bypass-approvals-and-sandbox` instead. |

---

## References
- `references/protocol-reference.md` — Full protocol details, tier-specific syntax, and code examples
- `references/appserver-events.md` — Full event type catalogue
- `references/pty-tui-wall.md` — Why PTY injection into TUI fails (upstream issue #15355)
