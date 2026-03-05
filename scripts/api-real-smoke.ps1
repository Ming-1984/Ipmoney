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

function Add-ApiCaseResult {
  param(
    [System.Collections.ArrayList]$Results,
    [string]$Name,
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [hashtable]$Headers,
    [int[]]$Expected
  )

  $result = Invoke-ApiCase -Name $Name -Method $Method -Url $Url -Body $Body -Headers $Headers -Expected $Expected
  [void]$Results.Add($result)
  return $result
}

function Get-AuditLogTotalByAction {
  param(
    [int]$ApiPort,
    [string]$AuthorizationToken,
    [string]$Action
  )

  $encodedAction = [System.Uri]::EscapeDataString($Action)
  $resp = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$ApiPort/admin/audit-logs?action=$encodedAction&page=1&pageSize=1" -Headers @{ Authorization = $AuthorizationToken }
  if ($resp.page -and $null -ne $resp.page.total) {
    return [int]$resp.page.total
  }
  return [int](@($resp.items).Count)
}

function Add-AdminConfigPutCaseResult {
  param(
    [System.Collections.ArrayList]$Results,
    [string]$Name,
    [string]$Url,
    [object]$Body,
    [hashtable]$Headers,
    [string]$Action,
    [int]$ApiPort,
    [string]$AuthorizationToken
  )

  $beforeCount = Get-AuditLogTotalByAction -ApiPort $ApiPort -AuthorizationToken $AuthorizationToken -Action $Action
  $result = Add-ApiCaseResult -Results $Results -Name $Name -Method "PUT" -Url $Url -Body $Body -Headers $Headers -Expected @(200)
  if ($result.ok) {
    $afterCount = Get-AuditLogTotalByAction -ApiPort $ApiPort -AuthorizationToken $AuthorizationToken -Action $Action
    if ($afterCount -le $beforeCount) {
      $result.ok = $false
      $result.expected = "$($result.expected)+audit-log-increment"
      $result.body = "$($result.body)`n[audit-check] action=$Action before=$beforeCount after=$afterCount"
    }
  }
  return $result
}

function Select-ContentId {
  param(
    [object[]]$Items,
    [string]$OwnerField,
    [string]$CurrentUserId,
    [string]$Label
  )

  $list = @($Items)
  if ($list.Count -le 0) {
    throw "No $Label items found for smoke write cases"
  }

  $candidate = $null
  if (-not [string]::IsNullOrWhiteSpace($OwnerField)) {
    $candidate = $list | Where-Object {
      $owner = $_.PSObject.Properties[$OwnerField].Value
      $owner -and [string]$owner -ne $CurrentUserId
    } | Select-Object -First 1
  }
  if (-not $candidate) {
    $candidate = $list | Select-Object -First 1
  }
  if (-not $candidate -or -not $candidate.id) {
    throw "No valid $Label id available for smoke write cases"
  }
  return [string]$candidate.id
}

function New-WriteHeaders {
  param(
    [string]$AuthorizationToken,
    [string]$Prefix,
    [string]$Label
  )

  $suffix = ([guid]::NewGuid().ToString('N')).Substring(0, 8)
  return @{
    Authorization = $AuthorizationToken
    "Idempotency-Key" = "$Prefix-$Label-$suffix"
  }
}

