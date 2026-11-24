# Camideyiz Biz: isolate Windows native builds from long-path/old-Ninja errors.
# Builds a standalone release APK, never merges/deploys or edits the primary clone.
# Run from any directory: powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
[CmdletBinding()]
param(
  [ValidateSet('Release','Debug')]
  [string]$Configuration = 'Release',
  [switch]$CleanNative,
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

# Gradle defaults to one worker per CPU (28 on an i7-14700HX). Each worker
# runs javac/kotlinc or a Ninja/clang batch while Metro bundles with one Node
# worker per CPU as well, so a 14 GB laptop exhausts RAM + page file and the
# JVM dies with "insufficient memory ... malloc failed" (daemon disappeared).
# Size parallelism to the memory that is actually free right now instead.
function Get-BuildMemoryPlan {
  param([int]$MaxWorkers = 8)
  # "Available" (free + standby cache), not WMI FreePhysicalMemory, which
  # ignores reclaimable cache. Perf classes are not localized (Turkish OS).
  $mem = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
  $os = Get-CimInstance Win32_OperatingSystem
  $freeRamGB = $mem.AvailableBytes / 1GB
  $freeCommitGB = ($mem.CommitLimit - $mem.CommittedBytes) / 1GB   # RAM + page file headroom
  $totalGB = $os.TotalVisibleMemorySize / 1MB
  $cores = [Environment]::ProcessorCount
  # ~4 GB for the Gradle JVM (heap + native) and Metro's main process; each
  # further parallel worker needs roughly 1 GB.
  $usable = [math]::Min($freeRamGB, $freeCommitGB) - 4
  $workers = [int][math]::Floor($usable)
  $workers = [math]::Max(2, [math]::Min($workers, [math]::Min($MaxWorkers, $cores)))
  [pscustomobject]@{
    Workers      = $workers
    MetroWorkers = [math]::Min($workers, 6)
    # In-process Kotlin needs heap room; only cap it when commit is scarce.
    HeapGB       = if ($totalGB -ge 12 -and $freeCommitGB -ge 8) { 3 } else { 2 }
    FreeRamGB    = [math]::Round($freeRamGB, 1)
    FreeCommitGB = [math]::Round($freeCommitGB, 1)
    TotalGB      = [math]::Round($totalGB, 1)
  }
}

function Stop-IsolatedGradleDaemons {
  param([string]$Gradlew)
  # Best effort; affects only daemons under this script's GRADLE_USER_HOME.
  try { & $Gradlew --stop *> $null } catch { }
}

function Invoke-GradleBuild {
  param([string]$Gradlew, [string]$Task, $Plan, [string]$Label)
  # Kotlin compiles inside the Gradle JVM: no second multi-GB Kotlin daemon.
  $env:CAMIDEYIZ_METRO_MAX_WORKERS = "$($Plan.MetroWorkers)"
  $jvm = "-Xmx$($Plan.HeapGB)g -XX:MaxMetaspaceSize=1g -XX:ReservedCodeCacheSize=256m -Dfile.encoding=UTF-8"
  Invoke-Checked $Label {
    & $Gradlew $Task --stacktrace --no-daemon "--max-workers=$($Plan.Workers)" `
      "-Dorg.gradle.jvmargs=$jvm" '-Pkotlin.compiler.execution.strategy=in-process' `
      '-PreactNativeArchitectures=arm64-v8a'
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
  $dirty = @(& git -C $CheckoutPath status --porcelain)
  if ($LASTEXITCODE -ne 0) { throw "Could not inspect Git status in $CheckoutPath." }
  if ($dirty.Count -gt 0) {
    # Expo prebuild may write to these two tracked files. Preserve such edits
    # in a named LOCAL stash before pulling. Never throw away modifications.
    # Refuse to auto-stash anything else: it could be real user work.
    $expoGeneratedPaths = @('apps/mobile/package.json','apps/mobile/tsconfig.json')
    $otherChanges = @($dirty | Where-Object {
      $_.Length -lt 4 -or $_.Substring(3).Trim('"') -notin $expoGeneratedPaths
    })
    if ($otherChanges.Count -gt 0) {
      Write-Warning "Other local files in isolated checkout: $($otherChanges -join '; ')"
      throw "$CheckoutPath has changes outside Expo generated package/tsconfig. Review and stash them manually; no files were modified."
    }
    Invoke-Checked 'Preserve Expo-generated changes in local Git stash' {
      & git -C $CheckoutPath stash push -m 'camideyiz-build: Expo prebuild files saved automatically' -- 'apps/mobile/package.json' 'apps/mobile/tsconfig.json'
    }
    $remaining = @(& git -C $CheckoutPath status --porcelain)
    if ($LASTEXITCODE -ne 0 -or $remaining.Count -gt 0) {
      throw "$CheckoutPath is still dirty after the automatic preservation step. Stop and review git status."
    }
    Write-Host 'Generated file edits are preserved in local git stash; Android CMake caches were not touched.' -ForegroundColor Green
  }
  Invoke-Checked 'Fast-forward isolated checkout' { & git -C $CheckoutPath pull --ff-only origin $Branch }
}

# Transfer the explicitly approved launcher icon to the isolated C:\cb
# checkout before Expo prebuild. Missing or mismatched art is fatal in Release.
if ($Configuration -eq 'Release') {
  $sourceAssets = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\mobile\assets'
  $targetAssets = Join-Path $CheckoutPath 'apps\mobile\assets'
  New-Item -ItemType Directory -Path $targetAssets -Force | Out-Null
  $icons = @(
    @{ Name='app-icon.png'; SHA='54f731ab37e8a205dcba9c5b7c602d140a8fadbfc69851533482fe9935580f29' },
    @{ Name='adaptive-icon.png'; SHA='b5d7097d0fdbc10319d9f9ae96acd57553e2364e1fd27f9a74e74efc5351c8b2' }
  )
  foreach ($icon in $icons) {
    $from = Join-Path $sourceAssets $icon.Name
    if (-not (Test-Path -LiteralPath $from -PathType Leaf)) {
      throw "Approved icon missing: $from. Extract camideyiz-icon-assets.zip into apps\mobile\assets first."
    }
    $digest = (Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($digest -ne $icon.SHA) { throw "Approved icon checksum mismatch: $($icon.Name)" }
    Copy-Item -LiteralPath $from -Destination (Join-Path $targetAssets $icon.Name) -Force
  }
  $env:CAMIDEYIZ_BRANDED_RELEASE = '1'
}

# The build happens in C:\cb, not in the developer's main checkout.
# Copy the exact user-uploaded MP3 across this isolation boundary BEFORE npm
# postinstall. .gitignore excludes it from git clone, not from an APK.
$sourceAudio = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\mobile\assets\audio\camideyiz-biz-ezan.mp3'
$targetAudio = Join-Path $CheckoutPath 'apps\mobile\assets\audio\camideyiz-biz-ezan.mp3'
$ezanSha = '09b6077c9ec6acaa3de1721de4a1f558c9e7ec0044c916d29ba6ea19b53ea77f'
if (Test-Path -LiteralPath $sourceAudio -PathType Leaf) {
  $sourceHash = (Get-FileHash -LiteralPath $sourceAudio -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sourceHash -ne $ezanSha) { throw "Ana proje MP3 SHA-256 değeri yüklenen ezanla eşleşmiyor." }
  $targetDir = Split-Path -Parent $targetAudio
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  Copy-Item -LiteralPath $sourceAudio -Destination $targetAudio -Force
  Write-Host 'Seçilen 3:17 ezan C:\cb derleme klasörüne aktarıldı.' -ForegroundColor Green
} else {
  Write-Warning 'Ana projede ses bulunamadı. npm postinstall URL kaynağını SHA-256 ile doğrulamayı deneyecek; farklı kayıt asla kullanılmayacak.'
}

Push-Location $CheckoutPath
try {
  Invoke-Checked 'Install workspace dependencies' { & npm.cmd install --package-lock=false --no-audit --no-fund }
  if ($Configuration -eq 'Release') {
    Invoke-Checked 'Verify exact user-approved launcher icon and adaptive foreground' {
      & node scripts/verify-app-icon.mjs
    }
  }
  # Fail locally before expensive native compilation if widget or brand
  # contracts are incomplete. These checks are offline and fast.
  if ($Configuration -eq 'Release') {
    Invoke-Checked 'Verify all eleven native widget layouts, metadata and live countdowns' {
      & node scripts/verify-widget-designs.mjs
    }
    Invoke-Checked 'Verify exact original 3D brand symbol and native CNG copy rule' {
      & node scripts/verify-brand-symbol.mjs
    }
    Invoke-Checked 'Verify safe native widget bridge and broadcast worker' {
      & node --experimental-strip-types scripts/verify-widget-native-runtime.mjs
    }
    Invoke-Checked 'Verify Widget Engine 4.0 nonblocking coordinator and perf metrics' {
      & node scripts/verify-widget-engine4.mjs
    }
    Invoke-Checked 'Verify Widget Engine 4.1 and supplied single-image branding' {
      & node scripts/verify-widget-engine41.mjs
    }
    Invoke-Checked 'Verify Widget Engine 4.3 on-time switch, day/night theme and previews' {
      & node scripts/verify-widget-engine43.mjs
    }
    Invoke-Checked 'Verify light widget layouts match their dark design sources' {
      & node scripts/sync-widget-light-layouts.mjs --check
    }
    Invoke-Checked 'Verify Kıble fused compass and guidance contracts' {
      & node scripts/verify-qibla.mjs
      if ($LASTEXITCODE -ne 0) { return }
      & node scripts/verify-dark-palette.mjs
    }
    Invoke-Checked 'Verify on-time prayer alerts and ezan fallback contracts' {
      & node scripts/verify-prayer-alerts.mjs
      if ($LASTEXITCODE -ne 0) { return }
      & node scripts/verify-adhan-playback-contracts.mjs
      if ($LASTEXITCODE -ne 0) { return }
      & node scripts/build-notification-icon.mjs --check
    }
    Invoke-Checked 'Verify brand splash hand-off and owner-icon derivation' {
      & node scripts/verify-splash.mjs
      if ($LASTEXITCODE -ne 0) { return }
      & node scripts/build-splash-mark.mjs --check
      if ($LASTEXITCODE -ne 0) { return }
      & node scripts/build-widget-marks.mjs --check
    }
    Invoke-Checked 'Test fast and safe widget headless health gate' {
      & node --experimental-strip-types scripts/verify-widget-headless-gate.mjs
    }
    Invoke-Checked 'Verify verified native widget recovery contracts' {
      & node scripts/verify-widget3-contracts.mjs
    }
  }
  # Prevent Release APKs with placeholder images or modified source pixels.
  if ($Configuration -eq 'Release') {
    Invoke-Checked 'Verify original-source lossless WebP posters' {
      & node scripts/verify-kerahat-posters.mjs
    }
    Invoke-Checked 'Verify all 27 gallery photos and thumbnails' {
      & node scripts/verify-gallery-assets.mjs
    }
  }
  Push-Location 'apps\mobile'
  try {
    # Default: preserve Gradle/CMake/Ninja intermediate objects between builds.
    # A clean prebuild is only required on first setup or when -CleanNative
    # is explicitly requested to recover from a broken native project.
    $androidDir = Join-Path (Get-Location).Path 'android'
    $gradleFile = Join-Path $androidDir 'settings.gradle'
    if ($CleanNative -or -not (Test-Path -LiteralPath $gradleFile)) {
      Invoke-Checked 'Generate clean native Android project' {
        & npx.cmd expo prebuild --platform android --no-install --clean
      }
    } else {
      Invoke-Checked 'Update native config in place (preserves CMake/Gradle cache)' {
        & npx.cmd expo prebuild --platform android --no-install
      }
    }
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
      # Idle daemons from earlier builds (isolated GRADLE_USER_HOME C:\g only)
      # each keep gigabytes resident; release them before sizing the build.
      Stop-IsolatedGradleDaemons -Gradlew $gradlew
      $plan = Get-BuildMemoryPlan
      Write-Host ("Memory plan: {0} GB free RAM, {1} GB free commit of {2} GB -> {3} Gradle workers, {4} Metro workers, {5} GB heap" -f `
        $plan.FreeRamGB, $plan.FreeCommitGB, $plan.TotalGB, $plan.Workers, $plan.MetroWorkers, $plan.HeapGB) -ForegroundColor Cyan
      if ($plan.FreeRamGB -lt 6) {
        $heavy = Get-Process | Group-Object Name | ForEach-Object {
          [pscustomobject]@{ Name = $_.Name; GB = ($_.Group | Measure-Object PrivateMemorySize64 -Sum).Sum / 1GB }
        } | Sort-Object GB -Descending | Select-Object -First 4
        $list = ($heavy | ForEach-Object { '{0} {1:N1} GB' -f $_.Name, $_.GB }) -join ', '
        Write-Warning "Only $($plan.FreeRamGB) GB RAM available; building with $($plan.Workers) workers (slower but safe). Largest users: $list. Closing extra VS Code windows, browsers or games speeds the build up."
      }
      $buildStarted = Get-Date
      try {
        Invoke-GradleBuild -Gradlew $gradlew -Task $task -Plan $plan `
          -Label "Build native $Configuration APK (arm64)"
      } catch {
        # Retry ONLY a JVM out-of-memory crash (a fresh hs_err log); real
        # compile errors fail immediately. Gradle resumes incrementally.
        $crash = Get-ChildItem -Path $androidDir -Filter 'hs_err_pid*.log' -File -ErrorAction SilentlyContinue |
          Where-Object { $_.LastWriteTime -ge $buildStarted }
        if (-not $crash) { throw }
        Write-Warning "Gradle JVM ran out of memory ($($crash[0].Name)). Retrying once with minimal parallelism."
        Stop-IsolatedGradleDaemons -Gradlew $gradlew
        $retry = Get-BuildMemoryPlan -MaxWorkers 2
        $retry.MetroWorkers = 2
        Invoke-GradleBuild -Gradlew $gradlew -Task $task -Plan $retry `
          -Label "Retry native $Configuration APK (arm64, 2 workers)"
      }
    } finally {
      Remove-Item Env:CAMIDEYIZ_METRO_MAX_WORKERS -ErrorAction SilentlyContinue
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
