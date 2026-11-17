# Camideyiz Biz — Widget P0 / Android native continuity

## Scope (17 November 2026)

Fix two release blockers while keeping the current widget UI unchanged:

1. **Distinguish data submission from actual launcher rendering.** Expo
   `updateSnapshot` stores widget properties and queues a Glance update;
   it does not return an image/pixel acknowledgment from Android Launcher.
2. **Prayer-boundary transitions when the JS app is not running.**
   Expo Widgets SDK 58 has no Android `updateTimeline`. WorkManager's 15-minute
   minimum is NOT an execution deadline.

## Implementation

- iOS remains WidgetKit + `updateTimeline`; none of the new native Android
  Java/AlarmManager code is built on iOS.
- Android's Expo widget layouts are unchanged. The `withWidgetBoundaryBridge`
  config plugin registers an Android-only React Native bridge and a receiver
  inside the generated CNG project; no manual edits under `android/`.
- Native `publishCalendar` receives **precomputed snapshots** at upcoming
  transitions, from `buildPrayerWidgetTimeline`, after the exact selected
  Diyanet district's multi-day calendar passes `parseWidgetCalendarCache`.
  The bridge rejects missing district identity and stale/unordered input.
- Persisted native source validity is bound to the original verified
  `fetchedAt`, **not** to the moment the user reopened the app. Maximum
  offline age: 72 hours. Out-of-date data becomes an explicit no-data state.
- At each upcoming prayer boundary, `AlarmManager.setAndAllowWhileIdle`
  requests a best-effort inexact wakeup. The receiver determines the most
  recent applicable snapshot **using current wall-clock time**, even if one or
  several alarms were delivered late, persists it to Expo Widgets shared
  preferences (`expo.modules.widgets`), sends explicit
  `ACTION_APPWIDGET_UPDATE` to both pinned Glance widget providers, and
  schedules the next boundary. The receiver also responds to reboot, phone
  time/time-zone change and package replacement.
- No exact-alarm permission (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`)
  or notification permission is requested. Under Doze/low-power modes,
  Android can deliver the alarm late: **exact-second change is NOT guaranteed**.
- Existing `expo-background-task` remains a secondary periodic network
  source for published calendar updates; it is no longer the only way to
  switch from one prayer to another.

## Verification semantics — no false success

`getStatus` reports:
- `installedNext`, `installedDay`: Android AppWidgetManager's actual
  pinned instance counts for each provider.
- `persisted`: both Expo native snapshots are stored with the same
  `nativeAppliedAt` revision and consistent next prayer.
- `lastAppliedAt`, `nextAlarmAt`, `lastNextName/Time`, `lastError`.
- `launcherConfirmed: false` ALWAYS: the external home-screen launcher does
  not offer an acknowledgement for pixels it rendered. **Do not** call
  native writes or a successful build "visually verified".

The companion screen shows the native instance counts, last native write,
next planned transition and this limitation.

## Android emulator/device QA acceptance (not done by GitHub CI)

Use a standalone release APK containing the CNG plugin, not Expo Go:
1. Install the APK. Open app, select district, wait for verified today +
   tomorrow prayer times, and tap **Widget'ı yenile**.
2. Long-press Android home screen, install both widgets; open app again and
   resync. Expect `installedNext >= 1` and `installedDay >= 1`.
3. Observe launcher and app diagnostics side-by-side. Compare six published
   times and next prayer. `nativePersisted` alone is **not** a pass.
4. Run `adb shell dumpsys appwidget | grep -i 'camideyiz\|NextPrayer\|PrayerDay'`
   to confirm widget providers/IDs are actually registered. On Windows, use
   `adb shell dumpsys appwidget | findstr /i "camideyiz NextPrayer PrayerDay"`.
5. Run `adb logcat -s CamideyizWidgetP0:E AndroidRuntime:E` to capture
   real native exceptions. Check for `CamideyizWidgetBridge` errors.
6. At an upcoming real prayer boundary, close the app, leave both widgets on
   screen and compare the next-prayer change. **Some delay is permitted by
   Android**; if a delay happens, capture the timestamp, Doze/battery mode,
   receiver logs, and UI state, not just a screenshot.
7. Test offline / app force-stop / reboot / clock change / district change.
   Android force-stop explicitly blocks alarms until the user opens the app;
   it cannot be bypassed by a normal app. Never misreport stopped-app data
   as "live". Reboot should restore scheduled transition if permission and
   OS startup policy permit it.
8. For native repro in CI, the separate Android QA workflow compiles a
   signed arm64 release APK and validates CNG native source registration.
   Core unit tests cover transition boundaries, delayed alarm recomputation,
   midnight and no-data fallback.

## Source compatibility / maintenance watch

The native helper writes Expo Widgets' Android private preferences:
`expo.modules.widgets` / `__expo_widgets_<name>_props` and triggers the
AppWidgetProvider broadcast. This is grounded in the Expo SDK 58 package
source but **not a stable public API**. Pin `expo-widgets` version to
`~58.0.28`, run a real native APK test before future Expo upgrades, and
switch to a first-party native widget provider if Expo changes the storage
contract.

- Expo official Android constraints: https://docs.expo.dev/versions/v58.0.0/sdk/widgets/
- Android alarm restrictions: https://developer.android.com/develop/background-work/services/alarms
- Android widget update guide: https://developer.android.com/develop/ui/views/appwidgets/advanced
