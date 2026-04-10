# Token Budget

## Count lines before writing

```bash
# Linux/macOS:
wc -l DECISIONS.md STACK.md CONTEXT.md

# Windows (PowerShell):
(Get-Content DECISIONS.md, STACK.md, CONTEXT.md -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
```

## Hard caps

| File | Max lines |
|------|-----------|
| `DECISIONS.md` | 150 |
| `CONTEXT.md` | 20 (always) |
| `STACK.md` | 200 |
| `memory/*.md` (freeform) | 50 per file |

## If a file would exceed its cap

1. Stop. Do not write yet.
2. Archive first:
   - DECISIONS.md superseded ADRs → `references/decisions-archive.md`
   - STACK.md resolved do-nots → `references/stack-archive.md`
3. Only after archiving, write.

## Quality check

Would removing this sentence lose information? If no → remove it.
