# Windows: Android native APK build (Reanimated / Ninja)

The Windows phone-test build of Camideyiz Biz failed with:

```text
:react-native-reanimated:buildCMakeRelWithDebInfo[arm64-v8a]
ninja: error: mkdir(CMakeFiles/reanimated.dir/C_/active_projects/camideyiz-biz/node_modules/.../CSS/common/values/complex): No such file or directory
```

**Root cause:** The local source directory is deeply nested, which
creates long native C++ object paths. Expo's default Android SDK CMake
3.22.1 bundles Ninja 1.10.2. Reanimated and Expo explicitly document
this Windows failure class and recommend a short checkout path, Win32
long paths, and a modern Ninja version. Earlier changing only
`GRADLE_USER_HOME` did not change the source checkout path.

This is a **local build-environment failure**, not evidence that the
prayer wheel, widget layouts, or API provider is defective.

## One-time Windows prerequisite

1. In **Administrator PowerShell**:
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force
   ```
2. **Restart Windows**, as required by the Expo/Windows documentation.
3. Android SDK must be installed (defaults to `C:\Android\Sdk`); JDK,
   Android build tools and appropriate NDK should also be available.
4. Script will try to install **CMake 3.31.6**, which ships
   **Ninja 1.12.1**, using SDK Manager. If Android Command-Line Tools
   are unavailable, install it in Android Studio > SDK Manager >
   SDK Tools > Show Package Details > CMake > 3.31.6.

## Build a standalone test APK without an emulator

From the normal Camideyiz Biz checkout:

```powershell
cd C:\active_projects\camideyiz-biz
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
```

The script:
- Checks the Windows long-path switch, CMake and Ninja versions.
- Uses `C:\g` for **isolated Gradle user home** and `C:\t` for temporary files.
- Sets **`android.cmakeVersion=3.31.6`** in `C:\g\gradle.properties`;
  do **not** set this in the shared project `app.json` because Linux
  CI/cloud builders do not automatically have that exact CMake version.
- Clones the GitHub feature branch into the much shorter **`C:\cb`**
  path and runs Expo prebuild + Gradle only in that checkout.
- Does **not** delete, rename, merge, or change the original project at
  `C:\active_projects\camideyiz-biz`.
- Runs `:app:assembleRelease` for ARM64 Android phones and searches for
  the APK at:
  `C:\cb\apps\mobile\android\app\build\outputs\apk\release\`
- Attempts to verify the APK signature with the Android SDK
  `apksigner`; unsigned APKs cannot be installed.
- Stops on errors rather than reporting a build as successful.

**Note:** A Release APK might be signed with a development/debug
keystore depending on the generated Android template. This is
acceptable only for private testing, **not** a Play Store release.
Production signing must be configured and verified separately.

If you need a Metro-dependent debug variant, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1 -Configuration Debug
```

A debug build does not by itself provide the same standalone experience
as the Release APK.

### Safe operation

- The isolated `C:\cb` checkout must be the expected repository and
  branch; the script **refuses to overwrite unrelated folders or
  discard uncommitted changes**.
- It creates no production deployment, Google Play upload, cloud
  build, or database migration.
- Avoid `git clean -fdX` and deleting the developer's main
  `node_modules` or `.env` just to make native compilation pass.
- No need to downgrade Reanimated, Android Gradle Plugin, or disable
  React Native New Architecture.
- If the script fails, capture the earliest failing task and error,
  plus the reported Ninja version, not only the last Gradle stacktrace.

## Device acceptance

After successful **signed and installable** APK output:
- Install to your Android phone; open app, set district, verify published
  prayer times and refresh.
- Long-press the launcher home screen > Widgets > Camideyiz Biz.
  Verify 2x2 next-prayer and 4x2 daily-prayer widgets.
- Verify widget tap opens the app; text does not clip; switching
  districts removes stale content.
- Test permission deny/allow, 5-second notification, enabled 7-day
  schedule, sound/silent modes, screen locked, battery optimization.
- Confirm a 24h rollover. Android widget refreshes on app opening;
  **fully automatic background refresh is not promised**.
- iOS WidgetKit signing and device QA remain separate release gates.

Sources:
- Expo: https://docs.expo.dev/troubleshooting/windows-long-paths/
- Reanimated: https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/
- Microsoft: https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation
