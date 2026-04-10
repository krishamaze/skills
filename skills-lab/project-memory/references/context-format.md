# CONTEXT.md Format

Full overwrite every invocation. Under 20 lines.

```markdown
# Context
**Updated:** YYYY-MM-DD

## Current Layer
Layer X — [name]. Status: [building | blocked | verified]

## Last Completed
[One line — what finished and confirmed working]

## Active Blocker
[One line. "None" if clear.]

## Next Action
[Exact next task. Specific enough for a cold-start agent.]

## Deferred
- [Thing set aside + why]
```

## Empty template

```markdown
# Context
**Updated:** YYYY-MM-DD

## Current Layer
Layer 1 — [name]. Status: [building | blocked | verified]

## Last Completed
None yet.

## Active Blocker
None.

## Next Action
[Define first task.]

## Deferred
<!-- Nothing deferred yet. -->
```
