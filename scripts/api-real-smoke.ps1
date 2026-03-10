[CmdletBinding()]
param(
  [int]$ApiPort = 3000,
  [string]$DatabaseUrl = "",
  [string]$RedisUrl = "",
  [string]$ReportDate = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Read-EnvFile([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  $lines = Get-Content -Path $Path -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    $trim = $line.Trim()
    if ($trim -eq "" -or $trim.StartsWith("#")) { continue }
    $parts = $trim.Split("=", 2)
    if ($parts.Length -lt 2) { continue }
    $key = $parts[0].Trim()
    $val = $parts[1].Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

function Apply-EnvMap([hashtable]$Map) {
  foreach ($key in $Map.Keys) {
    $current = (Get-Item -Path "Env:$key" -ErrorAction SilentlyContinue).Value
    if ([string]::IsNullOrWhiteSpace($current)) {
      Set-Item -Path "Env:$key" -Value $Map[$key]
    }
  }
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

  throw "No available API port found for api-real-smoke"
}

Apply-EnvMap -Map (Read-EnvFile (Join-Path $repoRoot ".env"))

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $DatabaseUrl = $env:DATABASE_URL
}
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $DatabaseUrl = "postgresql://ipmoney:ipmoney@127.0.0.1:5432/ipmoney"
}
if ([string]::IsNullOrWhiteSpace($RedisUrl)) {
  $RedisUrl = $env:REDIS_URL
}
if ([string]::IsNullOrWhiteSpace($RedisUrl)) {
  $RedisUrl = "redis://127.0.0.1:6379"
}

function Wait-Health([string]$Url, [int]$TimeoutSec = 45) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $status = & curl.exe -s -o NUL -w "%{http_code}" $Url
      if ($status -eq "200") { return }
    } catch { }
    Start-Sleep -Milliseconds 400
  }
  throw "api not ready: $Url"
}

function Invoke-ApiCase {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [hashtable]$Headers,
    [int[]]$Expected
  )

  $h = @{}
  if ($Headers) {
    foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
  }

  try {
    if ($null -ne $Body) {
      $json = $Body | ConvertTo-Json -Depth 10 -Compress
      $h["Content-Type"] = "application/json"
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $h -Body $json -UseBasicParsing
    } else {
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $h -UseBasicParsing
    }
    $status = [int]$resp.StatusCode
    $raw = $resp.Content
  } catch {
    $status = [int]$_.Exception.Response.StatusCode.value__
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $raw = $reader.ReadToEnd()
      $reader.Close()
    } catch {
      $raw = ""
    }
  }

  return [pscustomobject]@{
    name = $Name
    method = $Method
    url = $Url
    status = $status
    expected = ($Expected -join "/")
    ok = ($Expected -contains $status)
    body = $raw
  }
}

$portResolution = Resolve-ApiPort -PreferredPort $ApiPort
$resolvedApiPort = [int]$portResolution.Port
if ($portResolution.Mode -eq "range-fallback") {
  Write-Host ("[api-real-smoke] api port {0} unavailable, fallback to nearby port {1}" -f $ApiPort, $resolvedApiPort)
}
if ($portResolution.Mode -eq "random-fallback") {
  Write-Host ("[api-real-smoke] api port range [{0}, {1}] unavailable, fallback to random port {2}" -f $ApiPort, ($ApiPort + 200), $resolvedApiPort)
}

