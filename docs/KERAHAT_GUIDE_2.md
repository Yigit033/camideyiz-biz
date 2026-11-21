# Kerahat 2.0 — original source posters, lossless WebP

## Status
- Screen has two tabs: **Ağır Kerahat** / **Hafif Kerahat**.
- Tabs show the original 1126×2000 user-supplied artwork with no cropping
  or overlays. Zoom/scroll preserves source content.
- Release APK refuses temporary WebP placeholders; assets require a manifest.

## ZIP input
The install script accepts a ZIP containing **exactly one** file per title:
`agir-kerahat.jpg/.jpeg/.png` and `hafif-kerahat.jpg/.jpeg/.png`.
Nested ZIP folders are supported. This matches the user-shared screenshot
showing two JPEG source files under a nested folder.
The old contract erroneously required exact repository-relative PNG paths.

PNG source authenticity is checked against previously recorded SHA-256:
- heavy `dd7a26f775110bc3a911be35c78ec9c90e3d3e0a2e0a470343cfaedb410babf7`
- light `f403909395ea5e9f676680f9c6df53e7a1b0cd9f9730328b8bafa3a3b1a3cce5`

**JPEG sources have no previously known reference SHA-256.** Their actual
SHA-256, source type and size are recorded in the manifest, but this
does *not* prove they are the same as previously supplied PNG artwork.
JPEG is already lossy; converting JPEG to lossless WebP preserves
the source's currently decoded pixels (verified byte-for-byte RGBA)
but cannot restore detail lost during original JPEG compression.
Lossless WebP might be *larger* than JPEG; console reports actual size.

## Install (Windows)
```powershell
cd C:\active_projects\camideyiz-biz
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\install-kerahat-posters.ps1 `
  -ArchivePath "C:\Users\Yiğit\Downloads\camideyiz-kerahat-orijinal-gorseller.zip" `
  -Publish
npm run verify:kerahat-posters
```

The installer converts to lossless WebP, verifies **both** source pixels,
and publishes only the WebP assets + poster-integrity.json on the feature
branch. It never merges to main or deploys.

## Release quality gates
- `poster-integrity.json` must list both real WebPs, valid type, 1126×2000,
  source metadata, file SHA-256 and decoded RGBA pixel SHA-256.
- Release script runs `npm run verify:kerahat-posters` after dependency install.
- Mobile device QA still required for tab switching, zooming, safe areas,
  accessibility and readability.
- Religious-content editorial verification is separate from pixel integrity.
