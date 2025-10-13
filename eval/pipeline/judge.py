#!/usr/bin/env python
"""
LLM-only single-record evaluation pipeline.

Steps:
  (1) Load record & extract UI description
  (2) Obtain agent output via (currently stub) MCP tool
  (3) LLM: Interpret intended UI -> intended_interpretation.json
  (4) LLM: Interpret rendered UI -> rendered_interpretation.json
  (5) LLM: Judge & score -> score.json

Artifacts:
  record.json
  ui_description.txt
  agent_output.txt
  prompt_step3_intended.txt
  intended_interpretation.json
  prompt_step4_rendered.txt
  rendered_interpretation.json
  prompt_step5_judge.txt
  score.json
  meta.json

This version removes all heuristic/stub scoring or interpretation. Failure in any
LLM step aborts the run with non‑zero exit.
"""
from __future__ import annotations
import argparse
import json
import os
import datetime
from pathlib import Path
from typing import Any, Dict, Optional
import sys

try:
    from .tool_aoai import aoai_chat  # uses environment-configured Azure OpenAI deployment
except Exception as e:  # pragma: no cover
    print(f"ERROR: cannot import aoai_chat from tool_aoai.py: {e}", file=sys.stderr)
    raise

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
PROMPT_INTENDED = PROMPTS_DIR / "interpret_intended.prompt.txt"
PROMPT_RENDERED = PROMPTS_DIR / "interpret_rendered.prompt.txt"
PROMPT_JUDGE    = PROMPTS_DIR / "judge_scoring.prompt.txt"

def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"

def _require_env(var: str):
    if not os.environ.get(var):
        print(f"ERROR: Required environment variable {var} not set (LLM-only mode).", file=sys.stderr)
        raise SystemExit(2)

def _ensure_prompt(path: Path):
    if not path.is_file():
        print(f"ERROR: Missing prompt template: {path}", file=sys.stderr)
        raise SystemExit(2)

def load_record(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))

def extract_ui_description(record: Dict[str, Any], ui_key: str) -> str:
    if ui_key in record:
        return str(record[ui_key])
    for c in ("ui_description", "prompt", "description", "scenario"):
        if c in record:
            return str(record[c])
    raise SystemExit("UI description key not found in record.")

def _call_mcp_tool(description: str, mode: str, endpoint: Optional[str]) -> str:
    if mode == "stub":
        lines = [l.strip() for l in description.splitlines() if l.strip()]
        components = []
        import re as _re
        patterns = {
            "KpiCard": r"\b(kpi|metric|count|total)\b",
            "Table": r"\b(table|list|rows?)\b",
            "Alert": r"\b(alert|warning|error)\b",
            "Chart": r"\b(chart|trend|graph)\b",
        }
        for comp, pat in patterns.items():
            if any(_re.search(pat, line, _re.IGNORECASE) for line in lines):
                components.append({"type": comp})
        if not components:
            components.append({"type": "Container"})
        return json.dumps({"root": {"type": "Page", "children": components}, "_mode": "stub-mcp"}, indent=2)
    if mode == "echo":
        return json.dumps({"echo": True, "original": description, "root": {"type": "Page", "children": []}}, indent=2)
    if mode == "http":
        raise NotImplementedError("HTTP MCP mode not implemented.")
    raise SystemExit(f"Unsupported MCP mode: {mode}")

def _read_prompt(p: Path) -> str:
    return p.read_text(encoding="utf-8")

def _write_text(path: Path, content: str):
    path.write_text(content, encoding="utf-8")

def _write_json(path: Path, obj: Any):
    path.write_text(json.dumps(obj, indent=2), encoding="utf-8")

