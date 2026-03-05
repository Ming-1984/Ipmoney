[CmdletBinding()]
param(
  [int]$MockPort = 4010,
  [int]$PrismPort = 4011,
  [int]$ClientPort = 5173,
  [int]$AdminPort = 5174,
  [string]$ReportDate = "",
  [string]$BrowserExe = "",
  [ValidateSet("core", "full")][string]$Mode = "core",
  [string[]]$PageFilter = @(),
  [ValidateSet("auto", "new", "old")][string]$HeadlessMode = "auto",
  [switch]$MinimalArgs,
  [int]$WaitMockSec = 240,
  [int]$WaitClientSec = 420,
  [int]$WaitAdminSec = 240,
  [int]$WarmupSec = 20,
  [int]$ClientWidth = 390,
  [int]$ClientHeight = 844,
  [int]$AdminWidth = 1440,
  [int]$AdminHeight = 900,
  [int]$ClientWaitMs = 6500,
  [int]$AdminWaitMs = 4500,
  [int]$CaptureTimeoutSec = 120
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

function Find-BrowserExe([string]$override) {
  if (-not [string]::IsNullOrWhiteSpace($override)) {
    if (Test-Path $override) { return (Resolve-Path $override).Path }
    $cmd = Get-Command $override -ErrorAction SilentlyContinue
    if ($null -ne $cmd) { return $cmd.Source }
    throw "Browser executable not found: $override"
  }

  $candidates = @(
    "$env:ProgramFiles(x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe",
    "$env:LocalAppData\\Microsoft\\Edge\\Application\\msedge.exe",
    "$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe",
    "$env:ProgramFiles(x86)\\Google\\Chrome\\Application\\chrome.exe",
    "$env:LocalAppData\\Google\\Chrome\\Application\\chrome.exe"
  )

  foreach ($p in $candidates) {
    if ([string]::IsNullOrWhiteSpace($p)) { continue }
    if (Test-Path $p) { return (Resolve-Path $p).Path }
  }

  $edgeCmd = Get-Command msedge -ErrorAction SilentlyContinue
  if ($null -ne $edgeCmd) { return $edgeCmd.Source }

  $chromeCmd = Get-Command chrome -ErrorAction SilentlyContinue
  if ($null -ne $chromeCmd) { return $chromeCmd.Source }

  throw "No supported browser found. Install Edge/Chrome or pass -BrowserExe."
}

function Contains-IgnoreCase([string]$Text, [string]$Needle) {
  if ([string]::IsNullOrWhiteSpace($Needle)) { return $false }
  if ($null -eq $Text) { return $false }
  return $Text.IndexOf($Needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Add-QueryParam([string]$baseUrl, [string]$key, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($baseUrl)) { return $baseUrl }
  try {
    $builder = New-Object System.UriBuilder($baseUrl)
    $queryString = $builder.Query
    if ($queryString.StartsWith("?")) { $queryString = $queryString.Substring(1) }

    $queryPairs = @{}
    if (-not [string]::IsNullOrWhiteSpace($queryString)) {
      foreach ($part in $queryString.Split("&")) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $kv = $part.Split("=", 2)
        if ($kv.Count -eq 0) { continue }
        $k = [System.Uri]::UnescapeDataString($kv[0])
        $v = ""
        if ($kv.Count -gt 1) { $v = [System.Uri]::UnescapeDataString($kv[1]) }
        $queryPairs[$k] = $v
      }
    }

    $queryPairs[$key] = $value

    $encoded = @()
    foreach ($k in ($queryPairs.Keys | Sort-Object)) {
      $encoded += ([System.Uri]::EscapeDataString($k) + "=" + [System.Uri]::EscapeDataString([string]$queryPairs[$k]))
    }
    $builder.Query = ($encoded -join "&")

    return $builder.Uri.AbsoluteUri.TrimEnd("/")
  } catch {
    if ($baseUrl -like "*?*") { return "$baseUrl&$key=$value" }
    return "$baseUrl?$key=$value"
  }
}

function To-Int([object]$Value, [int]$Fallback = 0) {
  if ($null -eq $Value) { return $Fallback }
  $parsed = 0
  if ([int]::TryParse([string]$Value, [ref]$parsed)) { return $parsed }
  return $Fallback
}

function Get-SelectorMatched(
  [object[]]$SelectorChecks,
  [string]$Selector
) {
  foreach ($check in $SelectorChecks) {
    if ([string]$check.selector -ne $Selector) { continue }
    return [bool]$check.matched
  }
  return $false
}

function Stop-ProcessTree([int]$RootPid) {
  if ($RootPid -le 0) { return }
  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootPid" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Stop-ProcessTree -RootPid ([int]$child.ProcessId)
  }
  Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
}

