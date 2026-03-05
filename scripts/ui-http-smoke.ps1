[CmdletBinding()]
param(
  [int]$MockPort = 4010,
  [int]$PrismPort = 4011,
  [int]$ClientPort = 5173,
  [int]$AdminPort = 5174,
  [string]$ReportDate = "",
  [int]$WaitMockSec = 240,
  [int]$WaitClientSec = 420,
  [int]$WaitAdminSec = 240
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
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

function Find-AvailablePort(
  [int]$PreferredPort,
  [int[]]$ReservedPorts = @(),
  [int]$MaxOffset = 200,
  [int]$RandomRetries = 10
) {
  if (($ReservedPorts -notcontains $PreferredPort) -and (Test-PortAvailable -Port $PreferredPort)) {
    return $PreferredPort
  }

  for ($i = 1; $i -le $MaxOffset; $i++) {
    $candidate = $PreferredPort + $i
    if (($ReservedPorts -contains $candidate)) { continue }
    if (Test-PortAvailable -Port $candidate) { return $candidate }
  }

  for ($attempt = 1; $attempt -le $RandomRetries; $attempt++) {
    $candidate = Get-RandomAvailablePort
    if (($ReservedPorts -contains $candidate)) { continue }
    if (Test-PortAvailable -Port $candidate) { return $candidate }
  }

  throw "No available port found for preferred port $PreferredPort"
}

function Get-HttpStatus([string]$Url, [hashtable]$Headers) {
  $args = @("-s", "-o", "NUL", "-w", "%{http_code}")
  if ($Headers) {
    foreach ($k in $Headers.Keys) {
      $args += @("-H", "${k}: $($Headers[$k])")
    }
  }
  $args += $Url

  $status = & curl.exe @args
  if ($LASTEXITCODE -ne 0) { return 0 }
  $parsed = 0
  [int]::TryParse($status, [ref]$parsed) | Out-Null
  return $parsed
}

function Wait-Status([string]$Url, [int]$TimeoutSec, [hashtable]$Headers) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $s = Get-HttpStatus -Url $Url -Headers $Headers
    if ($s -ge 200 -and $s -lt 500) { return $s }
    Start-Sleep -Milliseconds 500
  }
  throw "timeout waiting for $Url"
}

$reservedPorts = @()
$resolvedMockPort = Find-AvailablePort -PreferredPort $MockPort -ReservedPorts $reservedPorts
$reservedPorts += $resolvedMockPort
$resolvedPrismPort = Find-AvailablePort -PreferredPort $PrismPort -ReservedPorts $reservedPorts
$reservedPorts += $resolvedPrismPort
$resolvedClientPort = Find-AvailablePort -PreferredPort $ClientPort -ReservedPorts $reservedPorts
$reservedPorts += $resolvedClientPort
$resolvedAdminPort = Find-AvailablePort -PreferredPort $AdminPort -ReservedPorts $reservedPorts
$reservedPorts += $resolvedAdminPort

if ($resolvedMockPort -ne $MockPort) { Write-Host ("[ui-http-smoke] mock port fallback: {0} -> {1}" -f $MockPort, $resolvedMockPort) }
if ($resolvedPrismPort -ne $PrismPort) { Write-Host ("[ui-http-smoke] prism port fallback: {0} -> {1}" -f $PrismPort, $resolvedPrismPort) }
if ($resolvedClientPort -ne $ClientPort) { Write-Host ("[ui-http-smoke] client port fallback: {0} -> {1}" -f $ClientPort, $resolvedClientPort) }
if ($resolvedAdminPort -ne $AdminPort) { Write-Host ("[ui-http-smoke] admin port fallback: {0} -> {1}" -f $AdminPort, $resolvedAdminPort) }

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null

$mockOut = Join-Path $logDir "ui-http-mock.out.log"
$mockErr = Join-Path $logDir "ui-http-mock.err.log"
$clientOut = Join-Path $logDir "ui-http-client.out.log"
$clientErr = Join-Path $logDir "ui-http-client.err.log"
$adminOut = Join-Path $logDir "ui-http-admin.out.log"
$adminErr = Join-Path $logDir "ui-http-admin.err.log"

$mockCmd = "`$env:MOCK_API_PORT='$resolvedMockPort'; `$env:MOCK_API_PRISM_PORT='$resolvedPrismPort'; pnpm mock"
$clientCmd = "`$env:TARO_APP_API_BASE_URL='http://127.0.0.1:$resolvedMockPort'; `$env:CLIENT_H5_PORT='$resolvedClientPort'; `$env:TARO_APP_ENABLE_MOCK_TOOLS='0'; pnpm -C apps/client dev:h5"
$adminCmd = "`$env:VITE_API_BASE_URL='http://127.0.0.1:$resolvedMockPort'; `$env:ADMIN_WEB_PORT='$resolvedAdminPort'; `$env:VITE_ENABLE_MOCK_TOOLS='0'; pnpm -C apps/admin-web dev"

$mockProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $mockCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $mockOut -RedirectStandardError $mockErr
$clientProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $clientCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $clientOut -RedirectStandardError $clientErr
$adminProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $adminCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $adminOut -RedirectStandardError $adminErr

try {
  Wait-Status -Url "http://127.0.0.1:$resolvedMockPort/health" -TimeoutSec $WaitMockSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$resolvedClientPort" -TimeoutSec $WaitClientSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$resolvedAdminPort" -TimeoutSec $WaitAdminSec -Headers @{} | Out-Null

  $checks = @(
    @{ name = "mock-health"; url = "http://127.0.0.1:$resolvedMockPort/health"; headers = @{ "X-Mock-Scenario" = "happy" } },
    @{ name = "mock-orders"; url = "http://127.0.0.1:$resolvedMockPort/orders"; headers = @{ "X-Mock-Scenario" = "happy" } },
    @{ name = "client-root"; url = "http://127.0.0.1:$resolvedClientPort/"; headers = @{} },
    @{ name = "admin-root"; url = "http://127.0.0.1:$resolvedAdminPort/"; headers = @{} },
    @{ name = "admin-login"; url = "http://127.0.0.1:$resolvedAdminPort/login"; headers = @{} },
    @{ name = "admin-orders"; url = "http://127.0.0.1:$resolvedAdminPort/orders"; headers = @{} },
    @{ name = "admin-verifications"; url = "http://127.0.0.1:$resolvedAdminPort/verifications"; headers = @{} },
    @{ name = "admin-config"; url = "http://127.0.0.1:$resolvedAdminPort/config"; headers = @{} },
    @{ name = "admin-patent-map"; url = "http://127.0.0.1:$resolvedAdminPort/patent-map"; headers = @{} }
  )

  $results = @()
  foreach ($c in $checks) {
    $status = Get-HttpStatus -Url $c.url -Headers $c.headers
    $pass = ($status -ge 200 -and $status -lt 400)
    $results += [pscustomobject]@{ name = $c.name; url = $c.url; status = $status; pass = $pass }
  }

  $summary = [pscustomobject]@{
    total  = $results.Count
    passed = ($results | Where-Object { $_.pass }).Count
    failed = ($results | Where-Object { -not $_.pass }).Count
  }

  $resultPath = Join-Path $logDir "ui-http-smoke-$ReportDate.json"
  $summaryPath = Join-Path $logDir "ui-http-smoke-$ReportDate-summary.json"
  $results | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $resultPath
  $summary | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $summaryPath

  if ($summary.failed -gt 0) { throw "ui-http-smoke failed: $($summary.failed)" }
} finally {
  foreach ($proc in @($mockProc, $clientProc, $adminProc)) {
    if ($proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
