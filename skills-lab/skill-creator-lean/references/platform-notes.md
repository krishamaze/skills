# Platform Notes

## Claude.ai

- No subagents → [DO] run test cases sequentially, read skill and execute the prompt
- Skip baseline comparison and quantitative benchmarking
- No browser → [DO] present results inline, ask for feedback in conversation
- Description optimization requires `claude -p` (Claude Code only) — skip it
- Blind comparison requires subagents — skip it

## Cowork

- Subagents available — full workflow applies
- No display → use `--static <output_path>` for viewer; feedback downloads as `feedback.json`; copy into workspace before next iteration
- Description optimization works (uses `claude -p` via subprocess)
- Add "Create evals JSON and run eval-viewer/generate_review.py" to TodoList

## Updating an Existing Skill

- Preserve original `name` field and directory name exactly
- Copy to `/tmp/skill-name/` before editing — installed path may be read-only
- Package from the copy
