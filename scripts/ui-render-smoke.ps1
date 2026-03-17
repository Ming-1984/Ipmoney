[CmdletBinding()]
param(
  [int]$MockPort = 4010,
  [int]$PrismPort = 4011,
  [int]$ClientPort = 5173,
  [int]$AdminPort = 5174,
  [string]$ReportDate = "",
  [string]$OutDir = "",
  [string]$BrowserExe = "",
  [ValidateSet("core","full")][string]$Mode = "core",
  [string[]]$PageFilter = @(),
  [switch]$ForceDemoAuth,
  [ValidateSet("auto","new","old")][string]$HeadlessMode = "auto",
  [switch]$MinimalArgs,
  [int]$WaitMockSec = 240,
  [int]$WaitClientSec = 420,
  [int]$WaitAdminSec = 240,
  [int]$WarmupSec = 30,
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

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = "docs/demo/rendered/ui-smoke-$ReportDate"
}

function Test-PortAvailable([int]$Port) {
  if ($Port -lt 1 -or $Port -gt 65535) { return $false }

  try {
    $activeListeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    foreach ($endpoint in $activeListeners) {
      if ([int]$endpoint.Port -eq $Port) {
        return $false
      }
    }
  } catch {
    # Fall through to socket probe.
  }

  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
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

function Stop-ProcessTree([int]$RootPid) {
  if ($RootPid -le 0) { return }
  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootPid" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Stop-ProcessTree -RootPid ([int]$child.ProcessId)
  }
  Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
}

function Get-LogTail([string]$Path, [int]$MaxLines = 40) {
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path $Path)) {
    return ""
  }
  $lines = @(Get-Content -Path $Path -Tail $MaxLines -ErrorAction SilentlyContinue)
  if ($lines.Count -eq 0) { return "" }
  return (($lines -join [Environment]::NewLine).Trim())
}

function Assert-ProcessRunning(
  [System.Diagnostics.Process]$Process,
  [string]$Name,
  [string]$StdErrPath,
  [string]$StdOutPath
) {
  if ($null -eq $Process) {
    throw ("{0} process did not start" -f $Name)
  }
  if (-not $Process.HasExited) { return }

  $stderrTail = Get-LogTail -Path $StdErrPath
  $stdoutTail = Get-LogTail -Path $StdOutPath
  $detail = ""
  if (-not [string]::IsNullOrWhiteSpace($stderrTail)) {
    $detail = $stderrTail
  } elseif (-not [string]::IsNullOrWhiteSpace($stdoutTail)) {
    $detail = $stdoutTail
  } else {
    $detail = "no process output captured"
  }

  throw ("{0} process exited early (pid={1}, code={2}) :: {3}" -f $Name, $Process.Id, $Process.ExitCode, $detail)
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

function Invoke-Capture(
  [string]$browserExe,
  [string]$userDataDir,
  [string]$url,
  [string]$pngOut,
  [int]$width,
  [int]$height,
  [int]$waitMs,
  [int]$timeoutSec
) {
  $headlessArg = "--headless"
  if ($HeadlessMode -eq "new") { $headlessArg = "--headless=new" }
  if ($HeadlessMode -eq "old") { $headlessArg = "--headless=old" }

  $commonArgs = @(
    $headlessArg,
    "--user-data-dir=`"$userDataDir`"",
    "--window-size=$width,$height"
  )

  if (-not $MinimalArgs) {
    $commonArgs += @(
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=CalculateNativeWinOcclusion",
      "--virtual-time-budget=$waitMs",
      "--run-all-compositor-stages-before-draw"
    )
  }

  $args = @($commonArgs + @("--screenshot=`"$pngOut`"", "`"$url`""))
  $proc = Start-Process -FilePath $browserExe -ArgumentList $args -PassThru -WindowStyle Hidden
  $timeoutMs = [Math]::Max(1000, $timeoutSec * 1000)
  if (-not $proc.WaitForExit($timeoutMs)) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    throw "Screenshot timeout: $url"
  }
  if ($proc.ExitCode -ne 0) { throw "Screenshot failed: $url" }
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

