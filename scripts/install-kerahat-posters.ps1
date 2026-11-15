# Install the user's exact, unchanged heavy/light kerahat posters.
# Optional -Publish commits ONLY the two poster assets to the current feature
# branch; no merge/deploy and no other local changes staged or committed.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ArchivePath,
  [switch]$Publish
)

$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$branch='feat/widgets-and-prayer-alerts-2'
if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
  throw "Poster ZIP not found: $ArchivePath"
}
if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) {
  throw "Not a Git project: $root"
}
$current=(& git -C $root branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $current -ne $branch) {
  throw "Expected $branch. Current branch: $current"
}
$specs=@(
  @{Path='apps/mobile/assets/kerahat/agir-kerahat.png';
    Hash='DD7A26F775110BC3A911BE35C78EC9C90E3D3E0A2E0A470343CFAEDB410BABF7'},
  @{Path='apps/mobile/assets/kerahat/hafif-kerahat.png';
    Hash='F403909395EA5E9F676680F9C6DF53E7A1B0CD9F9730328B8BA3A3B1A3CCE5'}
)
Add-Type -AssemblyName System.IO.Compression
$zip=[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath).Path)
try {
  # Validate BOTH posters before overwriting even a single existing file.
  $payload=@()
  foreach ($spec in $specs) {
    $entry=@($zip.Entries | Where-Object { $_.FullName -eq $spec.Path })
    if ($entry.Count -ne 1) {
      throw "ZIP must contain exactly one file: $($spec.Path)"
    }
    $stream=$entry[0].Open()
    try {
      $memory=New-Object System.IO.MemoryStream
      $stream.CopyTo($memory)
      $bytes=$memory.ToArray()
      $memory.Dispose()
    } finally {$stream.Dispose()}
    $sha=[System.Security.Cryptography.SHA256]::Create()
    try {
      $hash=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','')
    } finally {$sha.Dispose()}
    if ($hash -ne $spec.Hash) {
      throw "Incorrect/modified poster in ZIP: $($spec.Path)"
    }
    $payload+=@{File=$spec.Path;Bytes=$bytes}
  }
  foreach ($poster in $payload) {
    $destination=Join-Path $root $poster.File
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    [System.IO.File]::WriteAllBytes($destination,$poster.Bytes)
    Write-Host "Original poster installed: $($poster.File)" -ForegroundColor Green
  }
} finally {$zip.Dispose()}

if ($Publish) {
  $changes=@(& git -C $root status --porcelain -- $specs[0].Path $specs[1].Path)
  if ($LASTEXITCODE -ne 0) {throw 'Git status failed'}
  if ($changes.Count -gt 0) {
    & git -C $root commit --only -m "assets(kerahat): add unmodified user-provided heavy and light teaching posters" -- $specs[0].Path $specs[1].Path
    if ($LASTEXITCODE -ne 0) {throw 'Poster-only Git commit failed'}
  } else {
    Write-Host 'Poster assets already match tracked Git versions.' -ForegroundColor Green
  }
  & git -C $root push origin $branch
  if ($LASTEXITCODE -ne 0) {
    throw 'Push failed; original files remain locally committed. Resolve Git authentication and run git push.'
  }
  Write-Host 'Original posters published to the existing GitHub feature branch.' -ForegroundColor Green
} else {
  Write-Host 'Posters installed locally. Run again with -Publish to commit/push ONLY these two files.' -ForegroundColor Yellow
}
