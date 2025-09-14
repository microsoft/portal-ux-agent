# Validation script: end-to-end MCP + UI sanity check
param(
  [int]$UiPort = 3000,
  [int]$McpPort = 3001,
  [string]$Message = "dashboard demo",
  [string]$UserId = ""
)

Write-Host "=== Killing all portal-ux-agent containers ===" -ForegroundColor Cyan
docker ps -aq --filter "ancestor=portal-ux-agent" | ForEach-Object { docker rm -f $_ }
docker rm -f portal-ux-agent-run 2>$null

Write-Host "=== Building image ===" -ForegroundColor Cyan
docker build -t portal-ux-agent .

Write-Host "=== Running container ===" -ForegroundColor Cyan
docker run -d --name portal-ux-agent-run -p 3000:3000 -p 3001:3001 portal-ux-agent

Start-Sleep -Seconds 3

Write-Host "=== Checking MCP health ===" -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/health" -Method Get
$health | ConvertTo-Json

Write-Host "=== Listing tools ===" -ForegroundColor Cyan
$tools = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/tools" -Method Get
$tools | ConvertTo-Json -Depth 4

Write-Host "=== Calling tool: create_portal_ui ===" -ForegroundColor Cyan
$toolArgs = @{ message = $Message }
if($UserId -and $UserId.Trim().Length -gt 0){ $toolArgs.userId = $UserId }
$payload = @{ name='create_portal_ui'; arguments=$toolArgs } | ConvertTo-Json -Depth 4
$response = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/tools/call" -Method Post -Body $payload -ContentType 'application/json'
$response | ConvertTo-Json -Depth 6

if($response.viewUrl){
  Write-Host "=== Fetching generated UI (first 400 chars) ===" -ForegroundColor Cyan
  $html = (Invoke-WebRequest -Uri $response.viewUrl).Content
  if($html.Length -gt 400){ $html.Substring(0,400) + '...' } else { $html }
}
else {
  Write-Warning "No viewUrl returned"
}
