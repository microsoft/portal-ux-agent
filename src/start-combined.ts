// Combined starter: runs UI server and unified HTTP MCP server in one process on two ports

// Prevent auto-start inside imported modules
process.env.START_SIMPLE_WEB_SERVER = '0';
process.env.START_UNIFIED_HTTP_MCP = '0';

const uiPort = Number(process.env.UI_PORT) || 3000;
const mcpPort = Number(process.env.MCP_PORT) || 3001;

const { startSimpleWebServer } = await import('./simple-web-server.js');
const { startUnifiedHttpMcp } = await import('./server/mcp/unified-http-mcp-server.js');

startSimpleWebServer(uiPort);
startUnifiedHttpMcp(mcpPort);

console.log(`[combined] UI: http://localhost:${uiPort}`);
console.log(`[combined] MCP: http://localhost:${mcpPort}`);

export {}; // keep as module