function Invoke-DumpDom(
  [string]$browserExe,
  [string]$userDataDir,
  [string]$url,
  [int]$width,
  [int]$height,
  [int]$waitMs,
  [int]$timeoutSec,
  [string[]]$selectors,
  [hashtable[]]$storage,
  [string]$stdoutPath,
  [string]$stderrPath
) {
  $timeoutMs = [Math]::Max(1000, $timeoutSec * 1000)
  $nodeArgs = @(
    "scripts/dump-dom-cdp.mjs",
    "--url", $url,
    "--browser", $browserExe,
    "--user-data-dir", $userDataDir,
    "--width", [string]$width,
    "--height", [string]$height,
    "--wait-ms", [string]$waitMs,
    "--timeout-ms", [string]$timeoutMs
  )

  if ($selectors) {
    foreach ($sel in $selectors) {
      if ([string]::IsNullOrWhiteSpace($sel)) { continue }
      $nodeArgs += @("--selector", $sel)
    }
  }

  if ($storage) {
    foreach ($entry in $storage) {
      if ($null -eq $entry) { continue }
      if (-not $entry.ContainsKey("key")) { continue }
      $key = [string]$entry.key
      if ([string]::IsNullOrWhiteSpace($key)) { continue }
      $value = ""
      if ($entry.ContainsKey("value")) { $value = [string]$entry.value }
      $mode = "raw"
      if ($entry.ContainsKey("mode")) { $mode = [string]$entry.mode }
      $storageArg = "$key=$value"
      if ($mode -eq "taro") {
        $nodeArgs += @("--storage-taro", $storageArg)
      } else {
        $nodeArgs += @("--storage", $storageArg)
      }
    }
  }

  if (Test-Path $stderrPath) { Clear-Content -Path $stderrPath -ErrorAction SilentlyContinue }
  $raw = & node @nodeArgs 2>$stderrPath
  $exitCode = $LASTEXITCODE
  $rawText = if ($raw -is [array]) { $raw -join [Environment]::NewLine } else { [string]$raw }
  $rawText | Out-File -Encoding UTF8 $stdoutPath

  if ($exitCode -ne 0) {
    $stderrText = ""
    if (Test-Path $stderrPath) {
      $stderrRaw = Get-Content -Raw $stderrPath -ErrorAction SilentlyContinue
      if ($stderrRaw) { $stderrText = $stderrRaw.Trim() }
    }
    if ([string]::IsNullOrWhiteSpace($stderrText)) { $stderrText = "node exit $exitCode" }
    throw "DOM dump failed: $url :: $stderrText"
  }

  try {
    return ($rawText | ConvertFrom-Json)
  } catch {
    $preview = $rawText
    if ($preview.Length -gt 400) { $preview = $preview.Substring(0, 400) }
    throw "DOM dump returned non-JSON payload: $url :: $preview"
  }
}

