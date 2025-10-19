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
import requests

# Default MCP tool call timeout (seconds). Can be overridden via env MCP_TOOL_TIMEOUT_SEC.
_DEFAULT_MCP_TIMEOUT = 30
try:  # Allow increasing (or lowering) via environment variable.
    _DEFAULT_MCP_TIMEOUT = int(os.environ.get("MCP_TOOL_TIMEOUT_SEC", "90"))  # raise previous 30s to 90s by default
except Exception:
    _DEFAULT_MCP_TIMEOUT = 90

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
    try:
        return datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    except Exception:
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

def _call_mcp_tool(description: str, endpoint: str) -> str:
    """
    Call MCP server via HTTP. Fail fast if unavailable.
    Exits with code 31 if MCP returns an error.
    """
    # Health check
    try:
        resp = requests.get(f"{endpoint}/mcp/health", timeout=3)
        if resp.status_code != 200:
            print(f"ERROR: MCP server at {endpoint} unhealthy: {resp.status_code}", file=sys.stderr)
            raise SystemExit(30)
    except requests.RequestException as e:
        print(f"ERROR: Cannot reach MCP server at {endpoint}: {e}", file=sys.stderr)
        raise SystemExit(30)
    
    # Call tool
    payload = {
        "name": "create_portal_ui",
        "arguments": {"message": description}
    }
    timeout_seconds = max(1, _DEFAULT_MCP_TIMEOUT)
    attempts = 2  # single retry on timeout or transient network error
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            resp = requests.post(f"{endpoint}/mcp/tools/call", json=payload, timeout=timeout_seconds)
            if resp.status_code != 200:
                print(f"ERROR: MCP tool call failed: {resp.status_code}", file=sys.stderr)
                raise SystemExit(32)
            try:
                result = resp.json()
            except Exception as e:  # JSON parse error
                print(f"ERROR: Cannot parse MCP response: {e}", file=sys.stderr)
                raise SystemExit(33)
            break
        except requests.Timeout as e:
            last_exc = e
            if attempt < attempts:
                print(f"WARNING: MCP tool call timed out after {timeout_seconds}s (attempt {attempt}/{attempts}), retrying...", file=sys.stderr)
                continue
            print(f"ERROR: MCP tool call timeout after {timeout_seconds}s (final attempt)", file=sys.stderr)
            raise SystemExit(32)
        except requests.RequestException as e:
            last_exc = e
            if attempt < attempts:
                print(f"WARNING: MCP tool call exception '{e}' (attempt {attempt}/{attempts}), retrying...", file=sys.stderr)
                continue
            print(f"ERROR: MCP tool call exception: {e}", file=sys.stderr)
            raise SystemExit(32)
    else:  # pragma: no cover - defensive, loop should exit via break/raise
        if last_exc:
            print(f"ERROR: MCP tool call failed: {last_exc}", file=sys.stderr)
            raise SystemExit(32)
    
    # Normalize payload
    normalized = _normalize_mcp_payload(result)
    if "error" in normalized:
        print(f"ERROR: MCP returned error: {normalized['error']}", file=sys.stderr)
        raise SystemExit(31)
    
    # Fallback warning
    if "root" in normalized and normalized["root"].get("type") == "Container" and not normalized["root"].get("children"):
        print("WARNING: MCP returned empty Container, may indicate incomplete processing.", file=sys.stderr)
    
    return json.dumps(normalized, indent=2)

def _normalize_mcp_payload(payload: dict) -> dict:
    """
    Normalize various MCP response shapes:
    - {content: [{text: json_str}]} -> parsed json
    - {content: [{text: plain_str}]} -> {root: {type: "Container"}}
    - {result: {...}} -> result
    - {...} -> passthrough
    """
    # Shape 1: {content: [{text: ...}]}
    if "content" in payload and isinstance(payload["content"], list):
        for item in payload["content"]:
            if isinstance(item, dict) and "text" in item:
                text = item["text"]
                try:
                    parsed = json.loads(text)
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    pass
                # Fallback for non-JSON text
                return {"root": {"type": "Container", "children": []}}
    
    # Shape 2: {result: ...}
    if "result" in payload:
        result = payload["result"]
        if isinstance(result, dict):
            return result
        if isinstance(result, str):
            try:
                parsed = json.loads(result)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass
    
    # Shape 3: Direct dict
    return payload

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

