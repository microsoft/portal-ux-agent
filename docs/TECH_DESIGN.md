# Two-Ports Design

- Purpose: Run MCP requests and UI rendering on separate ports while sharing in-memory state in a single Node.js process.
- Ports: `UI_PORT` (default 3000) serves `/ui/:sessionId` and `/api/compositions/:sessionId`; `MCP_PORT` (default 3001) exposes MCP-style HTTP endpoints (tools list/call, optional streaming).
- Shared Memory: Both servers import a common in-memory composition store module, so tool calls and UI reads operate on the same Map without external storage.
- Flow: Client calls MCP `POST /mcp/tools/call` → pipeline creates a composition and saves it → response includes `sessionId` and `viewUrl` → browser loads `/ui/:sessionId` to render.
- Streaming (optional): `GET /mcp/stream/:sessionId` uses SSE to emit progress events (intent started/completed, composition created, render ready).
- Config: Ports and CORS are set via env vars (`UI_PORT`, `MCP_PORT`, optional `CORS_ORIGIN`).
- Benefits: Clear separation of concerns, zero-setup shared state, fast iteration; can later swap shared Map for Redis if moving to multi-process or horizontal scale.

