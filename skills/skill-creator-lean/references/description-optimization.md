# Description Optimization

## Step 1: Generate 20 Trigger Eval Queries

Mix of should-trigger (8–10) and should-not-trigger (8–10). Save as JSON:
```json
[
  {"query": "the user prompt", "should_trigger": true},
  {"query": "another prompt", "should_trigger": false}
]
```

Queries must be realistic and specific — file paths, column names, company names, casual phrasing, typos.
Near-miss negatives are most valuable: queries sharing keywords with the skill but needing something different.

Bad: `"Format this data"`, `"Extract text from PDF"`
Good: `"ok so my boss sent me this xlsx called Q4 sales final FINAL v2.xlsx and she wants a profit margin column, revenue is col C costs are col D i think"`

## Step 2: Review with User

[READ] assets/eval_review.html — WHEN preparing trigger eval review for user
[DO] Replace `__EVAL_DATA_PLACEHOLDER__`, `__SKILL_NAME_PLACEHOLDER__`, `__SKILL_DESCRIPTION_PLACEHOLDER__`
[DO] Write to `/tmp/eval_review_<skill-name>.html` and open it
[DO] User edits, toggles, clicks "Export Eval Set" → downloads to `~/Downloads/eval_set.json`

## Step 3: Run Optimization Loop

[RUN] scripts/run_loop.py `--eval-set <path> --skill-path <path> --model <model-id> --max-iterations 5 --verbose`

## Step 4: Apply Result

[DO] Update SKILL.md frontmatter with `best_description`. Show before/after and scores to user.
