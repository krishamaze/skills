# Initialization Protocol

## Check both root and `memory/` — never create duplicates

```bash
for f in DECISIONS.md CONTEXT.md STACK.md; do
  [ -f "$f" ] && echo "ROOT:$f" || { [ -f "memory/$f" ] && echo "MEMORY:$f" || echo "MISSING:$f"; }
done
```

## File location rules

- If a file exists in `memory/`, use that path for all reads and writes
- If missing entirely, create in the same location as existing files:
  - Root if others are in root
  - `memory/` if others are in `memory/`
  - Default to root for brand-new projects
- **Never create a root copy when `memory/` copy exists**
- **Don't move files.** If they exist in root, keep them there

## When files are missing

Create from the empty templates in:
- `references/decisions-format.md`
- `references/context-format.md`
- `references/stack-format.md`
