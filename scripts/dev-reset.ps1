[CmdletBinding()]
param(
  [ValidateSet("mock", "api", "all")]
  [string]$Target = "mock",
  [int]$MockPort = 4010,
  [int]$ApiPort = 3200,
  [switch]$Force,
  [switch]$SeedDemo,
  [switch]$PurgeDemo
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

$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath) -and (Test-Path (Join-Path $repoRoot ".env.example"))) {
  Copy-Item -Path (Join-Path $repoRoot ".env.example") -Destination $envPath -Force
  Write-Host "[reset] .env not found. Created from .env.example."
}
Apply-EnvMap -Map (Read-EnvFile $envPath)

if ($Target -eq "mock" -or $Target -eq "all") {
  $mockUrl = "http://127.0.0.1:$MockPort/__reset"
  try {
    $null = Invoke-RestMethod -Method Post -Uri $mockUrl -TimeoutSec 4
    Write-Host "[reset] mock-api reset ok: $mockUrl"
  } catch {
    Write-Host "[reset] mock-api not reachable: $mockUrl"
  }
}

if ($Target -eq "api" -or $Target -eq "all") {
  if (-not $Force) {
    throw "Refusing to reset API database without -Force (data will be wiped)."
  }

  $apiDir = Join-Path $repoRoot "apps/api"
  Push-Location $apiDir
  try {
    Write-Host "[reset] prisma generate..."
    Invoke-External -FilePath "pnpm" -Args @("prisma:generate")

    Write-Host "[reset] prisma migrate reset..."
    Invoke-External -FilePath "pnpm" -Args @("prisma", "migrate", "reset", "--force", "--skip-seed")

    $env:SEED_DEMO_DATA = if ($SeedDemo) { "true" } else { "false" }
    if ($PurgeDemo) { $env:SEED_DEMO_PURGE_MAP = "true" }

    Write-Host "[reset] prisma seed..."
    Invoke-External -FilePath "pnpm" -Args @("db:seed")
  } finally {
    Pop-Location
  }
}
