#!/usr/bin/env python
"""
Single-record evaluation processor implementing steps (1)-(5):
  (1) Find / extract UI description from a record
  (2) Call (stub) MCP tool with description to get "UX Agent Output"
  (3) Interpret the intended UI from description
  (4) Interpret the rendered UI from agent output
  (5) Produce judge scores by comparing (3) and (4) (stub scoring; replace with LLM)

This replaces the older positional-arg judge stub and provides a richer artifact set.

Artifacts per run directory (out-dir):
  record.json
  ui_description.txt
  agent_output.txt
  intended_interpretation.json
  rendered_interpretation.json
  judge_prompt.txt
  score.json
  meta.json

Usage:
  python eval/pipeline/judge.py --record path/to/record.json --out-dir eval/runs/<run>/<id> \
    --mcp-mode stub --model stub-model

Future: implement real MCP HTTP calls & LLM judge integration.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Optional
import datetime


def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def load_record(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_ui_description(record: Dict[str, Any], ui_key: str) -> str:
    if ui_key in record:
        return str(record[ui_key])
    for candidate in ("ui_description", "prompt", "description", "scenario"):
        if candidate in record:
            return str(record[candidate])
    raise SystemExit("UI description key not found in record.")


def _call_mcp_tool(description: str, mode: str, endpoint: Optional[str]) -> str:
    if mode == "stub":
        lines = [l.strip() for l in description.splitlines() if l.strip()]
        components = []
        keywords_map = {
            r"\b(kpi|metric|count|total)\b": "KpiCard",
            r"\b(table|list|rows?)\b": "Table",
            r"\b(alert|warning|error)\b": "Alert",
            r"\b(chart|trend|graph)\b": "Chart",
        }
        for pattern, comp in keywords_map.items():
            import re as _re
            if any(_re.search(pattern, l, _re.IGNORECASE) for l in lines):
                components.append({"type": comp})
        if not components:
            components.append({"type": "Container"})
        return json.dumps({"root": {"type": "Page", "children": components}, "_mode": "stub"}, indent=2)
    elif mode == "echo":
        return json.dumps({"echo": True, "original": description, "root": {"type": "Page", "children": []}}, indent=2)
    elif mode == "http":
        raise NotImplementedError("HTTP MCP mode not implemented.")
    else:
        raise SystemExit(f"Unsupported MCP mode: {mode}")


def interpret_intended_ui(ui_description: str) -> Dict[str, Any]:
    import re as _re
    lines = [l.strip() for l in ui_description.splitlines() if l.strip()]
    intents = []
    for l in lines:
        tokens = _re.findall(r"[A-Za-z0-9_]+", l)
        intents.append(
            {
                "raw": l,
                "tokens": tokens[:15],
                "mentionsTable": bool(_re.search(r"\btable|rows|columns\b", l, _re.IGNORECASE)),
                "mentionsKpi": bool(_re.search(r"\bkpi|metric|count|total\b", l, _re.IGNORECASE)),
                "mentionsChart": bool(_re.search(r"\bchart|graph|trend\b", l, _re.IGNORECASE)),
            }
        )
    inferred_components = []
    if any(i["mentionsKpi"] for i in intents): inferred_components.append("KpiCard")
    if any(i["mentionsTable"] for i in intents): inferred_components.append("Table")
    if any(i["mentionsChart"] for i in intents): inferred_components.append("Chart")
    if not inferred_components:
        inferred_components.append("Page")
    return {
        "summary": {
            "lineCount": len(lines),
            "inferredComponents": inferred_components,
        },
        "lines": intents,
    }


def interpret_rendered_ui(agent_output: str) -> Dict[str, Any]:
    import re as _re
    parsed = None
    stripped = agent_output.strip()
    if stripped.startswith("{") or stripped.startswith("["):
        try:
            parsed = json.loads(agent_output)
        except Exception:
            parsed = None
    components = []
    if parsed:
        def walk(node):
            if isinstance(node, dict):
                t = node.get("type")
                if t:
                    components.append(t)
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for item in node:
                    walk(item)
        walk(parsed)
    else:
        patterns = {
            "KpiCard": r"kpi|metric|count",
            "Table": r"<table|rows|columns",
            "Alert": r"alert|warning|error",
            "Chart": r"chart|graph|trend"
        }
        lowered = agent_output.lower()
        for comp, pat in patterns.items():
            if _re.search(pat, lowered):
                components.append(comp)
    unique_components = sorted(set(components))
    return {
        "componentTypes": unique_components,
        "componentCount": len(components),
        "rawParsed": bool(parsed),
        "rawIsJson": bool(parsed),
    }


def build_judge_prompt(intended: Dict[str, Any], rendered: Dict[str, Any]) -> str:
    return "\n".join([
        "=== INTENDED ===",
        json.dumps(intended, indent=2),
        "=== RENDERED ===",
        json.dumps(rendered, indent=2),
        "=== INSTRUCTIONS ===",
        "Stub judge prompt. Replace with real LLM evaluation instructions.",
    ])


def stub_score(intended: Dict[str, Any], rendered: Dict[str, Any]) -> Dict[str, Any]:
    intended_set = set(intended["summary"]["inferredComponents"])
    rendered_set = set(rendered["componentTypes"])
    overlap = len(intended_set & rendered_set)
    intended_count = max(len(intended_set), 1)
    rendered_count = max(len(rendered_set), 1)
    correctness_ratio = overlap / intended_count
    correctness = round(5 * correctness_ratio, 1)
    extras = len(rendered_set - intended_set)
    fidelity_base = max(0.0, 1.0 - (extras * 0.15))
    ui_fidelity = round(5 * min(fidelity_base, 1.0), 1)
    comp_meaningful = [c for c in rendered_set if c.lower() != "page"]
    compositionality = 2.0
    if len(comp_meaningful) >= 2: compositionality = 3.5
    if len(comp_meaningful) >= 3: compositionality = 4.0
    if len(comp_meaningful) >= 4: compositionality = 4.5
    resilience = 5.0
    if not rendered_set:
        resilience = 1.0
    elif rendered["componentCount"] == 0:
        resilience = 2.0
    line_tokens = sum(len(l["tokens"]) for l in intended["lines"]) or 1
    clarity_ratio = min(line_tokens / (8 * max(1, intended["summary"]["lineCount"])), 1.0)
    clarity = round(2.5 + (2.5 * clarity_ratio), 1)
    dims = {
        "correctness": correctness,
        "uiFidelity": ui_fidelity,
        "compositionality": round(compositionality, 1),
        "resilience": round(resilience, 1),
        "clarity": clarity
    }
    overall = round(sum(dims.values()) / len(dims), 1)
    warnings = []
    if correctness < 2.0: warnings.append("Low correctness overlap.")
    if ui_fidelity < 2.0: warnings.append("UI fidelity penalized by extra components.")
    return {
        "dimensionScores": dims,
        "overall": overall,
        "warnings": warnings,
        "improvements": ["Integrate real LLM judge for semantic evaluation."],
        "notes": f"Stub judge: overlap={overlap}/{intended_count}, extras={extras}"
    }


def process_single_record(record_path: Path, out_dir: Path, *, ui_key: str, mcp_mode: str, mcp_endpoint: Optional[str], model: str) -> Dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    record = load_record(record_path)
    record_id = str(record.get("id") or record_path.stem)
    ui_description = extract_ui_description(record, ui_key=ui_key)
    agent_output = _call_mcp_tool(ui_description, mode=mcp_mode, endpoint=mcp_endpoint)
    intended = interpret_intended_ui(ui_description)
    rendered = interpret_rendered_ui(agent_output)
    judge_prompt = build_judge_prompt(intended, rendered)
    score_obj = stub_score(intended, rendered)
    (out_dir / "record.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    (out_dir / "ui_description.txt").write_text(ui_description, encoding="utf-8")
    (out_dir / "agent_output.txt").write_text(agent_output, encoding="utf-8")
    (out_dir / "intended_interpretation.json").write_text(json.dumps(intended, indent=2), encoding="utf-8")
    (out_dir / "rendered_interpretation.json").write_text(json.dumps(rendered, indent=2), encoding="utf-8")
    (out_dir / "judge_prompt.txt").write_text(judge_prompt, encoding="utf-8")
    score_payload = {"recordId": record_id, "model": model, "timestamp": _now_iso(), **score_obj}
    (out_dir / "score.json").write_text(json.dumps(score_payload, indent=2), encoding="utf-8")
    meta = {"recordId": record_id, "timestamp": _now_iso(), "model": model, "mcpMode": mcp_mode, "uiKey": ui_key, "stepsCompleted": [1,2,3,4,5], "note": "Step 5 uses stub scoring. Replace with real LLM call."}
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return {"recordId": record_id, "outDir": str(out_dir), "overall": score_payload["overall"], "componentTypes": rendered["componentTypes"]}


def build_arg_parser():
    p = argparse.ArgumentParser(description="Process a single evaluation dataset record (steps 1–5).")
    p.add_argument("--record", required=True, help="Path to record JSON file")
    p.add_argument("--out-dir", required=True, help="Output directory for artifacts")
    p.add_argument("--ui-key", default="ui_description", help="Field name containing UI description")
    p.add_argument("--mcp-mode", default="stub", choices=["stub","echo","http"], help="How to obtain agent output")
    p.add_argument("--mcp-endpoint", help="Endpoint for MCP when mode=http (not implemented)")
    p.add_argument("--model", default="stub-model", help="Model label for metadata")
    return p


def main(argv: Optional[list[str]] = None) -> int:
    ap = build_arg_parser()
    args = ap.parse_args(argv)
    summary = process_single_record(Path(args.record), Path(args.out_dir), ui_key=args.ui_key, mcp_mode=args.mcp_mode, mcp_endpoint=args.mcp_endpoint, model=args.model)
    print(json.dumps({"status": "ok", **summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
