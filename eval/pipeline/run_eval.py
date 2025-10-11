#!/usr/bin/env python
"""End-to-end evaluation pipeline (dataset -> autoscore -> judge stub).
Currently uses stub judge (Python deterministic) and placeholder composition fetch.
Extend: integrate real MCP call to create_portal_ui.
"""
from __future__ import annotations
import json, argparse, subprocess, sys, datetime, os
from pathlib import Path
from typing import Any, List

from autoscore.rules import ComponentNode, evaluate_expected_component, summarize_component_evals
from autoscore.summarize import summarize_nodes

ROOT = Path(__file__).parent.parent
DATASET = ROOT / 'dataset' / 'ux-agent.jsonl'
OUT_ROOT = ROOT / 'out'

JUDGE_SCRIPT = ROOT.parent / 'scripts' / 'judge.py'  # reuse existing judge
PROMPT_TEMPLATE = Path(__file__).parent / 'judge' / 'prompt_template.txt'


def load_dataset(path: Path) -> list[dict[str,Any]]:
    return [json.loads(l) for l in path.read_text(encoding='utf-8').splitlines() if l.strip()]


def fake_fetch_composition(prompt: str) -> dict:
    """Placeholder: return a trivial mock composition.
    Replace with real MCP tool invocation.
    """
    return {
        "type": "Page",
        "children": [
            {"type": "KpiCard", "props": {"title": "Active Users"}, "children": []},
            {"type": "Table", "props": {"columns": ["status","version","time"]}, "children": []}
        ]
    }


def build_nodes(tree: dict, path: str = "root") -> ComponentNode:
    children = [build_nodes(c, f"{path}/{i}") for i, c in enumerate(tree.get('children', []))]
    return ComponentNode(type=tree.get('type','Unknown'), props=tree.get('props',{}), children=children, path=path)


def autoscore(item: dict, composition: dict) -> dict:
    root = build_nodes(composition)
    flat = root.flatten()
    evals = [evaluate_expected_component(spec, flat) for spec in item['expected_components']]
    summary = summarize_component_evals(evals)
    component_summary = summarize_nodes(flat)
    return {
        "id": item['id'],
        "archetype": item.get('archetype'),
        "scores": summary,
        "component_summary": component_summary
    }


def run_judge(autoscore_record: dict, prompt: str, rubric_path: Path) -> dict:
    rubric = rubric_path.read_text(encoding='utf-8')
    template = PROMPT_TEMPLATE.read_text(encoding='utf-8') if PROMPT_TEMPLATE.exists() else ''
    # Compose intermediate bundle for judge.py consumption (extend judge.py later to accept autoscore JSON)
    # For now embed autoscore into a temporary prompt file and rely on existing judge stub.
    # Future: modify judge.py to accept a JSON file argument.
    # We'll just pass scenario text as scenario + attach autoscore summary appended to agent output.
    tmp_dir = OUT_RUN / 'tmp'
    tmp_dir.mkdir(parents=True, exist_ok=True)
    scenario_txt = Path(tmp_dir / f"{autoscore_record['id']}_scenario.txt")
    scenario_txt.write_text(prompt, encoding='utf-8')
    agent_output = Path(tmp_dir / f"{autoscore_record['id']}_agent_output.txt")
    agent_output.write_text(json.dumps(autoscore_record['component_summary'], indent=2), encoding='utf-8')
    # Call existing judge
    cmd = [sys.executable, str(JUDGE_SCRIPT), autoscore_record['id'], str(scenario_txt), str(agent_output), str(rubric_path), '', 'stub-python-model']
    subprocess.run(cmd, check=True)
    score_path = agent_output.parent / 'score.json'
    judge_score = json.loads(score_path.read_text(encoding='utf-8'))
    return judge_score


def ensure_out(run_id: str) -> Path:
    run_dir = OUT_ROOT / 'runs' / run_id
    (run_dir / 'autoscore').mkdir(parents=True, exist_ok=True)
    return run_dir


def save_autoscore(run_dir: Path, rec: dict):
    with (run_dir / 'autoscore' / f"{rec['id']}.json").open('w', encoding='utf-8') as f:
        json.dump(rec, f, indent=2)


def append_jsonl(path: Path, obj: dict):
    with path.open('a', encoding='utf-8') as f:
        f.write(json.dumps(obj) + '\n')


def summarize_run(run_dir: Path, merged: List[dict]):
    import statistics
    overall = [m['judge']['overall'] for m in merged if m.get('judge')]
    cov = [m['autoscore']['scores']['componentCoverage'] for m in merged]
    out_lines = [
        f"Items: {len(merged)}",
        f"Coverage(mean): {sum(cov)/len(cov):.3f}",
        f"Judge Overall(mean): {sum(overall)/len(overall):.3f}" if overall else 'Judge Overall: n/a'
    ]
    (run_dir / 'summary.md').write_text('# Run Summary\n\n' + '\n'.join(out_lines) + '\n', encoding='utf-8')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--dataset', default=str(DATASET))
    ap.add_argument('--rubric', default=str(ROOT / 'rubric.md'))
    args = ap.parse_args()

    run_id = datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    OUT_RUN = ensure_out(run_id)

    dataset = load_dataset(Path(args.dataset))
    merged: list[dict] = []
    autoscores_path = OUT_RUN / 'autoscores.jsonl'
    results_path = OUT_RUN / 'results.jsonl'

    for item in dataset:
        composition = fake_fetch_composition(item['prompt'])
        auto = autoscore(item, composition)
        save_autoscore(OUT_RUN, auto)
        append_jsonl(autoscores_path, auto)
        judge_score = run_judge(auto, item['prompt'], Path(args.rubric))
        merged_record = {
            'id': item['id'],
            'archetype': item.get('archetype'),
            'autoscore': auto['scores'],
            'judge': {
                'overall': judge_score['overall'],
                'dimensionScores': judge_score['dimensionScores']
            }
        }
        append_jsonl(results_path, merged_record)
        merged.append(merged_record)

    summarize_run(OUT_RUN, merged)
    print(f"Run complete: {OUT_RUN}")
