# Knowledge Graph (memory/)

`memory/` is a flat directory of atomic `.md` files — one concept per file.
Agents read it before work, write to it after learning. Think Obsidian vault
but simpler: no links between notes, filename is the index.

---

## Structure

```
memory/
├── CONTEXT.md                  # live state (overwrite) — structured
├── DECISIONS.md                # ADRs (append only) — structured
├── STACK.md                    # versions + do-nots (append only) — structured
├── stack-constraints.md        # extracted knowledge
├── auth-gotchas.md             # learned during work
├── api-rate-limits.md          # learned during work
└── ...                         # grows organically
```

## Rules

1. **One concept per file** — if it covers two topics, split it
2. **≤50 lines per file** — approaching 50 means too broad
3. **Flat namespace** — no subdirectories; `ls memory/` is the index
4. **Filename = topic** — lowercase, hyphens, scannable at a glance
5. **No cross-references** — memory files are leaf nodes, no cycles
6. **Three structured files are special** — DECISIONS.md, CONTEXT.md, STACK.md
   keep their formats (managed by project-memory). Everything else is freeform.

## How agents interact

Agents are told in AGENT.md to:
- `ls memory/` or scan filenames before starting work
- Read files relevant to their current task
- Write new files when they learn something non-obvious
- Invoke `/memory` for architectural decisions and failures (those go to the structured files)

## When project-memory writes to memory/

- **Extracting dumps:** Knowledge blocks from agent config files → atomic memory/ files
- **Never:** project-memory does not write freeform knowledge. Agents do that themselves.
- **Always:** project-memory manages only DECISIONS.md, CONTEXT.md, STACK.md within memory/.
