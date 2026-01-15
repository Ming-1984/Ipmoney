[CmdletBinding()]
param(
  [switch]$SplitWindows,
  [switch]$OpenApiPreview,
  [switch]$EnableMockTools,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Get-ProcessCommandLine([int]$ProcessId) {
  try {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
    return $p.CommandLine
  } catch {
    return $null
  }
}

function Try-StopRepoNodeOnPort([int]$Port) {
  $getNetTcp = (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)
  if ($null -eq $getNetTcp) { return $false }

  $connections = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($connections.Count -eq 0) { return $false }

  $processIds = $connections.OwningProcess | Sort-Object -Unique
  foreach ($processId in $processIds) {
    try {
      $proc = Get-Process -Id $processId -ErrorAction Stop
      if ($proc.ProcessName -ne "node") { continue }
    } catch {
      continue
    }

    $cmd = Get-ProcessCommandLine -ProcessId $processId
    if ([string]::IsNullOrWhiteSpace($cmd)) { continue }

    $shouldStop = $false
    if ($cmd -like "*$repoRoot*") { $shouldStop = $true }
    if (-not $shouldStop -and $cmd -match "(^|\s)src/server\.js(\s|$)") { $shouldStop = $true }
    if (-not $shouldStop -and $cmd -match "(^|\s)taro(\.cmd)?(\s|$)") { $shouldStop = $true }
    if (-not $shouldStop -and $cmd -match "(^|\s)vite(\s|$)") { $shouldStop = $true }
    if (-not $shouldStop -and $cmd -match "(^|\s)prism(\s|$)") { $shouldStop = $true }
    if (-not $shouldStop) { continue }

    Write-Host "[demo] stopping stale dev process on port $Port (pid $processId)..."
    try { Stop-Process -Id $processId -Force -ErrorAction Stop } catch {}
  }

  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 150
    $after = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if ($after.Count -eq 0) { return $true }
  }
  return $false
}

function Test-LocalPortInUse([int]$Port) {
  $getNetTcp = (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)
  if ($null -ne $getNetTcp) {
    try {
      return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue).Count -gt 0
    } catch {
      return $false
    }
  }

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $wait = $iar.AsyncWaitHandle.WaitOne(200)
    if (-not $wait) {
      $client.Close()
      return $false
    }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Find-FreePort([int]$Preferred, [int]$MaxTries = 50) {
  for ($p = $Preferred; $p -lt ($Preferred + $MaxTries); $p++) {
    if ($p -eq $Preferred -and (Test-LocalPortInUse $p)) {
      $freed = Try-StopRepoNodeOnPort -Port $p
      if ($freed) { return $p }
    }
    if (-not (Test-LocalPortInUse $p)) { return $p }
  }
  throw "No free port found near $Preferred"
}

if (-not $SkipInstall -and -not (Test-Path (Join-Path $repoRoot "node_modules"))) {
  Write-Host "[demo] installing dependencies..."
  pnpm install
}

$mockPort = Find-FreePort 4010
$prismPort = Find-FreePort ($mockPort + 1)
$clientPort = Find-FreePort 5173
$adminPort = Find-FreePort 5174
$openApiPort = Find-FreePort 8080

$env:TARO_APP_API_BASE_URL = "http://127.0.0.1:$mockPort"
$env:VITE_API_BASE_URL = "http://127.0.0.1:$mockPort"
$env:MOCK_API_PORT = "$mockPort"
$env:MOCK_API_PRISM_PORT = "$prismPort"
$env:CLIENT_H5_PORT = "$clientPort"
$env:ADMIN_WEB_PORT = "$adminPort"
$env:TARO_APP_ENABLE_MOCK_TOOLS = if ($EnableMockTools) { "1" } else { "0" }
$env:VITE_ENABLE_MOCK_TOOLS = if ($EnableMockTools) { "1" } else { "0" }

$psExe = (Get-Command powershell).Source

if ($OpenApiPreview) {
  Start-Process $psExe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd `"$repoRoot`"; pnpm exec redocly preview-docs docs/api/openapi.yaml --port $openApiPort"
  ) | Out-Null
}

if ($SplitWindows) {
  Start-Process $psExe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd `"$repoRoot`"; `$env:MOCK_API_PORT='$mockPort'; `$env:MOCK_API_PRISM_PORT='$prismPort'; pnpm mock"
  ) | Out-Null

  Start-Process $psExe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd `"$repoRoot`"; `$env:TARO_APP_API_BASE_URL='http://127.0.0.1:$mockPort'; `$env:CLIENT_H5_PORT='$clientPort'; pnpm -C apps/client dev:h5"
  ) | Out-Null

  Start-Process $psExe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "cd `"$repoRoot`"; `$env:VITE_API_BASE_URL='http://127.0.0.1:$mockPort'; `$env:ADMIN_WEB_PORT='$adminPort'; pnpm -C apps/admin-web dev"
  ) | Out-Null

  Write-Host "[demo] started:"
  Write-Host "  - Mock API:   http://127.0.0.1:$mockPort"
  Write-Host "  - Client H5:  http://127.0.0.1:$clientPort"
  Write-Host "  - Admin Web:  http://127.0.0.1:$adminPort"
  if ($OpenApiPreview) { Write-Host "  - OpenAPI:    http://127.0.0.1:$openApiPort" }
  return
}

Write-Host "[demo] starting (turbo parallel dev)..."
Write-Host "  - Mock API:   http://127.0.0.1:$mockPort (Prism: $prismPort)"
Write-Host "  - Client H5:  http://127.0.0.1:$clientPort"
Write-Host "  - Admin Web:  http://127.0.0.1:$adminPort"
if ($OpenApiPreview) { Write-Host "  - OpenAPI:    http://127.0.0.1:$openApiPort" }

pnpm turbo run dev --no-daemon --parallel --filter=mock-api --filter=client --filter=admin-web
