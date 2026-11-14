# Camideyiz Biz: isolate Windows native builds from long-path/old-Ninja errors.
# Builds a standalone release APK, never merges/deploys or edits the primary clone.
# Run from any directory: powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
[CmdletBinding()]
param(
  [ValidateSet('Release','Debug')]
  [string]$Configuration = 'Release',
  [string]$CheckoutPath = 'C:\cb',
  [string]$Branch = 'feat/widgets-and-prayer-alerts-2'
)

$ErrorActionPreference = 'Stop'
$repoUrl = 'https://github.com/Yigit033/camideyiz-biz.git'
$gradleHome = 'C:\g'
$tempHome = 'C:\t'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { 'C:\Android\Sdk' }

function Invoke-Checked {
  param([string]$Name, [scriptblock]$Action)
  Write-Host "==> $Name" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed (exit $LASTEXITCODE)"
  }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required.' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Node.js/npm is required.' }
if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) { throw 'npx is required.' }
if (-not (Test-Path -LiteralPath $sdk -PathType Container)) {
  throw "Android SDK not found: $sdk. Set ANDROID_HOME to your SDK path."
}
if ($CheckoutPath.Length -gt 10) {
  throw "CheckoutPath must be near the drive root (example C:\cb) to avoid Ninja path limits."
}
$longPaths = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
if ($longPaths -ne 1) {
  throw 'Enable Windows long paths in elevated PowerShell, restart Windows, then rerun: New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force'
}

$cmakeVersion = '3.31.6'
$cmakeDir = Join-Path $sdk "cmake\$cmakeVersion"
$ninja = Join-Path $cmakeDir 'bin\ninja.exe'
if (-not (Test-Path -LiteralPath $ninja -PathType Leaf)) {
  Write-Host "Android SDK CMake $cmakeVersion is missing; attempting SDK Manager install." -ForegroundColor Yellow
  $sdkmanager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
  if (-not (Test-Path -LiteralPath $sdkmanager -PathType Leaf)) {
    throw "Install CMake $cmakeVersion in Android Studio > SDK Manager > SDK Tools > Show Package Details. Then rerun."
  }
  Invoke-Checked 'Install Android SDK CMake 3.31.6' {
    & $sdkmanager "--sdk_root=$sdk" "cmake;$cmakeVersion"
  }
}
if (-not (Test-Path -LiteralPath $ninja -PathType Leaf)) { throw "Ninja not found at $ninja" }
$ninjaVersion = (& $ninja --version | Select-Object -First 1).Trim()
if ([version]$ninjaVersion -lt [version]'1.12.0') {
  throw "Old Ninja $ninjaVersion found. Required: 1.12.0+."
}
Write-Host "Using Ninja $ninjaVersion from CMake $cmakeVersion" -ForegroundColor Green

# Local, non-global build settings; never edit the developer's main checkout.
New-Item -ItemType Directory -Path $gradleHome,$tempHome -Force | Out-Null
$env:GRADLE_USER_HOME = $gradleHome
$env:TEMP = $tempHome
$env:TMP = $tempHome
$env:CMAKE_VERSION = $cmakeVersion
if ($env:_JAVA_OPTIONS) {
  Write-Warning '_JAVA_OPTIONS is set. It can affect Gradle; removing it for this process only.'
  Remove-Item Env:_JAVA_OPTIONS -ErrorAction SilentlyContinue
}

# Expo SDK 57+ honors android.cmakeVersion from the Gradle user home.
# Preserve any other user Gradle properties in this isolated directory.
$gradleProps = Join-Path $gradleHome 'gradle.properties'
$props = if (Test-Path $gradleProps) { [IO.File]::ReadAllText($gradleProps) } else { '' }
if ($props -match '(?m)^\s*android\.cmakeVersion\s*=') {
  $props = [regex]::Replace($props,'(?m)^\s*android\.cmakeVersion\s*=.*$',"android.cmakeVersion=$cmakeVersion")
} else {
  $props = $props.TrimEnd() + "`r`nandroid.cmakeVersion=$cmakeVersion`r`n"
}
[IO.File]::WriteAllText($gradleProps,$props)

