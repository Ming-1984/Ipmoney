param(
  [switch]$DryRun
)

$repoRoot = Split-Path -Parent $PSScriptRoot

$targets = @(
  "apps\\client\\.temp",
  "apps\\client\\dist",
  "apps\\client\\node_modules\\.cache",
  "node_modules\\.cache"
)

foreach ($rel in $targets) {
  $path = Join-Path $repoRoot $rel
  if (Test-Path $path) {
    if ($DryRun) {
      Write-Host "[dry-run] would remove $path"
    } else {
      Write-Host "removing $path"
      Remove-Item -Recurse -Force -ErrorAction Stop $path
    }
  } else {
    Write-Host "skip (not found) $path"
  }
}

Write-Host "done"
