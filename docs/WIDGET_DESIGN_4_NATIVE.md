# Camideyiz Biz — Widget Tasarım 4.0 (Android native)

The four variants now use Android `RemoteViews`, not an Expo headless JS widget renderer:
- **Tekli Vakit (1×1):** only next name and fixed published prayer clock, 68×68dp minimum, no unreadable sub-minute text.
- **Sıradaki Vakit (2×2):** fixed prayer time plus system-driven `Chronometer` countdown.
- **Günlük Namaz Vakitleri (4×2):** six current-day *published* prayer times, next prayer highlighted.
- **Vakit Odağı (4×2):** current interval deduced from the strictly ordered published six daily entries, next prayer and Android `Chronometer` countdown, fixed next time beneath it.

Both **dark teal/gold** and **light ivory/green** native XML layouts exist. The native appearance preference is synchronized from the app's own selected/system theme after AsyncStorage hydration and persisted across Android widget-only processes; an unchanged preference is a no-op. Changes trigger the already-off-main-thread native update queue.

All four providers have distinct stable package class names and are registered by `withWidgetBoundaryBridge`. The original two provider names remain unchanged so existing pins survive APK upgrades. Android `Chronometer` uses `SystemClock.elapsedRealtime()`; never schedule one update per second, wake React, generate astronomical hours, or fetch from the widget process. The existing inexact Android boundary alarm is retained. Under Doze, rollover can be delayed by the OS; count-down may temporarily reach 00:00/negative until the system wakes the receiver, so it must be checked on physical devices. No promise of exact boundary seconds.

The design board is a *visual reference*, not a pixel-exact contract across different launcher grids or accessibility font scales. The compact 1×1 has intentionally fewer decorations because some launcher cells are smaller than 110dp. All text is backed by validated same-district data; when data are unavailable, placeholders are used instead.

## QA and APK

```powershell
git fetch origin
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
node scripts/verify-widget-designs.mjs
node scripts/verify-widget-native-runtime.mjs
node scripts/verify-widget3-contracts.mjs
node scripts/verify-startup-performance.mjs
npm run typecheck
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
```

Check all four widgets with both themes, narrow 1×1 on the launcher, 2×2 countdown after 60s, 4×2 next-row highlight at the boundary, after-midnight Yatsı/İmsak transition, data-unavailable placeholders, district changes, background/offline, reboot, and widget-free app launch performance. CI/static assertions cannot verify that Android launcher rendered the pixels; release APK physical device acceptance is required.
