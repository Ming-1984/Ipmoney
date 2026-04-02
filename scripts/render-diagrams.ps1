param(
  [string]$ArchitectureOutDir = "docs/architecture/rendered",
  [string]$DemoOutDir = "docs/demo/rendered",
  [switch]$IncludeDemo,
  [string]$PngBackground = "white",
  [int]$PngWidth = 2200,
  [int]$PngHeight = 2200,
  [int]$PngScale = 4,
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

function ResolveExistingDiagrams([string[]]$paths, [string]$label) {
  $existing = @()
  foreach ($path in $paths) {
    if (Test-Path $path) {
      $existing += $path
    } else {
      Write-Warning "[$label] skip missing diagram: $path"
    }
  }
  return $existing
}

function RenderDiagram([string]$diagramPath, [string]$outDir) {
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
    Write-Warning "Skip normalize: scripts/normalize-rendered-images.py not found"
    return
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

$architectureInputs = Get-ChildItem -Path "docs/architecture" -Filter "*.mmd" -File |
  Sort-Object Name |
  ForEach-Object { $_.FullName }

if (-not $architectureInputs -or $architectureInputs.Count -eq 0) {
  throw "No architecture diagrams found under docs/architecture"
}

New-Item -ItemType Directory -Force $ArchitectureOutDir | Out-Null

$demoInputs = @()
if ($IncludeDemo) {
  New-Item -ItemType Directory -Force $DemoOutDir | Out-Null

  $demoCandidates = @(
    "docs/demo/diagrams/business-core-swimlane.mmd",
    "docs/demo/diagrams/business-refund-dispute-swimlane.mmd",
    "docs/demo/diagrams/architecture-p0-logical.mmd",
    "docs/demo/diagrams/architecture-target-microservices.mmd",
    "docs/demo/diagrams/deployment-prod.mmd",
    "docs/demo/diagrams/dataflow-money-pii-security.mmd",
    "docs/demo/diagrams/event-model.mmd",
    "docs/demo/diagrams/requirements-phase-summary.mmd"
  )

  $demoInputs = ResolveExistingDiagrams -paths $demoCandidates -label "demo"
}

foreach ($diagramPath in $architectureInputs) {
  RenderDiagram $diagramPath $ArchitectureOutDir
}

if ($demoInputs.Count -gt 0) {
  foreach ($diagramPath in $demoInputs) {
    RenderDiagram $diagramPath $DemoOutDir
  }
}

NormalizePngDir $ArchitectureOutDir
if ($demoInputs.Count -gt 0) {
  NormalizePngDir $DemoOutDir
}

Write-Host "Done."
Write-Host "Architecture diagrams rendered: $($architectureInputs.Count)"
Write-Host "Architecture outputs:          $ArchitectureOutDir"
if ($demoInputs.Count -gt 0) {
  Write-Host "Demo diagrams rendered:         $($demoInputs.Count)"
  Write-Host "Demo outputs:                   $DemoOutDir"
}
