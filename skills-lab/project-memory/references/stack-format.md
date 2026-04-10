# STACK.md Format

Two sections. Append-only except version bumps.

```markdown
# Stack

## Locked Versions
| Package | Version | Replaces |
|---------|---------|----------|
| [package] | [version] | [what it replaces and why] |

## Do-Not Patterns + Root Causes

### [Pattern name]
**Never:** [Exact thing to never do]
**Why:** [Root cause — what broke]
**Instead:** [Correct pattern]
```

## What earns a Do-Not entry

- Anything that caused a real failure during this project
- Any pattern caught and rejected with a specific reason
- Any anti-pattern from team skills that applies here

## Empty template

```markdown
# Stack

## Locked Versions
| Package | Version | Replaces |
|---------|---------|----------|
<!-- Append entries as they are locked. -->

## Do-Not Patterns + Root Causes
<!-- Append entries as failures are diagnosed. -->
```
