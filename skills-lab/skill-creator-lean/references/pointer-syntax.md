# Pointer Syntax

Use these exactly. No variations.

```
[REMIND:stable] <topic> — <one line hint on what to recall and why>
[REMIND:verify] <topic> — <one line hint; may have changed post-2024, verify before acting>
[READ] references/<file>.md — WHEN <specific trigger condition>
[RUN] scripts/<script>.py — WHEN <specific trigger condition>
[SPAWN] agents/<file>.md — WHEN <specific trigger condition>
[DO] — agent executes this step directly
```

## Rules

- `[REMIND]` = trained knowledge. One line only. Never expand inline.
- `:stable` = timeless knowledge (books, principles, math). Recall confidently.
- `:verify` = tool behavior, APIs, frameworks. Recall then cross-check if post-2024.
- `[READ]` must always include a `WHEN` condition — load only what the current step needs.
- `[RUN]` = delegate to script. Never re-implement script logic inline.
- `[SPAWN]` = delegate to subagent. Never do subagent work directly.
- `[DO]` = agent executes this step itself. Must be explicit — absence of tag is not permission to self-execute.
- References must be atomic — one concept per file. No dump files.
- No circular loading — references never point back to SKILL.md or to each other.
- Default is delegation. Self-execution requires explicit `[DO]` tag.
