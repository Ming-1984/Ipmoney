[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://staging-api.example.com",
  [int]$ApiPort = 3200,
  [string]$ReportDate = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
}

function Invoke-Step([string]$name, [scriptblock]$block) {
  Write-Host ""
  Write-Host ("[verify] {0}" -f $name)
  & $block
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $name (exit=$LASTEXITCODE)"
  }
}

Invoke-Step "openapi:lint" { pnpm openapi:lint }
Invoke-Step "lint" { pnpm lint }
Invoke-Step "typecheck" { pnpm typecheck }

Invoke-Step "audit-openapi-backend" { node scripts/audit-openapi-backend.mjs }
Invoke-Step "audit-coverage" { node scripts/audit-coverage.mjs }
Invoke-Step "scan:banned-words" { pnpm scan:banned-words }

# Build artifacts (use a non-local API base so production guards won't trip in CI).
$env:VITE_API_BASE_URL = $ApiBaseUrl
$env:TARO_APP_API_BASE_URL = $ApiBaseUrl

Invoke-Step "api:build" { pnpm -C apps/api build }
Invoke-Step "admin-web:build" { pnpm -C apps/admin-web build }
Invoke-Step "client:build:h5" { pnpm -C apps/client build:h5 }
Invoke-Step "client:build:weapp" { pnpm -C apps/client build:weapp }

# Smoke / preflight checks (require docker compose infra running).
Invoke-Step "api-real-smoke" { powershell -ExecutionPolicy Bypass -File scripts/api-real-smoke.ps1 -ApiPort $ApiPort -ReportDate $ReportDate }
Invoke-Step "db-preflight-check" { powershell -ExecutionPolicy Bypass -File scripts/db-preflight-check.ps1 -ReportDate $ReportDate }
Invoke-Step "ui-http-smoke" { powershell -ExecutionPolicy Bypass -File scripts/ui-http-smoke.ps1 -ReportDate $ReportDate }
Invoke-Step "ui-render-smoke(core)" { powershell -ExecutionPolicy Bypass -File scripts/ui-render-smoke.ps1 -Mode core -ReportDate $ReportDate }

Write-Host ""
Write-Host ("[verify] OK (ReportDate={0})" -f $ReportDate)

