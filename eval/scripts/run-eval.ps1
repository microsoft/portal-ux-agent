param(
  [string]$ScenariosPath = (Resolve-Path (Join-Path $PSScriptRoot '..\scenarios')).Path,
  [string]$RunsRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\runs') -ErrorAction SilentlyContinue)?.Path,
  [string]$RubricPath = (Resolve-Path (Join-Path $PSScriptRoot '..\rubric.md')).Path,
  [int]$UiPort = 3000,
  [int]$McpPort = 3001,
  [switch]$UseWs,
  [string]$JudgeModel = 'stub-model',
  [switch]$ReuseContainer
)

if (-not $RunsRoot) {
  $RunsRoot = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'runs'
  if (-not (Test-Path $RunsRoot)) { New-Item -ItemType Directory -Path $RunsRoot | Out-Null }
}

function Get-PythonCmd {
  $candidates = @('python','py -3')
  foreach ($c in $candidates) {
    try {
      $v = & $c --version 2>$null
      if ($LASTEXITCODE -eq 0) { return $c }
    } catch {}
  }
  return $null
}

$pythonCmd = Get-PythonCmd

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  if (-not $pythonCmd) { throw 'Neither Node.js nor Python found. Install one runtime.' }
}

# Compile TypeScript judge (fallback) if Node present and TS source exists
$tsJudge = Join-Path $PSScriptRoot 'judge.ts'
if ((Test-Path $tsJudge) -and (Get-Command node -ErrorAction SilentlyContinue)) {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  Push-Location $repoRoot
  try {
    if (Test-Path './tsconfig.json') {
      npx tsc --pretty false 2>$null
    } else {
      if (-not (Get-Command tsc -ErrorAction SilentlyContinue)) { npm install typescript --no-save | Out-Null }
      npx tsc ./eval/scripts/judge.ts --target ES2020 --module commonjs --outDir ./eval/scripts 2>$null
    }
  } finally { Pop-Location }
}

$runId = (Get-Date -Format 'yyyyMMdd_HHmmss')
$runDir = Join-Path $RunsRoot $runId
$rawDir = Join-Path $runDir 'raw'
New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
Write-Host "=== Eval Run: $runId ===" -ForegroundColor Cyan
Write-Host "Judge runtime preference: $(if ($pythonCmd) {'Python'} else {'Node'})" -ForegroundColor DarkGray

# Container management
$containerName = 'portal-ux-agent-eval'
$containerRunning = (docker ps --format '{{.Names}}' | Select-String -SimpleMatch $containerName -Quiet)
if (-not $ReuseContainer -or -not $containerRunning) {
  if ($containerRunning) { docker rm -f $containerName | Out-Null }
  Write-Host 'Building fresh image...' -ForegroundColor Cyan
  docker build -t portal-ux-agent . | Out-Null
  Write-Host 'Starting container...' -ForegroundColor Cyan
  docker run -d --name $containerName -p ${UiPort}:$UiPort -p ${McpPort}:$McpPort portal-ux-agent | Out-Null
  Start-Sleep -Seconds 5
}

$scenarioFiles = Get-ChildItem -Path $ScenariosPath -Filter *.txt
if (-not $scenarioFiles) { throw "No scenarios found at $ScenariosPath" }

$manifest = [ordered]@{
  runId     = $runId
  createdAt = (Get-Date).ToString('o')
  model     = $JudgeModel
  rubricPath= (Resolve-Path $RubricPath).Path
  scenarios = @()
}

foreach ($file in $scenarioFiles) {
  $scenarioId = [IO.Path]::GetFileNameWithoutExtension($file.Name)
  $scenarioOutDir = Join-Path $rawDir $scenarioId
  New-Item -ItemType Directory -Path $scenarioOutDir -Force | Out-Null

  $scenarioText = Get-Content -Path $file.FullName -Raw
  Set-Content -Path (Join-Path $scenarioOutDir 'scenario.txt') -Value $scenarioText -NoNewline

  # Placeholder: fetch default UI page until real MCP invocation integrated
  $uiUrl = "http://localhost:$UiPort/ui/default"
  try { $html = (Invoke-WebRequest -UseBasicParsing -Uri $uiUrl -TimeoutSec 10).Content }
  catch { $html = "<error>Failed to fetch $uiUrl : $_</error>" }
  Set-Content -Path (Join-Path $scenarioOutDir 'agent_output.txt') -Value $html

  $expectedPath = Join-Path (Join-Path $ScenariosPath '..\expected') "$scenarioId.json"
  $expectedResolved = $null
  if (Test-Path $expectedPath) {
    Copy-Item $expectedPath (Join-Path $scenarioOutDir 'expected.json') -Force
    $expectedResolved = (Resolve-Path $expectedPath).Path
  }

  $manifest.scenarios += [ordered]@{
    id = $scenarioId
    file = (Resolve-Path $file.FullName).Path
    expectedFile = $expectedResolved
  }
}

$manifestPath = Join-Path $runDir 'manifest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -NoNewline

# Judge pass (Python preferred, Node fallback)
$scoreResults = @()
foreach ($entry in $manifest.scenarios) {
  $scenarioId = $entry.id
  $scenarioOutDir = Join-Path $rawDir $scenarioId
  $scenarioPath = Join-Path $scenarioOutDir 'scenario.txt'
  $agentOutputPath = Join-Path $scenarioOutDir 'agent_output.txt'
  $expectedPath   = Join-Path $scenarioOutDir 'expected.json'
  $expectedArg = (Test-Path $expectedPath) ? $expectedPath : ''

  if ($pythonCmd) {
    & $pythonCmd (Join-Path $PSScriptRoot 'judge.py') `
      $scenarioId $scenarioPath $agentOutputPath $RubricPath $expectedArg $JudgeModel | Out-Null
  } else {
    node (Join-Path $PSScriptRoot 'judge.js') `
      $scenarioId $scenarioPath $agentOutputPath $RubricPath $expectedArg $JudgeModel | Out-Null
  }

  $score = Get-Content -Path (Join-Path $scenarioOutDir 'score.json') -Raw | ConvertFrom-Json
  $scoreResults += $score
}

$scoreResults | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $runDir 'scores.json') -NoNewline

Write-Host '=== Eval complete ===' -ForegroundColor Green
Write-Host "Run directory: $runDir" -ForegroundColor Gray