function Normalize-ClientH5Fragment([string]$Fragment) {
  if ([string]::IsNullOrWhiteSpace($Fragment)) { return $Fragment }
  if (-not $Fragment.StartsWith("#/pages/")) { return $Fragment }

  $mainRoutes = @(
    "#/pages/home/index",
    "#/pages/tech-managers/index",
    "#/pages/publish/index",
    "#/pages/messages/index",
    "#/pages/me/index"
  )

  foreach ($route in $mainRoutes) {
    if ($Fragment -eq $route) { return $Fragment }
  }

  return ($Fragment -replace "^#/pages/", "#/subpackages/")
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

if ($resolvedMockPort -ne $MockPort) { Write-Host ("[ui-render-smoke] mock port fallback: {0} -> {1}" -f $MockPort, $resolvedMockPort) }
if ($resolvedPrismPort -ne $PrismPort) { Write-Host ("[ui-render-smoke] prism port fallback: {0} -> {1}" -f $PrismPort, $resolvedPrismPort) }
if ($resolvedClientPort -ne $ClientPort) { Write-Host ("[ui-render-smoke] client port fallback: {0} -> {1}" -f $ClientPort, $resolvedClientPort) }
if ($resolvedAdminPort -ne $AdminPort) { Write-Host ("[ui-render-smoke] admin port fallback: {0} -> {1}" -f $AdminPort, $resolvedAdminPort) }

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null

$mockOut = Join-Path $logDir "ui-render-mock.out.log"
$mockErr = Join-Path $logDir "ui-render-mock.err.log"
$clientOut = Join-Path $logDir "ui-render-client.out.log"
$clientErr = Join-Path $logDir "ui-render-client.err.log"
$adminOut = Join-Path $logDir "ui-render-admin.out.log"
$adminErr = Join-Path $logDir "ui-render-admin.err.log"

$mockCmd = "`$env:MOCK_API_PORT='$resolvedMockPort'; `$env:MOCK_API_PRISM_PORT='$resolvedPrismPort'; pnpm mock"
$clientCmd = "`$env:NODE_OPTIONS='--max-old-space-size=4096'; `$env:TARO_APP_API_BASE_URL='http://127.0.0.1:$resolvedMockPort'; `$env:CLIENT_H5_PORT='$resolvedClientPort'; `$env:TARO_APP_ENABLE_MOCK_TOOLS='0'; `$env:DEMO_AUTH_ENABLED='true'; `$env:DEMO_PAYMENT_ENABLED='true'; pnpm -C apps/client dev:h5"
$adminCmd = "`$env:VITE_API_BASE_URL='http://127.0.0.1:$resolvedMockPort'; `$env:ADMIN_WEB_PORT='$resolvedAdminPort'; `$env:VITE_ENABLE_MOCK_TOOLS='0'; pnpm -C apps/admin-web dev"

$mockProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $mockCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $mockOut -RedirectStandardError $mockErr
$clientProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $clientCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $clientOut -RedirectStandardError $clientErr
$adminProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $adminCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $adminOut -RedirectStandardError $adminErr

try {
  Start-Sleep -Milliseconds 1200
  Assert-ProcessRunning -Process $mockProc -Name "mock" -StdErrPath $mockErr -StdOutPath $mockOut
  Assert-ProcessRunning -Process $clientProc -Name "client" -StdErrPath $clientErr -StdOutPath $clientOut
  Assert-ProcessRunning -Process $adminProc -Name "admin" -StdErrPath $adminErr -StdOutPath $adminOut

  Wait-Status -Url "http://127.0.0.1:$resolvedMockPort/health" -TimeoutSec $WaitMockSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$resolvedClientPort" -TimeoutSec $WaitClientSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$resolvedAdminPort" -TimeoutSec $WaitAdminSec -Headers @{} | Out-Null
  if ($WarmupSec -gt 0) {
    Start-Sleep -Seconds $WarmupSec
  }

  Assert-ProcessRunning -Process $mockProc -Name "mock" -StdErrPath $mockErr -StdOutPath $mockOut
  Assert-ProcessRunning -Process $clientProc -Name "client" -StdErrPath $clientErr -StdOutPath $clientOut
  Assert-ProcessRunning -Process $adminProc -Name "admin" -StdErrPath $adminErr -StdOutPath $adminOut

  $browser = Find-BrowserExe $BrowserExe
  $outDirAbs = Join-Path $repoRoot $OutDir
  $userDataAbs = Join-Path $repoRoot (".tmp/ui-render-profile-{0}" -f $ReportDate)
  if (Test-Path $userDataAbs) {
    $userDataAbs = Join-Path $repoRoot (".tmp/ui-render-profile-{0}-{1}" -f $ReportDate, (Get-Date).ToString("HHmmss"))
  }
  New-Item -ItemType Directory -Force $outDirAbs | Out-Null
  New-Item -ItemType Directory -Force $userDataAbs | Out-Null

  $clientBase = "http://127.0.0.1:$resolvedClientPort"
  $adminBase = "http://127.0.0.1:$resolvedAdminPort"

  $pages = @()
  if ($Mode -eq "full") {
    $pages = @(
      @{ name = "client-home"; path = "#/pages/home/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-tech-managers"; path = "#/pages/tech-managers/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-publish-entry"; path = "#/pages/publish/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-search"; path = "#/pages/search/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-listing-detail"; path = "#/pages/listing/detail/index?listingId=$($sample.listingId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-patent-detail"; path = "#/pages/patent/detail/index?patentId=$($sample.patentId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-artwork-detail"; path = "#/pages/artwork/detail/index?artworkId=$($sample.artworkId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-demand-detail"; path = "#/pages/demand/detail/index?demandId=$($sample.demandId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-achievement-detail"; path = "#/pages/achievement/detail/index?achievementId=$($sample.achievementId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-organizations"; path = "#/pages/organizations/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-organization-detail"; path = "#/pages/organizations/detail/index?orgUserId=$($sample.orgUserId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-patent-map"; path = "#/pages/patent-map/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-patent-map-region-detail"; path = "#/pages/patent-map/region-detail/index?regionCode=$($sample.regionCode)&year=$($sample.year)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-inventors"; path = "#/pages/inventors/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-tech-manager-detail"; path = "#/pages/tech-managers/detail/index?techManagerId=$($sample.techManagerId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-trade-rules"; path = "#/pages/trade-rules/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-login"; path = "#/pages/login/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-messages"; path = "#/pages/messages/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-chat"; path = "#/pages/messages/chat/index?conversationId=$($sample.conversationId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-notifications"; path = "#/pages/notifications/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-notification-detail"; path = "#/pages/notifications/detail/index?id=$($sample.notificationId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-announcements"; path = "#/pages/announcements/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-announcement-detail"; path = "#/pages/announcements/detail/index?id=$($sample.announcementId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-orders"; path = "#/pages/orders/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-order-detail"; path = "#/pages/orders/detail/index?orderId=$($sample.orderId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-favorites"; path = "#/pages/favorites/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-contracts"; path = "#/pages/contracts/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-invoices"; path = "#/pages/invoices/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-addresses"; path = "#/pages/addresses/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-address-edit"; path = "#/pages/addresses/edit/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-deposit-pay"; path = "#/pages/checkout/deposit-pay/index?listingId=$($sample.listingId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-deposit-success"; path = "#/pages/checkout/deposit-success/index?orderId=$($sample.orderId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-final-pay"; path = "#/pages/checkout/final-pay/index?orderId=$($sample.orderId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-final-success"; path = "#/pages/checkout/final-success/index?orderId=$($sample.orderId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-my-listings"; path = "#/pages/my-listings/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-my-demands"; path = "#/pages/my-demands/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-my-achievements"; path = "#/pages/my-achievements/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-my-artworks"; path = "#/pages/my-artworks/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-publish-patent"; path = "#/pages/publish/patent/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-publish-demand"; path = "#/pages/publish/demand/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-publish-achievement"; path = "#/pages/publish/achievement/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-publish-artwork"; path = "#/pages/publish/artwork/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-cluster-picker"; path = "#/pages/cluster-picker/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-settings-notifications"; path = "#/pages/settings/notifications/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-about"; path = "#/pages/about/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-support"; path = "#/pages/support/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-support-faq"; path = "#/pages/support/faq/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-support-faq-detail"; path = "#/pages/support/faq/detail/index?id=faq-1"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-support-contact"; path = "#/pages/support/contact/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-legal-privacy"; path = "#/pages/legal/privacy/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-legal-terms"; path = "#/pages/legal/terms/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-legal-privacy-guide"; path = "#/pages/legal/privacy-guide/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-profile-edit"; path = "#/pages/profile/edit/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-onboarding-choose-identity"; path = "#/pages/onboarding/choose-identity/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-onboarding-verification-form"; path = "#/pages/onboarding/verification-form/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-region-picker"; path = "#/pages/region-picker/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-ipc-picker"; path = "#/pages/ipc-picker/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-me"; path = "#/pages/me/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },

      @{ name = "admin-login"; path = "/login"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-dashboard"; path = "/"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-orders"; path = "/orders"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-order-detail"; path = "/orders/$($sample.orderId)"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-refunds"; path = "/refunds"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-settlements"; path = "/settlements"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-invoices"; path = "/invoices"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-listings"; path = "/listings"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-demands"; path = "/demands"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-achievements"; path = "/achievements"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-artworks"; path = "/artworks"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-tech-managers"; path = "/tech-managers"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-cases"; path = "/cases"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-reports"; path = "/reports"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-comments"; path = "/comments"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-announcements"; path = "/announcements"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-alerts"; path = "/alerts"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-verifications"; path = "/verifications"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-rbac"; path = "/rbac"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-config"; path = "/config"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-maintenance"; path = "/maintenance"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-regions"; path = "/regions"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-patent-map"; path = "/patent-map"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-audit-logs"; path = "/audit-logs"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-patents"; path = "/patents"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs }
    )
  } else {
    $pages = @(
      @{ name = "client-home"; path = "#/pages/home/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-login"; path = "#/pages/login/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "admin-login"; path = "/login"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs }
    )
  }

  if ($PageFilter -and $PageFilter.Count -gt 0) {
    $filter = @($PageFilter | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($filter.Count -gt 0) {
      $pages = @($pages | Where-Object { $filter -contains $_.name })
    }
  }

  $results = @()
  foreach ($p in $pages) {
    $baseUrl = if ($p.base) { $p.base } else { $clientBase }
    $normalizedPath = [string]$p.path
    if ($baseUrl -eq $clientBase) {
      $normalizedPath = Normalize-ClientH5Fragment -Fragment $normalizedPath
    }

    $rawUrl = if ($normalizedPath.StartsWith("http")) { $normalizedPath } elseif ($normalizedPath.StartsWith("/")) { "$baseUrl$normalizedPath" } else { "$baseUrl/$normalizedPath" }
    $useDemoAuth = $p.demoAuth -or ($ForceDemoAuth -and $baseUrl -eq $clientBase)
    $url = if ($useDemoAuth) { Add-QueryParam $rawUrl "__demo_auth" "1" } else { $rawUrl }
    $pngOut = Join-Path $outDirAbs ("{0}.png" -f $p.name)
    $ok = $true
    $err = ""
    try {
      Assert-ProcessRunning -Process $mockProc -Name "mock" -StdErrPath $mockErr -StdOutPath $mockOut
      Assert-ProcessRunning -Process $clientProc -Name "client" -StdErrPath $clientErr -StdOutPath $clientOut
      Assert-ProcessRunning -Process $adminProc -Name "admin" -StdErrPath $adminErr -StdOutPath $adminOut

      Invoke-Capture $browser $userDataAbs $url $pngOut $p.width $p.height $p.waitMs $CaptureTimeoutSec
    } catch {
      $ok = $false
      $err = $_.Exception.Message
    }
    $results += [pscustomobject]@{ name = $p.name; url = $url; path = $pngOut; ok = $ok; error = $err }
  }

  $summary = [pscustomobject]@{
    total  = $results.Count
    passed = @($results | Where-Object { $_.ok }).Count
    failed = @($results | Where-Object { -not $_.ok }).Count
  }

  $resultPath = Join-Path $logDir "ui-render-smoke-$ReportDate.json"
  $summaryPath = Join-Path $logDir "ui-render-smoke-$ReportDate-summary.json"
  $results | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $resultPath
  $summary | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $summaryPath

  if ($summary.failed -gt 0) { throw "ui-render-smoke failed: $($summary.failed)" }
  Write-Host ($summary | ConvertTo-Json -Compress)
} finally {
  foreach ($proc in @($mockProc, $clientProc, $adminProc)) {
    if ($proc) {
      Stop-ProcessTree -RootPid $proc.Id
    }
  }
}
