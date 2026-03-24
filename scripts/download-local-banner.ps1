$ErrorActionPreference = 'Stop'

$defaultUrl = 'https://samplelib.com/lib/preview/mp4/sample-5s.mp4'
$videoUrl = if ($env:BANNER_VIDEO_URL) { $env:BANNER_VIDEO_URL } else { $defaultUrl }
$targetPath = 'G:\study\code2\3\Ipmoney\apps\client\src\assets\home\banner-local.mp4'
$targetDir = Split-Path -Parent $targetPath

if (-not (Test-Path $targetDir)) {
  New-Item -ItemType Directory -Force $targetDir | Out-Null
}

if (Test-Path $targetPath) {
  $size = (Get-Item $targetPath).Length
  if ($size -gt 0) {
    Write-Host "Local banner video already exists: $targetPath ($size bytes)."
    exit 0
  }
}

try {
  if ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12 -eq 0) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  }
} catch {
  # ignore if TLS setting is unavailable
}

Write-Host "Downloading local banner video from $videoUrl ..."
Invoke-WebRequest -Uri $videoUrl -OutFile $targetPath
Write-Host "Saved local banner video to $targetPath."
