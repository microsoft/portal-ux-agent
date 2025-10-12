# UX Agent Evaluation (LLM Judge Harness)

This folder contains a lightweight, reproducible evaluation harness for the portal UX agent.

## Goals
- Track scenario evolution over time.
- Score generations with a consistent rubric.
- Enable diffable regression checks.
- Allow plugging any LLM as the "judge" (Azure OpenAI, local, etc).

## Folder Map
| Folder | Purpose |
|--------|---------|
| `scenarios/` | Plain-text user intents or instructions to feed the agent. |
| `expected/`  | Optional structured reference heuristics. |
| `judges/`    | Judge prompt templates + scoring descriptors. |
| `runs/`      | Auto-created timestamped outputs + scores. |
| `scripts/`   | Orchestration, scoring, aggregation utilities. |

## Quick Start (Python Stub Judge)
Run the Python evaluation harness directly (cross‑platform):
```pwsh
python ./eval/pipeline/run_eval.py --dataset eval/dataset --out eval/runs --model stub-model
```

Optional flags (if implemented):
- `--limit N` limit number of scenarios
- `--filter KEYWORD` only scenarios whose filename contains keyword
- `--dry-run` parse dataset only, no judge calls

If you previously used the PowerShell wrapper, it's been removed—`run_eval.py` is now the single canonical entrypoint.

## Adding a Scenario
1. Create `eval/scenarios/scenario_XX_label.txt`.
2. (Optional) Add `eval/expected/scenario_XX_label.json` with heuristics.
3. Re-run the evaluation run script.

## Run Output Layout
```
eval/runs/<timestamp>/
  manifest.json        # scenarios + meta
  scores.json          # array of judge outputs
  raw/<scenario>/      # raw tool responses, HTML, judge prompt, score
```

## Judge Integration
Replace the placeholder model call in `judge.py` with a real provider. Implement a function returning the required JSON shape (see `llm-judge-prompt.txt`).

Supported future integrations (planned):
- Azure OpenAI (Chat Completions) via env vars
- Local LLM runner
- Other API providers

## Metrics / Dimensions
See `rubric.md` for the full scoring rubric. Overall score = mean of included numeric dimensions.

## Autoscore (Automated Scoring)
The evaluation system includes **autoscore** - a deterministic, programmatic validation system (in `pipeline/autoscore/`) that checks UI composition without using an LLM.

### What Autoscore Validates
1. **Component Coverage** - Are the required component types present? (e.g., 3 KpiCards, 1 Table)
2. **Property Fidelity** - Do components have expected props with correct values?

### How It Works
- Flattens the component tree into analyzable nodes
- Matches against `expected_components` defined in dataset items
- Supports multiple validation types:
  - **Exact match**: `"status"` must equal exactly "status"
  - **One-of**: `["active", "pending"]` must be one of these values
  - **Regex**: `{"regex": "\\d{4}"}` pattern matching
  - **Existence**: `{"exists": true}` just checks prop is present

### Output Metrics
Returns numeric scores (0.0-1.0):
- `componentCoverage`: Percentage of expected components found
- `propFidelity`: Percentage of required props that match specifications

### Autoscore vs LLM Judge
| Autoscore | LLM Judge |
|-----------|-----------|
| Fast & deterministic | Slower, requires API |
| Reproducible | May vary slightly |
| Only checks structure | Evaluates semantics & quality |
| Needs explicit specs | Understands natural language intent |

Both are used together: autoscore provides objective structural validation, while the LLM judge evaluates holistic quality (correctness, compositionality, clarity). Autoscore metrics can influence judge scoring - for example, low component coverage caps the overall score.

## Roadmap Ideas
- DOM parser to extract used component classes
- Heuristic validation of required components
- Visual diff snapshots
- Performance budget checks (Lighthouse/PSI)
- Deterministic seeds for reproducibility

---
This harness intentionally ships with a stub judge so it can run offline. Plug in real judging when ready.
