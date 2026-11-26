# Camideyiz Biz — Widget 3.1 / Android launcher reliability

## Architecture (17 November 2026)

After a real-phone report showing **both widgets stuck on "Takvim yüklenmedi" while the Home screen displayed verified Tuzla times**, we replaced the Android-only Expo widget JSX renderer with **native Android `RemoteViews` + `AppWidgetProvider`**.

This is an Android widget implementation change, **not a migration of the app**:
- Expo Router + React Native/TypeScript Home, notifications, and location stay as before.
- iOS `expo-widgets` + WidgetKit / `updateTimeline` stays as before.
- The Expo config keeps iOS widgets but turns off Expo's Android renderer.
- Android UI is built from CNG-managed XML and small Java providers.
- Existing Android launcher provider class names `biz.camideyiz.app.NextPrayerWidgetProvider` and `biz.camideyiz.app.PrayerDayWidgetProvider` are retained, so previously pinned appWidget IDs can survive the APK upgrade.

## Data path (NO manual refresh required for normal use)

1. Selected district and a structurally validated *published* Diyanet-coded today/tomorrow calendar are read once by `PrayerSourceProvider`. No astronomical fallback and no placeholder clock values.
2. `CompanionProvider` automatically calls `syncForegroundWidgetCalendar` after the source is ready and again after an app foreground refresh / location selection.
3. The active district is stored before native writes, and the validated published days are persisted for offline use. A different district's old cache is rejected.
4. `CamideyizWidgetBridge.publishCalendar` submits precomputed snapshots at each upcoming prayer boundary to `WidgetBoundaryScheduler`.
5. The scheduler commits the snapshot and calls `AppWidgetManager.updateAppWidget(ids, RemoteViews)` directly. The external launcher does **not** run an Expo widget JavaScript bundle.
6. `NextPrayerWidgetProvider.onUpdate` and `PrayerDayWidgetProvider.onUpdate` call the same scheduler when the user initially pins a widget or the OS updates it. They use the last validated snapshot without requiring the user to open the app at every pin/update.
7. The entire widget surface uses a **real `PendingIntent.getActivity`** to open the app when tapped; the previous misleading inert "Open app" text is gone.
8. `AlarmManager.setAndAllowWhileIdle` schedules best-effort native transitions; on delivery the receiver chooses the *actual current* precomputed state even after delayed wakeups. WorkManager remains a secondary best-effort network update mechanism.
9. Last-published fetch timestamp bounds offline schedule validity to 72h. Reopening the app does not extend it. No exact-alarm, background location, or notification permission required.

## Honesty / observability

Native diagnostic state includes:
- Installed launcher instance counts for small and daily cards.
- Committed native snapshot revision and effective next prayer.
- Next requested native boundary, source validity, last native error.
- `launcherConfirmed:false`: the external OEM launcher does not acknowledge drawing pixels. Neither a Java result nor a successful APK build proves the end-user screen is correct.

If the app shows verified prayer times but widgets remain blank, capture the native diagnostic error and `adb logcat -s CamideyizWidget:E AndroidRuntime:E`; **do not** attribute the issue to Expo Go if testing a real APK.

## Physical-device acceptance matrix (required before closing the incident)

- **Fresh install**: select district, load today+tomorrow. Pin both widgets *after* verified data. Expect times with no manual refresh button.
- **Upgrade from the previous APK**: existing pinned widgets should keep IDs. If OEM launcher did not restore instances, pin once and log device model + firmware.
- **Launcher tap**: tap each card and confirm the app actually opens, including from a fully backgrounded app.
- **Switch district**: old city's times must disappear; new city's verified times appear when fetched.
- **Wi-Fi/airplane mode**: a validated still-current district calendar should remain readable. Past expiry show honest unavailable text, never an invented prayer hour.
- **Transition**: leave app backgrounded over a published prayer boundary and confirm both cards advance. Android Doze may delay inexact wakeups; capture actual latency rather than claiming exact-second updates.
- **Reboot/time-zone adjustment**: the receiver reschedules and chooses the appropriate current state.
- **Force stop**: Android blocks pending alarms until the app is reopened; a normal app cannot bypass this OS guarantee.
- **Two themes/launcher grid sizes**: check 2×2 and 4×2 layout, Turkish glyphs, text clipping, card tap area, and six actual Diyanet-coded hours.
- **iOS**: separately test WidgetKit on a real iPhone; Android CI does not validate iOS widget rendering.

## Commands (Windows PowerShell)

```powershell
cd C:\active_projects\camideyiz-biz
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1 -CheckoutPath C:\cb -CleanNative
adb shell dumpsys appwidget | findstr /i "camideyiz NextPrayer PrayerDay"
adb logcat -s CamideyizWidget:E AndroidRuntime:E
```

Note: Root remote-view provider and resources are produced from `apps/mobile/plugins/widget-native` by `apps/mobile/plugins/withWidgetBoundaryBridge.js`, so a `-CleanNative` build is required after this change.

References: https://developer.android.com/develop/ui/views/appwidgets and https://developer.android.com/develop/background-work/services/alarms.
