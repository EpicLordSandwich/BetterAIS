# Zbalí len runtime súbory – žiadne .desloppify/, .claude/, testy, scorecard ani
# lokálne diagnostické súbory. Použitie: npm run package (Chrome + Firefox).
param([ValidateSet('chrome', 'firefox', 'both')][string]$Target = 'both')
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$common = @(
  'background.js', 'themes.js', 'text-utils.js', 'grades.js', 'content.js', 'base.css',
  'popup.html', 'popup.js', 'options.html', 'options.js', 'options.css',
  'logo.png', 'pedro.gif', 'icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'
)

if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Path $dist | Out-Null }
$version = (Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version

function New-Package([string]$name, [string]$manifest) {
  $stage = Join-Path $dist $name
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
  New-Item -ItemType Directory -Path $stage | Out-Null
  Copy-Item (Join-Path $root $manifest) (Join-Path $stage 'manifest.json')
  foreach ($f in $common) { Copy-Item (Join-Path $root $f) (Join-Path $stage $f) }
  $zip = Join-Path $dist ("betteruis-$name-$version.zip")
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
  Remove-Item $stage -Recurse -Force
  Write-Host "OK $zip"
}

if ($Target -in @('chrome', 'both')) { New-Package 'chrome' 'manifest.json' }
if ($Target -in @('firefox', 'both')) { New-Package 'firefox' 'manifest.firefox.json' }
