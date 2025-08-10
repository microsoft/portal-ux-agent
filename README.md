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


