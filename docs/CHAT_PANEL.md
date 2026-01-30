# Chat Panel Feature

The Chat Panel is a right-side interactive UI that allows users to communicate with the UX Agent directly from any rendered portal page. Users can describe the UI they want in natural language, and the agent will generate and hot-render the components without requiring a full page reload.

## Features

- **Right-side collapsible panel** - 360px wide, toggleable via floating button
- **Direct intent processing** - Calls the LLM-powered intent processor directly
- **Hot render** - Updates UI in-place without full page reload
- **Real-time feedback** - Loading animation and status messages
- **Responsive design** - Full-width on mobile devices

## Architecture

### Files

| File | Description |
|------|-------------|
| `public/scripts/chat.js` | Client-side chat logic (send messages, hot render) |
| `public/styles/chat.css` | Chat panel styling and animations |
| `src/server/web/react-renderer.ts` | Injects chat panel HTML into rendered pages |
| `src/simple-web-server.ts` | Server endpoints for `/api/chat` and `/api/ui-html/:userId` |

### API Endpoints

#### `POST /api/chat`

Processes a chat message and generates a new UI composition.

**Request:**
```json
{
  "userId": "default",
  "message": "Show me a dashboard with sales KPIs and a revenue trend chart"
}
```

**Response (success):**
```json
{
  "success": true,
  "userId": "default",
  "sessionId": "uuid-here",
  "template": "dashboard-cards-grid",
  "componentCount": 5,
  "viewUrl": "/ui/default"
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Failed to generate UI"
}
```

#### `GET /api/ui-html/:userId`

Returns the rendered HTML for a user's composition (used for hot-reload).

**Response:** Full HTML document for the user's current composition.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser: /ui/default                                           │
│  ┌─────────────────────────────────┬──────────────────────────┐ │
│  │                                 │      Chat Panel          │ │
│  │    Main Dashboard Content       │  ┌──────────────────┐    │ │
│  │                                 │  │ 🤖 UX Agent Chat │    │ │
│  │    (KPIs, Charts, Tables)       │  ├──────────────────┤    │ │
│  │                                 │  │ User: "show      │    │ │
│  │                                 │  │  revenue chart"  │    │ │
│  │                                 │  │                  │    │ │
│  │                                 │  │ Bot: ✅ Updated! │    │ │
│  │                                 │  ├──────────────────┤    │ │
│  │                                 │  │ [____________]   │    │ │
│  │                                 │  │ [Send ➤]         │    │ │
│  └─────────────────────────────────┴──────────────────────────┘ │
│                                                           [💬]  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    POST /api/chat
                    { userId: "default", message: "show revenue chart" }
                                │
                                ▼
               ┌────────────────────────────────┐
               │   processUserIntent(message)   │
               │   (calls Azure OpenAI LLM)     │
               └────────────────────────────────┘
                                │
                                ▼
               ┌────────────────────────────────┐
               │   renderUI(intent, userId)     │
               │   (stores composition)         │
               └────────────────────────────────┘
                                │
                                ▼
                    { success: true, ... }
                                │
                                ▼
               ┌────────────────────────────────┐
               │   GET /api/ui-html/default     │
               │   (fetch new HTML)             │
               └────────────────────────────────┘
                                │
                                ▼
               ┌────────────────────────────────┐
               │   Hot-render: replace DOM      │
               │   content without full reload  │
               └────────────────────────────────┘
```

## Sequence Diagram

```
┌────────┐          ┌────────────┐          ┌─────────────────┐          ┌────────────┐
│ Client │          │ Web Server │          │ Intent Processor│          │ UI Renderer│
└───┬────┘          └─────┬──────┘          └────────┬────────┘          └─────┬──────┘
    │                     │                          │                         │
    │  POST /api/chat     │                          │                         │
    │  {userId, message}  │                          │                         │
    │────────────────────>│                          │                         │
    │                     │                          │                         │
    │                     │  processUserIntent(msg)  │                         │
    │                     │─────────────────────────>│                         │
    │                     │                          │                         │
    │                     │                          │  (LLM call to Azure)    │
    │                     │                          │─────────────────────────│
    │                     │                          │                         │
    │                     │        Intent            │                         │
    │                     │<─────────────────────────│                         │
    │                     │                          │                         │
    │                     │  renderUI(intent, userId)│                         │
    │                     │────────────────────────────────────────────────────>
    │                     │                          │                         │
    │                     │        Composition       │                         │
    │                     │<────────────────────────────────────────────────────
    │                     │                          │                         │
    │  {success: true}    │                          │                         │
    │<────────────────────│                          │                         │
    │                     │                          │                         │
    │  GET /api/ui-html/  │                          │                         │
    │────────────────────>│                          │                         │
    │                     │                          │                         │
    │  HTML response      │                          │                         │
    │<────────────────────│                          │                         │
    │                     │                          │                         │
    │  (hot render DOM)   │                          │                         │
    │                     │                          │                         │
```

## Usage

1. **Open any UI page**: Navigate to `http://localhost:3000/ui/default` (or any userId)

2. **Toggle chat panel**: Click the 💬 button in the bottom-right corner

3. **Send a message**: Type a description of the UI you want, e.g.:
   - "Show me a dashboard with revenue KPIs"
   - "Create a kanban board for project management"
   - "Display a table of recent orders with a pie chart"

4. **View results**: The UI will update automatically without page reload

## Configuration

The chat feature uses the same Azure OpenAI configuration as the main UX agent:

| Environment Variable | Description |
|---------------------|-------------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | API key for authentication |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name |
| `AZURE_OPENAI_API_VERSION` | API version (default: `2025-01-01-preview`) |

## Styling Customization

The chat panel styles are defined in `public/styles/chat.css`. Key CSS classes:

| Class | Description |
|-------|-------------|
| `#chat-panel` | Main panel container |
| `.chat-header` | Header with gradient background |
| `.chat-messages` | Scrollable messages container |
| `.chat-message-user` | User message bubble (blue) |
| `.chat-message-assistant` | Assistant message bubble (white) |
| `.chat-input` | Text input field |
| `.chat-send-btn` | Send button |
| `#chat-toggle-btn` | Floating toggle button |

## Error Handling

- **Network errors**: Displayed in chat as "❌ Network error: ..."
- **LLM failures**: Returns `{ success: false, error: "..." }` with error message
- **Hot render fallback**: If DOM replacement fails, falls back to full page reload
