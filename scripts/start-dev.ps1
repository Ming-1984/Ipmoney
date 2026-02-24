[CmdletBinding()]
param(
  [ValidateSet("weapp", "h5", "none")]
  [string]$Client = "weapp",
  [switch]$SplitWindows,
  [switch]$AutoPort = $true,
  [switch]$SkipInstall,
  [switch]$SkipInfra,
  [switch]$SkipDb,
  [switch]$Seed,
  [switch]$PurgeDemo,
  [switch]$EnableDemoAuth = $true,
  [switch]$EnableDemoPayment,
  [switch]$AllowDemoUuidTokens,
  [switch]$EnableMockTools,
  [switch]$AllowNonDev,
  [int]$ApiPort = 3200,
  [int]$AdminPort = 5174,
  [int]$ClientPort = 5173
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

function Get-ProcessCommandLine([int]$ProcessId) {
  try {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
    return $p.CommandLine
  } catch {
    return $null
  }
}

function Try-StopRepoNodeOnPort([int]$Port) {
  $getNetTcp = (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)
  if ($null -eq $getNetTcp) { return $false }

  $connections = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($connections.Count -eq 0) { return $false }

  $processIds = $connections.OwningProcess | Sort-Object -Unique
  foreach ($processId in $processIds) {
    try {
      $proc = Get-Process -Id $processId -ErrorAction Stop
      if ($proc.ProcessName -ne "node") { continue }
    } catch {
      continue
    }

    $cmd = Get-ProcessCommandLine -ProcessId $processId
    if ([string]::IsNullOrWhiteSpace($cmd)) { continue }

    $shouldStop = $false
    if ($cmd -like "*$repoRoot*") { $shouldStop = $true }
    if (-not $shouldStop -and $cmd -match "(^|\s)nest(\.cmd)?(\s|$)") { $shouldStop = $true }
    if (-not $shouldStop -and $cmd -match "(^|\s)taro(\.cmd)?(\s|$)") { $shouldStop = $true }
    if (-not $shouldStop -and $cmd -match "(^|\s)vite(\s|$)") { $shouldStop = $true }
    if (-not $shouldStop) { continue }

    Write-Host "[start] stopping dev process on port $Port (pid $processId)..."
    try { Stop-Process -Id $processId -Force -ErrorAction Stop } catch {}
  }

  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 150
    $after = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if ($after.Count -eq 0) { return $true }
  }
  return $false
}

function Stop-RepoNodeByCommandMatch {
  param(
    [Parameter(Mandatory = $true)][string[]]$Needles,
    [Parameter(Mandatory = $true)][string]$Reason
  )

  $needlesLower = $Needles | ForEach-Object { $_.ToLower() }
  $procs = @(Get-Process -Name node -ErrorAction SilentlyContinue)
  foreach ($proc in $procs) {
    $cmd = Get-ProcessCommandLine -ProcessId $proc.Id
    if ([string]::IsNullOrWhiteSpace($cmd)) { continue }
    if ($cmd -notlike "*$repoRoot*") { continue }

    $lower = $cmd.ToLower()
    $hit = $false
    foreach ($n in $needlesLower) {
      if ($lower.Contains($n)) { $hit = $true; break }
    }
    if (-not $hit) { continue }

    Write-Host "[start] stopping repo node process (pid $($proc.Id)) for $Reason..."
    try { Stop-Process -Id $proc.Id -Force -ErrorAction Stop } catch {}
  }
}

function Test-LocalPortInUse([int]$Port) {
  $getNetTcp = (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)
  if ($null -ne $getNetTcp) {
    try {
      return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue).Count -gt 0
    } catch {
      return $false
    }
  }

  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $wait = $iar.AsyncWaitHandle.WaitOne(200)
    if (-not $wait) {
      $client.Close()
      return $false
    }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Get-ExcludedPortRanges {
  $netsh = Get-Command netsh -ErrorAction SilentlyContinue
  if ($null -eq $netsh) { return @() }
  try {
    $out = & $netsh.Source interface ipv4 show excludedportrange protocol=tcp 2>$null
  } catch {
    return @()
  }

  $ranges = @()
  foreach ($line in $out) {
    if ($line -match '^\s*(\d+)\s+(\d+)\s*$') {
      $start = [int]$matches[1]
      $end = [int]$matches[2]
      $ranges += ,@($start, $end)
    }
  }
  return $ranges
}

$script:ExcludedRanges = Get-ExcludedPortRanges

function Test-PortReserved([int]$Port) {
  foreach ($range in $script:ExcludedRanges) {
    if ($Port -ge $range[0] -and $Port -le $range[1]) { return $true }
  }
  return $false
}

