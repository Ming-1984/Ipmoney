[CmdletBinding()]
param(
  [switch]$SplitWindows,
  [switch]$OpenApiPreview,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not $SkipInstall -and -not (Test-Path (Join-Path $repoRoot "node_modules"))) {
  Write-Host "[demo] installing dependencies..."
  pnpm install
}

if (-not $env:TARO_APP_API_BASE_URL) { $env:TARO_APP_API_BASE_URL = "http://127.0.0.1:4010" }
if (-not $env:VITE_API_BASE_URL) { $env:VITE_API_BASE_URL = "http://127.0.0.1:4010" }

$psExe = (Get-Command powershell).Source

if ($OpenApiPreview) {
  Start-Process $psExe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd `"$repoRoot`"; pnpm openapi:preview"
  ) | Out-Null
}

if ($SplitWindows) {
  Start-Process $psExe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd `"$repoRoot`"; pnpm mock"
  ) | Out-Null

  Start-Process $psExe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd `"$repoRoot`"; pnpm -C apps/client dev:h5"
  ) | Out-Null

  Start-Process $psExe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd `"$repoRoot`"; pnpm -C apps/admin-web dev"
  ) | Out-Null

  Write-Host "[demo] started:"
  Write-Host "  - Mock API:   http://127.0.0.1:4010"
  Write-Host "  - Client H5:  http://127.0.0.1:5173"
  Write-Host "  - Admin Web:  http://127.0.0.1:5174"
  if ($OpenApiPreview) { Write-Host "  - OpenAPI:    http://127.0.0.1:8080" }
  return
}

Write-Host "[demo] starting (turbo parallel dev)..."
Write-Host "  - Mock API:   http://127.0.0.1:4010"
Write-Host "  - Client H5:  http://127.0.0.1:5173"
Write-Host "  - Admin Web:  http://127.0.0.1:5174"
if ($OpenApiPreview) { Write-Host "  - OpenAPI:    http://127.0.0.1:8080" }

pnpm dev

