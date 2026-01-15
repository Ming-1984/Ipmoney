[CmdletBinding()]
param(
  [string]$ClientBaseUrl = "http://127.0.0.1:5173",
  [string]$AdminBaseUrl = "http://127.0.0.1:5174",
  [string]$OutDir = "docs/demo/rendered/ui",
  [string]$BrowserExe = "",
  [string]$UserDataDir = ".tmp/ui-capture-profile",
  [int]$ClientWidth = 390,
  [int]$ClientHeight = 844,
  [int]$AdminWidth = 1440,
  [int]$AdminHeight = 900,
  [int]$ClientWaitMs = 6500,
  [int]$AdminWaitMs = 4500,
  [switch]$IncludePdf,
  [switch]$MergeAll,
  [switch]$Zip,
  [switch]$ListOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Normalize-BaseUrl([string]$url) {
  $trimmed = ""
  if ($null -ne $url) { $trimmed = $url.Trim() }
  if ([string]::IsNullOrWhiteSpace($trimmed)) { return "" }
  return $trimmed.TrimEnd("/")
}

function Join-Url([string]$base, [string]$path) {
  $b = Normalize-BaseUrl $base
  $p = ""
  if ($null -ne $path) { $p = $path.Trim() }
  if ([string]::IsNullOrWhiteSpace($b)) { return $p }
  if ([string]::IsNullOrWhiteSpace($p)) { return $b }

  if ($p.StartsWith("http://") -or $p.StartsWith("https://")) {
    return $p
  }

  if ($p.StartsWith("/")) {
    return "$b$p"
  }

  return "$b/$p"
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
    # Fallback: simple concat.
    if ($baseUrl -like "*?*") { return "$baseUrl&$key=$value" }
    return "$baseUrl?$key=$value"
  }
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

function Test-HttpOk([string]$url, [int]$timeoutSeconds = 3) {
  try {
    $res = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec $timeoutSeconds -ErrorAction Stop
    return $res.StatusCode -ge 200 -and $res.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Invoke-Capture(
  [string]$browserExe,
  [string]$userDataDir,
  [string]$url,
  [string]$pngOut,
  [string]$pdfOut,
  [int]$width,
  [int]$height,
  [int]$waitMs,
  [bool]$includePdf
) {
  $commonArgs = @(
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--user-data-dir=$userDataDir",
    "--window-size=$width,$height",
    "--virtual-time-budget=$waitMs",
    "--run-all-compositor-stages-before-draw"
  )

  Write-Host "[capture] $url"

  if (-not [string]::IsNullOrWhiteSpace($pngOut)) {
    & $browserExe @commonArgs "--screenshot=$pngOut" $url | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Screenshot failed: $url" }
  }

  if ($includePdf -and -not [string]::IsNullOrWhiteSpace($pdfOut)) {
    & $browserExe @commonArgs "--print-to-pdf=$pdfOut" "--print-to-pdf-no-header" $url | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "PDF export failed: $url" }
  }
}

$clientBase = Normalize-BaseUrl $ClientBaseUrl
$adminBase = Normalize-BaseUrl $AdminBaseUrl

if ([string]::IsNullOrWhiteSpace($clientBase) -and [string]::IsNullOrWhiteSpace($adminBase)) {
  throw "At least one of -ClientBaseUrl or -AdminBaseUrl must be provided."
}

$browserExe = Find-BrowserExe $BrowserExe

$outDirAbs = $null
try {
  $outDirAbs = (Resolve-Path (Join-Path $repoRoot $OutDir) -ErrorAction Stop).Path
} catch {
  $outDirAbs = Join-Path $repoRoot $OutDir
}

$userDataAbs = $null
try {
  $userDataAbs = (Resolve-Path (Join-Path $repoRoot $UserDataDir) -ErrorAction Stop).Path
} catch {
  $userDataAbs = Join-Path $repoRoot $UserDataDir
}

New-Item -ItemType Directory -Force $outDirAbs | Out-Null
New-Item -ItemType Directory -Force $userDataAbs | Out-Null

$clientOut = Join-Path $outDirAbs "client"
$adminOut = Join-Path $outDirAbs "admin"
New-Item -ItemType Directory -Force $clientOut | Out-Null
New-Item -ItemType Directory -Force $adminOut | Out-Null

$sample = @{
  listingId = "7a490e63-8173-41e7-b4f0-0d0bb5ce7d20"
  patentId = "965f9831-2c44-48e8-8b7a-cd7ab40ff7ec"
  orgUserId = "c5b6438a-f3a7-4590-a484-0f2a2991c613"
  conversationId = "127a267b-d5f8-4b39-acf8-855dff7258b0"
  orderId = "e9032d03-9b23-40ba-84a3-ac681f21c41b"
  regionCode = "110000"
  year = 2025
}

$clientPages = @(
  @{ name = "home"; path = "#/pages/home/index"; demoAuth = $false },
  @{ name = "search"; path = "#/pages/search/index"; demoAuth = $false },
  @{ name = "patent-map"; path = "#/pages/patent-map/index"; demoAuth = $false },
  @{ name = "patent-map-region-detail"; path = "#/pages/patent-map/region-detail/index?regionCode=$($sample.regionCode)&year=$($sample.year)"; demoAuth = $false },
  @{ name = "inventors"; path = "#/pages/inventors/index"; demoAuth = $false },
  @{ name = "listing-detail"; path = "#/pages/listing/detail/index?listingId=$($sample.listingId)"; demoAuth = $false },
  @{ name = "patent-detail"; path = "#/pages/patent/detail/index?patentId=$($sample.patentId)"; demoAuth = $false },
  @{ name = "organizations"; path = "#/pages/organizations/index"; demoAuth = $false },
  @{ name = "organization-detail"; path = "#/pages/organizations/detail/index?orgUserId=$($sample.orgUserId)"; demoAuth = $false },
  @{ name = "trade-rules"; path = "#/pages/trade-rules/index"; demoAuth = $false },
  @{ name = "login"; path = "#/pages/login/index"; demoAuth = $false },

  @{ name = "onboarding-choose-identity"; path = "#/pages/onboarding/choose-identity/index"; demoAuth = $true },
  @{ name = "onboarding-verification-form"; path = "#/pages/onboarding/verification-form/index"; demoAuth = $true },
  @{ name = "region-picker"; path = "#/pages/region-picker/index"; demoAuth = $true },
  @{ name = "profile-edit"; path = "#/pages/profile/edit/index"; demoAuth = $true },

  @{ name = "messages"; path = "#/pages/messages/index"; demoAuth = $true },
  @{ name = "chat"; path = "#/pages/messages/chat/index?conversationId=$($sample.conversationId)"; demoAuth = $true },
  @{ name = "publish"; path = "#/pages/publish/index"; demoAuth = $true },
  @{ name = "publish-patent"; path = "#/pages/publish/patent/index"; demoAuth = $true },
  @{ name = "publish-demand"; path = "#/pages/publish/demand/index"; demoAuth = $true },
  @{ name = "publish-achievement"; path = "#/pages/publish/achievement/index"; demoAuth = $true },
  @{ name = "my-listings"; path = "#/pages/my-listings/index"; demoAuth = $true },
  @{ name = "favorites"; path = "#/pages/favorites/index"; demoAuth = $true },
  @{ name = "orders"; path = "#/pages/orders/index"; demoAuth = $true },
  @{ name = "order-detail"; path = "#/pages/orders/detail/index?orderId=$($sample.orderId)"; demoAuth = $true },
  @{ name = "checkout-deposit-pay"; path = "#/pages/checkout/deposit-pay/index?listingId=$($sample.listingId)"; demoAuth = $true },
  @{ name = "checkout-deposit-success"; path = "#/pages/checkout/deposit-success/index?orderId=$($sample.orderId)&paymentId=demo-payment-deposit"; demoAuth = $true },
  @{ name = "checkout-final-pay"; path = "#/pages/checkout/final-pay/index?orderId=$($sample.orderId)"; demoAuth = $true },
  @{ name = "checkout-final-success"; path = "#/pages/checkout/final-success/index?orderId=$($sample.orderId)&paymentId=demo-payment-final"; demoAuth = $true },
  @{ name = "me"; path = "#/pages/me/index"; demoAuth = $true }
)

$adminPages = @(
  @{ name = "login"; path = "/login" },
  @{ name = "dashboard"; path = "/" },
  @{ name = "verifications"; path = "/verifications" },
  @{ name = "listings"; path = "/listings" },
  @{ name = "orders"; path = "/orders" },
  @{ name = "refunds"; path = "/refunds" },
  @{ name = "settlements"; path = "/settlements" },
  @{ name = "invoices"; path = "/invoices" },
  @{ name = "config"; path = "/config" },
  @{ name = "regions"; path = "/regions" },
  @{ name = "patent-map"; path = "/patent-map" }
)

if ($ListOnly) {
  Write-Host "[capture] Browser: $browserExe"
  if (-not [string]::IsNullOrWhiteSpace($clientBase)) {
    Write-Host "[capture] Client base: $clientBase"
    foreach ($p in $clientPages) {
      $base = if ($p.demoAuth) { Add-QueryParam $clientBase "__demo_auth" "1" } else { $clientBase }
      $full = Join-Url $base "/$($p.path)"
      Write-Host ("  - client/{0}: {1}" -f $p.name, $full)
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($adminBase)) {
    Write-Host "[capture] Admin base: $adminBase"
    foreach ($p in $adminPages) {
      $full = Join-Url $adminBase $p.path
      Write-Host ("  - admin/{0}: {1}" -f $p.name, $full)
    }
  }
  return
}

if (-not [string]::IsNullOrWhiteSpace($clientBase)) {
  if (-not (Test-HttpOk $clientBase)) {
    throw "Client is not reachable at $clientBase. Start it first (e.g. scripts/demo.ps1) or pass the correct -ClientBaseUrl."
  }
}

if (-not [string]::IsNullOrWhiteSpace($adminBase)) {
  if (-not (Test-HttpOk $adminBase)) {
    throw "Admin web is not reachable at $adminBase. Start it first (e.g. scripts/demo.ps1) or pass the correct -AdminBaseUrl."
  }
}

Write-Host "[capture] Browser: $browserExe"
Write-Host "[capture] OutDir:  $outDirAbs"

if (-not [string]::IsNullOrWhiteSpace($clientBase)) {
  Write-Host "[capture] Capturing client pages..."
  foreach ($p in $clientPages) {
    $base = if ($p.demoAuth) { Add-QueryParam $clientBase "__demo_auth" "1" } else { $clientBase }
    $url = Join-Url $base "/$($p.path)"

    $pngOut = Join-Path $clientOut ("client-{0}.png" -f $p.name)
    $pdfOut = Join-Path $clientOut ("client-{0}.pdf" -f $p.name)
    Invoke-Capture $browserExe $userDataAbs $url $pngOut $pdfOut $ClientWidth $ClientHeight $ClientWaitMs ([bool]$IncludePdf)
  }
}

if (-not [string]::IsNullOrWhiteSpace($adminBase)) {
  Write-Host "[capture] Capturing admin pages..."
  foreach ($p in $adminPages) {
    $url = Join-Url $adminBase $p.path
    $pngOut = Join-Path $adminOut ("admin-{0}.png" -f $p.name)
    $pdfOut = Join-Path $adminOut ("admin-{0}.pdf" -f $p.name)
    Invoke-Capture $browserExe $userDataAbs $url $pngOut $pdfOut $AdminWidth $AdminHeight $AdminWaitMs ([bool]$IncludePdf)
  }
}

if ($Zip) {
  $zipPath = Join-Path $outDirAbs "ui-screenshots.zip"
  if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
  Compress-Archive -Path (Join-Path $outDirAbs "*") -DestinationPath $zipPath -Force
  Write-Host "[capture] Zipped: $zipPath"
}

if ($MergeAll) {
  $mergeScript = Join-Path $repoRoot "scripts/merge-ui-screenshots.py"
  if (-not (Test-Path $mergeScript)) {
    throw "Missing merger script: $mergeScript"
  }

  $outBoard = Join-Path $outDirAbs "ui-all.png"
  python $mergeScript --input-dir $outDirAbs --output $outBoard
  if ($LASTEXITCODE -ne 0) { throw "merge-ui-screenshots.py failed." }
  Write-Host "[capture] Board: $outBoard"
}

Write-Host "[capture] Done."
