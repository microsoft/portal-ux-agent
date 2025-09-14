# Helper script: invoke create_portal_ui tool via MCP HTTP API
param(
  [string]$Message = "sample dashboard",
  [int]$Port = 3001
)

$payload = @{ name = 'create_portal_ui'; arguments = @{ message = $Message } } | ConvertTo-Json -Depth 4
Write-Host "POST /mcp/tools/call -> $Message" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "http://localhost:$Port/mcp/tools/call" -Method Post -Body $payload -ContentType 'application/json'
$response | ConvertTo-Json -Depth 6
if($response.viewUrl){
  Write-Host "`nFetching viewUrl: $($response.viewUrl)" -ForegroundColor Green
  try { (Invoke-WebRequest -Uri $response.viewUrl).Content.Substring(0,400) + '...'; } catch { Write-Warning $_ }
}
