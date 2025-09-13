// Simple HTTP Server without external dependencies
import { createServer } from 'http';
import { parse } from 'url';
import { getComposition as storeGetComposition, setComposition as storeSetComposition } from './shared/composition-store.js';

interface UIComposition {
  sessionId: string;
  template: string;
  components: Array<{
    id: string;
    type: string;
    props: Record<string, any>;
    slot: string;
  }>;
  userMessage?: string;
}

class SimpleWebServer {
  private compositions = new Map<string, UIComposition>();
  private port: number;

  constructor(port = Number(process.env.UI_PORT) || 3000) {
    this.port = port;
    // Add some sample compositions for demo
    this.addSampleCompositions();
  }

  private addSampleCompositions() {
    const sampleComposition: UIComposition = {
      sessionId: 'demo123',
      template: 'dashboard-cards-grid',
      components: [
        {
          id: 'kpi1',
          type: 'kpi-card',
          props: { title: 'Total Sales', value: '$125,430', trend: 'up' },
          slot: 'kpiRow'
        },
        {
          id: 'kpi2',
          type: 'kpi-card',
          props: { title: 'Active Users', value: '2,847', trend: 'up' },
          slot: 'kpiRow'
        },
        {
          id: 'chart1',
          type: 'chart',
          props: { title: 'Revenue Trend', type: 'line' },
          slot: 'cardsGrid'
        }
      ],
      userMessage: 'Create a sales dashboard'
    };
    this.compositions.set('demo123', sampleComposition);
    // Also seed shared store so other servers can access the same state
    try {
      storeSetComposition({
        sessionId: sampleComposition.sessionId,
        template: sampleComposition.template,
        components: sampleComposition.components,
        userMessage: sampleComposition.userMessage,
        createdAt: Date.now(),
      });
    } catch {}
  }

