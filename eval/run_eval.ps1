<#!
.SYNOPSIS
Runs the multi-record evaluation pipeline (LLM-only judge) using ONLY the repo root .env file.

.DESCRIPTION
Loads environment variables from <repo-root>/.env if present (no other locations searched),
then invokes eval/pipeline/run_judge_over_dataset.py with supplied filtering/limit options.

The Python judge pipeline is now LLM-only; ensure the .env contains Azure OpenAI values if
actual LLM interpretation/scoring is desired:
  AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
  AZURE_OPENAI_API_KEY=sk-...
  AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

If AZURE_OPENAI_ENDPOINT is missing, runs that call judge.py will fail early.

.PARAMETER RunRoot
Directory under which run_judge_over_dataset.py will create timestamped runs (default: eval/runs)

.PARAMETER MCPMode
stub | echo | http (http not implemented). Default: stub

.PARAMETER MCPEndpoint
Future HTTP MCP endpoint (only relevant when MCPMode=http)

.PARAMETER Model
Label recorded in metadata; defaults to AZURE_OPENAI_DEPLOYMENT or "stub-model" if not set.

.PARAMETER Limit
Limit number of dataset records processed.

.PARAMETER Filter
Substring filter applied to dataset record identifiers or titles.

.PARAMETER IdPrefix
Optional prefix for generated record IDs.

.PARAMETER SkipExisting
Skip records whose output directory already contains score.json

.EXAMPLE
pwsh ./eval/run_eval.ps1 -Limit 5 -Filter dashboard

.EXAMPLE
pwsh ./eval/run_eval.ps1 -MCPMode stub

#>
[CmdletBinding()]
param(
  [string]$RunRoot = "eval/runs",
  [ValidateSet("stub","echo","http")] [string]$MCPMode = "stub",
  [string]$MCPEndpoint,
  [string]$Model,
  [int]$Limit,
  [string]$Filter,
  [string]$IdPrefix,
  [switch]$SkipExisting
)

function Import-RepoRootDotEnv {
  param([string]$EnvPath)
  if (-not (Test-Path -LiteralPath $EnvPath)) {
    Write-Host "No repo root .env found at $EnvPath; continuing with existing environment." -ForegroundColor Yellow
    return $false
  }
  Write-Host "Loading environment from $EnvPath" -ForegroundColor Cyan
  Get-Content -LiteralPath $EnvPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $k = $line.Substring(0,$idx).Trim()
    $v = $line.Substring($idx+1).Trim()
    if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1,$v.Length-2) }
    elseif ($v.StartsWith("'") -and $v.EndsWith("'")) { $v = $v.Substring(1,$v.Length-2) }
  if ($k) { Set-Item -Path Env:$k -Value $v }
  }
  return $true
}

# Resolve paths relative to this script (which is in eval/)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path   # eval/
$envLoaded = Import-RepoRootDotEnv -EnvPath (Join-Path $ScriptDir "../.env")

# Derive model if absent
if (-not $Model) {
  if ($env:AZURE_OPENAI_DEPLOYMENT) { $Model = $env:AZURE_OPENAI_DEPLOYMENT } else { $Model = "stub-model" }
}

# MCP server reachability check (http mode only)
if ($MCPMode -eq 'http' -and $MCPEndpoint) {
  try {
    $mcpHealth = "$($MCPEndpoint.TrimEnd('/'))/health"
    $resp = Invoke-WebRequest -Uri $mcpHealth -Method Head -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "MCP server reachable: $MCPEndpoint (HTTP $($resp.StatusCode))" -ForegroundColor Cyan
  } catch {
    Write-Warning "MCP server unreachable at $MCPEndpoint"
    Write-Warning "Error: $($_.Exception.Message)"
    $canPrompt = ($Host.UI.SupportsVirtualTerminal -and ($env:CI -ne 'true'))
    if ($canPrompt) {
      $ans = Read-Host "Continue without confirmed MCP availability? (y/N)"
      if ($ans -notin @('y','Y','yes','YES')) {
        Write-Error "Aborted by user (MCP server unreachable)."
        exit 10
      }
      Write-Host "Proceeding with unreachable MCP server..." -ForegroundColor Yellow
    } else {
      Write-Error "Non-interactive or CI environment; aborting due to unreachable MCP server."
      exit 10
    }
  }
}

$Python = "python"
$ArgsList = @(
  "eval/pipeline/run_judge_over_dataset.py",
  "--run-root", $RunRoot,
  "--mcp-mode", $MCPMode,
  "--model", $Model
)
if ($MCPEndpoint)  { $ArgsList += @("--mcp-endpoint", $MCPEndpoint) }
if ($Limit)        { $ArgsList += @("--limit", $Limit) }
if ($Filter)       { $ArgsList += @("--filter", $Filter) }
if ($IdPrefix)     { $ArgsList += @("--id-prefix", $IdPrefix) }
if ($SkipExisting) { $ArgsList += @("--skip-existing") }

Write-Host "----------------------------------------------" -ForegroundColor DarkGray
Write-Host "Multi-record Evaluation Run" -ForegroundColor Green
Write-Host " .env Loaded : $envLoaded"
Write-Host " DatasetPath : (hard-coded in load_dataset.py)"
Write-Host " RunRoot     : $RunRoot"
Write-Host " MCPMode     : $MCPMode"
if ($MCPEndpoint) { Write-Host " MCP Endpoint: $MCPEndpoint" }
Write-Host " Model       : $Model"
if ($Limit)    { Write-Host " Limit       : $Limit" }
if ($Filter)   { Write-Host " Filter      : $Filter" }
if ($IdPrefix) { Write-Host " IdPrefix    : $IdPrefix" }
if ($SkipExisting) { Write-Host " SkipExisting: True" }
if ($env:AZURE_OPENAI_ENDPOINT) { Write-Host " Azure OpenAI Endpoint: $($env:AZURE_OPENAI_ENDPOINT)" } else { Write-Host " Azure OpenAI Endpoint: (not set)" }
Write-Host "----------------------------------------------" -ForegroundColor DarkGray

# Change to parent directory (repo root) to run the Python script
Push-Location (Join-Path $ScriptDir "..")
try {
  & $Python @ArgsList
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($exitCode -ne 0) {
  Write-Error "Evaluation failed (exit $exitCode)"
  exit $exitCode
}
Write-Host "Run complete." -ForegroundColor Green
