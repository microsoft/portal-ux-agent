<#
  Robust startup script for portal-ux-agent (HTTP MCP mode).
  Hardcoded:
    UI_PORT=3000
    MCP_PORT=3001
    USE_MCP_WS=0 (HTTP mode)
  Features:
    - Docker daemon availability check
    - Remove previous container
    - Unconditional image build (simplifies freshness)
    - Container state verification (must be Running)
    - UI /health probe before declaring success
    - Conditional success message only after health OK
    - Clear failure messages with exit codes
#>

$ErrorActionPreference = 'Stop'

function Info($m) { Write-Host $m -ForegroundColor Cyan }
function Ok($m)   { Write-Host $m -ForegroundColor Green }
function Warn($m) { Write-Host $m -ForegroundColor DarkYellow }

$containerName = 'portal-ux-agent-run'
$imageName     = 'portal-ux-agent'
$uiPort        = 3000
$mcpPort       = 3001
$useWsFlag     = '0'  # HTTP mode hardcoded (MCP served over HTTP endpoints)

function Fail($m) { Write-Host $m -ForegroundColor Red }

$exitCode = 0

# Resolve project root (repo root assumed parent of tests/)
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot

try {
  Info "=== Checking Docker daemon availability ==="
  try {
    $null = docker version --format '{{.Server.Version}}'
  } catch {
    Fail "Docker daemon not reachable. Start Docker Desktop and retry."
    $exitCode = 1; throw
  }

  Info "=== Removing existing container (if any) ==="
  try { docker rm -f $containerName 2>$null | Out-Null } catch {}

  Info "=== Building image: $imageName ==="
  docker build -t $imageName . | Write-Host
  if ($LASTEXITCODE -ne 0) { Fail "Docker build failed (exit $LASTEXITCODE)."; $exitCode = 2; throw }

  # Ensure logs directory exists (mounted for app logging)
  $logsDir = Join-Path $projectRoot 'logs'
  if (-not (Test-Path $logsDir)) { New-Item -Path $logsDir -ItemType Directory | Out-Null }
  $logsDirResolved = (Resolve-Path $logsDir).Path

  Info "=== Starting container: $containerName ==="
  $runArgs = @('run','-d','--name',$containerName,
    '-e',"UI_PORT=$uiPort",
    '-e',"MCP_PORT=$mcpPort",
    '-e',"USE_MCP_WS=$useWsFlag",
    '-p',"${uiPort}:${uiPort}",
    '-p',"${mcpPort}:${mcpPort}",
    '-v',"${logsDirResolved}:/app/logs",
    $imageName)
  $containerId = docker @runArgs
  if ($LASTEXITCODE -ne 0 -or -not $containerId) { Fail "Container failed to start."; $exitCode = 3; throw }

  Info "=== Verifying container state ==="
  $running = docker inspect -f '{{.State.Running}}' $containerName 2>$null
  if ($LASTEXITCODE -ne 0 -or $running -ne 'true') {
    Warn "Container not running; recent logs:"; docker logs $containerName --tail 60 | Write-Host
    Fail "Aborting."; $exitCode = 4; throw
  }

  Info "=== Waiting for UI health (up to 15s) ==="
  $healthy = $false
  for ($i=0; $i -lt 30; $i++) {
    try {
      $resp = Invoke-RestMethod -Uri "http://localhost:$uiPort/health" -TimeoutSec 2 -Method Get
      if ($resp.status -eq 'ok') { $healthy = $true; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $healthy) {
    Warn "UI health not ready; showing logs (last 60 lines):"; docker logs $containerName --tail 60 | Write-Host
    Fail "UI failed to become healthy."; $exitCode = 5; throw
  }

  Ok "Service started."
  Write-Host ""
  Write-Host "UI:         http://localhost:$uiPort/ui/default" -ForegroundColor White
  Write-Host "UI Health:  http://localhost:$uiPort/health" -ForegroundColor White
  Write-Host "MCP (HTTP): http://localhost:$mcpPort/mcp/health" -ForegroundColor White
  Write-Host ""
  Write-Host "Stop: docker rm -f $containerName" -ForegroundColor DarkGray
  Write-Host "Logs: docker logs -f $containerName" -ForegroundColor DarkGray
} catch {
  if ($exitCode -eq 0) { $exitCode = 10 }
  Fail "Unhandled error: $($_.Exception.Message)"
  try {
    $state = docker inspect -f '{{.State.Status}}' $containerName 2>$null
    if ($state) { Warn "Container state: $state"; docker logs $containerName --tail 40 | Write-Host }
  } catch {}
} finally {
  Pop-Location
  if ($exitCode -ne 0) { exit $exitCode }
}