  start() {
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url || '', true);
      const pathname = parsedUrl.pathname || '';

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Routes
      if (pathname.startsWith('/ui/')) {
        const sessionId = pathname.split('/ui/')[1];
        this.handleUIRequest(sessionId, res);
      } else if (pathname.startsWith('/api/compositions/')) {
        const sessionId = pathname.split('/api/compositions/')[1];
        this.handleAPIRequest(sessionId, res);
      } else if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'portal-ux-agent' }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(this.port, () => {
      console.log(`Simple Web Server running on http://localhost:${this.port}`);
      console.log(`Try: http://localhost:${this.port}/ui/demo123`);
    });
  }

  private handleUIRequest(sessionId: string, res: any) {
    const composition = this.compositions.get(sessionId) || (storeGetComposition(sessionId) as any);
    if (!composition) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Composition not found');
      return;
    }

    const html = this.renderComposition(composition);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  private handleAPIRequest(sessionId: string, res: any) {
    const composition = this.compositions.get(sessionId) || (storeGetComposition(sessionId) as any);
    if (!composition) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Composition not found' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(composition));
  }

  private renderComposition(composition: UIComposition): string {
    const templateHTML = this.getTemplateHTML(composition.template);
    const slotComponents: Record<string, string[]> = {};

    // Group components by slot
    composition.components.forEach(component => {
      if (!slotComponents[component.slot]) {
        slotComponents[component.slot] = [];
      }
      slotComponents[component.slot].push(this.renderComponent(component));
    });

    // Replace slots in template
    let finalHTML = templateHTML;
    for (const [slotName, components] of Object.entries(slotComponents)) {
      const slotPlaceholder = `<slot name="${slotName}"></slot>`;
      finalHTML = finalHTML.replace(slotPlaceholder, components.join(''));
    }

    return this.wrapInDocument(finalHTML, composition);
  }

  private getTemplateHTML(templateId: string): string {
    const templates: Record<string, string> = {
      'dashboard-cards-grid': `
        <div class="dashboard-container">
          <header class="dashboard-header">
            <h1>Dashboard</h1>
          </header>
          <section class="kpi-row">
            <slot name="kpiRow"></slot>
          </section>
          <main class="cards-grid">
            <slot name="cardsGrid"></slot>
          </main>
        </div>
      `,
      'portal-leftnav': `
        <div class="portal-container">
          <nav class="left-nav">
            <slot name="nav"></slot>
          </nav>
          <div class="main-content">
            <header class="top-header">
              <h1>Portal</h1>
            </header>
            <main class="content-area">
              <slot name="content"></slot>
            </main>
          </div>
        </div>
      `,
      'board-kanban': `
        <div class="kanban-board">
          <div class="board-toolbar">
            <h1>Kanban Board</h1>
          </div>
          <div class="board-columns">
            <slot name="columns"></slot>
          </div>
        </div>
      `
    };
    return templates[templateId] || '<div>Unknown template</div>';
  }

  private renderComponent(component: any): string {
    const { type, props } = component;

    switch (type) {
      case 'kpi-card':
        return `
          <div class="card kpi-card">
            <h3>${props.title || 'KPI'}</h3>
            <div class="value">${props.value || '0'}</div>
            <div class="trend trend-${props.trend || 'neutral'}">${props.trend || 'neutral'}</div>
          </div>
        `;
      case 'chart':
        return `
          <div class="card chart-card">
            <h3>${props.title || 'Chart'}</h3>
            <div class="chart-placeholder">
              <div style="height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
                📊 ${props.type || 'line'} chart would go here
              </div>
            </div>
          </div>
        `;
      case 'nav-item':
        return `
          <div class="nav-item">
            <a href="${props.href || '#'}">${props.icon || '📄'} ${props.label || 'Item'}</a>
          </div>
        `;
      default:
        return `<div class="card">Unknown component: ${type}</div>`;
    }
  }

  private wrapInDocument(content: string, composition: UIComposition): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Portal UI - ${composition.sessionId}</title>
        <style>
          body { 
            margin: 0; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f5f5f5;
          }
          .dashboard-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
          .dashboard-header { margin-bottom: 20px; }
          .dashboard-header h1 { margin: 0; color: #333; }
          .kpi-row { 
            display: flex; 
            gap: 20px; 
            margin-bottom: 20px; 
            flex-wrap: wrap;
          }
          .cards-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
          }
          .card { 
            background: white; 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            padding: 16px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .kpi-card { 
            min-width: 200px;
            text-align: center;
          }
          .kpi-card h3 { 
            margin: 0 0 8px 0; 
            font-size: 14px; 
            color: #666; 
            font-weight: normal;
          }
          .kpi-card .value { 
            font-size: 24px; 
            font-weight: bold; 
            color: #333; 
            margin-bottom: 4px;
          }
          .kpi-card .trend { font-size: 12px; }
          .trend-up { color: #22c55e; }
          .trend-down { color: #ef4444; }
          .trend-neutral { color: #6b7280; }
          .chart-placeholder { margin-top: 10px; }
          .portal-container { 
            display: flex; 
            height: 100vh; 
          }
          .left-nav { 
            width: 250px; 
            background: #fff; 
            border-right: 1px solid #ddd;
            padding: 20px; 
          }
          .main-content { 
            flex: 1; 
            display: flex; 
            flex-direction: column; 
          }
          .top-header { 
            padding: 20px; 
            border-bottom: 1px solid #ddd; 
            background: white;
          }
          .top-header h1 { margin: 0; }
          .content-area { 
            flex: 1; 
            padding: 20px; 
          }
          .nav-item { 
            padding: 8px 0; 
          }
          .nav-item a { 
            text-decoration: none; 
            color: #333; 
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .nav-item a:hover { 
            color: #2563eb; 
          }
          .kanban-board { 
            padding: 20px; 
          }
          .board-toolbar { 
            margin-bottom: 20px; 
          }
          .board-toolbar h1 { 
            margin: 0; 
          }
          .board-columns { 
            display: flex; 
            gap: 20px; 
          }
          
          /* Info banner */
          .info-banner {
            background: #dbeafe;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #1e40af;
          }
        </style>
      </head>
      <body>
        <div class="info-banner">
          🤖 Generated from: "${composition.userMessage || 'User request'}" | Session: ${composition.sessionId}
        </div>
        ${content}
      </body>
      </html>
    `;
  }
}

export function startSimpleWebServer(port?: number) {
  const server = new SimpleWebServer(port);
  server.start();
}

// Auto-start unless disabled (useful for combined starter)
if (process.env.START_SIMPLE_WEB_SERVER !== '0') {
  startSimpleWebServer();
}
