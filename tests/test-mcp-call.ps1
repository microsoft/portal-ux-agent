# Minimal MCP tool call script (no params). Attempts WS first, falls back to HTTP.
$ErrorActionPreference = 'Stop'

$McpPort = 3001
$SamplePath = Join-Path $PSScriptRoot '..\src\data\sample-requests\docker-validation.txt'
if(Test-Path $SamplePath){
  $Message = Get-Content -Path $SamplePath -Raw
} else {
  $Message = 'Generate a simple portal dashboard with a KPI card and a table.'
}

Write-Host "=== MCP create_portal_ui (auto transport) ===" -ForegroundColor Cyan

# ---------- WebSocket attempt ----------
Add-Type -AssemblyName System.Net.WebSockets | Out-Null
$wsUri = "ws://localhost:$McpPort"
$socket = $null
$wsConnected = $false

for($i=0; $i -lt 8; $i++){
  $cts = $null
  try {
    if($socket){ $socket.Dispose(); $socket = $null }
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.Options.AddSubProtocol('mcp')
    $cts = [System.Threading.CancellationTokenSource]::new()
    $cts.CancelAfter([TimeSpan]::FromMilliseconds(1200))
    $socket.ConnectAsync([Uri]$wsUri, $cts.Token).GetAwaiter().GetResult()
    $wsConnected = $true
    break
  } catch {
    Start-Sleep -Milliseconds 400
  } finally {
    if($cts){ $cts.Dispose() }
  }
}

function Send-Mcp {
  param($Sock,$Obj)
  $json = $Obj | ConvertTo-Json -Depth 10 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $seg = [System.ArraySegment[byte]]::new($bytes)
  $Sock.SendAsync($seg,[System.Net.WebSockets.WebSocketMessageType]::Text,$true,[System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
}

function Receive-Mcp {
  param($Sock,$ExpectId)
  $buf = New-Object byte[] 4096
  while($true){
    $builder = [System.Text.StringBuilder]::new()
    do {
      $seg = [System.ArraySegment[byte]]::new($buf)
      $res = $Sock.ReceiveAsync($seg,[System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
      if($res.Count -gt 0){
        $null = $builder.Append([System.Text.Encoding]::UTF8.GetString($buf,0,$res.Count))
      }
    } while(-not $res.EndOfMessage)
    $text = $builder.ToString()
    try { $obj = $text | ConvertFrom-Json } catch { $obj = $null }
    if($obj -and $obj.id -eq $ExpectId){ return $obj }
  }
}

if($wsConnected){
  Write-Host "Using WebSocket transport." -ForegroundColor Green
  try {
    $id = 1
    Send-Mcp $socket @{
      jsonrpc='2.0'; id=$id; method='initialize'; params=@{
        protocolVersion='2025-06-18'
        clientInfo=@{ name='call-tool'; version='0.1' }
        capabilities=@{ tools=@{} }
      }
    }
    $null = Receive-Mcp $socket $id
    Send-Mcp $socket @{ jsonrpc='2.0'; method='initialized' }

    $id++
    Send-Mcp $socket @{ jsonrpc='2.0'; id=$id; method='tools/list'; params=@{} }
    $null = Receive-Mcp $socket $id

    $id++
    $arguments = @{ message = $Message }
    Send-Mcp $socket @{
      jsonrpc='2.0'
      id=$id
      method='tools/call'
      params=@{ name='create_portal_ui'; arguments=$arguments }
    }
    $resp = Receive-Mcp $socket $id
    $resp | ConvertTo-Json -Depth 12

    # Try to locate viewUrl in result content (if present)
    $viewUrl = $null
    if($resp.result.content){
      $view = $resp.result.content | Where-Object { $_.name -eq 'viewUrl' -or $_.type -eq 'viewUrl' }
      if($view -and $view.text){ $viewUrl = $view.text }
    }
    if($viewUrl -and $viewUrl -match '^https?://'){
      Write-Host "`n=== viewUrl preview ===" -ForegroundColor Cyan
      try {
        $html = (Invoke-WebRequest -UseBasicParsing -Uri $viewUrl -TimeoutSec 10).Content
        if($html.Length -gt 400){ $html.Substring(0,400)+'...' } else { $html }
      } catch { Write-Warning "Failed to fetch viewUrl: $_" }
    }
  } finally {
    if($socket -and $socket.State -eq [System.Net.WebSockets.WebSocketState]::Open){
      $socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure,'done',[System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
    }
    if($socket){ $socket.Dispose() }
  }
  Write-Host "`nSuccess (WebSocket)." -ForegroundColor Green
  exit 0
}

# ---------- HTTP fallback ----------
Write-Host "WebSocket unavailable; falling back to HTTP." -ForegroundColor Yellow
$healthOk = $false
for($i=0;$i -lt 20;$i++){
  try {
    $h = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/health" -TimeoutSec 2 -Method Get
    if($h){ $healthOk = $true; break }
  } catch { Start-Sleep -Milliseconds 500 }
}
if(-not $healthOk){
  Write-Host "Server not healthy on HTTP (WebSocket also failed)." -ForegroundColor Red
  exit 2
}

try {
  $tools = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/tools" -Method Get -TimeoutSec 5
  $payload = @{ name='create_portal_ui'; arguments=@{ message=$Message } } | ConvertTo-Json -Depth 6
  $resp = Invoke-RestMethod -Uri "http://localhost:$McpPort/mcp/tools/call" -Method Post -Body $payload -ContentType 'application/json' -TimeoutSec 40
  $resp | ConvertTo-Json -Depth 10
  if($resp.viewUrl){
    Write-Host "`n=== viewUrl preview ===" -ForegroundColor Cyan
    try {
      $html = (Invoke-WebRequest -UseBasicParsing -Uri $resp.viewUrl -TimeoutSec 10).Content
      if($html.Length -gt 400){ $html.Substring(0,400)+'...' } else { $html }
    } catch { Write-Warning "Failed to fetch viewUrl: $_" }
  }
  Write-Host "`nSuccess (HTTP)." -ForegroundColor Green
  exit 0
} catch {
  Write-Host "HTTP tool call failed: $_" -ForegroundColor Red
  exit 3
}
