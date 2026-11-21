# Install the two user-supplied JPEG/PNG kerahat images from a ZIP.
# Accept a nested folder structure and JPEG .jpg/.jpeg or exact original PNG.
# Converts to pixel-identical lossless WebP; optionally publishes only images
# and their manifest to the current feature branch. No main merge or deploy.
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
  throw "Not a Git repository: $root"
}
$current=(& git -C $root branch --show-current).Trim()
if($LASTEXITCODE -ne 0 -or $current -ne $branch) {
  throw "Expected branch $branch; found $current"
}
if(-not (Get-Command node -ErrorAction SilentlyContinue)){
  throw 'Node.js required'
}
Push-Location $root
try {
  & node -e "require.resolve('sharp')" 2>$null
  if($LASTEXITCODE -ne 0) {throw "sharp missing; run 'npm install' in repository root"}
} finally {Pop-Location}

$specs=@(
  @{Base='agir-kerahat';PngHash='DD7A26F775110BC3A911BE35C78EC9C90E3D3E0A2E0A470343CFAEDB410BABF7'},
  @{Base='hafif-kerahat';PngHash='F403909395EA5E9F676680F9C6DF53E7A1B0CD9F9730328B8BAFA3A3B1A3CCE5'}
)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath).Path)
$temp=Join-Path ([IO.Path]::GetTempPath()) ('camideyiz-posters-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
try{
  $payload=@()
  foreach($spec in $specs){
    # Normalize ZIP paths and match by leaf filename; the user archive
    # contains nested directory levels rather than repository-relative paths.
    $entries=@($zip.Entries | Where-Object {
      $leaf=($_.FullName -replace '\\','/').Split('/')[-1]
      $leaf -match ('^'+[regex]::Escape($spec.Base)+'\.(png|jpe?g)$')
    })
    if($entries.Count -ne 1){
      throw "Expected exactly one JPEG/PNG named $($spec.Base) anywhere in ZIP; found $($entries.Count)."
    }
    $entry=$entries[0]
    if($entry.Length -lt 100 -or $entry.Length -gt 15000000){
      throw "Unexpected file size for $($entry.FullName)"
    }
    $leaf=($entry.FullName -replace '\\','/').Split('/')[-1]
    $ext=[IO.Path]::GetExtension($leaf).ToLowerInvariant()
    $stream=$entry.Open()
    try{
      $mem=New-Object IO.MemoryStream
      try{$stream.CopyTo($mem);$bytes=$mem.ToArray()}
      finally{$mem.Dispose()}
    } finally{$stream.Dispose()}
    if($ext -eq '.png'){
      $validSig=$bytes.Length -ge 8 -and
        $bytes[0] -eq 137 -and $bytes[1] -eq 80 -and
        $bytes[2] -eq 78 -and $bytes[3] -eq 71
    }else{
      $validSig=$bytes.Length -ge 3 -and
        $bytes[0] -eq 255 -and $bytes[1] -eq 216 -and $bytes[2] -eq 255
    }
    if(-not $validSig){throw "Invalid image signature: $leaf"}
    $sha=[Security.Cryptography.SHA256]::Create()
    try{$hash=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','')}
    finally{$sha.Dispose()}
    if($ext -eq '.png' -and $hash -ne $spec.PngHash){
      throw "PNG is not the previously verified original: $leaf"
    }
    $payload+=@{Name=$leaf;Bytes=$bytes;Hash=$hash}
  }
  foreach($p in $payload){
    [IO.File]::WriteAllBytes((Join-Path $temp $p.Name),$p.Bytes)
    Write-Host "Source detected: $($p.Name) (SHA256 $($p.Hash))"
  }
  Push-Location $root
  try{
    & node .\scripts\convert-kerahat-posters.mjs $temp
    if($LASTEXITCODE -ne 0){throw 'Poster conversion or pixel comparison failed'}
    & node .\scripts\verify-kerahat-posters.mjs
    if($LASTEXITCODE -ne 0){throw 'WebP integrity validation failed'}
  } finally {Pop-Location}
} finally {
  $zip.Dispose()
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
$files=@(
  'apps/mobile/assets/kerahat/agir-kerahat.webp',
  'apps/mobile/assets/kerahat/hafif-kerahat.webp',
  'apps/mobile/assets/kerahat/poster-integrity.json'
)
if($Publish){
  & git -C $root add -- $files
  if($LASTEXITCODE -ne 0){throw 'Git add failed'}
  $changes=@(& git -C $root diff --cached --name-only -- $files)
  if($LASTEXITCODE -ne 0){throw 'Cannot inspect staged poster files'}
  if($changes.Count -gt 0){
    & git -C $root commit --only -m "assets(kerahat): add pixel-matched lossless WebP posters" -- $files
    if($LASTEXITCODE -ne 0){throw 'Poster-only Git commit failed'}
  }
  & git -C $root push origin $branch
  if($LASTEXITCODE -ne 0){throw 'Git push failed, assets remain locally installed'}
  Write-Host 'SUCCESS: WebP posters pushed to feature branch only.' -ForegroundColor Green
}else{
  Write-Host 'Converted and verified locally; use -Publish to send the 3 verified files to GitHub.' -ForegroundColor Yellow
}
