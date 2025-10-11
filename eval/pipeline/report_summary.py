#!/usr/bin/env python
"""Generate summary.md from results.jsonl (post-merge optional)."""
from __future__ import annotations
import json, argparse, statistics
from pathlib import Path

def load_jsonl(p: Path):
    return [json.loads(l) for l in p.read_text(encoding='utf-8').splitlines() if l.strip()]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True)
    args = ap.parse_args()
    run_dir = Path(args.run)
    results_file = run_dir / 'results.jsonl'
    if not results_file.exists():
        raise SystemExit('results.jsonl missing')
    rows = load_jsonl(results_file)
    overall = [r['judge']['overall'] for r in rows if r.get('judge')]
    coverage = [r['autoscore']['componentCoverage'] for r in rows]
    prop = [r['autoscore']['propFidelity'] for r in rows]
    def mean(xs): return sum(xs)/len(xs) if xs else 0
    def ci95(xs):
        if len(xs) < 2: return 0
        import math
        m = mean(xs); sd = statistics.pstdev(xs)
        return 1.96 * (sd / (len(xs) ** 0.5)), m
    ci_o, m_o = ci95(overall)
    arche_map = {}
    for r in rows:
        a = r.get('archetype') or 'unknown'
        arche_map.setdefault(a, []).append(r)
    arche_lines = []
    for a, items in arche_map.items():
        o = mean([i['judge']['overall'] for i in items if i.get('judge')])
        arche_lines.append(f"| {a} | {len(items)} | {o:.2f} |")
    md = [
        f"# Run Summary", '',
        f"Items: {len(rows)}",\
        f"Coverage Mean: {mean(coverage):.3f}",
        f"Prop Fidelity Mean: {mean(prop):.3f}",
        f"Judge Overall Mean: {m_o:.3f} ± {ci_o:.3f}",
        '',
        '## By Archetype',
        '| Archetype | Items | JudgeOverall |',
        '|-----------|-------|--------------|',
        *arche_lines
    ]
    (run_dir / 'summary.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    print('summary.md written')

if __name__ == '__main__':
    main()
