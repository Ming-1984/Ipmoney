[CmdletBinding()]
param(
  [string]$CliPath = "",
  [string]$ProjectPath = "apps/client",
  [string]$OutFile = "",
  [string]$ReportDate = "",
  [int]$WaitMs = 2000,
  [int]$TimeoutMs = 120000,
  [int]$LaunchRetries = 3,
  [int]$LaunchRetryDelayMs = 4000,
  [string]$Scenario = "happy",
  [string]$UserToken = "",
  [switch]$NoAuth,
  [switch]$KillStaleDevtools
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
}

if ([string]::IsNullOrWhiteSpace($OutFile)) {
  $OutFile = (Join-Path $repoRoot ".tmp/weapp-route-smoke-$ReportDate.json")
}

if ([string]::IsNullOrWhiteSpace($UserToken)) {
  $UserToken = $env:DEMO_USER_TOKEN
}

$args = @(
  "scripts/weapp-route-smoke.js",
  "--project-path", $ProjectPath,
  "--out-file", $OutFile,
  "--wait-ms", "$WaitMs",
  "--timeout-ms", "$TimeoutMs",
  "--launch-retries", "$LaunchRetries",
  "--launch-retry-delay-ms", "$LaunchRetryDelayMs",
  "--scenario", $Scenario
)

if (-not [string]::IsNullOrWhiteSpace($CliPath)) {
  $args += @("--cli-path", $CliPath)
}

if ($NoAuth) {
  $args += @("--no-auth")
} elseif (-not [string]::IsNullOrWhiteSpace($UserToken)) {
  $args += @("--user-token", $UserToken)
}

if ($KillStaleDevtools) {
  $args += @("--kill-stale-devtools")
}

Write-Host "[weapp-route-smoke] outFile: $OutFile"
& node @args
if ($LASTEXITCODE -ne 0) {
  throw "weapp-route-smoke failed (exit=$LASTEXITCODE). See: $OutFile"
}
