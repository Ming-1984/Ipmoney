[CmdletBinding()]
param(
  [int]$MockPort = 4010,
  [int]$PrismPort = 4011,
  [int]$ClientPort = 5173,
  [int]$AdminPort = 5174,
  [string]$ReportDate = "",
  [string]$OutDir = "",
  [string]$BrowserExe = "",
  [string]$UserDataDir = ".tmp/ui-capture-profile",
  [int]$WaitMockSec = 240,
  [int]$WaitClientSec = 420,
  [int]$WaitAdminSec = 240,
  [int]$ClientWidth = 390,
  [int]$ClientHeight = 844,
  [int]$AdminWidth = 1440,
  [int]$AdminHeight = 900,
  [int]$ClientWaitMs = 6500,
  [int]$AdminWaitMs = 4500,
  [int]$CaptureTimeoutSec = 120,
  [ValidateSet("auto","new","old")][string]$HeadlessMode = "auto",
  [switch]$MinimalArgs,
  [switch]$UseVirtualTimeBudget,
  [string[]]$PageFilter = @(),
  [switch]$ForceDemoAuth,
  [switch]$Zip,
  [switch]$MergeAll
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($ReportDate)) {
  $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
}

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = "docs/demo/rendered/ui-capture-$ReportDate"
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

$ports = @($MockPort, $PrismPort, $ClientPort, $AdminPort)
Stop-Ports $ports

$logDir = Join-Path $repoRoot ".tmp"
New-Item -ItemType Directory -Force $logDir | Out-Null

$mockOut = Join-Path $logDir "ui-capture-mock.out.log"
$mockErr = Join-Path $logDir "ui-capture-mock.err.log"
$clientOut = Join-Path $logDir "ui-capture-client.out.log"
$clientErr = Join-Path $logDir "ui-capture-client.err.log"
$adminOut = Join-Path $logDir "ui-capture-admin.out.log"
$adminErr = Join-Path $logDir "ui-capture-admin.err.log"

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

  $captureParams = @{
    ClientBaseUrl      = "http://127.0.0.1:$ClientPort"
    AdminBaseUrl       = "http://127.0.0.1:$AdminPort"
    OutDir             = $OutDir
    UserDataDir        = $UserDataDir
    ClientWidth        = $ClientWidth
    ClientHeight       = $ClientHeight
    AdminWidth         = $AdminWidth
    AdminHeight        = $AdminHeight
    ClientWaitMs       = $ClientWaitMs
    AdminWaitMs        = $AdminWaitMs
    CaptureTimeoutSec  = $CaptureTimeoutSec
    HeadlessMode       = $HeadlessMode
  }
  if ($MinimalArgs) { $captureParams.MinimalArgs = $true }
  if ($UseVirtualTimeBudget) { $captureParams.UseVirtualTimeBudget = $true }
  if ($ForceDemoAuth) { $captureParams.ForceDemoAuth = $true }
  if ($PageFilter -and $PageFilter.Count -gt 0) { $captureParams.PageFilter = $PageFilter }
  if ($Zip) { $captureParams.Zip = $true }
  if ($MergeAll) { $captureParams.MergeAll = $true }
  if (-not [string]::IsNullOrWhiteSpace($BrowserExe)) { $captureParams.BrowserExe = $BrowserExe }

  $captureScript = Join-Path $repoRoot "scripts/capture-ui.ps1"
  $argsLog = Join-Path $logDir "ui-capture-full-args.txt"
  $captureParams.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" } | Out-File -Encoding UTF8 $argsLog
  & $captureScript @captureParams
  if ($LASTEXITCODE -ne 0) { throw "capture-ui failed" }

  $outDirAbs = Join-Path $repoRoot $OutDir
  $pngCount = @(Get-ChildItem -Path $outDirAbs -Recurse -File -Filter *.png -ErrorAction SilentlyContinue).Count
  $summary = [pscustomobject]@{
    totalPng = $pngCount
    outDir = $outDirAbs
  }

  $summaryPath = Join-Path $logDir "ui-capture-full-$ReportDate-summary.json"
  $summary | ConvertTo-Json -Depth 3 | Out-File -Encoding UTF8 $summaryPath

  Write-Host ($summary | ConvertTo-Json -Compress)
} finally {
  foreach ($proc in @($mockProc, $clientProc, $adminProc)) {
    if ($proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  }
  Stop-Ports $ports
}
