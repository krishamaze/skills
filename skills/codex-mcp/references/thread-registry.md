# Thread registry — schema, maintenance, and routing

The MCP wrapper keeps a local registry in `memory/codex-threads.json` so
the orchestrating agent can route calls to the right thread by topic, not by
recency. Persisted thread ids are resumable across MCP server restarts because
the wrapper reloads them with Codex `thread/resume`.

## Schema

```json
{
  "session": "2026-03-28T22:00:00Z",
  "threads": [
    {
      "thread_id": "T1",
      "tool": "codex_run",
      "mode": "explore",
      "topic": "auth/map",
      "status": "active",
      "created_at": "2026-03-28T22:01:00Z"
    },
    {
      "thread_id": "R1",
      "tool": "codex_review",
      "mode": null,
      "topic": "auth/2FA-check",
      "status": "review",
      "created_at": "2026-03-28T22:15:00Z"
    }
  ]
}
```

**`topic` format:** `{module}/{action}` — short, scannable. Examples:
`auth/map`, `auth/2FA-build`, `payment/debug-timeout`.

**`status` values:**
- `active` — eligible for routing to `codex_run`
- `review` — `codex_review` follow-ups only, never routed to `codex_run`
- `done` — task complete, skip in routing, keep for reference

**`session`:** ISO timestamp last written by the wrapper when it touched the
registry. Useful for debugging, but not a reason by itself to expire threads.

## Maintenance rules

Run these after every tool call:

**After `codex_run` with no `thread_id`** (new thread started):
→ ADD row: derive topic from prompt, status=`active`

**After `codex_run` with `thread_id`** (resumed existing thread):
→ UPDATE row: refresh topic if task scope changed, otherwise leave

**After `codex_review` with no `thread_id`** (new review):
→ ADD row: derive topic from prompt, status=`review`

**After `codex_review` with `thread_id`** (follow-up on existing review):
→ No new row. No update needed.

**When a task is complete** (tests pass, feature shipped, bug confirmed fixed):
→ Mark thread status=`done`. Do not delete — keeps history visible.

## Routing decision tree

Run this before every `codex_run` call:

**Step 0 — Scan active threads.**  
Filter registry to `status=active` only.

For targeted read-only follow-ups driven by injected context or one narrow
file/config question, prefer `inspect` over `explore`.

**Case 1 — Single topic match.**  
Task scope overlaps exactly one active thread by module.
→ Pass that `thread_id`. Not the most recent one. The matching one.

Key sub-case: `explore → build` on the same module. The explore thread has
the map — the build task needs it. Match on module, not on mode.

```
Registry:  T1  explore  auth/map   active
Next task: "add 2FA to auth module"
→ module match: T1 → pass thread_id=T1
```

**Case 2 — No match.**  
Task is genuinely new, no active thread covers it.
→ Omit `thread_id`. After the call, add new row to registry.

**Case 3 — Multi-thread span.**  
Task touches multiple active threads (e.g. integrate auth into payment).
→ Omit `thread_id` (fresh thread). Synthesize findings from both threads
explicitly in the prompt — the orchestrating agent already has prior outputs
in context:

```
codex_run(mode=build, prompt="""
From auth exploration (T1): [key findings]
From payment exploration (T2): [key findings]

Task: integrate auth tokens into payment flow...
""")
```

**Review follow-ups are separate.**  
`review` status threads never appear in routing. To follow up on a review,
pass the review `thread_id` to `codex_review` directly. Do not route through
the decision tree.
