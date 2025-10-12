#!/usr/bin/env python
"""Aggregate latest run scores (Python version).
Usage:
  python aggregate.py [runsRoot?]
If runsRoot omitted, defaults to ../runs relative to this script.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from statistics import mean

def main():
    runs_root = Path(sys.argv[1]) if len(sys.argv) > 1 else (Path(__file__).parent.parent / 'runs')
    if not runs_root.exists():
        print(f"Run directory not found: {runs_root}", file=sys.stderr)
        sys.exit(1)
    runs = sorted([p for p in runs_root.iterdir() if p.is_dir()], reverse=True)
    if not runs:
        print('No runs found.', file=sys.stderr)
        sys.exit(1)
    latest = runs[0]
    scores_file = latest / 'scores.json'
    if not scores_file.exists():
        print(f'scores.json not found in {latest}', file=sys.stderr)
        sys.exit(1)

    scores = json.loads(scores_file.read_text(encoding='utf-8'))
    dims = ['correctness','uiFidelity','compositionality','resilience','clarity']
    agg = {}
    for d in dims:
        vals = [s['dimensionScores'][d] for s in scores if d in s['dimensionScores']]
        if vals:
            agg[d] = round(mean(vals), 2)
    overall_vals = [s['overall'] for s in scores if 'overall' in s]
    if overall_vals:
        agg['overallMean'] = round(mean(overall_vals), 2)

    print(f"=== Aggregated Results (Latest Run: {latest.name}) ===")
    for k,v in agg.items():
        print(f"{k}: {v}")

if __name__ == '__main__':
    main()