function Find-FreePort([int]$StartPort) {
  for ($p = $StartPort; $p -lt ($StartPort + 200); $p++) {
    if (Test-PortReserved $p) { continue }
    if (-not (Test-LocalPortInUse $p)) { return $p }
  }
  throw "Unable to find a free port starting at $StartPort."
}

function Ensure-PortFree([int]$Port, [string]$Name) {
  if (Test-PortReserved $Port) {
    if (-not $AutoPort) {
      throw "$Name port $Port is reserved by system. Use -AutoPort or choose another port."
    }
    $next = Find-FreePort -StartPort ($Port + 1)
    Write-Host "[start] $Name port $Port reserved; using $next instead."
    return $next
  }
  if (-not (Test-LocalPortInUse $Port)) { return $Port }
  $freed = Try-StopRepoNodeOnPort -Port $Port
  if ($freed -and -not (Test-LocalPortInUse $Port)) { return $Port }
  if (-not $AutoPort) {
    throw "$Name port $Port is already in use. Close the process or use -AutoPort."
  }
  $next = Find-FreePort -StartPort ($Port + 1)
  Write-Host "[start] $Name port $Port in use; using $next instead."
  return $next
}

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

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Args = @()
  )
  & $FilePath @Args
  if ($LASTEXITCODE -ne 0) {
    $joined = $Args -join " "
    throw "Command failed (exit=$LASTEXITCODE): $FilePath $joined"
  }
}

function Test-DockerAvailable {
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if ($null -eq $docker) { return $false }
  try {
    & $docker.Source info --format '{{.ServerVersion}}' | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath)) {
  Copy-Item -Path (Join-Path $repoRoot ".env.example") -Destination $envPath -Force
  Write-Host "[start] .env not found. Created from .env.example."
}

$envMap = Read-EnvFile $envPath
Apply-EnvMap -Map $envMap

