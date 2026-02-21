[CmdletBinding()]
param(
  [string]$Service = "postgres",
  [string]$DbUser = "ipmoney",
  [string]$DbName = "ipmoney",
  [string]$OutFile = "",
  [switch]$Clean,
  [string]$ReportDate = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
}

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null

if ([string]::IsNullOrWhiteSpace($OutFile)) {
  $stamp = (Get-Date).ToString("HHmmss")
  $OutFile = Join-Path $logDir "db-backup-$ReportDate-$stamp.sql"
}

$outAbs = (Resolve-Path (Split-Path -Parent $OutFile) -ErrorAction SilentlyContinue)
if ($null -eq $outAbs) {
  New-Item -ItemType Directory -Force (Split-Path -Parent $OutFile) | Out-Null
}

$dumpArgs = @(
  "compose", "exec", "-T", $Service,
  "pg_dump",
  "-U", $DbUser,
  "-d", $DbName,
  "--no-owner",
  "--no-privileges"
)
if ($Clean) {
  $dumpArgs += @("--clean", "--if-exists")
}

# Use cmd redirection to avoid PowerShell adding BOM/encoding transforms to the SQL dump.
$dumpCmd = "docker " + ($dumpArgs -join " ") + " > `"$OutFile`""
cmd /c $dumpCmd | Out-Null
if ($LASTEXITCODE -ne 0) { throw "db-backup failed: $dumpCmd" }

Write-Host ("[db-backup] wrote: " + $OutFile)

