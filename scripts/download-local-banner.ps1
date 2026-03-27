$ErrorActionPreference = 'Stop'

$defaultUrl1 = 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4'
$defaultUrl2 = 'https://samplelib.com/lib/preview/mp4/sample-10s.mp4'
$videoUrl1 = if ($env:BANNER_VIDEO_URL_1) { $env:BANNER_VIDEO_URL_1 } else { $defaultUrl1 }
$videoUrl2 = if ($env:BANNER_VIDEO_URL_2) { $env:BANNER_VIDEO_URL_2 } else { $defaultUrl2 }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$targetPath1 = Join-Path $repoRoot 'apps\client\src\assets\home\banner-local-1.mp4'
$targetPath2 = Join-Path $repoRoot 'apps\client\src\assets\home\banner-local-2.mp4'
$targetDir = Split-Path -Parent $targetPath1

if (-not (Test-Path $targetDir)) {
  New-Item -ItemType Directory -Force $targetDir | Out-Null
}

$hasVideo1 = $false
$hasVideo2 = $false
if (Test-Path $targetPath1) {
  $size = (Get-Item $targetPath1).Length
  if ($size -gt 0) {
    $hasVideo1 = $true
    Write-Host "Local banner video already exists: $targetPath1 ($size bytes)."
  }
}
if (Test-Path $targetPath2) {
  $size = (Get-Item $targetPath2).Length
  if ($size -gt 0) {
    $hasVideo2 = $true
    Write-Host "Local banner video already exists: $targetPath2 ($size bytes)."
  }
}

try {
  if ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12 -eq 0) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  }
} catch {
  # ignore if TLS setting is unavailable
}

if (-not $hasVideo1) {
  Write-Host "Downloading local banner video 1 from $videoUrl1 ..."
  Invoke-WebRequest -Uri $videoUrl1 -OutFile $targetPath1
  Write-Host "Saved local banner video to $targetPath1."
}

if (-not $hasVideo2) {
  Write-Host "Downloading local banner video 2 from $videoUrl2 ..."
  Invoke-WebRequest -Uri $videoUrl2 -OutFile $targetPath2
  Write-Host "Saved local banner video to $targetPath2."
}