$env:PORT = "$resolvedApiPort"
$env:DATABASE_URL = $DatabaseUrl
$env:REDIS_URL = $RedisUrl
$env:DEMO_AUTH_ENABLED = "true"
$env:DEMO_PAYMENT_ENABLED = "true"
if ([string]::IsNullOrWhiteSpace($env:DEMO_ADMIN_TOKEN)) {
  $env:DEMO_ADMIN_TOKEN = "demo-admin-$([guid]::NewGuid().ToString('N'))"
}
if ([string]::IsNullOrWhiteSpace($env:DEMO_USER_TOKEN)) {
  $env:DEMO_USER_TOKEN = "demo-user-$([guid]::NewGuid().ToString('N'))"
}
if ([string]::IsNullOrWhiteSpace($env:DEMO_ADMIN_ID)) {
  $env:DEMO_ADMIN_ID = [guid]::NewGuid().ToString()
}
if ([string]::IsNullOrWhiteSpace($env:DEMO_USER_ID)) {
  $env:DEMO_USER_ID = [guid]::NewGuid().ToString()
}
# Smoke tests should not rely on UUID passthrough tokens; keep it off explicitly.
$env:DEMO_AUTH_ALLOW_UUID_TOKENS = "false"
$env:UPLOAD_DIR = (Join-Path $repoRoot ".tmp/uploads")
New-Item -ItemType Directory -Force $env:UPLOAD_DIR | Out-Null

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null
$stdoutPath = Join-Path $logDir "api-real-smoke.out.log"
$stderrPath = Join-Path $logDir "api-real-smoke.err.log"
$resultsPath = Join-Path $logDir "api-real-smoke-$ReportDate.json"
$summaryPath = Join-Path $logDir "api-real-smoke-$ReportDate-summary.json"

$proc = Start-Process -FilePath "node" -ArgumentList @("apps/api/dist/main.js") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

try {
  Wait-Health -Url "http://127.0.0.1:$resolvedApiPort/health" -TimeoutSec 45

  $wechatLogin = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$resolvedApiPort/auth/wechat/mp-login" -Body (@{ code = "demo-code" } | ConvertTo-Json -Compress) -ContentType "application/json"
  $userToken = "Bearer $($wechatLogin.accessToken)"
  $adminToken = "Bearer $($env:DEMO_ADMIN_TOKEN)"

  $cases = @(
    @{ name = "health"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/health"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "auth-sms-send"; method = "POST"; url = "http://127.0.0.1:$resolvedApiPort/auth/sms/send"; body = @{ phone = "13800138000" }; headers = @{}; expected = @(200, 201) },
    @{ name = "auth-sms-verify"; method = "POST"; url = "http://127.0.0.1:$resolvedApiPort/auth/sms/verify"; body = @{ phone = "13800138000"; code = "123456" }; headers = @{}; expected = @(200, 201) },
    @{ name = "me"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/me"; body = $null; headers = @{ Authorization = $userToken }; expected = @(200) },
    @{ name = "orders-user"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/orders"; body = $null; headers = @{ Authorization = $userToken }; expected = @(200) },
    @{ name = "admin-listings"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/listings"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-demands"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/demands"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-achievements"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/achievements"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-artworks"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/artworks"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-user-verifications"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/user-verifications"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-audit-logs"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/audit-logs"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-rbac-roles"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-rbac-permissions"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/rbac/permissions"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-report-summary"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/reports/finance/summary"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-patents"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/patents"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "patent-map-summary"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/patent-map/summary?year=2025&level=PROVINCE"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-listings"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/listings"; body = $null; headers = @{}; expected = @(200) }
  )

  $results = @()
  foreach ($c in $cases) {
    $results += Invoke-ApiCase -Name $c.name -Method $c.method -Url $c.url -Body $c.body -Headers $c.headers -Expected $c.expected
  }

  $failedCount = [int](($results | Where-Object { -not $_.ok }).Count)
  $summary = [pscustomobject]@{
    total = $results.Count
    passed = [int](($results | Where-Object { $_.ok }).Count)
    failed = $failedCount
  }

  $results | ConvertTo-Json -Depth 8 | Out-File -Encoding UTF8 $resultsPath
  $summary | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $summaryPath

  if ($failedCount -gt 0) {
    $failed = $results | Where-Object { -not $_.ok } | Select-Object name, status, expected, url
    $failed | Format-Table -AutoSize | Out-Host
    throw "api-real-smoke failed: $failedCount"
  }

  Write-Host ($summary | ConvertTo-Json -Compress)
} finally {
  if ($proc -and -not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
}
