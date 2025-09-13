// Combined starter: runs UI server and HTTP MCP server in one process on two ports

// Disable module auto-starts before importing
process.env.START_SIMPLE_WEB_SERVER = process.env.START_SIMPLE_WEB_SERVER ?? '0';
process.env.START_HTTP_MCP_SERVER = process.env.START_HTTP_MCP_SERVER ?? '0';

const uiPort = Number(process.env.UI_PORT) || 3000;
const mcpPort = Number(process.env.MCP_PORT) || 3001;

const { startSimpleWebServer } = await import('./simple-web-server.js');
const { startHttpMcpServer } = await import('./server/mcp/http-mcp-server.js');

startSimpleWebServer(uiPort);
startHttpMcpServer(mcpPort);

console.log(`[combined] UI: http://localhost:${uiPort}`);
console.log(`[combined] MCP: http://localhost:${mcpPort}`);

