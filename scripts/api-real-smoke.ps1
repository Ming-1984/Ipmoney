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

function Normalize-ResultBody {
  param(
    [string]$Raw,
    [int]$MaxChars = 4096
  )

  if ([string]::IsNullOrEmpty($Raw)) {
    return ""
  }
  if ($Raw.Length -le $MaxChars) {
    return $Raw
  }
  $rest = $Raw.Length - $MaxChars
  return $Raw.Substring(0, $MaxChars) + "`n...[truncated $rest chars]"
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

  $raw = Normalize-ResultBody -Raw $raw

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

function Add-ApiFileUploadCaseResult {
  param(
    [System.Collections.ArrayList]$Results,
    [string]$Name,
    [string]$Url,
    [string]$AuthorizationToken,
    [string]$FilePath,
    [hashtable]$FormFields,
    [int[]]$Expected
  )

  $tmpBody = Join-Path $env:TEMP ("api-file-upload-{0}.json" -f ([guid]::NewGuid().ToString('N')))
  try {
    $curlArgs = @("-s", "-o", $tmpBody, "-w", "%{http_code}", "-X", "POST", $Url, "-H", "Authorization: $AuthorizationToken", "-F", "file=@$FilePath")
    if ($FormFields) {
      foreach ($key in $FormFields.Keys) {
        $curlArgs += "-F"
        $curlArgs += ("{0}={1}" -f $key, [string]$FormFields[$key])
      }
    }
    $statusText = & curl.exe @curlArgs
    $status = [int]$statusText
    $raw = ""
    if (Test-Path $tmpBody) {
      $raw = Get-Content -Path $tmpBody -Raw -ErrorAction SilentlyContinue
    }
  } finally {
    Remove-Item -Path $tmpBody -Force -ErrorAction SilentlyContinue
  }

  $result = [pscustomobject]@{
    name = $Name
    method = "POST"
    url = $Url
    status = $status
    expected = ($Expected -join "/")
    ok = ($Expected -contains $status)
    body = (Normalize-ResultBody -Raw $raw)
  }
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

function New-RefundReadyOrder {
  param(
    [System.Collections.ArrayList]$Results,
    [int]$ApiPort,
    [string]$UserToken,
    [string]$AdminToken,
    [string]$ListingId,
    [string]$IdempotencyPrefix,
    [string]$CasePrefix
  )

  $orderCreate = Add-ApiCaseResult -Results $Results -Name "$CasePrefix-order-create" -Method "POST" -Url "http://127.0.0.1:$ApiPort/orders" -Body @{ listingId = $ListingId } -Headers (New-WriteHeaders -AuthorizationToken $UserToken -Prefix $IdempotencyPrefix -Label "$CasePrefix-order-create") -Expected @(200, 201)
  $orderId = Get-ResultStringField -Result $orderCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($orderId)) { throw "$CasePrefix-order-create missing id" }
  [void](Add-ApiCaseResult -Results $Results -Name "$CasePrefix-order-payment-intent-deposit" -Method "POST" -Url "http://127.0.0.1:$ApiPort/orders/$orderId/payment-intents" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $UserToken -Prefix $IdempotencyPrefix -Label "$CasePrefix-order-payment-intent-deposit") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $Results -Name "$CasePrefix-admin-order-manual-payment-deposit" -Method "POST" -Url "http://127.0.0.1:$ApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $AdminToken -Prefix $IdempotencyPrefix -Label "$CasePrefix-admin-order-manual-payment-deposit") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $Results -Name "$CasePrefix-admin-order-contract-signed" -Method "POST" -Url "http://127.0.0.1:$ApiPort/admin/orders/$orderId/milestones/contract-signed" -Body @{ dealAmountFen = 2000000 } -Headers (New-WriteHeaders -AuthorizationToken $AdminToken -Prefix $IdempotencyPrefix -Label "$CasePrefix-admin-order-contract-signed") -Expected @(200, 201))
  return $orderId
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
# Keep smoke focused on business behavior instead of local rate-limit noise.
$env:RATE_LIMIT_ENABLED = "false"
# Keep file upload smoke local-only to avoid external object storage dependency.
$env:S3_BUCKET = ""
$env:S3_ACCESS_KEY_ID = ""
$env:S3_SECRET_ACCESS_KEY = ""
$env:UPLOAD_DIR = (Join-Path $repoRoot ".tmp/uploads")
New-Item -ItemType Directory -Force $env:UPLOAD_DIR | Out-Null

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null
$stdoutPath = Join-Path $logDir "api-real-smoke.out.log"
$stderrPath = Join-Path $logDir "api-real-smoke.err.log"
$resultsPath = Join-Path $logDir "api-real-smoke-$ReportDate.json"
$summaryPath = Join-Path $logDir "api-real-smoke-$ReportDate-summary.json"
$smokeEvidencePath = Join-Path $logDir "api-real-smoke-evidence-$ReportDate.txt"
"api smoke evidence $ReportDate" | Out-File -Encoding ASCII $smokeEvidencePath

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
  $adminPatentsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/admin/patents" -Headers @{ Authorization = $adminToken }
  $regionsForWrites = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$resolvedApiPort/regions"
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
  $patentId = Select-ContentId -Items @($adminPatentsForWrites.items) -OwnerField "" -CurrentUserId $currentUserId -Label "patent"
  $regionCandidates = @()
  if ($regionsForWrites -is [System.Array]) {
    $regionCandidates = @($regionsForWrites)
  } elseif ($regionsForWrites -and $regionsForWrites.items) {
    $regionCandidates = @($regionsForWrites.items)
  }
  $regionItem = $regionCandidates | Select-Object -First 1
  $importRegionCode = ""
  if ($regionItem) {
    if ($regionItem.code) { $importRegionCode = [string]$regionItem.code }
    elseif ($regionItem.regionCode) { $importRegionCode = [string]$regionItem.regionCode }
  }
  if ([string]::IsNullOrWhiteSpace($importRegionCode)) {
    throw "No region code available for patent-map import smoke cases"
  }
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
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/payments/manual" -Body @{ payType = "DEPOSIT"; amount = 100 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-contract-signed-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/milestones/contract-signed" -Body @{ dealAmountFen = 100 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-contract-signed-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-transfer-completed-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-transfer-completed-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-payout-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/payouts/manual" -Body @{ payoutEvidenceFileId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-payout-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-issue-invoice-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/invoice" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-issue-invoice-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-upsert-invoice-missing" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/invoice" -Body @{ invoiceFileId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-upsert-invoice-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-delete-invoice-missing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$missingOrderId/invoice" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-delete-invoice-missing") -Expected @(404))
  $missingRefundRequestId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-approve-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$missingRefundRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-approve-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-reject-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$missingRefundRequestId/reject" -Body @{ reason = "smoke missing refund" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-reject-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-complete-missing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$missingRefundRequestId/complete" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-complete-missing") -Expected @(404))

  $orderCreate = Add-ApiCaseResult -Results $results -Name "order-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders" -Body @{ listingId = $listingId } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-create") -Expected @(200, 201)
  $orderId = Get-ResultStringField -Result $orderCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($orderId)) { throw "order-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "order-payment-intent-deposit" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/payment-intents" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-payment-intent-deposit") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-deposit" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-deposit") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-deposit-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "DEPOSIT" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-deposit-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-contract-signed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/milestones/contract-signed" -Body @{ dealAmountFen = 2000000 } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-contract-signed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "order-payment-intent-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/payment-intents" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-payment-intent-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-final" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-final") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payment-final-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payments/manual" -Body @{ payType = "FINAL" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payment-final-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-transfer-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/milestones/transfer-completed" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-transfer-completed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-settlement-get" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/settlement" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payout-missing-evidence" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payouts/manual" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-missing-evidence") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-upsert-invoice-missing-file" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/invoice" -Body @{ invoiceFileId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-upsert-invoice-missing-file") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "order-refund-request-not-allowed-ready-to-settle" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke not allowed" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-refund-request-not-allowed-ready-to-settle") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "order-invoice-request-not-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice-requests" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-invoice-request-not-completed") -Expected @(409))
  $evidenceUpload = Add-ApiFileUploadCaseResult -Results $results -Name "file-upload-evidence" -Url "http://127.0.0.1:$resolvedApiPort/files" -AuthorizationToken $userToken -FilePath $smokeEvidencePath -FormFields $null -Expected @(200, 201)
  $evidenceFileId = Get-ResultStringField -Result $evidenceUpload -Field "id"
  if ([string]::IsNullOrWhiteSpace($evidenceFileId)) { throw "file-upload-evidence missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-manual-payout-with-evidence" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/payouts/manual" -Body @{ payoutEvidenceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-manual-payout-with-evidence") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "order-invoice-request-completed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice-requests" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-invoice-request-completed") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "order-invoice-request-completed-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$orderId/invoice-requests" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-invoice-request-completed-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-upsert-invoice-with-file" -Method "PUT" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/invoice" -Body @{ invoiceFileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-upsert-invoice-with-file") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-order-delete-invoice-existing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/orders/$orderId/invoice" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-order-delete-invoice-existing") -Expected @(204))

  $refundApproveOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "refund-approve"
  $refundApproveCreate = Add-ApiCaseResult -Results $results -Name "refund-approve-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke approve flow" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "refund-approve-create") -Expected @(200, 201)
  $refundApproveRequestId = Get-ResultStringField -Result $refundApproveCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($refundApproveRequestId)) { throw "refund-approve-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "refund-approve-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId/refund-requests" -Body $null -Headers @{ Authorization = $userToken } -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-approve-existing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundApproveRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-approve-existing") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-approve-existing-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundApproveRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-approve-existing-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-complete-existing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundApproveRequestId/complete" -Body @{ remark = "smoke complete flow" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-complete-existing") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-complete-existing-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundApproveRequestId/complete" -Body @{ remark = "smoke duplicate complete flow" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-complete-existing-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "order-refund-request-after-refunded" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundApproveOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke disallowed after refunded" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "order-refund-request-after-refunded") -Expected @(409))

  $refundRejectOrderId = New-RefundReadyOrder -Results $results -ApiPort $resolvedApiPort -UserToken $userToken -AdminToken $adminToken -ListingId $listingId -IdempotencyPrefix $idempotencyPrefix -CasePrefix "refund-reject"
  $refundRejectCreate = Add-ApiCaseResult -Results $results -Name "refund-reject-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/orders/$refundRejectOrderId/refund-requests" -Body @{ reasonCode = "OTHER"; reasonText = "smoke reject flow" } -Headers (New-WriteHeaders -AuthorizationToken $userToken -Prefix $idempotencyPrefix -Label "refund-reject-create") -Expected @(200, 201)
  $refundRejectRequestId = Get-ResultStringField -Result $refundRejectCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($refundRejectRequestId)) { throw "refund-reject-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-reject-existing-missing-reason" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/reject" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-reject-existing-missing-reason") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-reject-existing" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/reject" -Body @{ reason = "smoke reject reason" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-reject-existing") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-reject-existing-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/reject" -Body @{ reason = "smoke reject reason duplicate" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-reject-existing-duplicate") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-complete-rejected" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/complete" -Body @{ remark = "smoke complete rejected" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-complete-rejected") -Expected @(409))
  [void](Add-ApiCaseResult -Results $results -Name "admin-refund-approve-rejected" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/refund-requests/$refundRejectRequestId/approve" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-refund-approve-rejected") -Expected @(409))

  [void](Add-ApiCaseResult -Results $results -Name "admin-case-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  $caseCreate = Add-ApiCaseResult -Results $results -Name "admin-case-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases" -Body @{ type = "DISPUTE"; title = "smoke case $ReportDate"; orderId = $refundApproveOrderId; requesterName = "smoke"; priority = "HIGH"; description = "smoke case description" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-create") -Expected @(200, 201)
  $caseId = Get-ResultStringField -Result $caseCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($caseId)) { throw "admin-case-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  $missingCaseId = [guid]::NewGuid().ToString()
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-detail-missing" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$missingCaseId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-assign-missing-assignee" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/assign" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-assign-missing-assignee") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-assign" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/assign" -Body @{ assigneeId = $currentUserId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-assign") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-status-invalid" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/status" -Body @{ status = "UNKNOWN" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-status-invalid") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-status-in-progress" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/status" -Body @{ status = "IN_PROGRESS" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-status-in-progress") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-note-empty" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/notes" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-note-empty") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-note-add" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/notes" -Body @{ note = "smoke case note" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-note-add") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-evidence-missing-file" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/evidence" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-evidence-missing-file") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-evidence-add" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/evidence" -Body @{ fileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-evidence-add") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-evidence-add-duplicate" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/evidence" -Body @{ fileId = $evidenceFileId } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-evidence-add-duplicate") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-sla-missing-due-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/sla" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-sla-missing-due-at") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-sla-invalid-due-at" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/sla" -Body @{ dueAt = "invalid-date" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-sla-invalid-due-at") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-sla-update" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/sla" -Body @{ dueAt = (Get-Date).AddDays(2).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-sla-update") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-case-status-closed" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/cases/$caseId/status" -Body @{ status = "CLOSED" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-case-status-closed") -Expected @(200, 201))

  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedules-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create-missing-patent" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body @{ yearNo = 1; dueDate = (Get-Date).AddDays(30).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create-missing-patent") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create-invalid-patent" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body @{ patentId = [guid]::NewGuid().ToString(); yearNo = 1; dueDate = (Get-Date).AddDays(30).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create-invalid-patent") -Expected @(404))
  $maintenanceYearNo = [int][double]::Parse((Get-Date -UFormat %s))
  $scheduleCreate = Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules" -Body @{ patentId = $patentId; yearNo = $maintenanceYearNo; dueDate = (Get-Date).AddDays(45).ToString("o"); status = "DUE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-create") -Expected @(200, 201)
  $scheduleId = Get-ResultStringField -Result $scheduleCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($scheduleId)) { throw "admin-maintenance-schedule-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-detail" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$scheduleId" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-detail-missing" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$([guid]::NewGuid().ToString())" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$scheduleId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-update-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-schedule-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/schedules/$scheduleId" -Body @{ status = "PAID"; gracePeriodEnd = (Get-Date).AddDays(60).ToString("o") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-schedule-update") -Expected @(200))

  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-tasks-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-create-missing-schedule" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-create-missing-schedule") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-create-invalid-schedule" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body @{ scheduleId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-create-invalid-schedule") -Expected @(404))
  $taskCreate = Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks" -Body @{ scheduleId = $scheduleId; assignedCsUserId = $currentUserId; status = "OPEN"; note = "smoke maintenance task" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-create") -Expected @(200, 201)
  $taskId = Get-ResultStringField -Result $taskCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($taskId)) { throw "admin-maintenance-task-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-update-invalid-status" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks/$taskId" -Body @{ status = "INVALID" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-update-invalid-status") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-update-invalid-evidence" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks/$taskId" -Body @{ evidenceFileId = [guid]::NewGuid().ToString() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-update-invalid-evidence") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks/$taskId" -Body @{ status = "DONE"; evidenceFileId = $evidenceFileId; note = "smoke maintenance done" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-update") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-maintenance-task-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-maintenance/tasks/$([guid]::NewGuid().ToString())" -Body @{ status = "DONE" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-maintenance-task-update-missing") -Expected @(404))

  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-users-list" -Method "GET" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users" -Body $null -Headers @{ Authorization = $adminToken } -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-create-missing-name" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles" -Body @{ permissionIds = @("report.read") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-create-missing-name") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-create-invalid-permission" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles" -Body @{ name = "smoke invalid role $ReportDate"; permissionIds = @("unknown.permission") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-create-invalid-permission") -Expected @(400))
  $rbacRoleCreate = Add-ApiCaseResult -Results $results -Name "admin-rbac-role-create" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles" -Body @{ name = "smoke role $ReportDate"; description = "smoke role"; permissionIds = @("report.read", "auditLog.read") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-create") -Expected @(200, 201)
  $rbacRoleId = Get-ResultStringField -Result $rbacRoleCreate -Field "id"
  if ([string]::IsNullOrWhiteSpace($rbacRoleId)) { throw "admin-rbac-role-create missing id" }
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-update-missing" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$([guid]::NewGuid().ToString())" -Body @{ name = "missing role" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-update-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-update-invalid-permission" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$rbacRoleId" -Body @{ permissionIds = @("unknown.permission") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-update-invalid-permission") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-update" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$rbacRoleId" -Body @{ name = "smoke role updated $ReportDate"; permissionIds = @("report.read") } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-update") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-user-update-missing-role-ids" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users/$currentUserId" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-user-update-missing-role-ids") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-user-update-unknown-role" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users/$currentUserId" -Body @{ roleIds = @([guid]::NewGuid().ToString()) } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-user-update-unknown-role") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-user-update-custom-role" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users/$currentUserId" -Body @{ roleIds = @($rbacRoleId) } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-user-update-custom-role") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-user-update-clear-roles" -Method "PATCH" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/users/$currentUserId" -Body @{ roleIds = @() } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-user-update-clear-roles") -Expected @(200))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-delete-system-forbidden" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/role-admin" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-delete-system-forbidden") -Expected @(403))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-delete-missing" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$([guid]::NewGuid().ToString())" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-delete-missing") -Expected @(404))
  [void](Add-ApiCaseResult -Results $results -Name "admin-rbac-role-delete" -Method "DELETE" -Url "http://127.0.0.1:$resolvedApiPort/admin/rbac/roles/$rbacRoleId" -Body $null -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-rbac-role-delete") -Expected @(200))

  [void](Add-ApiCaseResult -Results $results -Name "admin-report-export" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/reports/finance/export" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-report-export") -Expected @(200, 201))
  [void](Add-ApiCaseResult -Results $results -Name "admin-report-export-invalid-range" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/reports/finance/export" -Body @{ start = "2026-12-31T00:00:00.000Z"; end = "2026-01-01T00:00:00.000Z" } -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-report-export-invalid-range") -Expected @(400))
  [void](Add-ApiCaseResult -Results $results -Name "admin-patent-map-import-missing-file" -Method "POST" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-map/import" -Body @{} -Headers (New-WriteHeaders -AuthorizationToken $adminToken -Prefix $idempotencyPrefix -Label "admin-patent-map-import-missing-file") -Expected @(400))
  $patentMapImportPath = Join-Path $logDir "api-real-smoke-patent-map-import-$ReportDate.csv"
  @(
    "regionCode,year,patentCount,industryBreakdown,topAssignees",
    "$importRegionCode,$((Get-Date).Year),1,," 
  ) | Out-File -Encoding UTF8 $patentMapImportPath
  [void](Add-ApiFileUploadCaseResult -Results $results -Name "admin-patent-map-import-dry-run" -Url "http://127.0.0.1:$resolvedApiPort/admin/patent-map/import" -AuthorizationToken $adminToken -FilePath $patentMapImportPath -FormFields @{ dryRun = "true" } -Expected @(200, 201))

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
