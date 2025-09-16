# Validation script: end-to-end MCP + UI sanity check
param(
  [int]$UiPort = 3000,
  [int]$McpPort = 3001,
  [string]$Message = @"
Team's velocity in last 6 sprints, measured by stories burned.
[
  { "sprint": "Sprint 7", "burned": 42 },
  { "sprint": "Sprint 8", "burned": 35 },
  { "sprint": "Sprint 9", "burned": 48 },
  { "sprint": "Sprint 10", "burned": 39 },
  { "sprint": "Sprint 11", "burned": 44 },
  { "sprint": "Sprint 12", "burned": 47 }
]

Team availability in next sprint.
[
  { "member": "Alice",   "capacity": 10, "assigned": 7, "availability": 3, "notes": "Can take 1 small task" },
  { "member": "Bob",     "capacity": 10, "assigned": 10, "availability": 0, "notes": "Fully loaded" },
  { "member": "Charlie", "capacity": 10, "assigned": 5, "availability": 5, "notes": "Available for big task" },
  { "member": "Diana",   "capacity": 10, "assigned": 8, "availability": 2, "notes": "Lightly loaded" },
  { "member": "Ethan",   "capacity": 10, "assigned": 6, "availability": 4, "notes": "Medium availability" }
]
"@,
  [string]$UserId = "",
  [switch]$UseWs
)

Write-Host "=== Killing all portal-ux-agent containers ===" -ForegroundColor Cyan
docker ps -aq --filter "ancestor=portal-ux-agent" | ForEach-Object { docker rm -f $_ }
docker rm -f portal-ux-agent-run 2>$null

Write-Host "=== Building image ===" -ForegroundColor Cyan
docker build -t portal-ux-agent .

Write-Host "=== Running container ===" -ForegroundColor Cyan
$wsFlag = if ($UseWs) { '1' } else { '0' }
docker run -d --name portal-ux-agent-run `
  -e UI_PORT=$UiPort -e MCP_PORT=$McpPort -e USE_MCP_WS=$wsFlag `
  -p ${UiPort}:$UiPort -p ${McpPort}:$McpPort `
  portal-ux-agent

# Wait for health
Write-Host "=== Waiting for health on MCP port $McpPort ===" -ForegroundColor Cyan
$maxWait = 30
for ($i=0; $i -lt $maxWait; $i++) {
  try {
    $h = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/health" -Method Get -TimeoutSec 2
    if ($h) { break }
  } catch { Start-Sleep -Milliseconds 500 }
}

Write-Host "=== Checking MCP health ===" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/health" -Method Get
$health | ConvertTo-Json

Write-Host "=== Listing tools ===" -ForegroundColor Cyan
$tools = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/tools" -Method Get -TimeoutSec 5
$tools | ConvertTo-Json -Depth 4

Write-Host "=== Calling tool: create_portal_ui ===" -ForegroundColor Cyan
$toolArgs = @{ message = $Message }
if($UserId -and $UserId.Trim().Length -gt 0){ $toolArgs.userId = $UserId }
$payload = @{ name='create_portal_ui'; arguments=$toolArgs } | ConvertTo-Json -Depth 4
$response = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/tools/call" -Method Post -Body $payload -ContentType 'application/json' -TimeoutSec 20
$response | ConvertTo-Json -Depth 6

if($response.viewUrl){
  Write-Host "=== Fetching generated UI (first 400 chars) ===" -ForegroundColor Cyan
  $html = (Invoke-WebRequest -UseBasicParsing -Uri $response.viewUrl -TimeoutSec 10).Content
  if($html.Length -gt 400){ $html.Substring(0,400) + '...' } else { $html }
}
else {
  Write-Warning "No viewUrl returned"
}

Write-Host "=== Opening WebSocket playground in browser ===" -ForegroundColor Cyan
$playgroundUrl = "http://localhost:$UiPort/playground-ws"
Write-Host "Launching: $playgroundUrl" -ForegroundColor DarkCyan
try {
  Start-Process $playgroundUrl | Out-Null
} catch {
  Write-Warning "Failed to open browser automatically. Open manually: $playgroundUrl"
}