$sample = @{
  listingId = "7a490e63-8173-41e7-b4f0-0d0bb5ce7d20"
  patentId = "965f9831-2c44-48e8-8b7a-cd7ab40ff7ec"
  artworkId = "7f8e9f72-98f4-4f4a-8d11-44f38fcf3d51"
  demandId = "8f278f0a-6ccf-45ce-a664-f5eaf39a9be4"
  achievementId = "2a9ee2ee-9ab8-4335-b568-e9d9ef57f2f7"
  techManagerId = "c05d27bc-c739-47ad-91f7-53ccf8517a4e"
  orgUserId = "c5b6438a-f3a7-4590-a484-0f2a2991c613"
  conversationId = "127a267b-d5f8-4b39-acf8-855dff7258b0"
  orderId = "e9032d03-9b23-40ba-84a3-ac681f21c41b"
  notificationId = "f15de7ac-b89d-45a5-9a26-5296caef82a4"
  announcementId = "d9b6adf1-0276-4af5-8bd0-5fcb8c20053c"
  regionCode = "110000"
  year = 2025
}

$clientApprovedStorage = @(
  @{ key = "ipmoney.token"; value = "dom-smoke-token"; mode = "taro" },
  @{ key = "ipmoney.onboardingDone"; value = "true"; mode = "taro" },
  @{ key = "ipmoney.verificationStatus"; value = "APPROVED"; mode = "taro" },
  @{ key = "ipmoney.verificationType"; value = "COMPANY"; mode = "taro" }
)

$adminAuthedStorage = @(
  @{ key = "ipmoney.adminToken"; value = "dom-smoke-admin-token"; mode = "raw" }
)

$reservedPorts = @()
$resolvedMockPort = Find-AvailablePort -PreferredPort $MockPort -ReservedPorts $reservedPorts
$reservedPorts += $resolvedMockPort
$resolvedPrismPort = Find-AvailablePort -PreferredPort $PrismPort -ReservedPorts $reservedPorts
$reservedPorts += $resolvedPrismPort
$resolvedClientPort = Find-AvailablePort -PreferredPort $ClientPort -ReservedPorts $reservedPorts
$reservedPorts += $resolvedClientPort
$resolvedAdminPort = Find-AvailablePort -PreferredPort $AdminPort -ReservedPorts $reservedPorts
$reservedPorts += $resolvedAdminPort

if ($resolvedMockPort -ne $MockPort) { Write-Host ("[ui-dom-smoke] mock port fallback: {0} -> {1}" -f $MockPort, $resolvedMockPort) }
if ($resolvedPrismPort -ne $PrismPort) { Write-Host ("[ui-dom-smoke] prism port fallback: {0} -> {1}" -f $PrismPort, $resolvedPrismPort) }
if ($resolvedClientPort -ne $ClientPort) { Write-Host ("[ui-dom-smoke] client port fallback: {0} -> {1}" -f $ClientPort, $resolvedClientPort) }
if ($resolvedAdminPort -ne $AdminPort) { Write-Host ("[ui-dom-smoke] admin port fallback: {0} -> {1}" -f $AdminPort, $resolvedAdminPort) }

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null

$mockOut = Join-Path $logDir "ui-dom-mock.out.log"
$mockErr = Join-Path $logDir "ui-dom-mock.err.log"
$clientOut = Join-Path $logDir "ui-dom-client.out.log"
$clientErr = Join-Path $logDir "ui-dom-client.err.log"
$adminOut = Join-Path $logDir "ui-dom-admin.out.log"
$adminErr = Join-Path $logDir "ui-dom-admin.err.log"

$mockCmd = "`$env:MOCK_API_PORT='$resolvedMockPort'; `$env:MOCK_API_PRISM_PORT='$resolvedPrismPort'; pnpm mock"
$clientCmd = "`$env:TARO_APP_API_BASE_URL='http://127.0.0.1:$resolvedMockPort'; `$env:CLIENT_H5_PORT='$resolvedClientPort'; `$env:TARO_APP_ENABLE_MOCK_TOOLS='0'; `$env:DEMO_AUTH_ENABLED='true'; `$env:DEMO_PAYMENT_ENABLED='true'; pnpm -C apps/client dev:h5"
$adminCmd = "`$env:VITE_API_BASE_URL='http://127.0.0.1:$resolvedMockPort'; `$env:ADMIN_WEB_PORT='$resolvedAdminPort'; `$env:VITE_ENABLE_MOCK_TOOLS='0'; pnpm -C apps/admin-web dev"

$mockProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $mockCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $mockOut -RedirectStandardError $mockErr
$clientProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $clientCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $clientOut -RedirectStandardError $clientErr
$adminProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $adminCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $adminOut -RedirectStandardError $adminErr

try {
  Wait-Status -Url "http://127.0.0.1:$resolvedMockPort/health" -TimeoutSec $WaitMockSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$resolvedClientPort" -TimeoutSec $WaitClientSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$resolvedAdminPort" -TimeoutSec $WaitAdminSec -Headers @{} | Out-Null
  if ($WarmupSec -gt 0) { Start-Sleep -Seconds $WarmupSec }

  $browser = Find-BrowserExe $BrowserExe
  $userDataAbs = Join-Path $repoRoot (".tmp/ui-dom-profile-{0}" -f $ReportDate)
  if (Test-Path $userDataAbs) {
    $userDataAbs = Join-Path $repoRoot (".tmp/ui-dom-profile-{0}-{1}" -f $ReportDate, (Get-Date).ToString("HHmmss"))
  }
  New-Item -ItemType Directory -Force $userDataAbs | Out-Null

  $clientBase = "http://127.0.0.1:$resolvedClientPort"
  $adminBase = "http://127.0.0.1:$resolvedAdminPort"

  $corePages = @(
    @{
      name = "client-home"; path = "#/pages/home/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/home/index"; minElements = 100
      selectorsAll = @(".home-page"); selectorsAny = @(".home-hero", ".home-quick-item", ".home-marquee-section")
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-search"; path = "#/subpackages/search/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/subpackages/search/index"; minElements = 120
      selectorsAll = @(".search-v4"); selectorsAny = @(".search-sort-row", ".search-filter-btn", ".search-filter-section")
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-listing-detail"; path = "#/subpackages/listing/detail/index?listingId=$($sample.listingId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/subpackages/listing/detail/index"; minElements = 120
      selectorsAll = @("#listing-overview", ".detail-page-compact"); selectorsAny = @(".detail-compact-title", ".detail-sticky-buttons")
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-orders"; path = "#/subpackages/orders/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/subpackages/orders/index"; minElements = 80
      selectorsAll = @(".detail-tabs"); selectorsAny = @(".detail-tab", ".search-toolbar-row", ".text-card-title")
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $false
    },
    @{
      name = "client-publish-patent"; path = "#/subpackages/publish/patent/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/subpackages/publish/patent/index"; minElements = 100
      selectorsAll = @(".publish-patent-page"); selectorsAny = @(".publish-section-title", ".form-label", ".publish-form")
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $false
    },
    @{
      name = "client-me"; path = "#/pages/me/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/me/index"; minElements = 90
      selectorsAll = @(".me-page"); selectorsAny = @(".me-order-card", ".me-section-title")
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $false
    },
    @{
      name = "admin-login"; path = "/login"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/login"; minElements = 40
      selectorsAll = @("input[placeholder*='token']"); selectorsAny = @(".ant-form", ".ant-card")
      textAny = @("Access Token", "Sign in"); storage = @(); demoAuth = $false
    },
    @{
      name = "admin-dashboard"; path = "/"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "://127.0.0.1:$resolvedAdminPort/"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-statistic", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-orders"; path = "/orders"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/orders"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-verifications"; path = "/verifications"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/verifications"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-config"; path = "/config"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/config"; minElements = 120
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-form", ".ant-form-item")
      textAny = @("weights", "featuredBoost", "Banner"); storage = $adminAuthedStorage; demoAuth = $false
    }
  )

  $effectiveMode = $Mode
  $extendedPages = @(
    @{
      name = "client-tech-managers"; path = "#/pages/tech-managers/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/tech-managers/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-patent-detail"; path = "#/pages/patent/detail/index?patentId=$($sample.patentId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/patent/detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-artwork-detail"; path = "#/pages/artwork/detail/index?artworkId=$($sample.artworkId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/artwork/detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-demand-detail"; path = "#/pages/demand/detail/index?demandId=$($sample.demandId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/demand/detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-achievement-detail"; path = "#/pages/achievement/detail/index?achievementId=$($sample.achievementId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/achievement/detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-organizations"; path = "#/pages/organizations/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/organizations/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-organization-detail"; path = "#/pages/organizations/detail/index?orgUserId=$($sample.orgUserId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/organizations/detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-patent-map"; path = "#/pages/patent-map/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/patent-map/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-inventors"; path = "#/pages/inventors/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/inventors/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-messages"; path = "#/pages/messages/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/messages/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-chat"; path = "#/pages/messages/chat/index?conversationId=$($sample.conversationId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/messages/chat/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-notifications"; path = "#/pages/notifications/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/notifications/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-announcements"; path = "#/pages/announcements/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/announcements/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-order-detail"; path = "#/pages/orders/detail/index?orderId=$($sample.orderId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/orders/detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-about"; path = "#/pages/about/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/about/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-support"; path = "#/pages/support/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/support/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-legal-privacy"; path = "#/pages/legal/privacy/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/legal/privacy/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-legal-terms"; path = "#/pages/legal/terms/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/legal/terms/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-profile-edit"; path = "#/pages/profile/edit/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/profile/edit/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "admin-listings"; path = "/listings"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/listings"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-refunds"; path = "/refunds"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/refunds"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-invoices"; path = "/invoices"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/invoices"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-patent-map"; path = "/patent-map"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/patent-map"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-rbac"; path = "/rbac"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/rbac"; minElements = 80
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-tabs", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-audit-logs"; path = "/audit-logs"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/audit-logs"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    }
  )

  $extendedPagesPhase2 = @(
    @{
      name = "client-publish-entry"; path = "#/pages/publish/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/publish/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-patent-map-region-detail"; path = "#/pages/patent-map/region-detail/index?regionCode=$($sample.regionCode)&year=$($sample.year)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/patent-map/region-detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-tech-manager-detail"; path = "#/pages/tech-managers/detail/index?techManagerId=$($sample.techManagerId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/tech-managers/detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-trade-rules"; path = "#/pages/trade-rules/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/trade-rules/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-login"; path = "#/pages/login/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/login/index"; minElements = 40
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-notification-detail"; path = "#/pages/notifications/detail/index?id=$($sample.notificationId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/notifications/detail/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-announcement-detail"; path = "#/pages/announcements/detail/index?id=$($sample.announcementId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/announcements/detail/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-favorites"; path = "#/pages/favorites/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/favorites/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-contracts"; path = "#/pages/contracts/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/contracts/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-invoices"; path = "#/pages/invoices/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/invoices/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-addresses"; path = "#/pages/addresses/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/addresses/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-address-edit"; path = "#/pages/addresses/edit/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/addresses/edit/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-deposit-pay"; path = "#/pages/checkout/deposit-pay/index?listingId=$($sample.listingId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/checkout/deposit-pay/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-deposit-success"; path = "#/pages/checkout/deposit-success/index?orderId=$($sample.orderId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/checkout/deposit-success/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-final-pay"; path = "#/pages/checkout/final-pay/index?orderId=$($sample.orderId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/checkout/final-pay/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-final-success"; path = "#/pages/checkout/final-success/index?orderId=$($sample.orderId)"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/checkout/final-success/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-my-listings"; path = "#/pages/my-listings/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/my-listings/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-my-demands"; path = "#/pages/my-demands/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/my-demands/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-my-achievements"; path = "#/pages/my-achievements/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/my-achievements/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-my-artworks"; path = "#/pages/my-artworks/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/my-artworks/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-publish-demand"; path = "#/pages/publish/demand/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/publish/demand/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-publish-achievement"; path = "#/pages/publish/achievement/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/publish/achievement/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-publish-artwork"; path = "#/pages/publish/artwork/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/publish/artwork/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-cluster-picker"; path = "#/pages/cluster-picker/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/cluster-picker/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-settings-notifications"; path = "#/pages/settings/notifications/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/settings/notifications/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-support-faq"; path = "#/pages/support/faq/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/support/faq/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-support-faq-detail"; path = "#/pages/support/faq/detail/index?id=faq-1"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/support/faq/detail/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-support-contact"; path = "#/pages/support/contact/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/support/contact/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-legal-privacy-guide"; path = "#/pages/legal/privacy-guide/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/legal/privacy-guide/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-onboarding-choose-identity"; path = "#/pages/onboarding/choose-identity/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/onboarding/choose-identity/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-onboarding-verification-form"; path = "#/pages/onboarding/verification-form/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/onboarding/verification-form/index"; minElements = 60
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = $clientApprovedStorage; demoAuth = $true
    },
    @{
      name = "client-region-picker"; path = "#/pages/region-picker/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/region-picker/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "client-ipc-picker"; path = "#/pages/ipc-picker/index"; base = $clientBase
      width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs
      expectedUrlContains = "#/pages/ipc-picker/index"; minElements = 50
      selectorsAll = @(); selectorsAny = @()
      textAny = @(); storage = @(); demoAuth = $false
    },
    @{
      name = "admin-order-detail"; path = "/orders/$($sample.orderId)"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/orders/$($sample.orderId)"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-card", ".ant-descriptions")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-settlements"; path = "/settlements"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/settlements"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-demands"; path = "/demands"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/demands"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-achievements"; path = "/achievements"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/achievements"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-artworks"; path = "/artworks"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/artworks"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-tech-managers"; path = "/tech-managers"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/tech-managers"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-cases"; path = "/cases"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/cases"; minElements = 90
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-card", ".ant-table")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-reports"; path = "/reports"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/reports"; minElements = 90
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-card", ".ant-table")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-comments"; path = "/comments"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/comments"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-announcements"; path = "/announcements"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/announcements"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-alerts"; path = "/alerts"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/alerts"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-maintenance"; path = "/maintenance"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/maintenance"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-regions"; path = "/regions"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/regions"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    },
    @{
      name = "admin-patents"; path = "/patents"; base = $adminBase
      width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs
      expectedUrlContains = "/patents"; minElements = 100
      selectorsAll = @(".ipm-sider", ".ipm-content-inner"); selectorsAny = @(".ant-table", ".ant-card")
      textAny = @(); storage = $adminAuthedStorage; demoAuth = $false
    }
  )

  $pages = @($corePages)
  if ($Mode -eq "full") {
    $pages = @($corePages + $extendedPages + $extendedPagesPhase2)
    $pageNames = @($pages | ForEach-Object { $_.name })
    $uniqueCount = @($pageNames | Sort-Object -Unique).Count
    if ($uniqueCount -ne $pages.Count) {
      throw "ui-dom-smoke full mode has duplicate page names ($uniqueCount unique / $($pages.Count) total)"
    }

    $effectiveMode = if ($pages.Count -ge 83) { "full-83" } else { "full-batch2" }
    Write-Host ("[ui-dom-smoke] full mode assertions: core={0}, batch1={1}, batch2={2}, total={3}" -f $corePages.Count, $extendedPages.Count, $extendedPagesPhase2.Count, $pages.Count)
  }

  if ($PageFilter -and $PageFilter.Count -gt 0) {
    $filter = @($PageFilter | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($filter.Count -gt 0) {
      $pages = @($pages | Where-Object { $filter -contains $_.name })
    }
  }

  $consoleErrorIgnorePatterns = @(
    "favicon",
    "ERR_ABORTED 404",
    "source map",
    "sourcemap",
    "chrome-extension://"
  )
  $consoleErrorSeverePatterns = @(
    "TypeError",
    "ReferenceError",
    "Cannot read properties of",
    "Unhandled Promise Rejection"
  )

  $results = @()
  foreach ($p in $pages) {
    $rawUrl = if ($p.path.StartsWith("http")) { $p.path } elseif ($p.path.StartsWith("/")) { "$($p.base)$($p.path)" } else { "$($p.base)/$($p.path)" }
    $url = if ($p.demoAuth) { Add-QueryParam $rawUrl "__demo_auth" "1" } else { $rawUrl }
    $stdoutPath = Join-Path $logDir ("ui-dom-{0}-{1}.stdout.log" -f $ReportDate, $p.name)
    $stderrPath = Join-Path $logDir ("ui-dom-{0}-{1}.stderr.log" -f $ReportDate, $p.name)
    $ok = $true
    $err = ""
    $href = ""
    $elementCount = 0
    $matchedSelectorAny = ""
    $matchedTextAny = ""
    $runtimeExceptionCount = 0
    $severeConsoleCount = 0
    $preview = ""

    try {
      $selectorsForDump = @()
      if ($p.selectorsAll) { $selectorsForDump += @($p.selectorsAll) }
      if ($p.selectorsAny) { $selectorsForDump += @($p.selectorsAny) }
      $selectorsForDump = @($selectorsForDump | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)

      $dom = Invoke-DumpDom `
        -browserExe $browser `
        -userDataDir $userDataAbs `
        -url $url `
        -width $p.width `
        -height $p.height `
        -waitMs $p.waitMs `
        -timeoutSec $CaptureTimeoutSec `
        -selectors $selectorsForDump `
        -storage $p.storage `
        -stdoutPath $stdoutPath `
        -stderrPath $stderrPath

      $href = [string]$dom.href
      $elementCount = To-Int $dom.elementCount
      $preview = [string]$dom.bodyTextPreview
      if ([string]::IsNullOrWhiteSpace($preview)) {
        $preview = [string]$dom.bodyHtmlPreview
      }
      if ($preview.Length -gt 240) { $preview = $preview.Substring(0, 240) }

      if (-not [string]::IsNullOrWhiteSpace([string]$p.expectedUrlContains)) {
        if (-not (Contains-IgnoreCase -Text $href -Needle ([string]$p.expectedUrlContains))) {
          throw ("href mismatch, expected fragment {0} but got {1}" -f [string]$p.expectedUrlContains, $href)
        }
      }

      if ($elementCount -lt (To-Int $p.minElements)) {
        throw ("elementCount too small: {0} < {1}" -f $elementCount, (To-Int $p.minElements))
      }

      $runtimeExceptions = @()
      if ($dom.runtimeExceptions) { $runtimeExceptions = @($dom.runtimeExceptions) }
      $runtimeExceptionCount = $runtimeExceptions.Count
      if ($runtimeExceptionCount -gt 0) {
        $msgs = @($runtimeExceptions | ForEach-Object { [string]$_.text } | Select-Object -First 3)
        throw ("runtime exception(s): {0}" -f ($msgs -join " | "))
      }

      $consoleErrors = @()
      if ($dom.consoleErrors) { $consoleErrors = @($dom.consoleErrors) }
      $severeConsoleMessages = @()
      foreach ($entry in $consoleErrors) {
        $text = [string]$entry.text
        if ([string]::IsNullOrWhiteSpace($text)) { continue }

        $ignored = $false
        foreach ($ignorePattern in $consoleErrorIgnorePatterns) {
          if (Contains-IgnoreCase -Text $text -Needle $ignorePattern) {
            $ignored = $true
            break
          }
        }
        if ($ignored) { continue }

        foreach ($severePattern in $consoleErrorSeverePatterns) {
          if (Contains-IgnoreCase -Text $text -Needle $severePattern) {
            $severeConsoleMessages += $text
            break
          }
        }
      }
      $severeConsoleCount = $severeConsoleMessages.Count
      if ($severeConsoleCount -gt 0) {
        throw ("severe console error(s): {0}" -f (($severeConsoleMessages | Select-Object -First 3) -join " | "))
      }

      $selectorChecks = @()
      if ($dom.selectorChecks) { $selectorChecks = @($dom.selectorChecks) }

      $missingSelectorsAll = @()
      if ($p.selectorsAll) {
        foreach ($sel in $p.selectorsAll) {
          if (-not (Get-SelectorMatched -SelectorChecks $selectorChecks -Selector $sel)) {
            $missingSelectorsAll += $sel
          }
        }
      }
      if ($missingSelectorsAll.Count -gt 0) {
        throw ("selectorsAll missing: {0}" -f ($missingSelectorsAll -join " | "))
      }

      if ($p.selectorsAny -and $p.selectorsAny.Count -gt 0) {
        foreach ($sel in $p.selectorsAny) {
          if (Get-SelectorMatched -SelectorChecks $selectorChecks -Selector $sel) {
            $matchedSelectorAny = $sel
            break
          }
        }
        if ([string]::IsNullOrWhiteSpace($matchedSelectorAny)) {
          throw ("selectorsAny not matched: {0}" -f ($p.selectorsAny -join " | "))
        }
      }

      if ($p.textAny -and $p.textAny.Count -gt 0) {
        $textPool = [string]$dom.bodyTextPreview + " " + [string]$dom.bodyHtmlPreview
        foreach ($needle in $p.textAny) {
          if (Contains-IgnoreCase -Text $textPool -Needle $needle) {
            $matchedTextAny = $needle
            break
          }
        }
        if ([string]::IsNullOrWhiteSpace($matchedTextAny)) {
          throw ("textAny not matched: {0}" -f ($p.textAny -join " | "))
        }
      }
    } catch {
      $ok = $false
      $trace = $_.ScriptStackTrace
      if ([string]::IsNullOrWhiteSpace($trace)) {
        $err = $_.Exception.Message
      } else {
        $err = "$($_.Exception.Message) :: $trace"
      }
    }

    $results += [pscustomobject]@{
      name = $p.name
      url = $url
      href = $href
      ok = $ok
      elementCount = $elementCount
      matchedSelectorAny = $matchedSelectorAny
      matchedTextAny = $matchedTextAny
      runtimeExceptionCount = $runtimeExceptionCount
      severeConsoleCount = $severeConsoleCount
      preview = $preview
      error = $err
    }
  }

  $summary = [pscustomobject]@{
    total = $results.Count
    passed = @($results | Where-Object { $_.ok }).Count
    failed = @($results | Where-Object { -not $_.ok }).Count
    requestedMode = $Mode
    mode = $effectiveMode
  }

  $resultPath = Join-Path $logDir "ui-dom-smoke-$ReportDate.json"
  $summaryPath = Join-Path $logDir "ui-dom-smoke-$ReportDate-summary.json"
  (ConvertTo-Json -InputObject @($results) -Depth 6) | Out-File -Encoding UTF8 $resultPath
  $summary | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $summaryPath

  if ($summary.failed -gt 0) { throw "ui-dom-smoke failed: $($summary.failed)" }
  Write-Host ($summary | ConvertTo-Json -Compress)
} finally {
  foreach ($proc in @($mockProc, $clientProc, $adminProc)) {
    if ($proc) {
      Stop-ProcessTree -RootPid $proc.Id
    }
  }
}
