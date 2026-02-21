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

function Stop-Ports([int[]]$ports) {
  foreach ($p in $ports) {
    try {
      $conns = @(Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)
      foreach ($procId in ($conns.OwningProcess | Sort-Object -Unique)) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    } catch { }
  }
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
  orgUserId = "c5b6438a-f3a7-4590-a484-0f2a2991c613"
  conversationId = "127a267b-d5f8-4b39-acf8-855dff7258b0"
  orderId = "e9032d03-9b23-40ba-84a3-ac681f21c41b"
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

$ports = @($MockPort, $PrismPort, $ClientPort, $AdminPort)
Stop-Ports $ports

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null

$mockOut = Join-Path $logDir "ui-render-mock.out.log"
$mockErr = Join-Path $logDir "ui-render-mock.err.log"
$clientOut = Join-Path $logDir "ui-render-client.out.log"
$clientErr = Join-Path $logDir "ui-render-client.err.log"
$adminOut = Join-Path $logDir "ui-render-admin.out.log"
$adminErr = Join-Path $logDir "ui-render-admin.err.log"

$mockCmd = "`$env:MOCK_API_PORT='$MockPort'; `$env:MOCK_API_PRISM_PORT='$PrismPort'; pnpm mock"
$clientCmd = "`$env:TARO_APP_API_BASE_URL='http://127.0.0.1:$MockPort'; `$env:CLIENT_H5_PORT='$ClientPort'; `$env:TARO_APP_ENABLE_MOCK_TOOLS='0'; pnpm -C apps/client dev:h5"
$adminCmd = "`$env:VITE_API_BASE_URL='http://127.0.0.1:$MockPort'; `$env:ADMIN_WEB_PORT='$AdminPort'; `$env:VITE_ENABLE_MOCK_TOOLS='0'; pnpm -C apps/admin-web dev"

$mockProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $mockCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $mockOut -RedirectStandardError $mockErr
$clientProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $clientCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $clientOut -RedirectStandardError $clientErr
$adminProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $adminCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $adminOut -RedirectStandardError $adminErr

try {
  Wait-Status -Url "http://127.0.0.1:$MockPort/health" -TimeoutSec $WaitMockSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$ClientPort" -TimeoutSec $WaitClientSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$AdminPort" -TimeoutSec $WaitAdminSec -Headers @{} | Out-Null
  if ($WarmupSec -gt 0) {
    Start-Sleep -Seconds $WarmupSec
  }

  $browser = Find-BrowserExe $BrowserExe
  $outDirAbs = Join-Path $repoRoot $OutDir
  $userDataAbs = Join-Path $repoRoot (".tmp/ui-render-profile-{0}" -f $ReportDate)
  if (Test-Path $userDataAbs) {
    $userDataAbs = Join-Path $repoRoot (".tmp/ui-render-profile-{0}-{1}" -f $ReportDate, (Get-Date).ToString("HHmmss"))
  }
  New-Item -ItemType Directory -Force $outDirAbs | Out-Null
  New-Item -ItemType Directory -Force $userDataAbs | Out-Null

  $clientBase = "http://127.0.0.1:$ClientPort"
  $adminBase = "http://127.0.0.1:$AdminPort"

  $pages = @()
  if ($Mode -eq "full") {
    $pages = @(
      @{ name = "client-home"; path = "#/pages/home/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-search"; path = "#/pages/search/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-listing-detail"; path = "#/pages/listing/detail/index?listingId=$($sample.listingId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-patent-detail"; path = "#/pages/patent/detail/index?patentId=$($sample.patentId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-organizations"; path = "#/pages/organizations/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-organization-detail"; path = "#/pages/organizations/detail/index?orgUserId=$($sample.orgUserId)"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-trade-rules"; path = "#/pages/trade-rules/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-login"; path = "#/pages/login/index"; demoAuth = $false; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-messages"; path = "#/pages/messages/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-chat"; path = "#/pages/messages/chat/index?conversationId=$($sample.conversationId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-orders"; path = "#/pages/orders/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-order-detail"; path = "#/pages/orders/detail/index?orderId=$($sample.orderId)"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-favorites"; path = "#/pages/favorites/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },
      @{ name = "client-me"; path = "#/pages/me/index"; demoAuth = $true; width = $ClientWidth; height = $ClientHeight; waitMs = $ClientWaitMs },

      @{ name = "admin-login"; path = "/login"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-dashboard"; path = "/"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-orders"; path = "/orders"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-refunds"; path = "/refunds"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-settlements"; path = "/settlements"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-invoices"; path = "/invoices"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-listings"; path = "/listings"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-verifications"; path = "/verifications"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
      @{ name = "admin-config"; path = "/config"; base = $adminBase; demoAuth = $false; width = $AdminWidth; height = $AdminHeight; waitMs = $AdminWaitMs },
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
    $rawUrl = if ($p.path.StartsWith("http")) { $p.path } elseif ($p.path.StartsWith("/")) { "$baseUrl$($p.path)" } else { "$baseUrl/$($p.path)" }
    $useDemoAuth = $p.demoAuth -or ($ForceDemoAuth -and $baseUrl -eq $clientBase)
    $url = if ($useDemoAuth) { Add-QueryParam $rawUrl "__demo_auth" "1" } else { $rawUrl }
    $pngOut = Join-Path $outDirAbs ("{0}.png" -f $p.name)
    $ok = $true
    $err = ""
    try {
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
    if ($proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  }
  Stop-Ports $ports
}
