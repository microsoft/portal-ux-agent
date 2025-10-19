#!/usr/bin/env python
"""
Azure OpenAI (AOAI) chat client utility for evaluation workflows.

Mirrors logic in src/ux-architect-agent/llm-intent.ts (TypeScript):
 - Supports API key or AAD (DefaultAzureCredential) auth
 - Structured log events (prompt, request, response, parsed, error)
 - Enforces JSON-only response via response_format={"type":"json_object"}
 - Simple exponential backoff retries for transient failures (429, 5xx)
 - Returns parsed JSON from first choice's message.content

Usage (library):
    from tool_aoai import aoai_chat
    result = aoai_chat(messages=[{"role":"system","content":"You are test."},{"role":"user","content":"Hello"}])

CLI:
    python eval/pipeline/tool_aoai.py --message "Build a KPI dashboard with active users and revenue"

Environment variables:
    AZURE_OPENAI_ENDPOINT          (required unless mocked)
    AZURE_OPENAI_API_KEY           (required if not using AAD)
    AZURE_OPENAI_DEPLOYMENT        (default: gpt-5-mini)
    AZURE_OPENAI_API_VERSION       (default: 2025-01-01-preview)
    AZURE_OPENAI_USE_AAD           (set to 1 to use AAD instead of API key)
    AZURE_OPENAI_SCOPE             (default: https://cognitiveservices.azure.com/.default)
    AOAI_TIMEOUT_MS                (default: 30000)
    AOAI_RETRIES                   (default: 3)
    AOAI_RETRY_BASE_MS             (default: 500)
    AOAI_LOG_PROMPT                (default: 1 -> enable logging)
    AOAI_PROMPT_LOG_PATH           (default: logs/aoai-prompts.log)

Return: Parsed JSON from model's first choice content.
Raises: RuntimeError / AOAIError on failure.
"""
from __future__ import annotations
import os
import sys
import json
import time
import uuid
import typing as t
from pathlib import Path
import datetime

try:
    from azure.identity import DefaultAzureCredential  # type: ignore
    _HAS_AAD = True
except Exception:  # pragma: no cover
    DefaultAzureCredential = object  # type: ignore
    _HAS_AAD = False

# ---------------------
# Configuration helpers
# ---------------------

def _env(key: str, default: str | None = None) -> str | None:
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip()

