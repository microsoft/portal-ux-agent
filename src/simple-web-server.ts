// Simple HTTP Server without external dependencies
import { createServer } from 'http';
import { parse } from 'url';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getCompositionByUser, renderUI } from './ui-builder-agent/ui-renderer.js';
import { processUserIntent } from './ux-architect-agent/intent-processor.js';
import { DEFAULT_USER_ID } from './shared/config.js';

interface SimpleRenderableComposition {
  sessionId: string;
  template: string;
  components: Array<{ id: string; type: string; props: Record<string, any>; slot: string; }>;
  userMessage?: string;
}

class SimpleWebServer {
  private port: number;

  constructor(port = Number(process.env.UI_PORT) || 3000) {
    this.port = port;
    this.addSampleCompositions();
  }

  private async addSampleCompositions() {
    // Seed a default composition only if none exists yet
    if (!getCompositionByUser(DEFAULT_USER_ID)) {
      const intent = await processUserIntent('sample dashboard with kpis');
      await renderUI(intent, DEFAULT_USER_ID);
    }
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

      if (pathname === '/playground') {
        this.handlePlayground(res);
      } else if (pathname === '/playground.js') {
        this.handlePlaygroundScript(res);
      } else if (pathname === '/playground-ws') {
        this.handlePlaygroundWs(res);
      } else if (pathname === '/playground-ws.js') {
        this.handlePlaygroundWsScript(res);
      } else if (pathname.startsWith('/ui/')) {
        const userId = pathname.split('/ui/')[1];
        this.handleUIRequest(userId, res);
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

  private handleUIRequest(userId: string, res: any) {
    const composition = getCompositionByUser(userId) as any as SimpleRenderableComposition | undefined;
    if (!composition) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Composition not found');
      return;
    }
    const html = this.renderComposition(composition);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  private handleAPIRequest(userId: string, res: any) {
  const composition = getCompositionByUser(userId) as any as SimpleRenderableComposition | undefined;
    if (!composition) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Composition not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(composition));
  }

  private handlePlayground(res: any) {
    try {
      const html = this.getPlaygroundHtml();
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Playground failed');
    }
  }

  private handlePlaygroundScript(res: any) {
    try {
      const js = this.getPlaygroundScript();
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(js);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Playground script failed');
    }
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

  private getPlaygroundHtml(): string {
  const mcpPort = Number(process.env.MCP_PORT) || 3001;
  return `<!DOCTYPE html><html lang="en"><meta charset="utf-8" />
<title>MCP Playground</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>:root{--bg:#0f1115;--panel:#1b1f27;--border:#2a303a;--accent:#3d82ff;--text:#e6e8ef;--muted:#9aa1af}body{margin:0;font:14px/1.4 system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);padding:32px}h1{margin-top:0;font-size:20px}.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px;max-width:880px}label{display:block;font-weight:600;margin:18px 0 6px}textarea,input{width:100%;box-sizing:border-box;background:#11151c;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:10px;font:inherit;resize:vertical}input{height:40px}button{background:var(--accent);color:#fff;border:none;padding:10px 18px;border-radius:6px;font:600 14px system-ui;cursor:pointer;margin-top:14px}button:disabled{opacity:.5;cursor:default}pre{background:#11151c;border:1px solid var(--border);padding:14px;border-radius:8px;overflow:auto;max-height:420px}.row{display:flex;gap:16px;flex-wrap:wrap}.small{flex:1 1 180px}footer{margin-top:32px;font-size:12px;color:var(--muted)}.status{font-size:12px;color:var(--muted);margin-left:10px}</style>
<div class="card"><h1>MCP Tool Playground</h1><form id="toolForm" method="post" novalidate><label>Message<textarea name="message" rows="3" placeholder="e.g. Dashboard with KPIs and revenue trend" required>dashboard with kpis</textarea></label><div class="row"><div class="small"><label>User ID<input name="userId" value="default" /></label></div><div class="small"><label>Endpoint (Base URL)<input name="baseUrl" value="http://localhost:${mcpPort}" /></label></div></div><button type="submit" id="runBtn">Call create_portal_ui</button><span class="status" id="status"></span></form><h3>Response</h3><pre id="output">—</pre><h3>View URL</h3><div id="viewUrl" style="font:13px system-ui;"></div></div><footer>POST name=create_portal_ui → /mcp/tools/call</footer>
<script src="/playground.js"></script></html>`;
  }

  private getPlaygroundWsHtml(): string {
    const mcpPort = Number(process.env.MCP_PORT) || 3001;
    return `<!DOCTYPE html><html lang="en"><meta charset="utf-8" />
<title>MCP WS Playground</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>:root{--bg:#0f1115;--panel:#1b1f27;--border:#2a303a;--accent:#3d82ff;--text:#e6e8ef;--muted:#9aa1af}body{margin:0;font:14px/1.4 system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);padding:32px}h1{margin-top:0;font-size:20px}.card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px;max-width:880px}label{display:block;font-weight:600;margin:18px 0 6px}textarea,input{width:100%;box-sizing:border-box;background:#11151c;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:10px;font:inherit;resize:vertical}input{height:40px}button{background:var(--accent);color:#fff;border:none;padding:10px 18px;border-radius:6px;font:600 14px system-ui;cursor:pointer;margin-top:14px}button:disabled{opacity:.5;cursor:default}pre{background:#11151c;border:1px solid var(--border);padding:14px;border-radius:8px;overflow:auto;max-height:420px}.row{display:flex;gap:16px;flex-wrap:wrap}.small{flex:1 1 180px}footer{margin-top:32px;font-size:12px;color:var(--muted)}.status{font-size:12px;color:var(--muted);margin-left:10px}</style>
<div class="card"><h1>MCP Tool Playground (WebSocket)</h1><form id="toolForm" method="post" novalidate><label>Message<textarea name="message" rows="3" placeholder="e.g. Dashboard with KPIs and revenue trend" required>dashboard with kpis</textarea></label><div class="row"><div class="small"><label>User ID<input name="userId" value="default" /></label></div><div class="small"><label>WS Endpoint<input name="wsBaseUrl" value="ws://localhost:${mcpPort}" /></label></div></div><button type="submit" id="runBtn">Call create_portal_ui (WS)</button><span class="status" id="status"></span></form><h3>Response</h3><pre id="output">-</pre><h3>View URL</h3><div id="viewUrl" style="font:13px system-ui;"></div></div><footer>WebSocket subprotocol: mcp</footer>
<script src="/playground-ws.js"></script></html>`;
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
`        function send(method,params){ const id=nextId++; const msg={jsonrpc:'2.0',id,method,params}; ws.send(JSON.stringify(msg)); return new Promise((res,rej)=>{ const t=setTimeout(()=>{pending.delete(id);rej(new Error('Timeout '+method));},15000); pending.set(id,{res:(v)=>{clearTimeout(t);res(v)},rej:(e)=>{clearTimeout(t);rej(e)}}); }); }\n`+
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

  private getPlaygroundScript(): string {
    return `// External playground script\n` +
`(function(){\n`+
`const f=document.getElementById('toolForm');\n`+
`const out=document.getElementById('output');\n`+
`const statusEl=document.getElementById('status');\n`+
`const viewUrlEl=document.getElementById('viewUrl');\n`+
`const btn=document.getElementById('runBtn');\n`+
`async function callTool(baseUrl,message,userId){\n`+
`  const body={name:'create_portal_ui',arguments:{message,userId}};\n`+
`  const url=baseUrl.replace(/\\/$/,'')+'/mcp/tools/call';\n`+
`  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});\n`+
`  const raw=await res.text();\n`+
`  let parsed;try{parsed=raw?JSON.parse(raw):{error:'Empty response', raw:''};}catch(e){parsed={error:'Non-JSON response', raw};}\n`+
`  if(!res.ok){return { success:false, status:res.status, ...parsed };}\n`+
`  return parsed;\n`+
`}\n`+
`f.addEventListener('submit',async e=>{\n`+
`  e.preventDefault();\n`+
`  out.textContent='';\n`+
`  viewUrlEl.textContent='';\n`+
`  statusEl.textContent='Calling…';\n`+
`  btn.disabled=true;\n`+
`  try {\n`+
`    const fd=new FormData(f);\n`+
`    const baseUrl=fd.get('baseUrl');\n`+
`    const message=fd.get('message');\n`+
`    const userId=fd.get('userId')||'default';\n`+
`    const start=performance.now();\n`+
`    const resp=await callTool(baseUrl,message,userId);\n`+
`    const ms=Math.round(performance.now()-start);\n`+
`    statusEl.textContent='Done in '+ms+' ms';\n`+
`    out.textContent=JSON.stringify(resp,null,2);\n`+
`    if(resp.viewUrl){\n`+
`      const safeUrl=resp.viewUrl.replace(/"/g,'&quot;');\n`+
`      viewUrlEl.innerHTML='<a style=\\"color:#3d82ff\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\"'+safeUrl+'\\">'+safeUrl+'</a>';\n`+
`    }\n`+
`  } catch(err){\n`+
`    statusEl.textContent='Error';\n`+
`    out.textContent=String(err);\n`+
`  } finally {\n`+
`    btn.disabled=false;\n`+
`  }\n`+
`});\n`+
`})();\n`;
  }

  private renderComposition(composition: SimpleRenderableComposition): string {
    const templateHTML = this.getTemplateHTML(composition.template);
    const slotComponents: Record<string, string[]> = {};
  composition.components.forEach((component: { id: string; type: string; props: Record<string, any>; slot: string; }) => {
      if (!slotComponents[component.slot]) slotComponents[component.slot] = [];
      slotComponents[component.slot].push(this.renderComponent(component));
    });
    let finalHTML = templateHTML;
    for (const [slotName, components] of Object.entries(slotComponents)) {
      finalHTML = finalHTML.replace(`<slot name="${slotName}"></slot>`, components.join(''));
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

  private wrapInDocument(content: string, composition: SimpleRenderableComposition): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Portal UI - ${composition.sessionId}</title>
        <style>
          body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
          .dashboard-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
          .dashboard-header { margin-bottom: 20px; }
          .dashboard-header h1 { margin: 0; color: #333; }
          .kpi-row { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
          .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
          .card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .kpi-card { min-width: 200px; text-align: center; }
          .kpi-card h3 { margin: 0 0 8px 0; font-size: 14px; color: #666; font-weight: normal; }
          .kpi-card .value { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 4px; }
          .kpi-card .trend { font-size: 12px; }
          .trend-up { color: #22c55e; }
          .trend-down { color: #ef4444; }
          .trend-neutral { color: #6b7280; }
          .chart-placeholder { margin-top: 10px; }
          .portal-container { display: flex; height: 100vh; }
          .left-nav { width: 250px; background: #fff; border-right: 1px solid #ddd; padding: 20px; }
          .main-content { flex: 1; display: flex; flex-direction: column; }
          .top-header { padding: 20px; border-bottom: 1px solid #ddd; background: white; }
          .top-header h1 { margin: 0; }
          .content-area { flex: 1; padding: 20px; }
          .nav-item { padding: 8px 0; }
          .nav-item a { text-decoration: none; color: #333; display: flex; align-items: center; gap: 8px; }
          .nav-item a:hover { color: #2563eb; }
          .kanban-board { padding: 20px; }
          .board-toolbar { margin-bottom: 20px; }
          .board-toolbar h1 { margin: 0; }
          .board-columns { display: flex; gap: 20px; }
          .info-banner { background: #dbeafe; border: 1px solid #93c5fd; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 14px; color: #1e40af; }
        </style>
      </head>
      <body>
        <div class="info-banner">🤖 Generated from: "${composition.userMessage || 'User request'}" | Session: ${composition.sessionId}</div>
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

if (process.env.START_SIMPLE_WEB_SERVER !== '0') {
  startSimpleWebServer();
}
