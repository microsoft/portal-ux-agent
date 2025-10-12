# Run Evaluation Pipeline (Multi-Record)

## Goal
Run the multi-record UX Agent evaluation pipeline using the PowerShell wrapper `eval/run_eval.ps1`, producing a fresh timestamped run under `eval/runs/`.

## Preconditions
1. Repo checked out and dependencies installed (Python on PATH).
2. Repo root `.env` contains Azure OpenAI values if LLM judging is desired:
   ```
   AZURE_OPENAI_ENDPOINT=...
   AZURE_OPENAI_API_KEY=...
   AZURE_OPENAI_DEPLOYMENT=...
   ```
3. Script `eval/run_eval.ps1` exists.
4. Dataset present at `eval/dataset` (or pass a different path).

## Inputs (adjust before running)
- DatasetPath (default: `eval/dataset`)
- RunRoot (default: `eval/runs`)
- MCPMode (`stub` | `echo` | `http` (not implemented))
- Limit (optional integer)
- Filter (optional substring)
- IdPrefix (e.g. `exp1-`)
- SkipExisting (bool)

## Command Template (PowerShell)
```pwsh
pwsh ./eval/run_eval.ps1 `
  -DatasetPath eval/dataset `
  -RunRoot eval/runs `
  -MCPMode stub `
  -Limit 10 `
  -Filter dashboard `
  -IdPrefix exp1- `
  -SkipExisting
```

Minimal default run:
```pwsh
pwsh ./eval/run_eval.ps1
```

## Expected Artifacts
`eval/runs/<UTC_TIMESTAMP>/` containing per-record subdirectories with:
- record.json
- ui_description.txt
- agent_output.txt
- prompt_step3_intended.txt
- intended_interpretation.json
- prompt_step4_rendered.txt
- rendered_interpretation.json
- prompt_step5_judge.txt
- step5_response.json
- score.json
- meta.json

Plus run-level summary files (e.g., summary.md, run_summary.json) created by the dataset runner.

## Validation Checklist
- Each processed record has `score.json` with `dimensionScores` and `overall`.
- `summary.md` contains aggregate metrics.
- No unexpected missing prompt files.

## Troubleshooting
| Symptom | Cause | Action |
|---------|-------|--------|
| judge fails: missing endpoint | `.env` lacks AZURE_OPENAI_ENDPOINT | Add endpoint & retry |
| score.json absent | LLM error mid-run | Inspect step5_response.json or console output |
| All scores low | Bad prompts or wrong deployment | Verify prompt templates & model name |
| PowerShell can't find python | Python not on PATH | Activate venv or add to PATH |

## Next Improvements (Optional)
- Add JSON schema validation for LLM outputs.
- Merge steps 3–5 into a single multi-output prompt for latency reduction.
- Add temperature / token control pass-through.

---
Execute the chosen command above to start the evaluation.