AZURE_OPENAI_ENDPOINT      = _env("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY       = _env("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_DEPLOYMENT    = _env("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini")
AZURE_OPENAI_API_VERSION   = _env("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
AZURE_OPENAI_USE_AAD       = _env("AZURE_OPENAI_USE_AAD", "0") == "1"
AZURE_OPENAI_SCOPE         = _env("AZURE_OPENAI_SCOPE", "https://cognitiveservices.azure.com/.default")

AOAI_TIMEOUT_MS            = int(_env("AOAI_TIMEOUT_MS", "30000"))
AOAI_RETRIES               = int(_env("AOAI_RETRIES", "3"))
AOAI_RETRY_BASE_MS         = int(_env("AOAI_RETRY_BASE_MS", "500"))
AOAI_LOG_PROMPT            = _env("AOAI_LOG_PROMPT", "1") != "0"
AOAI_PROMPT_LOG_PATH       = _env("AOAI_PROMPT_LOG_PATH", "logs/aoai-prompts.log")

# ---------------------
# Logging
# ---------------------

def _now_iso() -> str:
    """Timezone-aware ISO8601 timestamp with microseconds and Z."""
    try:
        return datetime.datetime.now(datetime.UTC).isoformat(timespec="microseconds")
    except Exception:
        # Fallback for older Python where datetime.UTC may not exist
        return datetime.datetime.utcnow().isoformat() + "Z"


def _append_log(record: dict) -> None:
    if not AOAI_LOG_PROMPT:
        return
    try:
        path = Path(AOAI_PROMPT_LOG_PATH)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as e:  # pragma: no cover
        print(f"[aoai.log] failed: {e}", file=sys.stderr)

def _redact_headers(headers: dict[str,str]) -> dict[str,str]:
    sensitive = {"authorization","api-key"}
    return {k: ("***redacted***" if k.lower() in sensitive else v) for k,v in headers.items()}

# ---------------------
# Authentication
# ---------------------

_cached_token: dict[str,t.Any] | None = None
_credential: DefaultAzureCredential | None = None  # type: ignore

def _get_aad_token(scope: str) -> str:
    global _credential, _cached_token
    if not _HAS_AAD:
        raise RuntimeError("azure-identity not installed; cannot use AAD (pip install azure-identity)")
    if _credential is None:
        _credential = DefaultAzureCredential()
    now = time.time()
    if _cached_token and (_cached_token["expires"] - 60) > now:
        return _cached_token["token"]
    token = _credential.get_token(scope)
    if not token or not getattr(token, "token", None):
        raise RuntimeError("Failed to acquire AAD token for Azure OpenAI")
    _cached_token = {
        "token": token.token,
        "expires": getattr(token, "expires_on", now + 300)
    }
    return _cached_token["token"]  # type: ignore

def _build_headers() -> dict[str,str]:
    headers: dict[str,str] = {"Content-Type":"application/json"}
    if AZURE_OPENAI_USE_AAD:
        token = _get_aad_token(AZURE_OPENAI_SCOPE)
        headers["Authorization"] = f"Bearer {token}"
    else:
        if not AZURE_OPENAI_API_KEY:
            raise RuntimeError("AZURE_OPENAI_API_KEY not set (and AAD not enabled)")
        headers["api-key"] = AZURE_OPENAI_API_KEY
    return headers

# ---------------------
# Core request
# ---------------------

def _build_url() -> str:
    if not AZURE_OPENAI_ENDPOINT:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT not configured")
    endpoint = AZURE_OPENAI_ENDPOINT.rstrip("/")
    return f"{endpoint}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"

TransientStatusCodes = {429, 500, 502, 503, 504}

class AOAIError(RuntimeError):
    pass

def aoai_chat(
    messages: list[dict[str,str]],
    *,
    response_format: str = "json_object",
    correlation_id: str | None = None,
    timeout_ms: int | None = None,
    max_retries: int | None = None,
    retry_base_ms: int | None = None
) -> t.Any:
    """Perform a chat completion and return parsed JSON from the message content.

    :param messages: OpenAI-style chat messages
    :param response_format: only 'json_object' tested here
    :param correlation_id: optional; autogenerated if None
    :param timeout_ms: override global AOAI_TIMEOUT_MS
    :param max_retries: override global AOAI_RETRIES
    :param retry_base_ms: override global AOAI_RETRY_BASE_MS
    """
    corr = correlation_id or uuid.uuid4().hex[:8]
    tmo = timeout_ms or AOAI_TIMEOUT_MS
    retries = max_retries if max_retries is not None else AOAI_RETRIES
    backoff_base = retry_base_ms if retry_base_ms is not None else AOAI_RETRY_BASE_MS

    url = _build_url()
    body = {
        "messages": messages,
        "response_format": {"type": response_format}
    }
    request_body_json = json.dumps(body, ensure_ascii=False)

    _append_log({
        "kind": "prompt",
        "timestamp": _now_iso(),
        "correlationId": corr,
        "messages": messages
    })

    attempt = 0
    while True:
        attempt += 1
        started = time.time()
        try:
            headers = _build_headers()
            _append_log({
                "kind": "request",
                "timestamp": _now_iso(),
                "correlationId": corr,
                "url": url,
                "method": "POST",
                "headers": _redact_headers(headers),
                "body": request_body_json,
                "attempt": attempt
            })

            import urllib.request
            req = urllib.request.Request(url, data=request_body_json.encode("utf-8"), headers=headers, method="POST")
            # socket-level timeout
            with urllib.request.urlopen(req, timeout=tmo / 1000.0) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                status = resp.status
            elapsed = int((time.time() - started) * 1000)

            _append_log({
                "kind": "response",
                "timestamp": _now_iso(),
                "correlationId": corr,
                "status": status,
                "ok": 200 <= status < 300,
                "elapsedMs": elapsed,
                "body": raw,
                "attempt": attempt
            })

            if not (200 <= status < 300):
                if status in TransientStatusCodes and attempt <= retries:
                    delay = backoff_base * (2 ** (attempt - 1))
                    time.sleep(delay / 1000.0)
                    continue
                raise AOAIError(f"Azure OpenAI error {status}: {raw[:500]}")

            try:
                data = json.loads(raw) if raw else {}
            except Exception as e:  # pragma: no cover
                raise AOAIError(f"Failed to parse response JSON: {e}")

            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content")
            )
            if not content:
                raise AOAIError("Missing content in AOAI response")
            try:
                parsed = json.loads(content)
            except Exception as e:
                raise AOAIError(f"Model content not valid JSON: {e}; raw content snippet={content[:120]}")

            _append_log({
                "kind": "parsed",
                "timestamp": _now_iso(),
                "correlationId": corr,
                "parsed": parsed
            })
            return parsed

        except Exception as e:  # pragma: no cover (network variability)
            msg = str(e)
            transient = False
            if isinstance(e, AOAIError):
                if any(code in msg for code in ["429", "500", "502", "503", "504"]):
                    transient = True
            if any(tok in msg.lower() for tok in ["timeout","temporarily","connection reset"]):
                transient = True
            _append_log({
                "kind": "error",
                "timestamp": _now_iso(),
                "correlationId": corr,
                "error": msg,
                "attempt": attempt,
                "transient": transient
            })
            if transient and attempt <= retries:
                delay = backoff_base * (2 ** (attempt - 1))
                time.sleep(delay / 1000.0)
                continue
            raise

INTENT_SYSTEM_PROMPT = """You are an intent-to-UI planner for a Portal UI generator.\nReturn ONLY one compact JSON object (no prose, no markdown) that the renderer can use directly.\n\nSchema:\n{\n  \"template\": string,\n  \"styles\"?: string[],\n  \"scripts\"?: string[],\n  \"components\": [\n    {\n      \"id\"?: string,\n      \"type\": string,\n      \"slot\": string,\n      \"library\"?: \"shadcn\",\n      \"props\": object\n    }\n  ]\n}\n\nGuidelines:\n- Populate required slots implied by the user message.\n- Provide non-empty arrays where appropriate.\n- Keep JSON minimal, strictly valid. No comments.\n"""

def generate_intent(message: str) -> t.Any:
    messages = [
        {"role": "system", "content": INTENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"User message: {message}"}
    ]
    return aoai_chat(messages)

# ---------------------
# CLI
# ---------------------

def _cli():  # pragma: no cover
    import argparse
    ap = argparse.ArgumentParser(description="Call Azure OpenAI chat (JSON-only) via AOAI tool.")
    ap.add_argument("--message", help="User prompt (if provided, uses high-level intent mode).")
    ap.add_argument("--raw", action="store_true", help="If set, expect raw JSON array of messages via stdin instead of --message.")
    ap.add_argument("--print", action="store_true", help="Print parsed JSON result.")
    args = ap.parse_args()
    try:
        if args.raw:
            stdin_txt = sys.stdin.read()
            msgs = json.loads(stdin_txt)
            if not isinstance(msgs, list):
                raise ValueError("Raw mode expects a JSON array of messages.")
            parsed = aoai_chat(msgs)
        else:
            if not args.message:
                ap.error("Either --message or --raw (with stdin) must be provided.")
            parsed = generate_intent(args.message)
        if args.print:
            print(json.dumps(parsed, indent=2, ensure_ascii=False))
        else:
            print(json.dumps({"status":"ok"}, ensure_ascii=False))
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(json.dumps({"status":"error","error":str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":  # pragma: no cover
    _cli()
