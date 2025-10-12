---
mode: agent
---
Run tests\test-mcp-call.ps1

# MCP Tool Call Test Prompt

Instructions:
- Run `tests\test-mcp-call.ps1`

Purpose:
- Executes the minimal MCP tool invocation script.
- Verifies that the MCP server (already running) can:
  1. Accept WebSocket connection (preferred) or fall back to HTTP.
  2. List tools.
  3. Invoke `create_portal_ui`.
  4. (Optionally) Fetch and preview generated `viewUrl`.

Expected:
- Exit code 0.
- JSON-RPC response printed.
- If `viewUrl` present, a 400-char preview shown.

Troubleshooting:
- If it fails early, ensure the container/server is running (e.g. via `tests/e2e-with-docker.ps1`).
- If schema errors appear, inspect `logs/intent-prompts.log` for malformed model output.
