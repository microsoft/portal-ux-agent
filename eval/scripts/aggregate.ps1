param(
  [string]$RunDir = (Resolve-Path (Join-Path $PSScriptRoot '..\runs')).Path
)

if (-not (Test-Path $RunDir)) { throw "Run directory not found: $RunDir" }

$latest = Get-ChildItem -Path $RunDir | Sort-Object Name -Descending | Select-Object -First 1
if (-not $latest) { throw 'No runs found.' }

$scoresFile = Join-Path $latest.FullName 'scores.json'
if (-not (Test-Path $scoresFile)) { throw "scores.json not found in $($latest.FullName)" }

$scores = (Get-Content -Path $scoresFile -Raw | ConvertFrom-Json)
$dims = 'correctness','uiFidelity','compositionality','resilience','clarity'
$agg = [ordered]@{}
foreach ($d in $dims) {
  $vals = @(); foreach ($s in $scores) { $vals += [double]$s.dimensionScores.$d }
  $agg[$d] = [Math]::Round(($vals | Measure-Object -Average).Average,2)
}
$overallVals = @($scores | ForEach-Object { [double]$_.overall })
$agg['overallMean'] = [Math]::Round(($overallVals | Measure-Object -Average).Average,2)

Write-Host "=== Aggregated Results (Latest Run: $($latest.Name)) ===" -ForegroundColor Cyan
$agg.GetEnumerator() | ForEach-Object { "{0}: {1}" -f $_.Key, $_.Value }
