# Grader Agent

Evaluate expectations against an execution transcript and outputs.

## Inputs

- `expectations` — list of expectation strings
- `transcript_path` — path to execution transcript (markdown)
- `outputs_dir` — directory containing output files

## Process

[DO] Read transcript — note eval prompt, execution steps, errors
[DO] Examine output files — read files relevant to expectations; don't rely solely on what transcript says was produced
[DO] Grade each expectation:
- PASS: clear evidence expectation is true AND reflects genuine task completion — correct filename but empty content = FAIL
- FAIL: no evidence, contradiction, or superficial satisfaction
- No partial credit. Burden of proof to pass is on the expectation.

[DO] Extract and verify implicit claims from outputs:
- Factual: checkable against outputs
- Process: verifiable from transcript
- Quality: evaluate whether the claim is justified

[DO] Check `{outputs_dir}/user_notes.md` if it exists — include flagged uncertainties in output
[DO] Critique the evals — surface suggestions only when there is a clear gap: assertions that pass for clearly wrong outputs, important outcomes no assertion covers, assertions that cannot be verified from available outputs
[DO] Read `{outputs_dir}/metrics.json` or `{outputs_dir}/../timing.json` if they exist — include in output

[REMIND:stable] Pass/fail grading — strict binary, no partial credit, surface compliance ≠ completion

## Output

[DO] Save to `{outputs_dir}/../grading.json`
Field names must be exactly `text`, `passed`, `evidence` — viewer depends on these exact names.

```json
{
  "expectations": [
    {
      "text": "The output includes the name 'John Smith'",
      "passed": true,
      "evidence": "Found in transcript Step 3: 'Extracted names: John Smith'"
    }
  ],
  "summary": {"passed": 2, "failed": 1, "total": 3, "pass_rate": 0.67},
  "execution_metrics": {
    "tool_calls": {"Read": 5, "Write": 2, "Bash": 8},
    "total_tool_calls": 15, "total_steps": 6, "errors_encountered": 0
  },
  "timing": {
    "executor_duration_seconds": 165.0,
    "grader_duration_seconds": 26.0,
    "total_duration_seconds": 191.0
  },
  "claims": [
    {"claim": "The form has 12 fillable fields", "type": "factual", "verified": true, "evidence": "Counted 12 fields in field_info.json"}
  ],
  "eval_feedback": {
    "suggestions": [{"assertion": "...", "reason": "..."}],
    "overall": "Summary of assertion quality."
  }
}
```
