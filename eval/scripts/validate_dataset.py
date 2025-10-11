#!/usr/bin/env python
"""Validate dataset JSONL against schema and basic distribution rules.
Usage:
  python validate_dataset.py --dataset ../dataset/ux-agent.jsonl --schema ../dataset/schema.json
"""
from __future__ import annotations
import json, argparse, sys, collections, hashlib
from pathlib import Path

try:
    from jsonschema import Draft7Validator
except ImportError:
    print("jsonschema not installed. Run: python -m pip install jsonschema", file=sys.stderr)
    sys.exit(2)

ARCHETYPE_MIN = 1  # adjust upward when scaling

def hash_dataset(lines: list[str]) -> str:
    h = hashlib.sha256()
    for line in lines:
        h.update(line.encode('utf-8'))
    return h.hexdigest()[:16]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dataset', required=True)
    ap.add_argument('--schema', required=True)
    args = ap.parse_args()

    dataset_path = Path(args.dataset)
    schema_path = Path(args.schema)
    if not dataset_path.exists():
        print(f"Dataset not found: {dataset_path}", file=sys.stderr); sys.exit(1)
    if not schema_path.exists():
        print(f"Schema not found: {schema_path}", file=sys.stderr); sys.exit(1)

    schema = json.loads(schema_path.read_text(encoding='utf-8'))
    validator = Draft7Validator(schema)

    lines = [l.strip() for l in dataset_path.read_text(encoding='utf-8').splitlines() if l.strip()]
    ids = set()
    arche_counts = collections.Counter()
    errors_total = 0

    for idx, line in enumerate(lines, 1):
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            print(f"Line {idx}: JSON decode error: {e}", file=sys.stderr)
            errors_total += 1
            continue
        errs = list(validator.iter_errors(obj))
        if errs:
            print(f"Line {idx} (id={obj.get('id')}): schema errors:")
            for e in errs:
                print(f"  - {e.message}")
            errors_total += len(errs)
        _id = obj.get('id')
        if _id in ids:
            print(f"Line {idx}: duplicate id {_id}")
            errors_total += 1
        ids.add(_id)
        arche = obj.get('archetype')
        if arche:
            arche_counts[arche] += 1

    if errors_total:
        print(f"FAILED with {errors_total} total errors", file=sys.stderr)
        sys.exit(1)

    # Distribution check (minimum presence)
    missing_arche = [a for a in ['dashboard','kanban','admin_portal','data_table','detail_page','auth'] if arche_counts[a] < ARCHETYPE_MIN]
    if missing_arche:
        print(f"WARNING: Underrepresented archetypes: {missing_arche}")

    print("OK: dataset valid")
    print(f"Items: {len(lines)}  Unique IDs: {len(ids)}  Dataset Hash: {hash_dataset(lines)}")
    print("Archetype counts:")
    for k,v in arche_counts.items():
        print(f"  {k}: {v}")

if __name__ == '__main__':
    main()
