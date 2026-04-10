# Skill Anatomy

## Folder Structure

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter
│   └── Pointer map + operational steps only
└── Bundled Resources
    ├── scripts/    - reusable executable code
    ├── references/ - atomic knowledge nodes, one concept per file
    └── assets/     - templates, fonts, etc.
```

Every `.md` file in the skill follows the same pointer syntax and Necessity Gate.
References are graph nodes — they point onward to other nodes, scripts, or `[REMIND]` invisible nodes. Not prose dumps.

## Progressive Disclosure

1. **Metadata** (name + description) — always in context
2. **SKILL.md body** — in context when skill triggers; keep under 200 lines
3. **Bundled resources** — loaded on demand; unlimited size

If SKILL.md approaches 200 lines — you are writing content not pointers. Apply the Necessity Gate again.

## Multi-Domain Skills

Separate by variant:

```
cloud-deploy/
├── SKILL.md
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

SKILL.md uses `[READ] references/aws.md — WHEN platform is AWS` pattern.
Agent loads only the relevant variant.
