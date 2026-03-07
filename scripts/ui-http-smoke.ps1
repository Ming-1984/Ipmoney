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

function Stop-ProcessTree([int]$RootPid) {
  if ($RootPid -le 0) { return }
  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootPid" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Stop-ProcessTree -RootPid ([int]$child.ProcessId)
  }
  Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
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

function Contains-IgnoreCase([string]$Text, [string]$Needle) {
  if ([string]::IsNullOrWhiteSpace($Needle)) { return $false }
  if ($null -eq $Text) { return $false }
  return $Text.IndexOf($Needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Invoke-HttpProbe([string]$Url, [hashtable]$Headers) {
  $headerPath = Join-Path $env:TEMP ("ui-http-smoke-header-{0}.tmp" -f ([Guid]::NewGuid().ToString("N")))
  $bodyPath = Join-Path $env:TEMP ("ui-http-smoke-body-{0}.tmp" -f ([Guid]::NewGuid().ToString("N")))
  $statusCode = 0
  $contentType = ""
  $body = ""
  try {
    $args = @("-s", "-L", "-D", $headerPath, "-o", $bodyPath, "-w", "%{http_code}")
    if ($Headers) {
      foreach ($k in $Headers.Keys) {
        $args += @("-H", "${k}: $($Headers[$k])")
      }
    }
    $args += $Url

    $statusRaw = & curl.exe @args
    if ($LASTEXITCODE -eq 0) {
      [int]::TryParse([string]$statusRaw, [ref]$statusCode) | Out-Null
    }

    if (Test-Path $headerPath) {
      $headerText = Get-Content -Raw -Path $headerPath -ErrorAction SilentlyContinue
      if ($headerText) {
        $headerLines = $headerText -split "`r?`n"
        foreach ($line in $headerLines) {
          if ($line -match "^\s*Content-Type\s*:\s*(.+?)\s*$") {
            $contentType = [string]$Matches[1]
          }
        }
      }
    }

    if (Test-Path $bodyPath) {
      $body = Get-Content -Raw -Path $bodyPath -ErrorAction SilentlyContinue
      if ($null -eq $body) { $body = "" }
    }
  } finally {
    Remove-Item -Path $headerPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $bodyPath -Force -ErrorAction SilentlyContinue
  }

  return [pscustomobject]@{
    status = $statusCode
    contentType = $contentType
    bodyLength = $body.Length
  }
}

function Get-ClientH5RoutesFromAppConfig([string]$ConfigPath) {
  if (-not (Test-Path $ConfigPath)) {
    throw "client app config not found: $ConfigPath"
  }

  $raw = Get-Content $ConfigPath -Raw -Encoding UTF8
  $routes = New-Object System.Collections.Generic.List[string]
  $routeSet = New-Object 'System.Collections.Generic.HashSet[string]'

  $mainPagesMatch = [regex]::Match($raw, "pages\s*:\s*\[(?<body>[\s\S]*?)\]\s*,\s*subPackages\s*:")
  if ($mainPagesMatch.Success) {
    $mainPagesBody = $mainPagesMatch.Groups["body"].Value
    $mainPageMatches = [regex]::Matches($mainPagesBody, "'([^']+)'")
    foreach ($mainPageMatch in $mainPageMatches) {
      $path = [string]$mainPageMatch.Groups[1].Value
      if ([string]::IsNullOrWhiteSpace($path)) { continue }
      $route = "/#/" + $path.TrimStart("/")
      if ($routeSet.Add($route)) {
        [void]$routes.Add($route)
      }
    }
  }

  $subPackagesMatch = [regex]::Match($raw, "subPackages\s*:\s*\[(?<body>[\s\S]*?)\]\s*,\s*window\s*:")
  if ($subPackagesMatch.Success) {
    $subPackagesBody = $subPackagesMatch.Groups["body"].Value
    $subPackageBlocks = [regex]::Matches(
      $subPackagesBody,
      "root\s*:\s*'([^']+)'\s*,\s*pages\s*:\s*\[(.*?)\]",
      [System.Text.RegularExpressions.RegexOptions]::Singleline
    )
    foreach ($subPackageBlock in $subPackageBlocks) {
      $root = [string]$subPackageBlock.Groups[1].Value
      $pagesBody = [string]$subPackageBlock.Groups[2].Value
      if ([string]::IsNullOrWhiteSpace($root)) { continue }
      $root = $root.Trim("/")
      $subPageMatches = [regex]::Matches($pagesBody, "'([^']+)'")
      foreach ($subPageMatch in $subPageMatches) {
        $subPath = [string]$subPageMatch.Groups[1].Value
        if ([string]::IsNullOrWhiteSpace($subPath)) { continue }
        $route = "/#/" + $root + "/" + $subPath.TrimStart("/")
        if ($routeSet.Add($route)) {
          [void]$routes.Add($route)
        }
      }
    }
  }

  return ,$routes
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
$clientCmd = "`$env:NODE_OPTIONS='--max-old-space-size=4096'; `$env:TARO_APP_API_BASE_URL='http://127.0.0.1:$resolvedMockPort'; `$env:CLIENT_H5_PORT='$resolvedClientPort'; `$env:TARO_APP_ENABLE_MOCK_TOOLS='0'; pnpm -C apps/client dev:h5"
$adminCmd = "`$env:VITE_API_BASE_URL='http://127.0.0.1:$resolvedMockPort'; `$env:ADMIN_WEB_PORT='$resolvedAdminPort'; `$env:VITE_ENABLE_MOCK_TOOLS='0'; pnpm -C apps/admin-web dev"

$mockProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $mockCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $mockOut -RedirectStandardError $mockErr
$clientProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $clientCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $clientOut -RedirectStandardError $clientErr
$adminProc = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $adminCmd) -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $adminOut -RedirectStandardError $adminErr

try {
  Wait-Status -Url "http://127.0.0.1:$resolvedMockPort/health" -TimeoutSec $WaitMockSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$resolvedClientPort" -TimeoutSec $WaitClientSec -Headers @{} | Out-Null
  Wait-Status -Url "http://127.0.0.1:$resolvedAdminPort" -TimeoutSec $WaitAdminSec -Headers @{} | Out-Null

  $sampleOrderId = "e9032d03-9b23-40ba-84a3-ac681f21c41b"
  $adminRouteChecks = @(
    @{ name = "admin-login"; path = "/login" },
    @{ name = "admin-dashboard"; path = "/" },
    @{ name = "admin-orders"; path = "/orders" },
    @{ name = "admin-order-detail"; path = "/orders/$sampleOrderId" },
    @{ name = "admin-refunds"; path = "/refunds" },
    @{ name = "admin-settlements"; path = "/settlements" },
    @{ name = "admin-invoices"; path = "/invoices" },
    @{ name = "admin-listings"; path = "/listings" },
    @{ name = "admin-demands"; path = "/demands" },
    @{ name = "admin-achievements"; path = "/achievements" },
    @{ name = "admin-artworks"; path = "/artworks" },
    @{ name = "admin-tech-managers"; path = "/tech-managers" },
    @{ name = "admin-cases"; path = "/cases" },
    @{ name = "admin-reports"; path = "/reports" },
    @{ name = "admin-comments"; path = "/comments" },
    @{ name = "admin-announcements"; path = "/announcements" },
    @{ name = "admin-alerts"; path = "/alerts" },
    @{ name = "admin-verifications"; path = "/verifications" },
    @{ name = "admin-rbac"; path = "/rbac" },
    @{ name = "admin-config"; path = "/config" },
    @{ name = "admin-maintenance"; path = "/maintenance" },
    @{ name = "admin-regions"; path = "/regions" },
    @{ name = "admin-patent-map"; path = "/patent-map" },
    @{ name = "admin-audit-logs"; path = "/audit-logs" },
    @{ name = "admin-patents"; path = "/patents" }
  )

  $checks = @(
    @{
      name = "mock-health"; url = "http://127.0.0.1:$resolvedMockPort/health"; headers = @{ "X-Mock-Scenario" = "happy" }
      expectedContentType = "application/json"; minBodyLength = 8
    },
    @{
      name = "mock-orders"; url = "http://127.0.0.1:$resolvedMockPort/orders"; headers = @{ "X-Mock-Scenario" = "happy" }
      expectedContentType = "application/json"; minBodyLength = 16
    },
    @{
      name = "client-home"; url = "http://127.0.0.1:$resolvedClientPort/"; headers = @{}
      expectedContentType = "text/html"; minBodyLength = 200
    }
  )

  $clientAppConfigPath = Join-Path $repoRoot "apps/client/src/app.config.ts"
  $clientRoutePaths = Get-ClientH5RoutesFromAppConfig -ConfigPath $clientAppConfigPath
  $clientRouteIndex = 0
  foreach ($clientRoutePath in $clientRoutePaths) {
    $clientRouteIndex += 1
    $routeSlug = ($clientRoutePath -replace "^/#/", "" -replace "[^a-zA-Z0-9]+", "-").Trim("-").ToLower()
    if ([string]::IsNullOrWhiteSpace($routeSlug)) {
      $routeSlug = "route-$clientRouteIndex"
    }
    $checks += @{
      name = ("client-route-{0:D2}-{1}" -f $clientRouteIndex, $routeSlug)
      url = "http://127.0.0.1:$resolvedClientPort$clientRoutePath"
      headers = @{}
      expectedContentType = "text/html"
      minBodyLength = 200
    }
  }

  foreach ($routeCheck in $adminRouteChecks) {
    $checks += @{
      name = $routeCheck.name
      url = "http://127.0.0.1:$resolvedAdminPort$($routeCheck.path)"
      headers = @{}
      expectedContentType = "text/html"
      minBodyLength = 200
    }
  }

  $results = @()
  foreach ($c in $checks) {
    $probe = Invoke-HttpProbe -Url $c.url -Headers $c.headers
    $status = $probe.status
    $contentType = [string]$probe.contentType
    $bodyLength = [int]$probe.bodyLength
    $reasons = New-Object System.Collections.Generic.List[string]

    if (-not ($status -ge 200 -and $status -lt 400)) {
      [void]$reasons.Add(("status={0}" -f $status))
    }

    if ($c.ContainsKey("expectedContentType")) {
      $expectedContentType = [string]$c.expectedContentType
      if (-not (Contains-IgnoreCase -Text $contentType -Needle $expectedContentType)) {
        [void]$reasons.Add(("content-type expected contains {0} but got {1}" -f $expectedContentType, $contentType))
      }
    }

    if ($c.ContainsKey("minBodyLength")) {
      $minBodyLength = [int]$c.minBodyLength
      if ($bodyLength -lt $minBodyLength) {
        [void]$reasons.Add(("body-length expected >= {0} but got {1}" -f $minBodyLength, $bodyLength))
      }
    }

    $pass = $reasons.Count -eq 0
    $results += [pscustomobject]@{
      name = $c.name
      url = $c.url
      status = $status
      contentType = $contentType
      bodyLength = $bodyLength
      pass = $pass
      reason = ($reasons -join "; ")
    }
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
    if ($proc) {
      Stop-ProcessTree -RootPid $proc.Id
    }
  }
}
