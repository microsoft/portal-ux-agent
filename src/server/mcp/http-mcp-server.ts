// Minimal HTTP MCP-like server (same-process) to expose tools over HTTP
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { processUserIntent } from '../../ux-architect-agent/intent-processor.js';
import { renderUI } from '../../ui-builder-agent/ui-renderer';
import { DEFAULT_USER_ID } from '../../shared/config.js';
import { subscribeSession, emitSessionEvent } from '../../shared/event-bus.js';

function sendJson(res: ServerResponse, status: number, body: any) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export function startHttpMcpServer(port = Number(process.env.MCP_PORT) || 3001) {
  const uiPort = Number(process.env.UI_PORT) || 3000;

  const server = createServer(async (req, res) => {
    const { pathname } = parse(req.url || '', true);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && pathname === '/mcp/health') {
        return sendJson(res, 200, { status: 'ok', service: 'portal-ux-agent-mcp-http' });
      }

      if (req.method === 'GET' && pathname === '/mcp/tools') {
        return sendJson(res, 200, {
          tools: [
            {
              name: 'create_portal_ui',
              description: 'Create a portal UI based on user requirements',
              inputSchema: {
                type: 'object',
                properties: {
                  message: { type: 'string', description: 'User message describing the UI to create' },
                  userId: { type: 'string', description: 'Optional user id (defaults to "default")' }
                },
                required: ['message'],
              },
            },
          ],
        });
      }

      if (req.method === 'POST' && pathname === '/mcp/tools/call') {
        const body = await parseBody(req);
        if (!body || typeof body !== 'object') {
          return sendJson(res, 400, { error: 'Invalid request body' });
        }

        const { name, arguments: args } = body as { name?: string; arguments?: any };
        if (name !== 'create_portal_ui') {
          return sendJson(res, 404, { error: `Unknown tool: ${name}` });
        }
        if (!args || typeof args.message !== 'string' || !args.message.trim()) {
          return sendJson(res, 400, { error: 'Missing arguments.message' });
        }

        try {
          const userId = (args.userId && String(args.userId).trim()) || DEFAULT_USER_ID;
          const intent = await processUserIntent(args.message);
          const composition = await renderUI(intent, userId);
          // Emit events for this session (after we know the sessionId)
          emitSessionEvent(composition.sessionId, 'intent:completed', {
            userGoal: intent.userGoal,
            template: intent.suggestedTemplate,
            components: intent.components,
          });
          emitSessionEvent(composition.sessionId, 'composition:created', {
            template: composition.template,
            components: composition.components?.length || 0,
          });
          emitSessionEvent(composition.sessionId, 'render:ready', {
            viewUrl: `http://localhost:${uiPort}/ui/${encodeURIComponent(userId)}`,
          });
          return sendJson(res, 200, {
            success: true,
            userId,
            sessionId: composition.sessionId,
            viewUrl: `http://localhost:${uiPort}/ui/${encodeURIComponent(userId)}`,
            composition,
          });
        } catch (e: any) {
          return sendJson(res, 500, { success: false, error: e?.message || 'Unknown error' });
        }
      }

      // SSE stream of events for a session
      if (req.method === 'GET' && pathname?.startsWith('/mcp/stream/')) {
        const sessionId = pathname.split('/mcp/stream/')[1];
        if (!sessionId) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: 'Missing sessionId' }));
          return;
        }
        // Headers for SSE
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        // Initial comment to open stream
        res.write(`: connected to session ${sessionId}\n\n`);
        // Keepalive ping
        const ping = setInterval(() => {
          try {
            res.write(`event: ping\n`);
            res.write(`data: {"ts":${Date.now()}}\n\n`);
          } catch {
            // ignore
          }
        }, 15000);

        // Subscribe to session events
        const unsubscribe = subscribeSession(sessionId, (evt) => {
          try {
            res.write(`event: ${evt.type}\n`);
            res.write(`data: ${JSON.stringify(evt)}\n\n`);
          } catch {
            // client likely disconnected
          }
        });

        // Cleanup on close
        req.on('close', () => {
          clearInterval(ping);
          unsubscribe();
        });
        return; // keep connection open
      }

      return sendJson(res, 404, { error: 'Not Found' });
    } catch (e: any) {
      return sendJson(res, 500, { error: e?.message || 'Internal Server Error' });
    }
  });

  server.listen(port, () => {
    console.log(`HTTP MCP server running on http://localhost:${port}`);
  });
}

// Auto-start unless disabled (useful for combined starter)
if (process.env.START_HTTP_MCP_SERVER !== '0') {
  startHttpMcpServer();
}
