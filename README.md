# Portal UX Agent

A TypeScript-based system that converts user messages into portal UIs via MCP (Model Context Protocol).

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the web server:
```bash
npm run dev:web
```

3. Start the MCP server (in another terminal):
```bash
npm run dev:mcp
```

Alternatively, start both (two ports, shared memory) in one process:
```bash
npm run dev:combined
```
UI on http://localhost:3000, MCP HTTP on http://localhost:3001.

## Docker

Build and run with Docker (exposes ports 3000 and 3001):

```bash
docker build -t portal-ux-agent:local .
docker run --rm -p 3000:3000 -p 3001:3001 \
  -e UI_PORT=3000 -e MCP_PORT=3001 portal-ux-agent:local
```

Or use Compose:

```bash
docker compose up --build
```

Test endpoints:
- MCP health: `curl http://localhost:3001/mcp/health`
- Create composition: `curl -s -X POST http://localhost:3001/mcp/tools/call -H "Content-Type: application/json" -d '{"name":"create_portal_ui","arguments":{"message":"Create a dashboard with KPIs"}}'`
- View UI: open the returned `viewUrl` or `http://localhost:3000/ui/<sessionId>`

## Architecture

- **MCP Server**: Handles incoming messages via Model Context Protocol
- **Web Server**: Serves rendered UIs and provides REST API
- **Intent Processor**: Converts user messages to UI specifications
- **Template System**: Provides layout templates (dashboard, portal, kanban)
- **Component System**: Maps data to UI components

## Usage

The MCP server accepts messages like:
- "Create a dashboard with sales charts"
- "Build a kanban board for project tasks"
- "Make a portal with navigation for admin tools"

The system will generate a composition and provide a URL to view the rendered UI.

## Components

Current component types:
- KPI Cards
- Charts (placeholder)
- Tables
- Navigation items
- Kanban columns/cards

## Templates

Available templates:
- `dashboard-cards-grid`: Dashboard with KPI row and card grid
- `portal-leftnav`: Enterprise portal with left navigation
- `board-kanban`: Kanban board with drag-and-drop columns

## Testing Utilities

Helper scripts now live in `tests/`:

PowerShell quick tool call:
```powershell
pwsh tests/call-tool.ps1 -Message "dashboard with KPIs"
```

End-to-end validation (health, tools list, tool call, fetch UI HTML):
```powershell
pwsh tests/validate-docker.ps1 -Message "ui smoke"
```

Run against a Docker container (ensure it's running on ports 3000/3001).


