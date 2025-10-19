#!/usr/bin/env python
"""Multi-record judge runner.

Loads the evaluation dataset (UI descriptions), runs the single-record judge pipeline
from `eval/pipeline/judge.py` (steps 1–5) for each record, and writes an aggregated
summary. This supersedes the older results.jsonl -> summary pipeline.

Outputs layout:
  eval/runs/<timestamp>/
    <recordId>/ ... per-record artifacts (see judge.py)
    run_summary.json  (machine readable aggregate)
    summary.md        (human readable aggregate)

Usage example:
  python eval/pipeline/run_judge_over_dataset.py \
      --run-root eval/runs --limit 10 --mcp-mode stub
"""
from __future__ import annotations
import argparse, json, re, statistics, datetime
from pathlib import Path
from typing import Dict, Any, List

# Allow running this script directly (python eval/pipeline/run_judge_over_dataset.py)
# by ensuring the repository root is on sys.path for absolute-style imports.
import sys
CURRENT_FILE = Path(__file__).resolve()
REPO_ROOT = CURRENT_FILE.parent.parent.parent  # eval/pipeline/ -> eval/ -> repo root
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from eval.dataset.load_dataset import load_dataset, resolve_dataset_dir  # type: ignore
from eval.pipeline.judge import process_single_record  # type: ignore


def _now_iso() -> str:
    try:
        return datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    except Exception:
        return datetime.datetime.utcnow().isoformat() + "Z"


def sanitize_id(name: str) -> str:
    base = name.strip().lower()
    base = re.sub(r"[^\w]+", "-", base)
    base = re.sub(r"-+", "-", base).strip('-')
    return base[:80] if len(base) > 80 else base


def ensure_run_dir(root: Path) -> Path:
    try:
        run_id = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d_%H%M%S")
    except Exception:
        run_id = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    rd = root / run_id
    rd.mkdir(parents=True, exist_ok=True)
    return rd


