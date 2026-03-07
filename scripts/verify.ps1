[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://staging-api.example.com",
  [int]$ApiPort = 3200,
  [string]$ReportDate = "",
  [string]$ChaosHistoryPath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
}

$tmpDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $tmpDir | Out-Null
if ([string]::IsNullOrWhiteSpace($ChaosHistoryPath)) {
  $ChaosHistoryPath = Join-Path $tmpDir "api-real-smoke-chaos-history.json"
}

function Test-PortAvailable([int]$Port) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    $listener.Stop()
    return $true
  } catch {
    return $false
  }
}

function Get-RandomAvailablePort() {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  try {
    $listener.Start()
    return [int]$listener.LocalEndpoint.Port
  } finally {
    $listener.Stop()
  }
}

function Resolve-ApiPort([int]$PreferredPort, [int]$MaxOffset = 200, [int]$RandomRetries = 10) {
  if (Test-PortAvailable -Port $PreferredPort) {
    return [pscustomobject]@{
      Port = $PreferredPort
      Mode = "preferred"
    }
  }

  for ($i = 1; $i -le $MaxOffset; $i++) {
    $candidate = $PreferredPort + $i
    if (Test-PortAvailable -Port $candidate) {
      return [pscustomobject]@{
        Port = $candidate
        Mode = "range-fallback"
      }
    }
  }

  for ($attempt = 1; $attempt -le $RandomRetries; $attempt++) {
    $candidate = Get-RandomAvailablePort
    if (Test-PortAvailable -Port $candidate) {
      return [pscustomobject]@{
        Port = $candidate
        Mode = "random-fallback"
      }
    }
  }

  throw "No available API port found in range [$PreferredPort, $($PreferredPort + $MaxOffset)] and random fallback retries exhausted"
}

function Invoke-Step(
  [string]$name,
  [scriptblock]$block,
  [int]$MaxAttempts = 1,
  [int[]]$RetryExitCodes = @()
) {
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    Write-Host ""
    Write-Host ("[verify] {0}" -f $name)
    if ($MaxAttempts -gt 1) {
      Write-Host ("[verify] attempt {0}/{1}" -f $attempt, $MaxAttempts)
    }

    & $block
    if ($LASTEXITCODE -eq 0) {
      return
    }

    $exitCode = [int]$LASTEXITCODE
    $canRetry = $attempt -lt $MaxAttempts -and ($RetryExitCodes.Count -eq 0 -or $RetryExitCodes -contains $exitCode)
    if ($canRetry) {
      Write-Host ("[verify] step failed with retryable exit={0}, retrying..." -f $exitCode)
      Start-Sleep -Seconds 3
      continue
    }

    throw "Step failed: $name (exit=$exitCode)"
  }
}

function Ensure-NodeHeap([int]$MinMb = 4096) {
  $current = [string]$env:NODE_OPTIONS
  if ($current -match "(^|\\s)--max-old-space-size(=|\\s)") {
    return
  }

  $heapArg = "--max-old-space-size=$MinMb"
  if ([string]::IsNullOrWhiteSpace($current)) {
    $env:NODE_OPTIONS = $heapArg
  } else {
    $env:NODE_OPTIONS = "$current $heapArg"
  }
  Write-Host ("[verify] NODE_OPTIONS appended for build stability: {0}" -f $heapArg)
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
Ensure-NodeHeap -MinMb 4096

Invoke-Step "api:build" { pnpm -C apps/api build }
Invoke-Step "admin-web:build" { pnpm -C apps/admin-web build }
Invoke-Step "client:build:h5" { pnpm -C apps/client build:h5 } -MaxAttempts 2 -RetryExitCodes @(134, -1073740791)
Invoke-Step "client:build:weapp" { pnpm -C apps/client build:weapp }
Invoke-Step "check:weapp-budget" { pnpm check:weapp-budget }

# Smoke / preflight checks (require docker compose infra running).
$portResolution = Resolve-ApiPort -PreferredPort $ApiPort
$resolvedApiPort = [int]$portResolution.Port

if ($portResolution.Mode -eq "range-fallback") {
  Write-Host ("[verify] api port {0} is unavailable, fallback to nearby port {1}" -f $ApiPort, $resolvedApiPort)
}
if ($portResolution.Mode -eq "random-fallback") {
  Write-Host ("[verify] api port range [{0}, {1}] unavailable, fallback to random port {2}" -f $ApiPort, ($ApiPort + 200), $resolvedApiPort)
}
Invoke-Step "api-real-smoke" { powershell -ExecutionPolicy Bypass -File scripts/api-real-smoke.ps1 -ApiPort $resolvedApiPort -ReportDate $ReportDate -ChaosHistoryPath $ChaosHistoryPath }
Invoke-Step "api-smoke-openapi-coverage" { node scripts/check-api-smoke-openapi-coverage.mjs --report-date $ReportDate }
if (Test-Path $ChaosHistoryPath) {
  $chaosHistorySnapshotPath = Join-Path $tmpDir "api-real-smoke-chaos-history-$ReportDate.json"
  Copy-Item -Path $ChaosHistoryPath -Destination $chaosHistorySnapshotPath -Force
  Write-Host ("[verify] chaos history snapshot: {0}" -f $chaosHistorySnapshotPath)
}
Invoke-Step "db-preflight-check" { powershell -ExecutionPolicy Bypass -File scripts/db-preflight-check.ps1 -ReportDate $ReportDate }
Invoke-Step "ui-http-smoke" { powershell -ExecutionPolicy Bypass -File scripts/ui-http-smoke.ps1 -ReportDate $ReportDate }
Invoke-Step "ui-render-smoke(core)" { powershell -ExecutionPolicy Bypass -File scripts/ui-render-smoke.ps1 -Mode core -ReportDate $ReportDate }
Invoke-Step "ui-dom-smoke(core)" { powershell -ExecutionPolicy Bypass -File scripts/ui-dom-smoke.ps1 -Mode core -ReportDate $ReportDate }

Write-Host ""
Write-Host ("[verify] OK (ReportDate={0})" -f $ReportDate)