function Get-ResultStringField {
  param(
    [pscustomobject]$Result,
    [string]$Field
  )

  if (-not $Result -or [string]::IsNullOrWhiteSpace($Result.body)) {
    throw "Result body is empty for case '$($Result.name)'"
  }
  $regex = '"' + [regex]::Escape($Field) + '"\s*:\s*"([^"]+)"'
  $match = [regex]::Match($Result.body, $regex)
  if (-not $match.Success) {
    throw "Cannot parse field '$Field' from case '$($Result.name)'"
  }
  return [string]$match.Groups[1].Value
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
# Ensure admin actor/token are UUIDs so admin write audit logs remain valid.
if ([string]::IsNullOrWhiteSpace($env:DEMO_ADMIN_ID)) {
  $env:DEMO_ADMIN_ID = [guid]::NewGuid().ToString()
}
$env:DEMO_ADMIN_TOKEN = $env:DEMO_ADMIN_ID
if ([string]::IsNullOrWhiteSpace($env:DEMO_USER_TOKEN)) {
  $env:DEMO_USER_TOKEN = "demo-user-$([guid]::NewGuid().ToString('N'))"
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
  $currentUserId = [string]$wechatLogin.user.id
  $idempotencyPrefix = "smoke-$ReportDate"

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
    @{ name = "admin-config-trade-rules-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/trade-rules"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-customer-service-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/customer-service"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-recommendation-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/recommendation"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-alerts-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/alerts"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-banner-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/banner"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-taxonomy-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/taxonomy"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-sensitive-words-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/sensitive-words"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "admin-config-hot-search-get"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/admin/config/hot-search"; body = $null; headers = @{ Authorization = $adminToken }; expected = @(200) },
    @{ name = "patent-map-summary"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/patent-map/summary?year=2025&level=PROVINCE"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-listings"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/listings"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-demands"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/demands"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-achievements"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/achievements"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-artworks"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/artworks"; body = $null; headers = @{}; expected = @(200) },
    @{ name = "search-tech-managers"; method = "GET"; url = "http://127.0.0.1:$resolvedApiPort/search/tech-managers"; body = $null; headers = @{}; expected = @(200) }
  )

  $results = New-Object System.Collections.ArrayList
  foreach ($c in $cases) {
    [void](Add-ApiCaseResult -Results $results -Name $c.name -Method $c.method -Url $c.url -Body $c.body -Headers $c.headers -Expected $c.expected)
  }

  $adminListingsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/listings" -Headers @{ Authorization = $adminToken }
  $adminDemandsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/demands" -Headers @{ Authorization = $adminToken }
  $adminAchievementsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/achievements" -Headers @{ Authorization = $adminToken }
  $adminArtworksForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/artworks" -Headers @{ Authorization = $adminToken }
  $searchTechManagersForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/search/tech-managers"
  $adminUserVerificationsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/user-verifications" -Headers @{ Authorization = $adminToken }
  $adminTradeRulesConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/trade-rules" -Headers @{ Authorization = $adminToken }
  $adminCustomerServiceConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/customer-service" -Headers @{ Authorization = $adminToken }
  $adminRecommendationConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/recommendation" -Headers @{ Authorization = $adminToken }
  $adminAlertsConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/alerts" -Headers @{ Authorization = $adminToken }
  $adminBannerConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/banner" -Headers @{ Authorization = $adminToken }
  $adminTaxonomyConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/taxonomy" -Headers @{ Authorization = $adminToken }
  $adminSensitiveWordsConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/sensitive-words" -Headers @{ Authorization = $adminToken }
  $adminHotSearchConfig = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/config/hot-search" -Headers @{ Authorization = $adminToken }

  $listingId = Select-ContentId -Items @($adminListingsForWrites.items) -OwnerField "sellerUserId" -CurrentUserId $currentUserId -Label "listing"
  $demandId = Select-ContentId -Items @($adminDemandsForWrites.items) -OwnerField "publisherUserId" -CurrentUserId $currentUserId -Label "demand"
  $achievementId = Select-ContentId -Items @($adminAchievementsForWrites.items) -OwnerField "publisherUserId" -CurrentUserId $currentUserId -Label "achievement"
  $artworkId = Select-ContentId -Items @($adminArtworksForWrites.items) -OwnerField "sellerUserId" -CurrentUserId $currentUserId -Label "artwork"
  $missingOrderId = [guid]::NewGuid().ToString()

  $techManagerId = $null
  $searchTechManagerItem = @($searchTechManagersForWrites.items) | Select-Object -First 1
  if ($searchTechManagerItem) {
    if ($searchTechManagerItem.userId) { $techManagerId = [string]$searchTechManagerItem.userId }
    elseif ($searchTechManagerItem.id) { $techManagerId = [string]$searchTechManagerItem.id }
  }
  if ([string]::IsNullOrWhiteSpace($techManagerId)) {
    $techManagerVerification = @($adminUserVerificationsForWrites.items | Where-Object { $_.type -eq "TECH_MANAGER" }) | Select-Object -First 1
    if ($techManagerVerification -and $techManagerVerification.userId) {
      $techManagerId = [string]$techManagerVerification.userId
    }
  }
  if ([string]::IsNullOrWhiteSpace($techManagerId)) {
    throw "No tech manager id available for smoke write cases"
  }

  $listingFavoriteHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-listing-post"
  [void](Add-ApiCaseResult -Results $results -Name "listing-favorite-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/favorites" -Body $null -Headers $listingFavoriteHeaders -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "listing-favorite-post-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/favorites" -Body $null -Headers $listingFavoriteHeaders -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "listing-favorite-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-listing-delete") -Expected @(200))
  $demandFavoriteHeaders = New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-demand-post"
  [void](Add-ApiCaseResult -Results $results -Name "demand-favorite-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/favorites" -Body $null -Headers $demandFavoriteHeaders -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "demand-favorite-post-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/favorites" -Body $null -Headers $demandFavoriteHeaders -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "demand-favorite-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-demand-delete") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "achievement-favorite-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/achievements/$achievementId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-achievement-post") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "achievement-favorite-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/achievements/$achievementId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-achievement-delete") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "artwork-favorite-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/artworks/$artworkId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-artwork-post") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "artwork-favorite-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/artworks/$artworkId/favorites" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "favorite-artwork-delete") -Expected @(200))

  [void](Add-ApiCaseResult -Results $results -Name "listing-consult-post" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/consultations" -Body @{ channel = "FORM" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "consult-listing-post") -Expected @(200, 201))

  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-trade-rules-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/trade-rules" -Body $adminTradeRulesConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-trade-rules-put") -Action "CONFIG_TRADE_RULES_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-customer-service-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/customer-service" -Body $adminCustomerServiceConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-customer-service-put") -Action "CONFIG_CS_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-recommendation-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/recommendation" -Body $adminRecommendationConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-recommendation-put") -Action "CONFIG_RECOMMENDATION_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-alerts-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/alerts" -Body $adminAlertsConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-alerts-put") -Action "CONFIG_ALERT_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-banner-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/banner" -Body $adminBannerConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-banner-put") -Action "CONFIG_BANNER_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-taxonomy-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/taxonomy" -Body $adminTaxonomyConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-taxonomy-put") -Action "CONFIG_TAXONOMY_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-sensitive-words-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/sensitive-words" -Body $adminSensitiveWordsConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-sensitive-words-put") -Action "CONFIG_SENSITIVE_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-AdminConfigPutCaseResult -Results $results -Name "admin-config-hot-search-put" -Url "http://127.0.0.1:$resolvedApiPort/admin/config/hot-search" -Body $adminHotSearchConfig -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-config-hot-search-put") -Action "CONFIG_HOT_SEARCH_UPDATE" -ApiPort $resolvedApiPort -AuthorizationToken $adminToken)
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-issue-invoice-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/invoice" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-issue-invoice-missing") -Expected @(404))

  $listingCommentCreate = Add-ApiCaseResult -Results $results -Name "listing-comment-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/comments" -Body @{ text = "smoke listing comment $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-create") -Expected @(200, 201)
  $listingCommentId = Get-ResultStringField -Result $listingCommentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($listingCommentId)) { throw "listing-comment-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "listing-comment-create-empty-text" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/comments" -Body @{ text = "" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-empty") -Expected @(400, 403))
  [void](Add-ApiCaseResult -Results $results -Name "listing-comment-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/comments/$listingCommentId" -Body @{ text = "smoke listing comment updated $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-update") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "listing-comment-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/comments/$listingCommentId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-listing-delete") -Expected @(200))

  $demandCommentCreate = Add-ApiCaseResult -Results $results -Name "demand-comment-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/comments" -Body @{ text = "smoke demand comment $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-demand-create") -Expected @(200, 201)
  $demandCommentId = Get-ResultStringField -Result $demandCommentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($demandCommentId)) { throw "demand-comment-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "demand-comment-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/comments/$demandCommentId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-demand-delete") -Expected @(200))

  $achievementCommentCreate = Add-ApiCaseResult -Results $results -Name "achievement-comment-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/achievements/$achievementId/comments" -Body @{ text = "smoke achievement comment $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-achievement-create") -Expected @(200, 201)
  $achievementCommentId = Get-ResultStringField -Result $achievementCommentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($achievementCommentId)) { throw "achievement-comment-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "achievement-comment-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/comments/$achievementCommentId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-achievement-delete") -Expected @(200))

  $artworkCommentCreate = Add-ApiCaseResult -Results $results -Name "artwork-comment-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/artworks/$artworkId/comments" -Body @{ text = "smoke artwork comment $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-artwork-create") -Expected @(200, 201)
  $artworkCommentId = Get-ResultStringField -Result $artworkCommentCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($artworkCommentId)) { throw "artwork-comment-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "artwork-comment-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/comments/$artworkCommentId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "comment-artwork-delete") -Expected @(200))

  $addressCreate = Add-ApiCaseResult -Results $results -Name "me-address-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/me/addresses" -Body @{ name = "Smoke Receiver"; phone = "13800138001"; regionCode = "110000"; addressLine = "Smoke Street 1"; isDefault = $false } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "address-create") -Expected @(200, 201)
  $addressId = Get-ResultStringField -Result $addressCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($addressId)) { throw "me-address-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "me-address-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/me/addresses/$addressId" -Body @{ addressLine = "Smoke Street 2"; isDefault = $true } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "address-update") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "me-address-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/me/addresses/$addressId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "address-delete") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "me-address-delete-missing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/me/addresses/$addressId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "address-delete-missing") -Expected @(404))

  $listingConversation = Add-ApiCaseResult -Results $results -Name "listing-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/listings/$listingId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-listing-upsert") -Expected @(200, 201)
  $listingConversationId = Get-ResultStringField -Result $listingConversation -Field "id"
  if ([string]::IsNullOrWhiteSpace($listingConversationId)) { throw "listing-conversation-upsert missing id" }

  [void](Add-ApiCaseResult -Results $results -Name "demand-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/demands/$demandId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-demand-upsert") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "achievement-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/achievements/$achievementId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-achievement-upsert") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "artwork-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/artworks/$artworkId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-artwork-upsert") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "tech-manager-conversation-upsert" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/tech-managers/$techManagerId/conversations" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-tech-manager-upsert") -Expected @(200, 201))

  [void](Add-ApiCaseResult -Results $results -Name "conversation-message-send" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/messages" -Body @{ type = "TEXT"; text = "smoke message $ReportDate" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-message-send") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "conversation-message-invalid-type" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/messages" -Body @{ type = "SYSTEM"; text = "invalid type" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-message-invalid-type") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "conversation-message-empty-text" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/messages" -Body @{ type = "TEXT"; text = "" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-message-empty-text") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "conversation-read" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/conversations/$listingConversationId/read" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "conversation-read") -Expected @(200, 201))

  $failedCount = [int](($results | Where-Object { -not $_.ok }).Count)
  $writeMethods = @("POST", "PUT", "PATCH", "DELETE")
  $writeResults = @($results | Where-Object { $writeMethods -contains $_.method.ToUpper() })
  $readResults = @($results | Where-Object { -not ($writeMethods -contains $_.method.ToUpper()) })
  $summary = [pscustomobject]@{
    total = $results.Count
    passed = [int](($results | Where-Object { $_.ok }).Count)
    failed = $failedCount
    writesTotal = $writeResults.Count
    writesPassed = [int](($writeResults | Where-Object { $_.ok }).Count)
    readsTotal = $readResults.Count
    readsPassed = [int](($readResults | Where-Object { $_.ok }).Count)
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