def process_single_record(record_path: Path, out_dir: Path, *, ui_key: str, mcp_endpoint: str, model: str) -> dict:
    # Env sanity
    _require_env("AZURE_OPENAI_ENDPOINT")
    out_dir.mkdir(parents=True, exist_ok=True)

    for p in (PROMPT_INTENDED, PROMPT_RENDERED, PROMPT_JUDGE):
        _ensure_prompt(p)

    step_log = []  # consolidated per-record log

    # STEP 1
    record = load_record(record_path)
    record_id = str(record.get("id") or record_path.stem)
    ui_description = extract_ui_description(record, ui_key=ui_key)
    step_log.append({"step":1,"name":"load_record","recordId":record_id,"uiDescriptionLength":len(ui_description),"recordKeys":list(record.keys())})

    # STEP 2
    agent_output = _call_mcp_tool(ui_description, endpoint=mcp_endpoint)
    step_log.append({"step":2,"name":"mcp_output","endpoint":mcp_endpoint,"agentOutputLength":len(agent_output)})

    intended_prompt = _read_prompt(PROMPT_INTENDED)
    rendered_prompt = _read_prompt(PROMPT_RENDERED)
    judge_prompt    = _read_prompt(PROMPT_JUDGE)

    # STEP 3
    intended_obj = llm_interpret_intended(ui_description, intended_prompt)
    step_log.append({"step":3,"name":"intended","keys":list(intended_obj.keys())})

    # STEP 4
    rendered_obj = llm_interpret_rendered(agent_output, rendered_prompt)
    step_log.append({"step":4,"name":"rendered","keys":list(rendered_obj.keys())})

    # STEP 5
    judge_obj = llm_judge(intended_obj, rendered_obj, judge_prompt, ui_description, agent_output)
    step_log.append({"step":5,"name":"judge","overall":judge_obj.get("overall"),"dimensions":list(judge_obj.get("dimensionScores", {}).keys())})

    # Existing artifact writes
    _write_json(out_dir / "record.json", record)
    _write_text(out_dir / "ui_description.txt", ui_description)
    _write_text(out_dir / "agent_output.txt", agent_output)
    _write_text(out_dir / "prompt_step3_intended.txt", intended_prompt)
    _write_json(out_dir / "intended_interpretation.json", intended_obj)
    _write_text(out_dir / "prompt_step4_rendered.txt", rendered_prompt)
    _write_json(out_dir / "rendered_interpretation.json", rendered_obj)
    _write_text(out_dir / "prompt_step5_judge.txt", judge_prompt)
    _write_json(out_dir / "step5_response.json", judge_obj)

    score_payload = {"recordId": record_id, "timestamp": _now_iso(), "model": model, **judge_obj}
    _write_json(out_dir / "score.json", score_payload)

    # Single consolidated log
    _write_json(out_dir / "record_steps.json", {
        "recordId": record_id,
        "model": model,
        "mcpEndpoint": mcp_endpoint,
        "steps": step_log
    })

    meta = {
        "recordId": record_id,
        "timestamp": _now_iso(),
        "model": model,
        "mcpEndpoint": mcp_endpoint,
        "uiKey": ui_key,
        "stepsCompleted": [1,2,3,4,5],
        "llmOnly": True,
        "promptTemplates": {
            "intended": PROMPT_INTENDED.name,
            "rendered": PROMPT_RENDERED.name,
            "judge": PROMPT_JUDGE.name
        },
        "consolidatedStepLog": "record_steps.json"
    }
    _write_json(out_dir / "meta.json", meta)

    return {"recordId": record_id, "outDir": str(out_dir), "overall": judge_obj.get("overall")}

def build_arg_parser():
    p = argparse.ArgumentParser(description="LLM-only single-record evaluation (HTTP MCP only).")
    p.add_argument("--record", required=True, help="Path to record JSON file")
    p.add_argument("--out-dir", required=True, help="Output directory for artifacts")
    p.add_argument("--ui-key", default="ui_description", help="Field containing UI description")
    p.add_argument("--mcp-endpoint", required=True, help="MCP server HTTP endpoint (e.g. http://localhost:3001)")
    p.add_argument("--model", default=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "deployment"), help="Model/deployment label for metadata only")
    return p

def main(argv: Optional[list[str]] = None) -> int:
    ap = build_arg_parser()
    args = ap.parse_args(argv)
    summary = process_single_record(Path(args.record), Path(args.out_dir), ui_key=args.ui_key, mcp_endpoint=args.mcp_endpoint, model=args.model)
    print(json.dumps({"status": "ok", **summary}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
