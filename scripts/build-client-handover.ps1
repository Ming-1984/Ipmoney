param(
  [string]$MdPath = "docs/architecture/client-handover-mini-admin.md",
  [string]$CssPath = "docs/architecture/pdf-cn.css"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $MdPath)) {
  throw "未找到对接文档：$MdPath"
}

if (-not (Test-Path -LiteralPath $CssPath)) {
  throw "未找到 PDF 样式文件：$CssPath"
}

$resolvedMd = (Resolve-Path -LiteralPath $MdPath).Path

Write-Host "[handover] exporting PDF from $MdPath"
npx -y md-to-pdf $MdPath --stylesheet $CssPath | Out-Host

$pdfPath = [System.IO.Path]::ChangeExtension($resolvedMd, ".pdf")
if (-not (Test-Path -LiteralPath $pdfPath)) {
  throw "PDF 生成失败：$pdfPath"
}

Get-Item -LiteralPath $resolvedMd, $pdfPath |
  Select-Object Name, Length, LastWriteTime |
  Format-Table -AutoSize
