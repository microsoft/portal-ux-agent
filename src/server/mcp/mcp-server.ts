import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { processUserIntent } from '../../ux-architect-agent/intent-processor.js';
import { renderUI } from '../../rendering/ui-renderer.js';
import { DEFAULT_USER_ID } from '../../shared/config.js';

// Message schema for the portal UI tool
const PortalUIToolSchema = z.object({
  message: z.string().describe('User message describing the UI they want to create'),
  userId: z.string().optional().describe('Optional user id (defaults to "default")')
});

class PortalMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'portal-ux-agent',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_portal_ui',
          description: 'Create a portal UI based on user requirements',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'User message describing the UI they want to create'
              }
            },
            required: ['message']
          }
        }
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'create_portal_ui') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      // Validate input
      const args = PortalUIToolSchema.parse(request.params.arguments);
      
      try {
        // Process the message through the agent pipeline
  const userId = args.userId?.trim() || DEFAULT_USER_ID;
  const intent = await processUserIntent(args.message);
  const uiComposition = await renderUI(intent, userId);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                userId,
                sessionId: uiComposition.sessionId,
                viewUrl: `http://localhost:3000/ui/${userId}`,
                composition: uiComposition
              }, null, 2)
            }
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          ],
        };
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Portal UX Agent MCP Server started');
  }
}

// Start the server
const server = new PortalMCPServer();
server.start().catch(console.error);
