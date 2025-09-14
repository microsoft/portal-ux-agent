# Portal UX Agent - Setup Guide

## Prerequisites

1. **Install Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` and `npm --version`

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the demo to see the intent processing:**
   ```bash
   npm run demo
   ```

3. **Start the web server:**
```bash
npm run dev:web
```
- Visit: http://localhost:3000/ui/demo123
- API: http://localhost:3000/api/compositions/demo123

4. **Start the MCP server** (in another terminal):
```bash
npm run dev:mcp
```

Or run both in a single process (two ports, shared memory):
```bash
npm run dev:combined
```
UI on http://localhost:3000, MCP HTTP on http://localhost:3001.

## MCP Integration

The MCP server accepts JSON-RPC messages on stdin and responds on stdout:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_portal_ui",
    "arguments": {
      "message": "Create a dashboard with sales metrics"
    }
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\": true, \"sessionId\": \"abc123\", \"viewUrl\": \"http://localhost:3000/ui/abc123\"}"
      }
    ]
  }
}
```

## Templates Available

1. **dashboard-cards-grid** - Dashboard with KPI row and card grid
2. **portal-leftnav** - Enterprise portal with left navigation
3. **board-kanban** - Kanban board with columns and cards

## Components Available

- **kpi-card** - Metric cards with values and trends
- **chart** - Chart placeholders (extensible)
- **table** - Data tables
- **nav-item** - Navigation items
- **kanban-column** - Kanban board columns
- **kanban-card** - Individual task cards

## Example Messages

- "Create a dashboard with sales metrics and charts"
- "Build a kanban board for project management"
- "Make a portal with navigation for admin tools"
- "Show me KPIs for website performance"

## Architecture

```
User Message → Intent Processor → Template Matcher → Component Mapper → UI Renderer → HTML/CSS
```

## Development

- **TypeScript** for type safety
- **Modular architecture** with clear separation of concerns
- **Template-based UI generation** for consistency
- **Component mapping** for data-driven UIs
- **Simple MCP protocol** implementation

## Extending

1. **Add new templates** in `src/templates/template-loader.ts`
2. **Add new components** in `src/ui-component-library/component-mapper.ts`
3. **Improve intent processing** in `src/agent/intent-processor.ts`
4. **Add UI libraries** by extending the component registry
