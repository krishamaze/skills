# DECISIONS.md Format

Each entry is an ADR. Once written, never edited. Reversals get a new ADR.

```markdown
# Decisions

## ADR-001: [Title]
**Status:** active | superseded by ADR-00X
**Decision:** One sentence — what was chosen.
**Why:** One to three sentences — the actual reason. Use conversation context.
**Do not:** What must never happen as a result.
**Failure mode:** What breaks if ignored.
```

## What earns an ADR

- Architecture choices, stack choices, security choices
- Anything that breaks silently if reversed

## What does NOT earn an ADR

- Implementation details, file naming
- Anything reversible without consequence

## Empty template

```markdown
# Decisions
<!-- ADRs appended below. Never edit existing entries. -->
```
