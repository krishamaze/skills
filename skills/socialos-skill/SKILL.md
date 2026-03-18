---
name: socialos
description: >
  Project memory for SocialOS — unified social inbox with AI reply suggestions.
  Read at every session start. Trigger when starting any coding task, before
  using any external API, after any failure, after any architectural decision.
  Never skip on a new session.
---

# SocialOS

## Read Every Session (in order)
1. `references/errors.md` — what not to repeat
2. `references/decisions.md` — what was already decided
3. `references/context.md` — where we are now

Read `references/apis.md` only when touching an external API.
Read `references/patterns.md` only when writing code.

---

## Knowledge Hierarchy

Strictly in order — higher always wins:
1. Real test result with logs
2. This skill and its references
3. Official docs (URL required)
4. Web search
5. Training data — never overrides any of the above

### To revise any reference file you need ONE of:
- Real error with logs proving it wrong
- Successful test proving new behavior
- Official documentation URL

"My training says otherwise" is never a valid reason.

---

## Skill Update Rules

- Never freehand edit any reference file
- Always use skill-creator skill to update
- Surgical edits only — never rewrite what is still true

---

## Hard Rules

- Never auto-send without human approval
- Never break the adapter interface contract
- Never assume external API behavior from training data

---

## References

| File | Read when |
|---|---|
| `references/context.md` | Every session |
| `references/errors.md` | Every session |
| `references/decisions.md` | Every session |
| `references/apis.md` | Before any API usage |
| `references/patterns.md` | Before writing code |
