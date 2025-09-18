# Validation script: end-to-end MCP + UI sanity check
param(
  [int]$UiPort = 3000,
  [int]$McpPort = 3001,
  [string]$Message = $null,
  [string]$UserId = "",
  [switch]$UseWs = $false
)

# Load default sample request if Message not provided
$sampleRequestDir = Join-Path $PSScriptRoot '..\src\data\sample-requests'
$defaultSamplePath = Join-Path $sampleRequestDir 'docker-validation.txt'
if (-not $Message -or -not $Message.Trim()) {
  if (-not (Test-Path $defaultSamplePath)) {
    throw "Sample request file not found: $defaultSamplePath"
  }
  $Message = Get-Content -Path $defaultSamplePath -Raw
}

Write-Host "=== Killing all portal-ux-agent containers ===" -ForegroundColor Cyan
docker ps -aq --filter "ancestor=portal-ux-agent" | ForEach-Object { docker rm -f $_ }
docker rm -f portal-ux-agent-run 2>$null

# Auto-load .env if present
$envFile = Join-Path $PSScriptRoot '..\.env'
if (Test-Path $envFile) {
  Write-Host "=== Loading .env ===" -ForegroundColor Cyan
  Get-Content $envFile | Where-Object { $_ -and $_ -notmatch '^\s*#' } | ForEach-Object {
    if ($_ -match '^(?<k>[^=]+)=(?<v>.*)$') {
      $k = $Matches.k.Trim(); $v = $Matches.v
      if ($k) { Set-Item -Path env:$k -Value $v }
    }
  }
}

# Function: Stop process on port
function Stop-ProcessOnPort {
  param([Parameter(Mandatory)][int]$Port)
  $killed = @()
  try {
    $conns = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      if ($procId -and $procId -ne $PID) {
        try {
          $proc = Get-Process -Id $procId -ErrorAction Stop
          Write-Host "Stopping process $($proc.ProcessName) (PID $procId) on port $Port" -ForegroundColor Yellow
          Stop-Process -Id $procId -Force
          $killed += $procId
        } catch {
          Write-Warning "Failed to stop PID $procId on port ${Port}: $_"
        }
      }
    }
  } catch {}
  if (-not $killed.Count) {
    Write-Host "Port $Port free" -ForegroundColor DarkGray
  }
}

# Function: Try UI endpoints
function Test-UiEndpoints {
  param([int]$UiPort, [string]$UserId, [switch]$OpenBrowser)

  $baseUiUrl = "http://localhost:$UiPort"
  $uiCandidates = @(
    "$baseUiUrl/ui/$UserId",
    "$baseUiUrl/ui/default",
    "$baseUiUrl/ui/",
    "$baseUiUrl/"
  )

  foreach ($url in $uiCandidates) {
    try {
      Write-Host "Trying $url ..."
      $res = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10
      if ($res.StatusCode -eq 200) {
        Write-Host ("✅ UI available at {0} ({1} bytes)" -f $url, $res.RawContentLength) -ForegroundColor Green
        if ($OpenBrowser) {
          try {
            Write-Host ("Opening UI in browser: {0}" -f $url) -ForegroundColor DarkCyan
            Start-Process $url | Out-Null
          } catch {
            Write-Warning "Failed to open browser automatically. Open manually: $url"
          }
        }
        return $true
      }
    } catch {
      Write-Host "⚠️  $url not available, trying next..."
    }
  }
  Write-Warning "❌ Could not reach UI at any of the tested paths."
  return $false
}

Write-Host "=== Ensuring ports $UiPort and $McpPort are free ===" -ForegroundColor Cyan
foreach ($p in @($UiPort, $McpPort)) { Stop-ProcessOnPort -Port $p }

Write-Host "=== Building image ===" -ForegroundColor Cyan
${null} = Push-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
try {
  docker build -t portal-ux-agent .
} finally {
  Pop-Location
}

Write-Host "=== Running container ===" -ForegroundColor Cyan
$effectiveUseWs = if ($PSBoundParameters.ContainsKey('UseWs')) { $UseWs } else { $true }
$wsFlag = if ($effectiveUseWs) { '1' } else { '0' }

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $projectRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -Path $logDir -ItemType Directory | Out-Null }
$logDirResolved = (Resolve-Path $logDir).Path
$promptLogPath = Join-Path $logDirResolved 'intent-prompts.log'
if (Test-Path $promptLogPath) { Remove-Item -Path $promptLogPath -Force -ErrorAction SilentlyContinue }

docker run -d --name portal-ux-agent-run `
  -e UI_PORT=$UiPort -e MCP_PORT=$McpPort -e USE_MCP_WS=$wsFlag `
  -e INTENT_PROMPT_LOG=/app/logs/intent-prompts.log `
  -p ${UiPort}:$UiPort -p ${McpPort}:$McpPort `
  -v "${logDirResolved}:/app/logs" `
  portal-ux-agent

$maxWait = 30
$effectiveUserId = if ($UserId -and $UserId.Trim()) { $UserId.Trim() } else { 'default' }

if ($effectiveUseWs) {
  Write-Host "=== Waiting for MCP WebSocket on port $McpPort ===" -ForegroundColor Cyan
  # ... (WebSocket init code unchanged) ...

  # ✅ New UI check
  Write-Host "=== Verifying UI page ===" -ForegroundColor Cyan
  $uiReady = $false
  for ($i = 0; $i -lt $maxWait; $i++) {
    if (Test-UiEndpoints -UiPort $UiPort -UserId $effectiveUserId) {
      $uiReady = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $uiReady) {
    Write-Warning "UI did not become ready within $maxWait seconds."
  } else {
    # Open the UI once in browser after it's confirmed ready
    Test-UiEndpoints -UiPort $UiPort -UserId $effectiveUserId -OpenBrowser
  }

} else {
  Write-Host "=== Waiting for health on MCP port $McpPort ===" -ForegroundColor Cyan
  for ($i = 0; $i -lt $maxWait; $i++) {
    try {
      $h = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/health" -Method Get -TimeoutSec 2
      if ($h) { break }
    } catch { Start-Sleep -Milliseconds 500 }
  }

  Write-Host "=== Checking MCP health ===" -ForegroundColor Cyan
  $health = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/health" -Method Get
  $health | ConvertTo-Json

  # ✅ New UI check
  Write-Host "=== Verifying UI page ===" -ForegroundColor Cyan
  Test-UiEndpoints -UiPort $UiPort -UserId $effectiveUserId
}

Write-Host "=== Opening WebSocket playground in browser ===" -ForegroundColor Cyan
$playgroundUrl = "http://localhost:$UiPort/playground-ws"
Write-Host "Launching: $playgroundUrl" -ForegroundColor DarkCyan
try {
  Start-Process $playgroundUrl | Out-Null
} catch {
  Write-Warning "Failed to open browser automatically. Open manually: $playgroundUrl"
}
