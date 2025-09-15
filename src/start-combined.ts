// Combined starter: runs UI server and MCP server in one process on two ports

// Prevent auto-start inside imported modules
process.env.START_SIMPLE_WEB_SERVER = '0';
process.env.START_UNIFIED_HTTP_MCP = process.env.START_UNIFIED_HTTP_MCP ?? '0';
process.env.START_WS_MCP_SERVER = process.env.START_WS_MCP_SERVER ?? '0';

const uiPort = Number(process.env.UI_PORT) || 3000;
const mcpPort = Number(process.env.MCP_PORT) || 3001;

const { startSimpleWebServer } = await import('./simple-web-server.js');
const useWs = (process.env.USE_MCP_WS || '1') === '1';
let startMcp: (port?: number) => void;
if (useWs) {
  const mod = await import('./server/mcp/ws-mcp-server.js');
  startMcp = mod.startWsMcpServer;
} else {
  const mod = await import('./server/mcp/unified-http-mcp-server.js');
  startMcp = mod.startUnifiedHttpMcp;
}

startSimpleWebServer(uiPort);
startMcp(mcpPort);

console.log(`[combined] UI: http://localhost:${uiPort}`);
console.log(`[combined] MCP: ${useWs ? `ws://localhost:${mcpPort}` : `http://localhost:${mcpPort}`}`);

export {}; // keep as module