def _aoai_json(messages, purpose: str):
    resp = aoai_chat(messages=messages)
    # Expect dict; if string, attempt JSON parse
    if isinstance(resp, str):
        try:
            resp_obj = json.loads(resp)
            return resp_obj
        except Exception:
            print(f"ERROR: {purpose} returned non-JSON string.", file=sys.stderr)
            raise SystemExit(1)
    if not isinstance(resp, dict):
        print(f"ERROR: {purpose} did not return JSON object.", file=sys.stderr)
        raise SystemExit(1)
    return resp

def llm_interpret_intended(ui_description: str, template: str) -> dict:
    prompt_filled = template.replace("{{UI_DESCRIPTION}}", ui_description)
    messages = [
        {"role": "system", "content": "You extract intended UI structure. Output strict JSON only."},
        {"role": "user", "content": prompt_filled},
    ]
    return _aoai_json(messages, "Intended Interpretation")

def llm_interpret_rendered(agent_output: str, template: str) -> dict:
    prompt_filled = template.replace("{{AGENT_OUTPUT}}", agent_output)
    messages = [
        {"role": "system", "content": "You summarize rendered UI structure. Output strict JSON only."},
        {"role": "user", "content": prompt_filled},
    ]
    return _aoai_json(messages, "Rendered Interpretation")

def llm_judge(intended: dict, rendered: dict, template: str, ui_description: str, agent_output: str) -> dict:
    filled = (template
              .replace("{{INTENDED_JSON}}", json.dumps(intended, ensure_ascii=False))
              .replace("{{RENDERED_JSON}}", json.dumps(rendered, ensure_ascii=False))
              .replace("{{UI_DESCRIPTION}}", ui_description)
              .replace("{{AGENT_OUTPUT}}", agent_output))
    messages = [
        {"role": "system", "content": "You are an impartial evaluator returning scores JSON only."},
        {"role": "user", "content": filled},
    ]
    result = _aoai_json(messages, "Judge Scoring")
    if "dimensionScores" not in result:
        print("ERROR: judge output missing dimensionScores", file=sys.stderr)
        raise SystemExit(1)
    if "overall" not in result:
        scores = [v for v in result["dimensionScores"].values() if isinstance(v,(int,float))]
        if scores:
            result["overall"] = round(sum(scores)/len(scores), 2)
    return result