def aggregate_scores(per: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not per:
        return {"count": 0}
    dims = ["correctness", "uiFidelity", "compositionality", "resilience", "clarity"]
    out: Dict[str, Any] = {"count": len(per)}
    for d in dims:
        vals = [p["dimensionScores"][d] for p in per if d in p.get("dimensionScores", {})]
        if vals:
            out[d] = round(sum(vals)/len(vals), 3)
    over = [p.get("overall") for p in per if p.get("overall") is not None]
    if over:
        mean = sum(over)/len(over)
        out["overallMean"] = round(mean, 3)
        if len(over) > 1:
            sd = statistics.pstdev(over)
            ci95 = 1.96 * (sd / (len(over) ** 0.5))
            out["overallCI95"] = round(ci95, 3)
    return out


def write_summary_md(run_dir: Path, agg: Dict[str, Any], per: List[Dict[str, Any]]):
    lines = ["# Run Summary", "", f"Records: {agg.get('count',0)}"]
    if 'overallMean' in agg:
        if 'overallCI95' in agg:
            lines.append(f"Overall Mean: {agg['overallMean']:.3f} ± {agg['overallCI95']:.3f}")
        else:
            lines.append(f"Overall Mean: {agg['overallMean']:.3f}")
    for d in ["correctness","uiFidelity","compositionality","resilience","clarity"]:
        if d in agg:
            lines.append(f"{d}: {agg[d]:.3f}")
    lines.append("")
    lines.append("## Per Record (first 50)")
    lines.append("| id | overall | rendered_components | intended_inferred |")
    lines.append("|----|---------|---------------------|-------------------|")
    for r in per[:50]:
        rc = ",".join(r.get("componentTypes", [])[:6])
        ic = ",".join(r.get("intendedInferredComponents", [])[:6])
        lines.append(f"| {r['recordId']} | {r.get('overall','?')} | {rc} | {ic} |")
    (run_dir / 'summary.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def run_dataset(run_root: Path, *, mcp_endpoint: str, limit: int | None, filter_sub: str | None, model: str, id_prefix: str | None, skip_existing: bool) -> Dict[str, Any]:
    print(f"[dataset] Loading from: {resolve_dataset_dir()}")
    data = load_dataset()
    print(f"[dataset] Loaded {len(data)} entries")
    titles = list(data.keys())
    if filter_sub:
        titles = [t for t in titles if filter_sub.lower() in t.lower()]
        print(f"[dataset] Filtered to {len(titles)} entries matching '{filter_sub}'")
    if limit is not None:
        titles = titles[:limit]
        print(f"[dataset] Limited to {len(titles)} entries")
    run_dir = ensure_run_dir(run_root)
    per: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []
    for idx, title in enumerate(titles, 1):
        raw = data[title]
        rid_base = sanitize_id(title)
        rid = f"{id_prefix}{rid_base}" if id_prefix else rid_base
        # Log start of record processing for responsiveness
        print(f"[record {idx}/{len(titles)}] Starting: title='{title}' id='{rid}' at {_now_iso()}", flush=True)
        out_dir = run_dir / rid
        if skip_existing and (out_dir / 'score.json').exists():
            try:
                score = json.loads((out_dir / 'score.json').read_text(encoding='utf-8'))
                per.append({
                    "recordId": rid,
                    "overall": score.get("overall"),
                    "dimensionScores": score.get("dimensionScores", {}),
                    "componentTypes": score.get("rendered", {}).get("componentTypes", []) if 'rendered' in score else [],
                    "intendedInferredComponents": score.get("intended", {}).get("summary", {}).get("inferredComponents", [])
                })
                continue
            except Exception:
                pass
        # Build synthetic record json for the single-record processor
        out_dir.mkdir(parents=True, exist_ok=True)
        record_path = out_dir / 'record.json'
        record_path.write_text(json.dumps({"id": rid, "ui_description": raw}, indent=2), encoding='utf-8')
        try:
            summary = process_single_record(
                record_path=record_path,
                out_dir=out_dir,
                ui_key='ui_description',
                mcp_endpoint=mcp_endpoint,
                model=model,
            )
            score_file = out_dir / 'score.json'
            if score_file.exists():
                score = json.loads(score_file.read_text(encoding='utf-8'))
                per.append({
                    "recordId": summary["recordId"],
                    "overall": score.get("overall"),
                    "dimensionScores": score.get("dimensionScores", {}),
                    "componentTypes": summary.get("componentTypes", []),
                    "intendedInferredComponents": summary.get("intendedInferredComponents", [])
                })
            else:
                errors.append({"recordId": rid, "error": "score.json missing"})
        except Exception as e:
            errors.append({"recordId": rid, "error": str(e)})
    agg = aggregate_scores(per)
    run_summary = {
        "runDir": str(run_dir),
        "timestamp": _now_iso(),
        "recordsProcessed": len(per),
        "errors": errors,
        "aggregate": agg,
    }
    (run_dir / 'run_summary.json').write_text(json.dumps(run_summary, indent=2), encoding='utf-8')
    write_summary_md(run_dir, agg, per)
    return run_summary


def build_parser():
    p = argparse.ArgumentParser(description='Run multi-record judge pipeline (HTTP MCP only).')
    p.add_argument('--run-root', default='eval/runs', help='Root directory for new run.')
    p.add_argument('--mcp-endpoint', required=True, help='MCP server HTTP endpoint (e.g. http://localhost:3001).')
    p.add_argument('--limit', type=int, help='Limit number of records.')
    p.add_argument('--filter', help='Substring filter applied to titles.')
    p.add_argument('--model', default='stub-model', help='Model label recorded in metadata.')
    p.add_argument('--id-prefix', help='Optional prefix for record ids.')
    p.add_argument('--skip-existing', action='store_true', help='Skip record if score.json already present.')
    return p


def main(argv=None):
    ap = build_parser()
    args = ap.parse_args(argv)
    run_root = Path(args.run_root)
    run_root.mkdir(parents=True, exist_ok=True)
    summary = run_dataset(
        run_root=run_root,
        mcp_endpoint=args.mcp_endpoint,
        limit=args.limit,
        filter_sub=args.filter,
        model=args.model,
        id_prefix=args.id_prefix,
        skip_existing=args.skip_existing,
    )
    print(json.dumps(summary, indent=2))
    if summary.get('errors'):
        print(f"Completed with {len(summary['errors'])} errors.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