if (-not (Test-Path -LiteralPath $CheckoutPath)) {
  Invoke-Checked 'Clone isolated short-path checkout' {
    & git clone --branch $Branch --single-branch $repoUrl $CheckoutPath
  }
} else {
  if (-not (Test-Path -LiteralPath (Join-Path $CheckoutPath '.git'))) {
    throw "$CheckoutPath already exists and is not a Git checkout; refusing to overwrite it."
  }
  $origin = (& git -C $CheckoutPath remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0 -or $origin -notmatch 'Yigit033[\\/]camideyiz-biz(\.git)?$') {
    throw "$CheckoutPath is not the Camideyiz Biz GitHub checkout; refusing to modify it."
  }
  $activeBranch = (& git -C $CheckoutPath branch --show-current).Trim()
  if ($activeBranch -ne $Branch) {
    throw "$CheckoutPath is on branch '$activeBranch', expected '$Branch'. No branch switching performed."
  }
  $dirty = & git -C $CheckoutPath status --porcelain
  if ($LASTEXITCODE -ne 0 -or $dirty) {
    throw "$CheckoutPath has uncommitted changes. Preserve/review them before building; use a different short CheckoutPath for a clean build."
  }
  Invoke-Checked 'Fast-forward isolated checkout' { & git -C $CheckoutPath pull --ff-only origin $Branch }
}

Push-Location $CheckoutPath
try {
  Invoke-Checked 'Install workspace dependencies' { & npm.cmd install --package-lock=false --no-audit --no-fund }
  Push-Location 'apps\mobile'
  try {
    # Isolated checkout means regenerating native files cannot overwrite the main worktree.
    Invoke-Checked 'Generate native Android project' {
      & npx.cmd expo prebuild --platform android --no-install --clean
    }
    $androidDir = Join-Path (Get-Location).Path 'android'
    $gradlew = Join-Path $androidDir 'gradlew.bat'
    if (-not (Test-Path -LiteralPath $gradlew -PathType Leaf)) {
      throw "Gradle wrapper not generated: $gradlew"
    }
    $settingsFiles = @('settings.gradle', 'settings.gradle.kts', 'settings.gradle.dcl')
    $settingsFound = @($settingsFiles | Where-Object {
      Test-Path -LiteralPath (Join-Path $androidDir $_) -PathType Leaf
    }).Count -gt 0
    if (-not $settingsFound) {
      throw "Android Gradle project missing settings.gradle[.kts] in $androidDir; check expo prebuild output"
    }
    $task = if ($Configuration -eq 'Release') { ':app:assembleRelease' } else { ':app:assembleDebug' }
    # Gradle must run WITHIN the Android project root. Invoking the wrapper by
    # full path from apps/mobile makes Gradle incorrectly search for settings.gradle
    # in apps/mobile, producing 'Directory does not contain a Gradle build'.
    Push-Location $androidDir
    try {
      Write-Host "Gradle project root: $((Get-Location).Path)" -ForegroundColor Cyan
      Invoke-Checked "Build native $Configuration APK (arm64)" {
        & $gradlew $task --no-daemon --stacktrace '-PreactNativeArchitectures=arm64-v8a'
      }
    } finally {
      Pop-Location
    }
    $output = Join-Path (Get-Location).Path ("android\app\build\outputs\apk\"+$Configuration.ToLowerInvariant())
    $apk = Get-ChildItem -Path $output -Filter '*.apk' -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $apk) { throw "Gradle reported success, but no APK exists in $output" }
    Write-Host "APK generated: $($apk.FullName)" -ForegroundColor Green
    if ($apk.Name -match 'unsigned') {
      Write-Warning 'APK is unsigned and cannot be installed until it is signed.'
    }
    $signer = Get-ChildItem -Path (Join-Path $sdk 'build-tools') -Filter 'apksigner.bat' -Recurse -File -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending | Select-Object -First 1
    if ($signer) {
      & $signer.FullName verify $apk.FullName
      if ($LASTEXITCODE -ne 0) {
        Write-Warning 'APK signature verification failed; do not install this file before signing.'
      } else {
        Write-Host 'APK signature verified.' -ForegroundColor Green
      }
    } else {
      Write-Warning 'apksigner unavailable; APK signing status has not been verified.'
    }
    if ($Configuration -eq 'Debug') {
      Write-Warning 'Debug APK expects a Metro development server. Use Release for a standalone device test.'
    }
  } finally { Pop-Location }
} finally { Pop-Location }
