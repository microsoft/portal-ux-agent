import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { toolsDescriptor, handleCreatePortalUi } from './core.js';

function send(res: ServerResponse, status: number, body: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve(undefined);
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

export function startUnifiedHttpMcp(port = Number(process.env.MCP_PORT) || 3001) {
  const server = createServer(async (req, res) => {
    const { pathname } = parse(req.url || '', true);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && pathname === '/mcp/health') {
        return send(res, 200, { status: 'ok', service: 'portal-ux-agent-mcp-http' });
      }

      if (req.method === 'GET' && pathname === '/mcp/tools') {
        return send(res, 200, { tools: toolsDescriptor });
      }

      if (req.method === 'POST' && pathname === '/mcp/tools/call') {
        const body = await readBody(req);
        if (!body || typeof body !== 'object') return send(res, 400, { error: 'Invalid body' });
        const { name, arguments: args } = body as { name?: string; arguments?: any };
        if (name !== 'create_portal_ui') return send(res, 404, { error: `Unknown tool: ${name}` });
        try {
          const result = await handleCreatePortalUi(args || {});
          return send(res, 200, result);
        } catch (e: any) {
          return send(res, 400, { success: false, error: e?.message || 'Bad request' });
        }
      }

      return send(res, 404, { error: 'Not Found' });
    } catch (e: any) {
      return send(res, 500, { error: e?.message || 'Internal Server Error' });
    }
  });

  server.listen(port, () => {
    console.log(`Unified HTTP MCP server running on http://localhost:${port}`);
  });
}

if (process.env.START_UNIFIED_HTTP_MCP !== '0') {
  startUnifiedHttpMcp();
}
