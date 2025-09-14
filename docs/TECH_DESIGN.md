# Two-Ports Design

- Purpose: Run MCP requests and UI rendering on separate ports while sharing in-memory state in a single Node.js process.
- Ports: `UI_PORT` (default 3000) serves `/ui/:userId` and `/api/compositions/:userId`; `MCP_PORT` (default 3001) exposes MCP-style HTTP endpoints (tools list/call, optional streaming).
- Shared Memory: Both servers now keep the latest composition per user (`Map<userId, composition>`). The previous sessionId-keyed store was removed for simplicity.
- Flow: Client calls MCP `POST /mcp/tools/call` (optionally with `userId`) → pipeline creates/overwrites the latest composition for that userId → response includes `userId`, `sessionId` (internal), and `viewUrl` → browser loads `/ui/:userId` to render.
- Streaming (optional): `GET /mcp/stream/:sessionId` uses SSE to emit progress events; sessionId remains an internal correlation id distinct from userId (future work could add `/mcp/stream/user/:userId`).
- Config: Ports and CORS are set via env vars (`UI_PORT`, `MCP_PORT`, optional `CORS_ORIGIN`).
- Benefits: Clear separation of concerns, zero-setup shared state, fast iteration; can later swap shared Map for Redis if moving to multi-process or horizontal scale.

# User vs Session

- userId: external stable key used in URLs (`/ui/<userId>`)
- sessionId: transient internal id for an individual render cycle (used for SSE stream path and logging)
- Latest-write-wins per userId; no historical versions retained.