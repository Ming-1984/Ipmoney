[CmdletBinding()]
param(
  [int[]]$Ports = @((4010..4040) + (5173..5200) + (8080..8090)),
  [switch]$Force
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

function Should-StopProcess([int]$ProcessId, [int]$Port) {
  if ($Force) { return $true }
  $cmd = Get-ProcessCommandLine -ProcessId $ProcessId
  if ([string]::IsNullOrWhiteSpace($cmd)) { return $false }
  if ($cmd -like "*$repoRoot*") { return $true }

  # Fallback heuristics: kill common local-dev commands on well-known dev ports.
  if ($cmd -match "(^|\s)src/server\.js(\s|$)") { return $true }
  if ($cmd -match "(^|\s)taro(\.cmd)?(\s|$)") { return $true }
  if ($cmd -match "(^|\s)vite(\s|$)") { return $true }
  if ($cmd -match "(^|\s)prism(\s|$)") { return $true }

  return $false
}

$getNetTcp = (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)
if ($null -eq $getNetTcp) {
  Write-Host "[clean] Get-NetTCPConnection not available; please close dev processes manually."
  exit 0
}

$portSet = New-Object 'System.Collections.Generic.HashSet[int]'
foreach ($p in $Ports) { $null = $portSet.Add([int]$p) }

$allConnections = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
$targets = $allConnections | Where-Object { $portSet.Contains([int]$_.LocalPort) } | Group-Object -Property LocalPort

$killed = 0
foreach ($group in $targets) {
  $port = [int]$group.Name
  $processIds = $group.Group.OwningProcess | Sort-Object -Unique
  foreach ($processId in $processIds) {
    $cmd = Get-ProcessCommandLine -ProcessId $processId
    if (-not (Should-StopProcess -ProcessId $processId -Port $port)) {
      Write-Host "[clean] port $port in use by pid $processId (skipped)."
      if ($cmd) { Write-Host "        $cmd" }
      continue
    }

    Write-Host "[clean] stopping pid $processId on port $port..."
    try { Stop-Process -Id $processId -Force -ErrorAction Stop; $killed += 1 } catch {}
  }
}

Write-Host "[clean] done. stopped $killed process(es)."
