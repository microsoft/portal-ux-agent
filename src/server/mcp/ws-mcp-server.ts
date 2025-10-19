import WebSocket, { WebSocketServer } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { WsServerTransport } from './ws-transport.js';
import { toolsDescriptor, handleCreatePortalUi } from './core.js';

export function startWsMcpServer(port = Number(process.env.MCP_PORT) || 3001) {
  const wss = new WebSocketServer({
    port,
    handleProtocols: (protocols) => {
      // Prefer the standard MCP subprotocol when offered
      if (protocols.has('mcp')) return 'mcp';
      // Otherwise accept the first offered protocol or none
      const first = protocols.values().next().value;
      return first || false;
    },
  });

  wss.on('connection', async (ws: WebSocket) => {
    const server = new Server({ name: 'portal-ux-agent', version: '1.0.0' }, { capabilities: { tools: {} } });

    // ListTools
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolsDescriptor }));

    // CallTool
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'create_portal_ui') {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }
      try {
        const result = await handleCreatePortalUi((request.params.arguments as any) || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (e: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: e?.message || 'Unknown error' }),
            },
          ],
        };
      }
    });

    const transport = new WsServerTransport(ws);
    await server.connect(transport);
  });

  console.log(`MCP WebSocket server listening on ws://localhost:${port}`);
}

if (process.env.START_WS_MCP_SERVER !== '0') {
  startWsMcpServer();
}
