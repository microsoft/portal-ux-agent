// Simplified MCP Server without external dependencies
// This is a basic implementation for demonstration

interface MCPMessage {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

class SimpleMCPServer {
  private compositions = new Map<string, any>();

  constructor() {
    // Bind stdin/stdout for MCP communication
    if (typeof process !== 'undefined') {
      process.stdin.on('data', (data) => {
        try {
          const message: MCPMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse MCP message:', error);
        }
      });
    }
  }

  private handleMessage(message: MCPMessage) {
    let response: MCPResponse;

    try {
      if (message.method === 'tools/list') {
        response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
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
            ]
          }
        };
      } else if (message.method === 'tools/call') {
        const { name, arguments: args } = message.params;
        
        if (name === 'create_portal_ui') {
          const result = this.createPortalUI(args.message);
          response = {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            }
          };
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
      } else {
        throw new Error(`Unknown method: ${message.method}`);
      }
    } catch (error) {
      response = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }

    // Send response
    if (typeof process !== 'undefined') {
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  }

  private createPortalUI(message: string): any {
    // Simple intent processing
    const sessionId = this.generateId();
    let template = 'dashboard-cards-grid';
    let components = ['kpi-card', 'chart'];

    if (message.toLowerCase().includes('kanban') || message.toLowerCase().includes('board')) {
      template = 'board-kanban';
      components = ['kanban-column', 'kanban-card'];
    } else if (message.toLowerCase().includes('portal') || message.toLowerCase().includes('navigation')) {
      template = 'portal-leftnav';
      components = ['nav-item', 'content-area'];
    }

    const composition = {
      sessionId,
      template,
      components: components.map(comp => ({
        id: this.generateId(),
        type: comp,
        props: this.getDefaultProps(comp),
        slot: this.getDefaultSlot(comp, template)
      })),
      userMessage: message
    };

    this.compositions.set(sessionId, composition);

    return {
      success: true,
      sessionId,
      viewUrl: `http://localhost:3000/ui/${sessionId}`,
      composition
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private getDefaultProps(componentType: string): any {
    const defaults: Record<string, any> = {
      'kpi-card': { title: 'KPI Metric', value: '1,234', trend: 'up' },
      'chart': { title: 'Performance Chart', type: 'line', data: [] },
      'nav-item': { label: 'Dashboard', href: '/dashboard', icon: 'chart' },
      'kanban-column': { title: 'To Do', cards: [] },
      'kanban-card': { title: 'Sample Task', description: 'Task description', priority: 'medium' }
    };
    return defaults[componentType] || {};
  }

  private getDefaultSlot(componentType: string, template: string): string {
    const slotMappings: Record<string, Record<string, string>> = {
      'dashboard-cards-grid': {
        'kpi-card': 'kpiRow',
        'chart': 'cardsGrid',
        'table': 'cardsGrid'
      },
      'portal-leftnav': {
        'nav-item': 'nav',
        'content-area': 'content'
      },
      'board-kanban': {
        'kanban-column': 'columns',
        'kanban-card': 'cards'
      }
    };
    return slotMappings[template]?.[componentType] || 'default';
  }
}

// Start the server
if (typeof process !== 'undefined') {
  const server = new SimpleMCPServer();
  console.error('Simple MCP Server started - listening on stdin/stdout');
} else {
  console.log('This server requires Node.js to run');
}
