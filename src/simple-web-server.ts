// Simple HTTP Server without external dependencies
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse, fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { getCompositionByUser } from './ui-builder-agent/ui-renderer.js';
import { seedStaticCompositionIfNeeded } from './ui-builder-agent/static-seed.js';
import { renderReactUI } from './server/web/react-renderer.js';
import { DEFAULT_USER_ID } from './shared/config.js';
import { processUserIntent } from './ux-architect-agent/intent-processor.js';
import { renderUI } from './ui-builder-agent/ui-renderer.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const SAMPLE_REQUEST_DIRS = [
  resolve(moduleDir, 'data', 'sample-requests'),
  resolve(process.cwd(), 'src', 'data', 'sample-requests')
];

const STATIC_DIRS = [
  resolve(process.cwd(), 'public'),
  resolve(moduleDir, 'public')
];

function loadSampleRequest(filename: string): string {
  for (const dir of SAMPLE_REQUEST_DIRS) {
    const candidate = join(dir, filename);
    if (existsSync(candidate)) {
      return readFileSync(candidate, 'utf-8').trim();
    }
  }
  throw new Error('Sample request file not found: ' + filename);
}

const VALIDATION_SAMPLE_REQUEST = loadSampleRequest('docker-validation.txt');

class SimpleWebServer {
  private port: number;

  constructor(port = Number(process.env.UI_PORT) || 3000) {
    this.port = port;
    this.seedStaticComposition();
  }

  private seedStaticComposition() {
    seedStaticCompositionIfNeeded().catch(err => {
      console.warn('[seed.static] Skipping static composition:', err?.message || err);
    });
  }

