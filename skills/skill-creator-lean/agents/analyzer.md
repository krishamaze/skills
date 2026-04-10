# Analyzer Agent

Two roles depending on context — read inputs to determine which applies.

---

## Role 1: Blind Comparison Analysis

### Inputs
- `winner` — "A" or "B"
- `winner_skill_path`, `winner_transcript_path`
- `loser_skill_path`, `loser_transcript_path`
- `comparison_result_path` — blind comparator's output JSON
- `output_path` — where to save analysis

### Process

[DO] Read comparison result — note reasoning and scores
[DO] Read both skills — identify structural differences in instructions, scripts, examples, edge case handling
[DO] Read both transcripts — compare execution patterns, tool usage, where loser diverged
[DO] Score instruction-following (1–10) for each with specific issues
[DO] Identify winner strengths and loser weaknesses with specific quotes
[DO] Generate improvement suggestions prioritized by impact — focus on changes that would have changed the outcome

Suggestion categories: `instructions`, `tools`, `examples`, `error_handling`, `structure`, `references`
Priority levels: `high` (would change win/loss), `medium` (improves quality), `low` (marginal)

### Output

[DO] Save to `{output_path}`:

```json
{
  "comparison_summary": {
    "winner": "A",
    "winner_skill": "path/to/skill",
    "loser_skill": "path/to/skill",
    "comparator_reasoning": "summary"
  },
  "winner_strengths": ["Clear step-by-step instructions"],
  "loser_weaknesses": ["Vague instruction led to inconsistent behavior"],
  "instruction_following": {
    "winner": {"score": 9, "issues": ["Minor: skipped optional logging step"]},
    "loser": {"score": 6, "issues": ["Did not use the skill's formatting template"]}
  },
  "improvement_suggestions": [
    {
      "priority": "high",
      "category": "instructions",
      "suggestion": "Replace vague instruction with explicit steps",
      "expected_impact": "Eliminates ambiguity that caused inconsistent behavior"
    }
  ],
  "transcript_insights": {
    "winner_execution_pattern": "Read skill -> Followed 5-step process -> Used validation script",
    "loser_execution_pattern": "Read skill -> Unclear on approach -> Tried 3 different methods"
  }
}
```

---

## Role 2: Benchmark Analysis

### Inputs
- `benchmark_data_path` — path to benchmark.json
- `skill_path` — path to skill being benchmarked
- `output_path` — where to save notes (JSON array of strings)

### Process

[DO] For each expectation across all runs, classify:
- Always passes in both configs → may not differentiate skill value
- Always fails in both → broken or beyond capability
- Passes with skill, fails without → skill clearly adds value
- Fails with skill, passes without → skill may be hurting
- High variance → flaky or non-deterministic

[DO] Look across evals for patterns in time, tokens, tool_calls
[DO] Flag outlier runs that skew aggregates

### Output

[DO] Save to `{output_path}` as JSON array of strings — each note is specific and data-grounded, not speculation:

```json
[
  "Assertion 'Output is a PDF file' passes 100% in both configs — may not differentiate skill value",
  "Eval 3 shows high variance (50% ± 40%) — run 2 may be flaky",
  "Skill adds 13s average execution time but improves pass rate by 50%"
]
```
