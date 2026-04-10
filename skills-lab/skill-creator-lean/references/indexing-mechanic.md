# Indexing Mechanic

When any `.md` file approaches 200 lines — do not expand it. Index it.

## The Pattern

```
Before:
references/decisions.md        ← 230 lines, too big

After:
references/decisions/
  decisions.md                 ← same name, now the map/index
  adr-format.md                ← extracted atomic node
  adr-archive.md               ← extracted atomic node
  superseded.md                ← extracted atomic node
```

**Rule:** The oversized file becomes the folder name. Its own name is preserved
as the map inside the folder. Knowledge moves out to atomic sibling nodes.
The map points to them with `[READ]` pointers.

**Existing pointers do not break.** Any `[READ] references/decisions.md` still
resolves — now it loads the map instead of the content. No pointer updates needed.

**The map contains zero content.** Headers and `[READ]` pointers only.
If content remains in the map after splitting — the split is incomplete.

---

## Two Ways a Node Splits

**Vertical** — one topic grows deep:
```
agent-parsing.md (220 lines)
→ agent-parsing/
    agent-parsing.md      ← index
    claude-code.md        ← deep node
    codex.md              ← deep node
    aider.md              ← deep node
```

**Horizontal** — one file covers two subdomains:
```
formats.md (210 lines, covers context + stack)
→ formats/
    formats.md            ← index pointing to both
    context-format.md     ← subdomain node
    stack-format.md       ← subdomain node
```

---

## Recursive Rule

If the index itself grows past 200 — index the index.

```
decisions/
  decisions.md            ← grew past 200
→ decisions/
    decisions.md          ← now indexes two sub-maps
    active/
      active.md           ← sub-map for active ADRs
    superseded/
      superseded.md       ← sub-map for superseded ADRs
```

---

## When a Node Becomes an Index

A leaf node that previously held content becomes an index when:
- It grows past 200 lines, OR
- Its content covers two distinct subdomains

Same mechanic applies — create folder, preserve filename as map, move content to atomic nodes.
The pointer in the parent that pointed to this node does not change — same filename, now resolves to the folder map.

---

## Orphan Check After Every Split

After any split, verify:
- Every new node file has an incoming pointer from the new map
- The new map has an incoming pointer from its parent
- Every level traces a pointer path back to SKILL.md
