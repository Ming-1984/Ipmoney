param(
  [string]$ArchitectureOutDir = "docs/architecture/rendered",
  [string]$DemoOutDir = "docs/demo/rendered",
  [string]$PngBackground = "white",
  [int]$PngWidth = 2000,
  [int]$PngHeight = 2000,
  [int]$PngScale = 6,
  [int]$NormalizeTolerance = 4,
  [int]$NormalizeCropPadding = 6,
  [int]$NormalizeOuterMargin = 48,
  [switch]$NoNormalizePng,
  [switch]$NoPdfFit,
  [switch]$NoSvg
)

$ErrorActionPreference = "Stop"

$NormalizePng = -not $NoNormalizePng
$PdfFit = -not $NoPdfFit
$Svg = -not $NoSvg

New-Item -ItemType Directory -Force $ArchitectureOutDir | Out-Null
New-Item -ItemType Directory -Force $DemoOutDir | Out-Null

$architectureInputs = @(
  "docs/architecture/c4-context.mmd",
  "docs/architecture/c4-container.mmd",
  "docs/architecture/c4-component-order.mmd",
  "docs/architecture/sequence-deposit-payment.mmd",
  "docs/architecture/sequence-refund.mmd",
  "docs/architecture/sequence-settlement.mmd",
  "docs/architecture/er-diagram.mmd",
  "docs/architecture/flow-listing-publish.mmd",
  "docs/architecture/flow-trade-end2end.mmd",
  "docs/architecture/flow-refund-dispute.mmd",
  "docs/architecture/state-order.mmd"
)

$demoInputs = @(
  # Demo high-level diagrams
  "docs/demo/diagrams/business-core-swimlane.mmd",
  "docs/demo/diagrams/business-refund-dispute-swimlane.mmd",
  "docs/demo/diagrams/architecture-p0-logical.mmd",
  "docs/demo/diagrams/architecture-target-microservices.mmd",
  "docs/demo/diagrams/deployment-prod.mmd",
  "docs/demo/diagrams/dataflow-money-pii-security.mmd",
  "docs/demo/diagrams/event-model.mmd",

  # Miniapp pages (from Ipmoney.md)
  "docs/demo/pages/miniapp/01-login.mmd",
  "docs/demo/pages/miniapp/02-home.mmd",
  "docs/demo/pages/miniapp/03-patent-map.mmd",
  "docs/demo/pages/miniapp/04-feeds.mmd",
  "docs/demo/pages/miniapp/05-detail.mmd",
  "docs/demo/pages/miniapp/06-message.mmd",
  "docs/demo/pages/miniapp/07-checkout-deposit-pay.mmd",
  "docs/demo/pages/miniapp/08-checkout-deposit-success.mmd",
  "docs/demo/pages/miniapp/09-checkout-final-pay.mmd",
  "docs/demo/pages/miniapp/10-checkout-final-success.mmd",
  "docs/demo/pages/miniapp/11-user-center.mmd",
  "docs/demo/pages/miniapp/12-publish-chooser.mmd",
  "docs/demo/pages/miniapp/13-publish-patent.mmd",
  "docs/demo/pages/miniapp/14-publish-demand.mmd",
  "docs/demo/pages/miniapp/15-publish-achievement.mmd",

  # Admin pages (from Ipmoney.md)
  "docs/demo/pages/admin/01-dashboard.mmd",
  "docs/demo/pages/admin/02-map-cms.mmd",
  "docs/demo/pages/admin/03-order-list.mmd",
  "docs/demo/pages/admin/04-order-detail.mmd",
  "docs/demo/pages/admin/05-content-audit.mmd",
  "docs/demo/pages/admin/06-user-auth.mmd",
  "docs/demo/pages/admin/07-finance.mmd",
  "docs/demo/pages/admin/08-system-settings.mmd"
)

function RenderDiagram([string]$diagramPath, [string]$outDir) {
  if (-not (Test-Path $diagramPath)) {
    throw "Missing diagram file: $diagramPath"
  }

  $baseName = [IO.Path]::GetFileNameWithoutExtension($diagramPath)
  $pngOut = Join-Path $outDir "$baseName.png"
  $pdfOut = Join-Path $outDir "$baseName.pdf"
  $svgOut = Join-Path $outDir "$baseName.svg"

  Write-Host "Render PNG: $diagramPath -> $pngOut"
  $pngArgs = @(
    "-y",
    "@mermaid-js/mermaid-cli",
    "-i",
    $diagramPath,
    "-o",
    $pngOut,
    "-b",
    $PngBackground,
    "-w",
    $PngWidth,
    "-H",
    $PngHeight
  )
  if ($PngScale -gt 0) {
    $pngArgs += @("-s", $PngScale)
  }
  npx @pngArgs
  if ($LASTEXITCODE -ne 0) {
    throw "mermaid-cli failed (PNG): $diagramPath"
  }

  Write-Host "Render PDF: $diagramPath -> $pdfOut"
  if ($PdfFit) {
    npx -y @mermaid-js/mermaid-cli -i $diagramPath -o $pdfOut -f
  } else {
    npx -y @mermaid-js/mermaid-cli -i $diagramPath -o $pdfOut
  }
  if ($LASTEXITCODE -ne 0) {
    throw "mermaid-cli failed (PDF): $diagramPath"
  }

  if ($Svg) {
    Write-Host "Render SVG: $diagramPath -> $svgOut"
    npx -y @mermaid-js/mermaid-cli -i $diagramPath -o $svgOut -b $PngBackground
    if ($LASTEXITCODE -ne 0) {
      throw "mermaid-cli failed (SVG): $diagramPath"
    }
  }
}

function NormalizePngDir([string]$outDir) {
  if (-not $NormalizePng) {
    return
  }

  if (-not (Test-Path "scripts/normalize-rendered-images.py")) {
    throw "Missing normalizer: scripts/normalize-rendered-images.py"
  }

  Write-Host "Normalize PNGs in: $outDir"

  $argsList = @(
    "scripts/normalize-rendered-images.py",
    "--in-place",
    $outDir,
    "--tolerance",
    $NormalizeTolerance,
    "--crop-padding",
    $NormalizeCropPadding,
    "--outer-margin",
    $NormalizeOuterMargin
  )

  if ($PngBackground) {
    $argsList += @("--background", $PngBackground)
  }

  python @argsList
  if ($LASTEXITCODE -ne 0) {
    throw "normalize-rendered-images.py failed for: $outDir"
  }
}

foreach ($diagramPath in $architectureInputs) {
  RenderDiagram $diagramPath $ArchitectureOutDir
}

foreach ($diagramPath in $demoInputs) {
  RenderDiagram $diagramPath $DemoOutDir
}

NormalizePngDir $ArchitectureOutDir
NormalizePngDir $DemoOutDir

Write-Host "Done."
Write-Host "Architecture outputs: $ArchitectureOutDir"
Write-Host "Demo outputs:         $DemoOutDir"
