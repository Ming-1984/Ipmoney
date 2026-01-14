[CmdletBinding()]
param(
  [string]$OutDir = "apps/client/src/assets/tabbar",
  [int]$Size = 81
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-Bitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $bmp.SetResolution(96, 96)
  return $bmp
}

function With-Graphics([System.Drawing.Bitmap]$bmp, [scriptblock]$draw) {
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    & $draw $g
  } finally {
    $g.Dispose()
  }
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Color-FromHex([string]$hex) {
  $h = $hex.TrimStart('#')
  $r = [Convert]::ToInt32($h.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($h.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($h.Substring(4, 2), 16)
  return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

function Draw-Home([System.Drawing.Graphics]$g, [System.Drawing.Pen]$pen, [int]$s) {
  $pad = [int]([Math]::Round($s * 0.22))
  $roofTopY = [int]([Math]::Round($s * 0.18))
  $roofY = [int]([Math]::Round($s * 0.34))
  $baseBottomY = [int]([Math]::Round($s * 0.74))
  $leftX = $pad
  $rightX = $s - $pad
  $midX = [int]([Math]::Round($s / 2))

  $g.DrawLine($pen, $leftX, $roofY, $midX, $roofTopY)
  $g.DrawLine($pen, $midX, $roofTopY, $rightX, $roofY)
  $g.DrawRectangle($pen, $leftX + 6, $roofY, ($rightX - $leftX) - 12, $baseBottomY - $roofY)

  $doorW = [int]([Math]::Round($s * 0.14))
  $doorH = [int]([Math]::Round($s * 0.22))
  $doorX = $midX - [int]([Math]::Round($doorW / 2))
  $doorY = $baseBottomY - $doorH
  $g.DrawRectangle($pen, $doorX, $doorY, $doorW, $doorH)
}

function Draw-Search([System.Drawing.Graphics]$g, [System.Drawing.Pen]$pen, [int]$s) {
  $r = [int]([Math]::Round($s * 0.20))
  $cx = [int]([Math]::Round($s * 0.42))
  $cy = [int]([Math]::Round($s * 0.42))
  $g.DrawEllipse($pen, $cx - $r, $cy - $r, $r * 2, $r * 2)
  $g.DrawLine($pen, $cx + $r - 2, $cy + $r - 2, [int]([Math]::Round($s * 0.74)), [int]([Math]::Round($s * 0.74)))
}

function Draw-Publish([System.Drawing.Graphics]$g, [System.Drawing.Pen]$pen, [int]$s) {
  $r = [int]([Math]::Round($s * 0.30))
  $cx = [int]([Math]::Round($s / 2))
  $cy = [int]([Math]::Round($s / 2))
  $g.DrawEllipse($pen, $cx - $r, $cy - $r, $r * 2, $r * 2)
  $arm = [int]([Math]::Round($s * 0.18))
  $g.DrawLine($pen, $cx - $arm, $cy, $cx + $arm, $cy)
  $g.DrawLine($pen, $cx, $cy - $arm, $cx, $cy + $arm)
}

function Draw-Messages([System.Drawing.Graphics]$g, [System.Drawing.Pen]$pen, [int]$s) {
  $x = [int]([Math]::Round($s * 0.18))
  $y = [int]([Math]::Round($s * 0.26))
  $w = [int]([Math]::Round($s * 0.64))
  $h = [int]([Math]::Round($s * 0.40))
  $r = [int]([Math]::Round($s * 0.10))

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  try {
    $path.AddArc($x, $y, $r, $r, 180, 90) | Out-Null
    $path.AddArc($x + $w - $r, $y, $r, $r, 270, 90) | Out-Null
    $path.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90) | Out-Null
    $path.AddArc($x, $y + $h - $r, $r, $r, 90, 90) | Out-Null
    $path.CloseFigure() | Out-Null
    $g.DrawPath($pen, $path)
  } finally {
    $path.Dispose()
  }

  $tail = New-Object System.Drawing.Drawing2D.GraphicsPath
  try {
    $tail.AddLine($x + [int]($w * 0.28), $y + $h, $x + [int]($w * 0.36), $y + $h + [int]($s * 0.12)) | Out-Null
    $tail.AddLine($x + [int]($w * 0.36), $y + $h + [int]($s * 0.12), $x + [int]($w * 0.44), $y + $h) | Out-Null
    $g.DrawPath($pen, $tail)
  } finally {
    $tail.Dispose()
  }
}

function Draw-Me([System.Drawing.Graphics]$g, [System.Drawing.Pen]$pen, [int]$s) {
  $cx = [int]([Math]::Round($s / 2))
  $headR = [int]([Math]::Round($s * 0.16))
  $headY = [int]([Math]::Round($s * 0.34))
  $g.DrawEllipse($pen, $cx - $headR, $headY - $headR, $headR * 2, $headR * 2)

  $bodyW = [int]([Math]::Round($s * 0.52))
  $bodyH = [int]([Math]::Round($s * 0.30))
  $bodyX = $cx - [int]([Math]::Round($bodyW / 2))
  $bodyY = [int]([Math]::Round($s * 0.52))
  $g.DrawArc($pen, $bodyX, $bodyY, $bodyW, $bodyH, 200, 140)
}

function Export-Icon([string]$name, [string]$hex, [string]$suffix, [scriptblock]$drawer) {
  $bmp = New-Bitmap $Size
  try {
    $color = Color-FromHex $hex
    $penWidth = [float]([Math]::Max(4, [Math]::Round($Size * 0.07)))
    $pen = New-Object System.Drawing.Pen -ArgumentList @($color, $penWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    try {
      With-Graphics $bmp {
        param($g)
        & $drawer $g $pen $Size
      }
    } finally {
      $pen.Dispose()
    }
    Save-Png $bmp (Join-Path $OutDir "$name$suffix.png")
  } finally {
    $bmp.Dispose()
  }
}

Write-Host "[tabbar-icons] generating to $OutDir (size=$Size)..."

$default = "#475569"
$active = "#FF6A00"

Export-Icon "home" $default "" ${function:Draw-Home}
Export-Icon "home" $active "-active" ${function:Draw-Home}

Export-Icon "search" $default "" ${function:Draw-Search}
Export-Icon "search" $active "-active" ${function:Draw-Search}

Export-Icon "publish" $default "" ${function:Draw-Publish}
Export-Icon "publish" $active "-active" ${function:Draw-Publish}

Export-Icon "messages" $default "" ${function:Draw-Messages}
Export-Icon "messages" $active "-active" ${function:Draw-Messages}

Export-Icon "me" $default "" ${function:Draw-Me}
Export-Icon "me" $active "-active" ${function:Draw-Me}

Write-Host "[tabbar-icons] done."
