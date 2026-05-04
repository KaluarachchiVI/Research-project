param(
  [switch]$SkipMermaid
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildDir = Join-Path $root "build"
$templatesDir = Join-Path $root "templates"
$diagramsDir = Join-Path $root "diagrams"
$figuresDir = Join-Path $buildDir "figures"

if (!(Test-Path $buildDir)) {
  New-Item -ItemType Directory -Path $buildDir | Out-Null
}
if (!(Test-Path $figuresDir)) {
  New-Item -ItemType Directory -Path $figuresDir | Out-Null
}

function Ensure-Pandoc {
  if (Get-Command pandoc -ErrorAction SilentlyContinue) { return }
  $localCandidates = @(
    (Join-Path $env:LOCALAPPDATA "Pandoc\pandoc.exe"),
    (Join-Path $env:ProgramFiles "Pandoc\pandoc.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Pandoc\pandoc.exe")
  )
  foreach ($candidate in $localCandidates) {
    if ($candidate -and (Test-Path $candidate)) {
      $pandocDir = Split-Path -Parent $candidate
      $env:PATH = "$pandocDir;$env:PATH"
      if (Get-Command pandoc -ErrorAction SilentlyContinue) {
        Write-Host "Using pandoc from $candidate" -ForegroundColor Cyan
        return
      }
    }
  }
  Write-Host "Pandoc not found. Attempting install with Chocolatey..." -ForegroundColor Yellow
  if (Get-Command choco -ErrorAction SilentlyContinue) {
    choco install pandoc -y | Out-Host
  }
  if (!(Get-Command pandoc -ErrorAction SilentlyContinue)) {
    throw "Pandoc is required. Install manually and rerun build."
  }
}

function Ensure-ReferenceDoc {
  $referenceDoc = Join-Path $templatesDir "reference.docx"
  if (Test-Path $referenceDoc) { return }
  Write-Host "Generating templates/reference.docx with Pandoc default..." -ForegroundColor Cyan
  pandoc -o $referenceDoc --print-default-data-file reference.docx
}

function Ensure-CSL {
  $csl = Join-Path $templatesDir "ieee.csl"
  if (Test-Path $csl) { return }
  throw "templates/ieee.csl not found."
}

function Build-Doc($name, $inputs) {
  $out = Join-Path $buildDir $name
  $primaryInputDir = Split-Path -Parent $inputs[0]
  $resourcePath = "$root;$buildDir;$figuresDir;$primaryInputDir"
  pandoc @inputs `
    --reference-doc (Join-Path $templatesDir "reference.docx") `
    --citeproc `
    --bibliography (Join-Path $root "references.bib") `
    --csl (Join-Path $templatesDir "ieee.csl") `
    --resource-path $resourcePath `
    --toc `
    --number-sections `
    -o $out
  if ($LASTEXITCODE -ne 0) {
    throw "Pandoc failed while building $name. Ensure target file is not open, then rerun."
  }
  Write-Host "Built $name" -ForegroundColor Green
}

Ensure-Pandoc
Ensure-ReferenceDoc
Ensure-CSL

if (-not $SkipMermaid) {
  if (Get-Command npx -ErrorAction SilentlyContinue) {
    if (Test-Path $diagramsDir) {
      $diagramFiles = Get-ChildItem -Path $diagramsDir -Filter *.mmd -File
      foreach ($diagram in $diagramFiles) {
        $target = Join-Path $figuresDir ($diagram.BaseName + ".png")
        try {
          npx --yes @mermaid-js/mermaid-cli -i $diagram.FullName -o $target | Out-Host
          Write-Host "Rendered diagram: $($diagram.Name)" -ForegroundColor Green
        } catch {
          Write-Host "Failed to render $($diagram.Name). Continuing build." -ForegroundColor Yellow
        }
      }
    } else {
      Write-Host "No thesis/diagrams directory found. Mermaid export skipped." -ForegroundColor Yellow
    }
  } else {
    Write-Host "npx not found. Mermaid export skipped." -ForegroundColor Yellow
  }
}

$groupInputs = @(
  (Join-Path $root "group/00-frontmatter.md"),
  (Join-Path $root "group/01-introduction.md"),
  (Join-Path $root "group/02-methodology.md"),
  (Join-Path $root "group/03-results-discussion.md"),
  (Join-Path $root "group/04-conclusion.md"),
  (Join-Path $root "group/05-references.md"),
  (Join-Path $root "group/06-appendices.md")
)
Build-Doc "Group-Thesis-25-26J-458.docx" $groupInputs

Build-Doc "IT22148254-bogahawatta-CLE.docx" @((Join-Path $root "individual/IT22148254-bogahawatta-CLE.md"))
Build-Doc "IT22054418-kaluarachchi-scheduler.docx" @((Join-Path $root "individual/IT22054418-kaluarachchi-scheduler.md"))
Build-Doc "IT22087874-rajendram-intentlock.docx" @((Join-Path $root "individual/IT22087874-rajendram-intentlock.md"))
Build-Doc "IT22276582-yasasvin-chronotype.docx" @((Join-Path $root "individual/IT22276582-yasasvin-chronotype.md"))

Write-Host "All documents generated in thesis/build/" -ForegroundColor Cyan
