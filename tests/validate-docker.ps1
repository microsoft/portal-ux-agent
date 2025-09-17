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
  [switch]$UseWs = $false
)

Write-Host "=== Killing all portal-ux-agent containers ===" -ForegroundColor Cyan
docker ps -aq --filter "ancestor=portal-ux-agent" | ForEach-Object { docker rm -f $_ }
docker rm -f portal-ux-agent-run 2>$null

# Auto-load .env if present (without exporting secrets to logs)
$envFile = Join-Path $PSScriptRoot '..' '.env'
if (Test-Path $envFile) {
  Write-Host "=== Loading .env ===" -ForegroundColor Cyan
  Get-Content $envFile | Where-Object { $_ -and $_ -notmatch '^\s*#' } | ForEach-Object {
    if ($_ -match '^(?<k>[^=]+)=(?<v>.*)$') {
      $k = $Matches.k.Trim(); $v = $Matches.v
      if ($k) { Set-Item -Path env:$k -Value $v }
    }
  }
}

# Port cleanup: ensure target UI and MCP ports are free before starting container
function Stop-ProcessOnPort {
  param(
    [Parameter(Mandatory)][int]$Port
  )
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
  } catch {
    # Fallback to netstat parsing if Get-NetTCPConnection not available or access denied
    try {
      $netstat = netstat -ano | Select-String ":$Port\s+.*LISTENING" | ForEach-Object { $_.ToString() }
      foreach ($line in $netstat) {
        $parts = $line -split "\s+" | Where-Object { $_ -ne '' }
        if ($parts.Length -ge 5) {
          $procId = $parts[-1]
          if ($procId -match '^[0-9]+$' -and [int]$procId -ne $PID) {
            try {
              $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
              $pname = if ($proc) { $proc.ProcessName } else { '<unknown>' }
              Write-Host "Stopping PID $procId ($pname) on port $Port (fallback)" -ForegroundColor Yellow
              Stop-Process -Id $procId -Force
              $killed += $procId
            } catch {
              Write-Warning "Fallback failed to stop PID $procId on port ${Port}: $_"
            }
          }
        }
      }
    } catch {
      Write-Warning "Could not inspect port ${Port}: $_"
    }
  }
  if (-not $killed.Count) {
    Write-Host "Port $Port free" -ForegroundColor DarkGray
  }
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
# If user did not explicitly pass -UseWs, default to true (WebSocket mode)
$effectiveUseWs = if ($PSBoundParameters.ContainsKey('UseWs')) { $UseWs } else { $true }
$wsFlag = if ($effectiveUseWs) { '1' } else { '0' }
Write-Host "=== Preparing docker run environment variables ===" -ForegroundColor Cyan
$currentIntentLog = (Get-Item -Path Env:INTENT_LOG_PROMPT -ErrorAction SilentlyContinue).Value
if (-not $currentIntentLog) {
  Write-Host "INTENT_LOG_PROMPT not set; defaulting to 1 for validation run" -ForegroundColor DarkYellow
  $env:INTENT_LOG_PROMPT = '1'
}
$forwardVars = @(
  'AZURE_OPENAI_ENDPOINT','AZURE_OPENAI_API_KEY','AZURE_OPENAI_DEPLOYMENT','AZURE_OPENAI_API_VERSION',
  'AZURE_OPENAI_USE_AAD','AZURE_OPENAI_SCOPE','INTENT_LOG_PROMPT','SEED_SAMPLE'
)
$envArgs = @()
foreach ($name in $forwardVars) {
  $val = (Get-Item -Path Env:$name -ErrorAction SilentlyContinue).Value
  if (-not $val -and $name -eq 'SEED_SAMPLE') { $val = '0' }
  if ($val) { $envArgs += @('-e', "$name=$val") }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $projectRoot 'logs'
if (-not (Test-Path $logDir)) {
  New-Item -Path $logDir -ItemType Directory | Out-Null
}
$logDirResolved = (Resolve-Path $logDir).Path

docker run -d --name portal-ux-agent-run `
  -e UI_PORT=$UiPort -e MCP_PORT=$McpPort -e USE_MCP_WS=$wsFlag `
  -e INTENT_PROMPT_LOG=/app/logs/intent-prompts.log `
  $envArgs `
  -p ${UiPort}:$UiPort -p ${McpPort}:$McpPort `
  -v "${logDirResolved}:/app/logs" `
  portal-ux-agent

$maxWait = 30

if ($effectiveUseWs) {
  Write-Host "=== Waiting for MCP WebSocket on port $McpPort ===" -ForegroundColor Cyan
  $wsUri = "ws://localhost:$McpPort"
  $socket = $null
  $connected = $false
  for ($i = 0; $i -lt $maxWait; $i++) {
    if ($socket) { $socket.Dispose(); $socket = $null }
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.Options.AddSubProtocol('mcp')
    $cts = [System.Threading.CancellationTokenSource]::new()
    $cts.CancelAfter([TimeSpan]::FromMilliseconds(1500))
    try {
      $socket.ConnectAsync([Uri]$wsUri, $cts.Token).GetAwaiter().GetResult()
      $connected = $true
      break
    } catch {
      Start-Sleep -Milliseconds 500
    } finally {
      $cts.Dispose()
    }
  }
  if (-not $connected) {
    throw "Failed to connect to MCP WebSocket at $wsUri"
  }

  function Send-McpMessage {
    param(
      [Parameter(Mandatory)] [System.Net.WebSockets.ClientWebSocket] $Socket,
      [Parameter(Mandatory)] [object] $Message
    )
    $json = $Message | ConvertTo-Json -Depth 10 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $segment = [System.ArraySegment[byte]]::new($bytes)
    $Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
  }

  function Receive-McpFragment {
    param(
      [Parameter(Mandatory)] [System.Net.WebSockets.ClientWebSocket] $Socket
    )
    $buffer = New-Object byte[] 4096
    $builder = [System.Text.StringBuilder]::new()
    do {
      $segment = [System.ArraySegment[byte]]::new($buffer)
      $result = $Socket.ReceiveAsync($segment, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
      if ($result.Count -gt 0) {
        $null = $builder.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
      }
    } while (-not $result.EndOfMessage)
    $text = $builder.ToString()
    $parsed = $null
    try { $parsed = $text | ConvertFrom-Json } catch {}
    [pscustomobject]@{ Text = $text; Json = $parsed }
  }

  function Receive-McpResponse {
    param(
      [Parameter(Mandatory)] [System.Net.WebSockets.ClientWebSocket] $Socket,
      [Parameter(Mandatory)] [int] $ExpectedId
    )
    while ($true) {
      $msg = Receive-McpFragment -Socket $Socket
      if ($msg.Json -and ($msg.Json.PSObject.Properties.Name -contains 'id') -and $msg.Json.id -eq $ExpectedId) {
        return $msg
      }
      Write-Host "[notification] $($msg.Text)" -ForegroundColor DarkGray
    }
  }

  try {
    Write-Host "=== MCP WS initialize ===" -ForegroundColor Cyan
    $nextId = 1
    $initId = $nextId++
    Send-McpMessage -Socket $socket -Message @{
      jsonrpc = '2.0'
      id      = $initId
      method  = 'initialize'
      params  = @{
        protocolVersion = '2025-06-18'
        clientInfo      = @{ name = 'validate-docker'; version = '1.0.0' }
        capabilities    = @{ tools = @{} }
      }
    }
    $initResponse = Receive-McpResponse -Socket $socket -ExpectedId $initId
    $initResponse.Json | ConvertTo-Json -Depth 6

    Send-McpMessage -Socket $socket -Message @{ jsonrpc = '2.0'; method = 'initialized' }

    Write-Host "=== tools/list (WS) ===" -ForegroundColor Cyan
    $listId = $nextId++
    Send-McpMessage -Socket $socket -Message @{
      jsonrpc = '2.0'
      id      = $listId
      method  = 'tools/list'
      params  = @{}
    }
    $listResponse = Receive-McpResponse -Socket $socket -ExpectedId $listId
    $listResponse.Json | ConvertTo-Json -Depth 6

    Write-Host "=== tools/call create_portal_ui (WS) ===" -ForegroundColor Cyan
    $arguments = @{ message = $Message }
    if ($UserId -and $UserId.Trim().Length -gt 0) { $arguments.userId = $UserId }
    $callId = $nextId++
    Send-McpMessage -Socket $socket -Message @{
      jsonrpc = '2.0'
      id      = $callId
      method  = 'tools/call'
      params  = @{
        name      = 'create_portal_ui'
        arguments = $arguments
      }
    }
    $callResponse = Receive-McpResponse -Socket $socket -ExpectedId $callId
    $callResponse.Json | ConvertTo-Json -Depth 10

    $viewUrl = $null
    $callData = $null
    if ($callResponse.Json -and $callResponse.Json.result) {
      $resultPayload = $callResponse.Json.result
      if ($resultPayload.content -and $resultPayload.content.Count -gt 0) {
        $textPayload = $resultPayload.content[0].text
        if ($textPayload) {
          try { $callData = $textPayload | ConvertFrom-Json } catch {
            Write-Warning "Tool response text was not valid JSON:"
            Write-Warning $textPayload
          }
        }
      } else {
        $callData = $resultPayload
      }
      if ($callData -and $callData.viewUrl) {
        $viewUrl = $callData.viewUrl
      }
    }

    if ($viewUrl) {
      Write-Host "=== Fetching generated UI (first 400 chars) ===" -ForegroundColor Cyan
      $html = (Invoke-WebRequest -UseBasicParsing -Uri $viewUrl -TimeoutSec 10).Content
      if ($html.Length -gt 400) { $html.Substring(0,400) + '...' } else { $html }
    } else {
      Write-Warning "No viewUrl returned"
    }
  } finally {
    if ($socket -and $socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
      $socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
    }
    if ($socket) { $socket.Dispose() }
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

  Write-Host "=== Listing tools ===" -ForegroundColor Cyan
  $tools = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/tools" -Method Get -TimeoutSec 5
  $tools | ConvertTo-Json -Depth 4

  Write-Host "=== Calling tool: create_portal_ui ===" -ForegroundColor Cyan
  $toolArgs = @{ message = $Message }
  if ($UserId -and $UserId.Trim().Length -gt 0) { $toolArgs.userId = $UserId }
  $payload = @{ name = 'create_portal_ui'; arguments = $toolArgs } | ConvertTo-Json -Depth 4
  $response = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/tools/call" -Method Post -Body $payload -ContentType 'application/json' -TimeoutSec 20
  $response | ConvertTo-Json -Depth 6

  if ($response.viewUrl) {
    Write-Host "=== Fetching generated UI (first 400 chars) ===" -ForegroundColor Cyan
    $html = (Invoke-WebRequest -UseBasicParsing -Uri $response.viewUrl -TimeoutSec 10).Content
    if ($html.Length -gt 400) { $html.Substring(0,400) + '...' } else { $html }
  } else {
    Write-Warning "No viewUrl returned"
  }
}

Write-Host "=== Opening WebSocket playground in browser ===" -ForegroundColor Cyan
$playgroundUrl = "http://localhost:$UiPort/playground-ws"
Write-Host "Launching: $playgroundUrl" -ForegroundColor DarkCyan
try {
  Start-Process $playgroundUrl | Out-Null
} catch {
  Write-Warning "Failed to open browser automatically. Open manually: $playgroundUrl"
}
