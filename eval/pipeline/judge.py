#!/usr/bin/env python
"""
Python judge implementation mirroring judge.ts contract.

Usage:
  python judge.py <scenarioId> <scenarioPath> <agentOutputPath> <rubricPath> <expectedPath?> <model?>

Outputs:
  - score.json (in same directory as agentOutputPath)
  - judge_prompt.txt (the constructed composite prompt)
"""
from __future__ import annotations
import json
import os
import sys
import datetime
from pathlib import Path
from typing import Any, Dict, Optional

DIMENSIONS = ["correctness", "uiFidelity", "compositionality", "resilience", "clarity"]


def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def deterministic_stub_scores(agent_output: str, scenario_text: str) -> Dict[str, Any]:
    """Deterministic placeholder scoring; replace with real LLM evaluation."""
    length_factor = min(len(agent_output) / 4000.0, 1.0)
    base = 3.0 + (0.5 * length_factor)
    dims = {
        "correctness": round(base, 1),
        "uiFidelity": round(base - 0.2, 1),
        "compositionality": round(base - 0.1, 1),
        "resilience": round(base, 1),
        "clarity": round(base - 0.3, 1),
    }
    overall = round(sum(dims.values()) / len(dims), 1)
    return {
        "dimensionScores": dims,
        "overall": overall,
        "warnings": [],
        "improvements": ["Integrate real LLM judge."],
        "notes": "Stubbed Python judge.",
    }


def build_judge_prompt(
    rubric: str,
    scenario_text: str,
    agent_output: str,
    expected_heuristics: Optional[Dict[str, Any]],
    judge_instructions: str,
) -> str:
    return "\n\n".join(
        [
            "=== RUBRIC ===",
            rubric,
            "=== SCENARIO ===",
            scenario_text,
            "=== RAW_OUTPUT ===",
            agent_output if agent_output.strip() else "<empty>",
            "=== OPTIONAL_EXPECTED ===",
            json.dumps(expected_heuristics, indent=2) if expected_heuristics else "<none>",
            "=== INSTRUCTIONS ===",
            judge_instructions,
        ]
    )


def main():
    if len(sys.argv) < 6:
        print(
            "Usage: python judge.py <scenarioId> <scenarioPath> <agentOutputPath> <rubricPath> <expectedPath?> <model?>",
            file=sys.stderr,
        )
        sys.exit(1)

    scenario_id = sys.argv[1]
    scenario_path = Path(sys.argv[2])
    agent_output_path = Path(sys.argv[3])
    rubric_path = Path(sys.argv[4])
    expected_path_arg = sys.argv[5] if len(sys.argv) > 5 else ""
    model = sys.argv[6] if len(sys.argv) > 6 else "stub-python-model"

    expected_json = None
    if expected_path_arg and expected_path_arg.strip():
        p = Path(expected_path_arg)
        if p.exists():
            try:
                expected_json = json.loads(p.read_text(encoding="utf-8"))
            except Exception as e:  # pragma: no cover - simple fallback
                expected_json = {"_parseError": str(e)}

    try:
        scenario_text = scenario_path.read_text(encoding="utf-8")
    except Exception:  # pragma: no cover
        scenario_text = ""
    try:
        agent_output = agent_output_path.read_text(encoding="utf-8")
    except Exception:  # pragma: no cover
        agent_output = ""

    rubric = rubric_path.read_text(encoding="utf-8")

    judge_prompt_file = Path(__file__).parent.parent / "judges" / "llm-judge-prompt.txt"
    judge_instructions = (
        judge_prompt_file.read_text(encoding="utf-8")
        if judge_prompt_file.exists()
        else "MISSING_JUDGE_PROMPT"
    )

    composite_prompt = build_judge_prompt(
        rubric=rubric,
        scenario_text=scenario_text,
        agent_output=agent_output,
        expected_heuristics=expected_json,
        judge_instructions=judge_instructions,
    )

    out_dir = agent_output_path.parent
    (out_dir / "judge_prompt.txt").write_text(composite_prompt, encoding="utf-8")

    stub_scores = deterministic_stub_scores(agent_output, scenario_text)
    score_obj = {
        "scenarioId": scenario_id,
        "dimensionScores": stub_scores["dimensionScores"],
        "overall": stub_scores["overall"],
        "warnings": stub_scores.get("warnings", []),
        "improvements": stub_scores.get("improvements", []),
        "notes": stub_scores.get("notes", ""),
        "model": model,
        "rawOutputPath": str(agent_output_path),
        "judgePromptPath": str(out_dir / "judge_prompt.txt"),
        "timestamp": _now_iso(),
    }
    (out_dir / "score.json").write_text(json.dumps(score_obj, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
