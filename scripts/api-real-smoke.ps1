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

function Stop-Port([int]$Port) {
  try {
    $conns = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    foreach ($pid in ($conns.OwningProcess | Sort-Object -Unique)) {
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  } catch { }
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

$env:PORT = "$ApiPort"
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
if ([string]::IsNullOrWhiteSpace($env:DEMO_AUTH_ALLOW_UUID_TOKENS)) {
  $env:DEMO_AUTH_ALLOW_UUID_TOKENS = "true"
}
$env:UPLOAD_DIR = (Join-Path $repoRoot ".tmp/uploads")
New-Item -ItemType Directory -Force $env:UPLOAD_DIR | Out-Null

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null
$stdoutPath = Join-Path $logDir "api-real-smoke.out.log"
$stderrPath = Join-Path $logDir "api-real-smoke.err.log"
$resultsPath = Join-Path $logDir "api-real-smoke-$ReportDate.json"
$summaryPath = Join-Path $logDir "api-real-smoke-$ReportDate-summary.json"

Stop-Port $ApiPort
$proc = Start-Process -FilePath "node" -ArgumentList @("apps/api/dist/main.js") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

try {
  Wait-Health -Url "http://127.0.0.1:$ApiPort/health" -TimeoutSec 45

  $wechatLogin = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$ApiPort/auth/wechat/mp-login" -Body (@{ code = "demo-code" } | ConvertTo-Json -Compress) -ContentType "application/json"
  $userToken = "Bearer $($wechatLogin.accessToken)"
  $adminToken = "Bearer $($env:DEMO_ADMIN_TOKEN)"

  $cases = @(
    @{ name = "health"; method = "GET"; url = "http://127.0.0.1:$ApiPort/health"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "auth-sms-send"; method = "POST"; url = "http://127.0.0.1:$ApiPort/auth/sms/send"; body = @{ phone = "13800138000" }; headers = @{}; expected = @(200, 201) },
    @{ name = "auth-sms-verify"; method = "POST"; url = "http://127.0.0.1:$ApiPort/auth/sms/verify"; body = @{ phone = "13800138000"; code = "123456" }; headers = @{}; expected = @(200, 201) },
    @{ name = "me"; method = "GET"; url = "http://127.0.0.1:$ApiPort/me"; body = $null; headers = @{ Authorization = $userToken }; expected = @(200) },
    @{ name = "orders-user"; method = "GET"; url = "http://127.0.0.1:$ApiPort/orders"; body = $null; headers = @{ Authorization = $userToken }; expected = @(200) },
    @{ name = "admin-listings"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/listings"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-demands"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/demands"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-achievements"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/achievements"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-artworks"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/artworks"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-user-verifications"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/user-verifications"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-audit-logs"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/audit-logs"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-rbac-roles"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/rbac/roles"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-rbac-permissions"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/rbac/permissions"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-report-summary"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/reports/finance/summary"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-patents"; method = "GET"; url = "http://127.0.0.1:$ApiPort/admin/patents"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "patent-map-summary"; method = "GET"; url = "http://127.0.0.1:$ApiPort/patent-map/summary?year=2025&level=PROVINCE"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-listings"; method = "GET"; url = "http://127.0.0.1:$ApiPort/search/listings"; body = $null; headers = @{}; expected = @(200) }
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
  Stop-Port $ApiPort
}