def process_single_record(record_path: Path, out_dir: Path, *, ui_key: str, mcp_mode: str, mcp_endpoint: Optional[str], model: str) -> dict:
    # Env sanity (endpoint + either API key or AAD implied in helper) - rely on url builder in aoai_chat
    _require_env("AZURE_OPENAI_ENDPOINT")
    out_dir.mkdir(parents=True, exist_ok=True)

    for p in (PROMPT_INTENDED, PROMPT_RENDERED, PROMPT_JUDGE):
        _ensure_prompt(p)

    # STEP 1: load record & extract UI description (log input/output)
    record = load_record(record_path)
    record_id = str(record.get("id") or record_path.stem)
    ui_description = extract_ui_description(record, ui_key=ui_key)
    _write_json(out_dir / "step1_input.json", {
        "recordPath": str(record_path),
        "uiKey": ui_key,
        "recordKeys": list(record.keys())
    })
    _write_json(out_dir / "step1_output.json", {
        "recordId": record_id,
        "uiDescriptionPreview": ui_description[:400],
        "uiDescriptionLength": len(ui_description)
    })

    # STEP 2: obtain agent output (log input/output)
    agent_output = _call_mcp_tool(ui_description, mode=mcp_mode, endpoint=mcp_endpoint)
    _write_json(out_dir / "step2_input.json", {
        "uiDescriptionLength": len(ui_description),
        "mcpMode": mcp_mode,
        "mcpEndpoint": mcp_endpoint
    })
    _write_json(out_dir / "step2_output.json", {
        "agentOutputPreview": agent_output[:400],
        "agentOutputLength": len(agent_output)
    })

    intended_prompt = _read_prompt(PROMPT_INTENDED)
    rendered_prompt = _read_prompt(PROMPT_RENDERED)
    judge_prompt    = _read_prompt(PROMPT_JUDGE)

    # STEP 3: intended interpretation (log input/output)
    _write_json(out_dir / "step3_input.json", {
        "promptTemplate": PROMPT_INTENDED.name,
        "promptCharCount": len(intended_prompt),
        "uiDescriptionLength": len(ui_description)
    })
    intended_obj = llm_interpret_intended(ui_description, intended_prompt)
    _write_json(out_dir / "step3_output.json", intended_obj)

    # STEP 4: rendered interpretation (log input/output)
    _write_json(out_dir / "step4_input.json", {
        "promptTemplate": PROMPT_RENDERED.name,
        "promptCharCount": len(rendered_prompt),
        "agentOutputLength": len(agent_output)
    })
    rendered_obj = llm_interpret_rendered(agent_output, rendered_prompt)
    _write_json(out_dir / "step4_output.json", rendered_obj)

    # STEP 5: judge scoring (log input/output)
    _write_json(out_dir / "step5_input.json", {
        "promptTemplate": PROMPT_JUDGE.name,
        "promptCharCount": len(judge_prompt),
        "intendedKeys": list(intended_obj.keys()),
        "renderedKeys": list(rendered_obj.keys())
    })
    judge_obj    = llm_judge(intended_obj, rendered_obj, judge_prompt, ui_description, agent_output)
    _write_json(out_dir / "step5_output.json", judge_obj)

    # Write existing artifacts
    _write_json(out_dir / "record.json", record)
    _write_text(out_dir / "ui_description.txt", ui_description)
    _write_text(out_dir / "agent_output.txt", agent_output)
    _write_text(out_dir / "prompt_step3_intended.txt", intended_prompt)
    _write_json(out_dir / "intended_interpretation.json", intended_obj)
    _write_text(out_dir / "prompt_step4_rendered.txt", rendered_prompt)
    _write_json(out_dir / "rendered_interpretation.json", rendered_obj)
    _write_text(out_dir / "prompt_step5_judge.txt", judge_prompt)
    _write_json(out_dir / "step5_response.json", judge_obj)

    score_payload = {
        "recordId": record_id,
        "timestamp": _now_iso(),
        "model": model,
        **judge_obj
    }
    _write_json(out_dir / "score.json", score_payload)

    meta = {
        "recordId": record_id,
        "timestamp": _now_iso(),
        "model": model,
        "mcpMode": mcp_mode,
        "uiKey": ui_key,
        "stepsCompleted": [1,2,3,4,5],
        "llmOnly": True,
        "promptTemplates": {
            "intended": PROMPT_INTENDED.name,
            "rendered": PROMPT_RENDERED.name,
            "judge": PROMPT_JUDGE.name
        },
        "stepLogging": True
    }
    _write_json(out_dir / "meta.json", meta)

    return {"recordId": record_id, "outDir": str(out_dir), "overall": judge_obj.get("overall")}

def build_arg_parser():
    p = argparse.ArgumentParser(description="LLM-only single-record evaluation (no stub fallbacks).")
    p.add_argument("--record", required=True, help="Path to record JSON file")
    p.add_argument("--out-dir", required=True, help="Output directory for artifacts")
    p.add_argument("--ui-key", default="ui_description", help="Field containing UI description")
    p.add_argument("--mcp-mode", default="stub", choices=["stub","echo","http"], help="How to synthesize agent output")
    p.add_argument("--mcp-endpoint", help="Endpoint for MCP when mode=http (not implemented)")
    p.add_argument("--model", default=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "deployment"), help="Model/deployment label for metadata only")
    return p

def main(argv: Optional[list[str]] = None) -> int:
    ap = build_arg_parser()
    args = ap.parse_args(argv)
    summary = process_single_record(Path(args.record), Path(args.out_dir), ui_key=args.ui_key, mcp_mode=args.mcp_mode, mcp_endpoint=args.mcp_endpoint, model=args.model)
    print(json.dumps({"status": "ok", **summary}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
