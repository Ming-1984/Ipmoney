[CmdletBinding()]
param(
  [string]$Service = "postgres",
  [string]$DbUser = "ipmoney",
  [string]$DbName = "ipmoney",
  [Parameter(Mandatory = $true)][string]$InFile,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not $Force) {
  throw "Refusing to restore without -Force (this will overwrite data)."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not (Test-Path $InFile)) {
  throw "Backup file not found: $InFile"
}

$inAbs = (Resolve-Path $InFile).Path

$restoreArgs = @(
  "compose", "exec", "-T", $Service,
  "psql",
  "-U", $DbUser,
  "-d", $DbName,
  "-v", "ON_ERROR_STOP=1"
)

# Use cmd redirection to feed the SQL as raw bytes (avoid PowerShell encoding transforms).
$restoreCmd = "docker " + ($restoreArgs -join " ") + " < `"$inAbs`""
cmd /c $restoreCmd | Out-Null
if ($LASTEXITCODE -ne 0) { throw "db-restore failed: $restoreCmd" }

Write-Host ("[db-restore] restored from: " + $inAbs)

