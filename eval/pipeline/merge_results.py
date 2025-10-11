#!/usr/bin/env python
"""Merge autoscore + judge jsonl streams into consolidated results.jsonl.
Assumes files in a run directory: autoscores.jsonl, judge.jsonl (future), currently judge data embedded.
"""
from __future__ import annotations
import json, argparse
from pathlib import Path

def load_jsonl(p: Path):
    return [json.loads(l) for l in p.read_text(encoding='utf-8').splitlines() if l.strip()]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', required=True, help='Path to run directory containing autoscores.jsonl and results.jsonl')
    args = ap.parse_args()
    run_dir = Path(args.run)
    autos_file = run_dir / 'autoscores.jsonl'
    res_file = run_dir / 'results.jsonl'
    if not autos_file.exists() or not res_file.exists():
        print('Required files missing.')
        return
    autos = {a['id']: a for a in load_jsonl(autos_file)}
    res = load_jsonl(res_file)
    merged = []
    for r in res:
        a = autos.get(r['id'])
        r['autoscore_detail'] = a.get('scores') if a else None
        merged.append(r)
    out_path = run_dir / 'results_merged.jsonl'
    with out_path.open('w', encoding='utf-8') as f:
        for m in merged:
            f.write(json.dumps(m) + '\n')
    print(f'Merged -> {out_path}')

if __name__ == '__main__':
    main()