  start() {
    const server = createServer((req, res) => {
      const parsedUrl = parse(req.url || '', true);
      const pathname = parsedUrl.pathname || '';

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200); res.end(); return;
      }

      if (pathname === '/playground' || pathname === '/playground/') {
        // Backward compatibility redirect to the remaining WebSocket playground
        res.writeHead(302, { 'Location': '/playground-ws' });
        res.end();
      } else if (pathname && this.tryServeStatic(pathname, res)) {
        // Static asset served
      } else if (pathname === '/playground-ws') {
        this.handlePlaygroundWs(res);
      } else if (pathname === '/playground-ws.js') {
        this.handlePlaygroundWsScript(res);
      } else if (pathname.startsWith('/ui/')) {
        const userId = pathname.split('/ui/')[1];
        this.handleUIRequest(userId, res);
      } else if (pathname.startsWith('/api/ui-html/')) {
        const userId = pathname.split('/api/ui-html/')[1];
        this.handleUIHtmlRequest(userId, res);
      } else if (pathname === '/api/chat' && req.method === 'POST') {
        this.handleChatRequest(req, res);
      } else if (pathname.startsWith('/api/compositions/')) {
        const userId = pathname.split('/api/compositions/')[1];
        this.handleAPIRequest(userId, res);
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
      console.log(`Try: http://localhost:${this.port}/ui/${DEFAULT_USER_ID}`);
    });
  }

  private tryServeStatic(pathname: string, res: any): boolean {
    if (!pathname.startsWith('/styles/') && !pathname.startsWith('/scripts/')) {
      return false;
    }

    const relativePath = pathname.replace(/^\//, '');
    for (const dir of STATIC_DIRS) {
      const candidate = join(dir, relativePath);
      if (existsSync(candidate)) {
        const ext = candidate.split('.').pop()?.toLowerCase();
        const contentType = ext === 'css' ? 'text/css' : ext === 'js' ? 'application/javascript' : 'application/octet-stream';
        try {
          const content = readFileSync(candidate);
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
          return true;
        } catch (err) {
          console.error('[static] Failed to read asset', candidate, err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Static asset error');
          return true;
        }
      }
    }

    return false;
  }

  private handleUIRequest(userId: string, res: any) {
    const composition = getCompositionByUser(userId);
    if (!composition) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Composition not found');
      return;
    }

    renderReactUI(composition)
      .then(html => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      })
      .catch(err => {
        console.error('[ui.render] Failed to render composition', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed to render UI');
      });
  }

  private handleAPIRequest(userId: string, res: any) {
    const composition = getCompositionByUser(userId);
    if (!composition) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Composition not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(composition));
  }

  private handleUIHtmlRequest(userId: string, res: ServerResponse) {
    const composition = getCompositionByUser(userId);
    if (!composition) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Composition not found');
      return;
    }

    renderReactUI(composition)
      .then(html => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      })
      .catch(err => {
        console.error('[ui-html] Failed to render composition', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed to render UI');
      });
  }

  private handleChatRequest(req: IncomingMessage, res: ServerResponse) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { userId = DEFAULT_USER_ID, message } = JSON.parse(body);
        
        if (!message || typeof message !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Message is required' }));
          return;
        }

        console.log(`[chat] Processing message for user "${userId}": ${message.slice(0, 100)}...`);

        // Process intent directly using the intent processor
        const intent = await processUserIntent(message);
        
        // Render UI and store composition
        const composition = await renderUI(intent, userId);
        
        console.log(`[chat] Generated UI for user "${userId}" with ${composition.components.length} components`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          userId,
          sessionId: composition.sessionId,
          template: composition.template,
          componentCount: composition.components.length,
          viewUrl: `/ui/${encodeURIComponent(userId)}`
        }));
      } catch (err: any) {
        console.error('[chat] Failed to process message:', err?.message || err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: err?.message || 'Failed to generate UI' 
        }));
      }
    });
    req.on('error', (err) => {
      console.error('[chat] Request error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Request error' }));
    });
  }

  private handlePlaygroundWs(res: any) {
    try {
      const html = this.getPlaygroundWsHtml();
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Playground WS failed');
    }
  }

  private handlePlaygroundWsScript(res: any) {
    try {
      const js = this.getPlaygroundWsScript();
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(js);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Playground WS script failed');
    }
  }

  private getPlaygroundWsHtml(): string {
    const mcpPort = Number(process.env.MCP_PORT) || 3001;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>MCP WS Playground</title><style>:root{color-scheme:dark light;font-family:system-ui}body{background:radial-gradient(circle at top,#1a2230,#0f141f);color:#fff;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:40px}.card{background:rgba(17,22,32,0.88);border:1px solid rgba(61,130,255,0.25);backdrop-filter:blur(14px);box-shadow:0 20px 60px rgba(0,0,0,0.45);border-radius:18px;padding:30px;width:min(960px,100%)}label{display:block;font-weight:600;margin:18px 0 6px}textarea,input{width:100%;box-sizing:border-box;background:#11151c;color:#f5f8ff;border:1px solid rgba(61,130,255,0.35);border-radius:8px;padding:12px;font:inherit;resize:vertical;box-shadow:inset 0 1px 4px rgba(0,0,0,0.45)}textarea{min-height:160px}input{height:42px}button{background:linear-gradient(135deg,#3d82ff,#7857ff);color:#fff;border:none;padding:12px 20px;border-radius:10px;font:600 15px system-ui;cursor:pointer;margin-top:16px;box-shadow:0 10px 30px rgba(61,130,255,0.35);transition:transform .2s ease,box-shadow .2s ease}button:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(61,130,255,0.45)}button:disabled{opacity:.45;cursor:default;transform:none;box-shadow:none}pre{background:#0d121c;border:1px solid rgba(61,130,255,0.35);padding:16px;border-radius:10px;overflow:auto;max-height:420px;font-size:13px;line-height:1.55;color:#b4c7ff}.row{display:flex;gap:18px;flex-wrap:wrap}.small{flex:1 1 200px}footer{margin-top:28px;font-size:12px;color:rgba(255,255,255,0.45)}.status{font-size:12px;color:rgba(255,255,255,0.55);margin-left:10px}</style></head><body><div class="card"><h1>MCP Tool Playground (WebSocket)</h1><form id="toolForm" method="post" novalidate><label>Message<textarea name="message" rows="18" placeholder="e.g. Dashboard with KPIs and revenue trend" required>${VALIDATION_SAMPLE_REQUEST}</textarea></label><div class="row"><div class="small"><label>User ID<input name="userId" value="default" /></label></div><div class="small"><label>WS Endpoint<input name="wsBaseUrl" value="ws://localhost:${mcpPort}" /></label></div></div><button type="submit" id="runBtn">Call create_portal_ui (WS)</button><span class="status" id="status"></span></form><h3>Response</h3><pre id="output">-</pre><h3>View URL</h3><div id="viewUrl" style="font:13px system-ui;"></div></div><footer>WebSocket subprotocol: mcp</footer><script src="/playground-ws.js"></script></body></html>`;
  }

  private getPlaygroundWsScript(): string {
    return `// WS Playground script\n` +
`(function(){\n`+
`const f=document.getElementById('toolForm');\n`+
`const out=document.getElementById('output');\n`+
`const statusEl=document.getElementById('status');\n`+
`const viewUrlEl=document.getElementById('viewUrl');\n`+
`const btn=document.getElementById('runBtn');\n`+
`f.addEventListener('submit',async e=>{\n`+
`  e.preventDefault(); out.textContent=''; viewUrlEl.textContent=''; statusEl.textContent='Connecting...'; btn.disabled=true;\n`+
`  try{\n`+
`    const fd=new FormData(f);\n`+
`    const wsBaseUrl=fd.get('wsBaseUrl');\n`+
`    const message=fd.get('message');\n`+
`    const userId=fd.get('userId')||'default';\n`+
`    const resp=await (async function callToolWs(){\n`+
`      return new Promise((resolve,reject)=>{\n`+
`        let nextId=1; const pending=new Map(); const ws=new WebSocket(wsBaseUrl,'mcp');\n`+
`        function send(method,params){ const id=nextId++; const msg={jsonrpc:'2.0',id,method,params}; ws.send(JSON.stringify(msg)); return new Promise((res,rej)=>{ const t=setTimeout(()=>{pending.delete(id);rej(new Error('Timeout '+method));},45000); pending.set(id,{res:(v)=>{clearTimeout(t);res(v)},rej:(e)=>{clearTimeout(t);rej(e)}}); }); }\n`+
`        ws.onopen=async()=>{ try{ await send('initialize',{protocolVersion:'2025-06-18',clientInfo:{name:'playground',version:'1.0.0'},capabilities:{tools:{}}}); ws.send(JSON.stringify({jsonrpc:'2.0',method:'initialized'})); const result=await send('tools/call',{name:'create_portal_ui',arguments:{message,userId}}); try{ const text=(Array.isArray(result?.content)&&result.content[0]?.text)||''; const parsed=text?JSON.parse(text):result; resolve(parsed);}catch(e){ resolve({success:false,error:'Bad WS response', raw:result}); } finally { ws.close(); } }catch(e){ reject(e); try{ws.close();}catch{} } };\n`+
`        ws.onmessage=(ev)=>{ try{ const msg=JSON.parse(ev.data); if(typeof msg.id!=='undefined'){ const rec=pending.get(msg.id); pending.delete(msg.id); if(rec){ if('result' in msg) rec.res(msg.result); else rec.rej(new Error(msg.error?.message||'WS error')); } } }catch{} };\n`+
`        ws.onerror=()=>{ reject(new Error('WebSocket error')); try{ws.close();}catch{} }; ws.onclose=()=>{};\n`+
`      });\n`+
`    })();\n`+
`    out.textContent=JSON.stringify(resp,null,2); statusEl.textContent='Done'; if(resp.viewUrl){ const safeUrl=resp.viewUrl.replace(/\"/g,'&quot;'); viewUrlEl.innerHTML='<a style=\\"color:#3d82ff\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"'+safeUrl+'\\">'+safeUrl+'</a>'; }\n`+
`  }catch(err){ statusEl.textContent='Error'; out.textContent=String(err); } finally { btn.disabled=false; }\n`+
`});\n`+
`})();\n`;
  }
}

export function startSimpleWebServer(port?: number) {
  const server = new SimpleWebServer(port);
  server.start();
}

if (process.env.START_SIMPLE_WEB_SERVER !== '0') {
  startSimpleWebServer();
}
