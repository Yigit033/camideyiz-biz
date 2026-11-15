# Validate the user's exact original PNGs from ZIP, convert losslessly
# to WebP, verify decoded pixels and optionally push ONLY the two WebP assets
# and their integrity manifest to the current feature branch.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ArchivePath,
  [switch]$Publish
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$branch='feat/widgets-and-prayer-alerts-2'
if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
  throw "Poster ZIP not found: $ArchivePath. Download the previously supplied ZIP first."
}
if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) {
  throw "Not a Git project: $root"
}
$current=(& git -C $root branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $current -ne $branch) {
  throw "Expected branch $branch, current: $current"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required.'
}
& node -e "require.resolve('sharp')" 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "sharp is required. Run 'npm install' from the repository root first."
}
$specs=@(
  @{Path='apps/mobile/assets/kerahat/agir-kerahat.png'; Name='agir-kerahat.png'; Hash='DD7A26F775110BC3A911BE35C78EC9C90E3D3E0A2E0A470343CFAEDB410BABF7'},
  @{Path='apps/mobile/assets/kerahat/hafif-kerahat.png'; Name='hafif-kerahat.png'; Hash='F403909395EA5E9F676680F9C6DF53E7A1B0CD9F9730328B8BAFA3A3B1A3CCE5'}
)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath).Path)
$temp=Join-Path ([System.IO.Path]::GetTempPath()) ('camideyiz-kerahat-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
try {
  # Validate all source entries before touching app assets.
  $payload=@()
  foreach($spec in $specs) {
    $entries=@($zip.Entries | Where-Object { $_.FullName -eq $spec.Path })
    if($entries.Count -ne 1) {throw "Expected exactly one ZIP entry: $($spec.Path)"}
    $stream=$entries[0].Open()
    try {
      $mem=New-Object System.IO.MemoryStream
      try { $stream.CopyTo($mem); $bytes=$mem.ToArray() }
      finally { $mem.Dispose() }
    } finally { $stream.Dispose() }
    $sha=[System.Security.Cryptography.SHA256]::Create()
    try { $hash=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','') }
    finally { $sha.Dispose() }
    if($hash -ne $spec.Hash) {throw "Original PNG changed: $($spec.Name)"}
    $payload+=@{Name=$spec.Name;Bytes=$bytes}
  }
  foreach($item in $payload) {
    [IO.File]::WriteAllBytes((Join-Path $temp $item.Name),$item.Bytes)
  }
  Push-Location $root
  try {
    & node .\scripts\convert-kerahat-posters.mjs $temp
    if($LASTEXITCODE -ne 0) {throw 'Lossless WebP conversion / pixel comparison failed'}
    & node .\scripts\verify-kerahat-posters.mjs
    if($LASTEXITCODE -ne 0) {throw 'WebP asset integrity verification failed'}
  } finally { Pop-Location }
} finally {
  $zip.Dispose()
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
$files=@('apps/mobile/assets/kerahat/agir-kerahat.webp',
         'apps/mobile/assets/kerahat/hafif-kerahat.webp',
         'apps/mobile/assets/kerahat/poster-integrity.json')
if($Publish) {
  & git -C $root add -- $files
  if($LASTEXITCODE -ne 0) {throw 'Could not stage the two WebP files and manifest'}
  $changes=@(& git -C $root diff --cached --name-only -- $files)
  if($LASTEXITCODE -ne 0) {throw 'Could not inspect staged poster changes'}
  if($changes.Count -gt 0) {
    & git -C $root commit --only -m "assets(kerahat): add verified lossless WebP posters" -- $files
    if($LASTEXITCODE -ne 0) {throw 'Poster-only commit failed'}
  }
  & git -C $root push origin $branch
  if($LASTEXITCODE -ne 0) {throw 'Git push failed; the verified images remain local'}
  Write-Host 'Verified lossless WebP posters published to the feature branch.' -ForegroundColor Green
} else {
  Write-Host 'WebP files prepared locally. Re-run with -Publish to push only the posters and integrity manifest.' -ForegroundColor Yellow
}
