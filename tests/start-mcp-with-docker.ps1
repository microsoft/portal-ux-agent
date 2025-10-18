<#
  Minimal startup script for portal-ux-agent.
  Hardcoded:
    UI_PORT=3000
    MCP_PORT=3001
    USE_MCP_WS=0 (HTTP mode)
  Behavior:
    - Removes existing container named portal-ux-agent-run (if present)
    - Builds image (unconditionally)
    - Starts container with port mappings and logs volume
    - Prints status
#>

$ErrorActionPreference = 'Stop'

function Info($m) { Write-Host $m -ForegroundColor Cyan }
function Ok($m)   { Write-Host $m -ForegroundColor Green }
function Warn($m) { Write-Host $m -ForegroundColor DarkYellow }

$containerName = 'portal-ux-agent-run'
$imageName     = 'portal-ux-agent'
$uiPort        = 3000
$mcpPort       = 3001
$useWsFlag     = '0'  # HTTP mode hardcoded

# Resolve project root (repo root assumed parent of tests/)
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot

try {
  Info "=== Removing existing container (if any) ==="
  docker rm -f $containerName 2>$null | Out-Null

  Info "=== Building image: $imageName ==="
  docker build -t $imageName . | Write-Host

  # Ensure logs directory exists (mounted for app logging)
  $logsDir = Join-Path $projectRoot 'logs'
  if (-not (Test-Path $logsDir)) {
    New-Item -Path $logsDir -ItemType Directory | Out-Null
  }
  $logsDirResolved = (Resolve-Path $logsDir).Path

  Info "=== Starting container: $containerName ==="
  docker run -d --name $containerName `
    -e UI_PORT=$uiPort -e MCP_PORT=$mcpPort -e USE_MCP_WS=$useWsFlag `
    -p "$(($uiPort)):$(($uiPort))" -p "$(($mcpPort)):$(($mcpPort))" `
    -v "$(($logsDirResolved)):/app/logs" `
    $imageName | Out-Null

  Info "=== Container status ==="
  docker ps --filter "name=$containerName" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

  Ok  "Service started."
  Write-Host ""
  Write-Host "UI:        http://localhost:$uiPort" -ForegroundColor White
  Write-Host "MCP (HTTP):  http://localhost:$mcpPort" -ForegroundColor White
  Write-Host ""
  Write-Host "Stop: docker rm -f $containerName" -ForegroundColor DarkGray
  Write-Host "Logs: docker logs -f $containerName" -ForegroundColor DarkGray
} finally {
  Pop-Location
}
