# Eval Process

Do NOT use `/skill-test` or any other testing skill. This is one continuous sequence.
Results go in `<skill-name>-workspace/iteration-N/eval-<ID>/`.

## Step 1: Spawn Runs

[SPAWN] two subagents simultaneously per test case — one with-skill, one baseline.
(If no subagents available — [DO] run sequentially. See platform-notes.md.)

With-skill subagent input:
```
Skill path: <path>
Task: <prompt>
Input files: <files or "none">
Save outputs to: <workspace>/iteration-N/eval-<ID>/with_skill/outputs/
```

Baseline:
- New skill → no skill, save to `without_skill/outputs/`
- Improving existing → snapshot old skill (`cp -r <skill> <workspace>/skill-snapshot/`), save to `old_skill/outputs/`

[DO] Write `eval_metadata.json` per eval:
```json
{"eval_id": 0, "eval_name": "descriptive-name", "prompt": "...", "assertions": []}
```

## Step 2: Draft Assertions (while runs are in progress)

Good assertions are objectively verifiable and self-descriptive.
Subjective skills → qualitative feedback only, no forced assertions.
[DO] Update `eval_metadata.json` and `evals/evals.json` with assertions once drafted.

## Step 3: Capture Timing

[DO] Save immediately when each subagent completes — this data only comes through task notification:
```json
{"total_tokens": 84852, "duration_ms": 23332, "total_duration_seconds": 23.3}
```

## Step 4: Grade, Aggregate, Launch Viewer

[SPAWN] agents/grader.md — WHEN test runs are complete
[DO] Save grading output to `grading.json`. Field names must be exactly `text`, `passed`, `evidence`.

[RUN] scripts/aggregate_benchmark.py `<workspace>/iteration-N --skill-name <n>`
[DO] Put with_skill before baseline in output.
[READ] references/schemas.md — WHEN need benchmark schema details

[SPAWN] agents/analyzer.md — WHEN surfacing non-discriminating assertions or variance analysis

[RUN] eval-viewer/generate_review.py `<workspace>/iteration-N --skill-name "my-skill" --benchmark <workspace>/iteration-N/benchmark.json`
Iteration 2+: add `--previous-workspace <workspace>/iteration-N-1`
Headless/Cowork: add `--static <output_path>` — feedback downloads as `feedback.json`
Do not write custom HTML — always delegate to generate_review.py.
Get outputs in front of the human before evaluating inputs yourself.

[DO] Tell the user: "Results are open in your browser — Outputs tab for cases, Benchmark tab for stats. Come back when done."

## Step 5: Read Feedback

Feedback format:
```json
{
  "reviews": [
    {"run_id": "eval-0-with_skill", "feedback": "missing axis labels", "timestamp": "..."},
    {"run_id": "eval-1-with_skill", "feedback": "", "timestamp": "..."}
  ],
  "status": "complete"
}
```

Empty feedback = acceptable. Focus on non-empty entries.
[DO] Kill the viewer: `kill $VIEWER_PID 2>/dev/null`
