# Camideyiz Biz — User-approved icon (19 Nov 2026)

**Source of truth:** user-uploaded `image(20261119-174132).png`, SHA256
`a50f1ceb13788541ef828436ba5c7f060ed5bc4a8b56b7b00e159af22d8044e5`.
This is the blue `camideyiz.biz` brand lockup on midnight-navy background
and illuminated blue rounded-square border. **Do not use the earlier gold mosque
concept or redraw it.**

The user-selected image was resized only, not regenerated:
- `app-icon.png`: 1024×1024 opaque PNG from approved image.
  SHA256 `54f731ab37e8a205dcba9c5b7c602d140a8fadbfc69851533482fe9935580f29`.
- `adaptive-icon.png`: 1024×1024 transparent PNG with the same approved
  artwork inset to 678×678 to keep the blue mark/name inside Android adaptive
  masks. SHA256 `b5d7097d0fdbc10319d9f9ae96acd57553e2364e1fd27f9a74e74efc5351c8b2`.

## Important: raw binary files

The current GitHub integration can edit repository text and refs but does not
accept conversation binary assets via file reference. The two approved image
bytes are supplied as `camideyiz-icon-assets.zip` in the ChatGPT conversation
and intentionally ignored by git. Install them exactly once:

```powershell
# From the repository root, after downloading the supplied ZIP:
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\camideyiz-icon-assets.zip" \
  -DestinationPath ".\apps\mobile\assets" -Force
node scripts/verify-app-icon.mjs
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
```

The build script securely copies both files into the isolated `C:\cb` checkout
before Expo prebuild and fails closed if missing. `app.config.js` wires
the normal Android/iOS launcher icon and Android adaptive foreground.
Checksums prevent an incorrect icon from silently replacing the approved
design. This concerns app launcher icons only; it does not replace the existing
owner-approved `camideyiz-original-symbol.png` used on the home screen and widgets.

Expo prebuild in CI without owner binary assets is intentionally unbranded and
MUST NOT be considered proof of the final launcher icon. A physical Android
Release APK is required to check circular, squircle, Samsung and Pixel masks.