$detectedEnvValues = @(
  $env:NODE_ENV,
  $env:APP_MODE,
  $env:DEPLOY_ENV,
  $env:STAGE,
  $env:ENV
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$nonDevEnvs = @("production", "prod", "staging")
if (-not $AllowNonDev) {
  foreach ($value in $detectedEnvValues) {
    if ($nonDevEnvs -contains $value.ToLower()) {
      throw "start-dev.ps1 is intended for local dev only. Detected env '$value'. Use -AllowNonDev to override."
    }
  }
}

if (-not $SkipInstall -and -not (Test-Path (Join-Path $repoRoot "node_modules"))) {
  Write-Host "[start] installing dependencies..."
  Invoke-External -FilePath "pnpm" -Args @("install")
}

$ApiPort = Ensure-PortFree -Port $ApiPort -Name "API"
$AdminPort = Ensure-PortFree -Port $AdminPort -Name "Admin"
if ($Client -eq "h5") {
  $ClientPort = Ensure-PortFree -Port $ClientPort -Name "Client H5"
}

if (-not $SkipInfra) {
  if (-not (Test-DockerAvailable)) {
    throw "Docker Desktop is not running. Start it or use -SkipInfra."
  }
  Write-Host "[start] starting infra (docker compose)..."
  Invoke-External -FilePath "pnpm" -Args @("dev:infra")
}

if (-not $SkipDb) {
  # Prisma on Windows will fail to overwrite the query engine DLL if any existing
  # API process is running and has loaded it. Stop any repo API processes first.
  Stop-RepoNodeByCommandMatch -Needles @("apps\\api", "apps/api") -Reason "prisma generate (engine lock avoidance)"
  Write-Host "[start] preparing database (prisma generate/migrate)..."
  Invoke-External -FilePath "pnpm" -Args @("-C", "apps/api", "prisma:generate")
  Invoke-External -FilePath "pnpm" -Args @("-C", "apps/api", "db:migrate")
  if ($Seed) {
    $env:SEED_DEMO_DATA = "0"
    if ($PurgeDemo) { $env:SEED_DEMO_PURGE_MAP = "1" }
    Write-Host "[start] seeding database (demo data disabled)..."
    Invoke-External -FilePath "pnpm" -Args @("-C", "apps/api", "db:seed")
  }
}

$apiBaseUrl = "http://127.0.0.1:$ApiPort"
$env:PORT = "$ApiPort"
$env:BASE_URL = $apiBaseUrl
$env:PUBLIC_HOST_WHITELIST = "localhost:$ApiPort,127.0.0.1:$ApiPort"
$env:TARO_APP_API_BASE_URL = $apiBaseUrl
$env:VITE_API_BASE_URL = $apiBaseUrl
$mockToolsValue = if ($EnableMockTools) { "1" } else { "0" }
$env:TARO_APP_ENABLE_MOCK_TOOLS = $mockToolsValue
$env:VITE_ENABLE_MOCK_TOOLS = $mockToolsValue
$demoAuthValue = if ($EnableDemoAuth) { "true" } else { "false" }
$demoPaymentEnabled = if ($PSBoundParameters.ContainsKey('EnableDemoPayment')) { [bool]$EnableDemoPayment } else { [bool]$EnableDemoAuth }
$demoPaymentValue = if ($demoPaymentEnabled) { "true" } else { "false" }
$env:DEMO_AUTH_ENABLED = $demoAuthValue
$env:DEMO_PAYMENT_ENABLED = $demoPaymentValue
if ($EnableDemoAuth) {
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
  # Default to secure behavior: UUID passthrough is OFF unless explicitly enabled.
  $env:DEMO_AUTH_ALLOW_UUID_TOKENS = if ($AllowDemoUuidTokens) { "true" } else { "false" }
} else {
  $env:DEMO_AUTH_ALLOW_UUID_TOKENS = "false"
}

$psExe = (Get-Command powershell).Source

$apiCommand = "cd `"$repoRoot`"; `$env:PORT='$ApiPort'; `$env:BASE_URL='$apiBaseUrl'; `$env:PUBLIC_HOST_WHITELIST='localhost:$ApiPort,127.0.0.1:$ApiPort'; `$env:DEMO_AUTH_ENABLED='$demoAuthValue'; `$env:DEMO_PAYMENT_ENABLED='$demoPaymentValue'; `$env:DEMO_AUTH_ALLOW_UUID_TOKENS='$($env:DEMO_AUTH_ALLOW_UUID_TOKENS)'; `$env:DEMO_ADMIN_TOKEN='$($env:DEMO_ADMIN_TOKEN)'; `$env:DEMO_USER_TOKEN='$($env:DEMO_USER_TOKEN)'; `$env:DEMO_ADMIN_ID='$($env:DEMO_ADMIN_ID)'; `$env:DEMO_USER_ID='$($env:DEMO_USER_ID)'; pnpm -C apps/api dev"
$adminCommand = "cd `"$repoRoot`"; `$env:VITE_API_BASE_URL='$apiBaseUrl'; `$env:VITE_ENABLE_MOCK_TOOLS='$mockToolsValue'; `$env:VITE_DEMO_ADMIN_TOKEN='$($env:DEMO_ADMIN_TOKEN)'; `$env:VITE_DEMO_AUTH_ENABLED='$demoAuthValue'; `$env:ADMIN_WEB_PORT='$AdminPort'; pnpm -C apps/admin-web dev"

$clientCommand = $null
if ($Client -eq "weapp") {
  $clientCommand = "cd `"$repoRoot`"; `$env:TARO_APP_API_BASE_URL='$apiBaseUrl'; `$env:TARO_APP_ENABLE_MOCK_TOOLS='$mockToolsValue'; pnpm -C apps/client dev:weapp"
}
if ($Client -eq "h5") {
  $clientCommand = "cd `"$repoRoot`"; `$env:TARO_APP_API_BASE_URL='$apiBaseUrl'; `$env:TARO_APP_ENABLE_MOCK_TOOLS='$mockToolsValue'; `$env:CLIENT_H5_PORT='$ClientPort'; pnpm -C apps/client dev:h5"
}

if ($SplitWindows) {
  Start-Process $psExe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $apiCommand) | Out-Null
  Start-Process $psExe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $adminCommand) | Out-Null
  if ($clientCommand) {
    Start-Process $psExe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $clientCommand) | Out-Null
  }
} else {
  Start-Process $psExe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $adminCommand) | Out-Null
  if ($clientCommand) {
    Start-Process $psExe -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $clientCommand) | Out-Null
  }
  Write-Host "[start] API running in current window..."
  Invoke-External -FilePath "pnpm" -Args @("-C", "apps/api", "dev")
  exit 0
}

Write-Host "[start] API:       $apiBaseUrl"
Write-Host "[start] Admin:     http://127.0.0.1:$AdminPort"
if ($Client -eq "h5") {
  Write-Host "[start] Client H5: http://127.0.0.1:$ClientPort"
}
if ($Client -eq "weapp") {
  Write-Host "[start] Client:    apps/client (miniprogramRoot dist/weapp)"
}
if ($EnableDemoAuth) {
  Write-Host "[start] Demo auth enabled."
  if ($demoPaymentEnabled) {
    Write-Host "[start] Demo payment enabled."
  } else {
    Write-Host "[start] Demo payment disabled."
  }
  Write-Host "[start] Admin token: $env:DEMO_ADMIN_TOKEN"
  Write-Host "[start] User token:  $env:DEMO_USER_TOKEN"
  Write-Host "[start] Admin id:    $env:DEMO_ADMIN_ID"
  Write-Host "[start] User id:     $env:DEMO_USER_ID"
  Write-Host "[start] UUID tokens: $env:DEMO_AUTH_ALLOW_UUID_TOKENS"
}
