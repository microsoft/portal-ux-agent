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

## Quick Start (Stub Judge)
```pwsh
pwsh ./eval/scripts/run-eval.ps1 -UiPort 3000 -McpPort 3001 -UseWs -JudgeModel "stub-model" -ReuseContainer
```

If the container is not running the script will build and start it.

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
Replace the placeholder model call in `judge.ts` with a real provider. Implement a function returning the required JSON shape (see `llm-judge-prompt.txt`).

Supported future integrations (planned):
- Azure OpenAI (Chat Completions) via env vars
- Local LLM runner
- Other API providers

## Metrics / Dimensions
See `rubric.md` for the full scoring rubric. Overall score = mean of included numeric dimensions.

## Roadmap Ideas
- DOM parser to extract used component classes
- Heuristic validation of required components
- Visual diff snapshots
- Performance budget checks (Lighthouse/PSI)
- Deterministic seeds for reproducibility

---
This harness intentionally ships with a stub judge so it can run offline. Plug in real judging when ready.
