# Camideyiz Biz — 19 Kasım 2026 açılış gecikmesi / widget iş yükü P0

## Fiziksel cihaz tanılaması

Kullanıcı raporundan doğrudan doğrulananlar:

- İlçe: **Pendik**, yayınlanmış takvim ve Android native ilçe ID: **9545**.
- **1 NextPrayer + 1 PrayerDay** widget kurulu.
- `native-committed`, `hasTimeline=true`, `lastReady=true`, `lastError=""`.
- Doğrulanmış uygulama takvimi önbelleği: **539 ms**.
- İlk **JS frame callback**: **644 ms**. Bu Android'in gerçekten gösterdiği piksellerin zaman ölçümü değildir.
- 1600 ms için programlanmış bakım zamanlayıcısı: **18.035 ms**.
- Yayımlanmış veri kaynağından yeni sonuç: **18.159 ms**.
- `audio-first-tap` ve `audio-first-playing` işareti bu oturumda bulunmamış. Bu veri tek başına MP3 hatasını teşhis etmez.
- Rapor JS süreci açıldıktan yaklaşık **526 saniye** sonra alınmış. AppState geçmişi önceki sürümde ölçülmediği için 17 saniyelik aralığın tamamen JS engellenmesi olduğu ispatlanamaz.
- Bildirilen native widget başarısı, arızanın ilk açılışta doğrudan widget yayınından kaynaklandığını kanıtlamaz. Native sınır, renderer, ses hazırlığı ve JS olay döngüsü ayrı test edilmelidir.

## P0 müdahaleleri

1. Android'de doğrulanmış, aynı ilçeye ait, en az 24 saat kapsama sahip ve son altı saat içinde yayınlanmış native widget takvimi bulunursa, tam JS widget motoru ve `updateAppWidget` yeniden yayını atlanıyor. Yanlış ilçe, bozuk takvim, önbellek eksikliği ve eski takvim hâlâ güvenli onarımı tetikliyor.
2. WorkManager arka plan işi, foreground uygulama aktifse ağı/JS veri motorunu yüklemeden başarıyla kapanıyor; ağ isteği bitince uygulamanın aktifleştiği de yeniden kontrol ediliyor. Native Android vakit geçiş alarmı bundan bağımsız.
3. TaskManager kaydı hafif `widgetBackgroundRegistration.ts` dosyasına ayrıldı. Kök başlatma ve normal görev kayıt kontrolü artık `prayerApi` / büyük widget motorunu import etmiyor.
4. Çevrimdışı 3.1MB MP3 otomatik olarak açılışta decode edilmiyor. İlk açık kullanıcı dokunuşu `starting` gösteriyor ve player hazır olduğunda oynatıyor.
5. AppState ilk `active` olayı normal cold-start fetch'ini ikinci kez zorlamıyor; gerçek background dönüşlerinde yeniden kontrol ediyor.
6. Aynı ezan alarm planını aynı Android prosesinde sürekli silip tekrar kurmak engellendi. Fakat proses yenilenince (Android Force Stop alarmları iptal edebilir) alarm yeniden kurulur; salt kalıcı tercihe dayanarak atlanmaz.
7. Rapor `worstEventLoopLagMs`, duraklama sayıları, AppState, gerçek vakitli ekran callback, alt sistemler için `operationsMs` içeriyor. Kullanıcı verisi ağa gönderilmez.

## Sonraki fiziksel cihaz kabul testi

- Bu commit'in Release APK'sını mevcut kurulumun üzerine yükleyip **soğuk başlangıç** ve **arkadan dönüşü** ayrı ayrı dene.
- Önce iki widget kurulu iken 3–5 kez açılış yap, ardından aynı APK'da widgetları kaldırıp aynı testi yap. Koşullar/süreler aynı değilse tek denemeden nedensellik çıkarma.
- Aynı gün için geçerli doğrulanmış önbellekle mobil veri kapalı iken açılışta vakitler anında görünmeli. Gerçek veri yoksa hiçbir kaynak verisi uydurulmamalı.
- Ezan düğmesine dokununca `Ezan hazırlanıyor…` hemen görünmeli; kayıt hazır olunca ses başlamalı; arka plan ve kilit ekranı ses denetlenmeli.
- Widget'da ilçe aynı kalmalı, geçiş ve gecenin ertesi sabah imsakına geçiş testi başarılı olmalı.
- Otomatik ezan tercihleri değişmediğinde yeniden planlama native kaynakları gereksiz işgal etmemeli, ama force-stop/restart sonrası kesin alarmlar tekrar kurulmalı.
- `Widget 3.0 → Raporu paylaş` çıktısını kontrol et:
  `startupPerformance.marksMs.configured-home-frame` ile `published-cache-ready` arasındaki fark;
  `monitor.worstEventLoopLagMs`, `monitor.currentAppState`;
  `operationsMs.widget-health-check`, `widget-native-publish`, `widget-background-registration`, `notification-reconcile`, `published-network-fetch`, `audio-source-load`.

**Sınır:** CI, Metro, TypeScript ve Android Gradle doğrulaması fiziksel cihazın render performansını veya sesli ezan dinleme deneyimini tek başına kanıtlamaz. Release cihazına ait olay döngüsü ve Android Perfetto/JankStats ölçümüyle yeniden doğrulanmalıdır.

## Android native widget broadcast / UI-thread separation (19 Nov P0 follow-up)

- `WidgetBoundaryReceiver`, `NextPrayerWidgetProvider`, and `PrayerDayWidgetProvider` now call `goAsync()` and hand calendar parsing, SharedPreferences commits, RemoteViews updates, and AlarmManager changes to a dedicated serialized background Java executor. The UI/broadcast main thread returns without waiting for the native work. All paths call `PendingResult.finish()`, including task rejection and update failure.
- Removing the last instance of either widget type triggers a native refresh. If **neither type is pinned**, the native boundary alarm is canceled; adding a widget invokes `onUpdate()` and restores the alarm from the persisted published timetable. This does not alter the separate ezan notification alarms.
- The executor is intentionally **not** for network requests or long background jobs: Android broadcast timeouts still apply. WorkManager continues to handle longer network refreshes.
- The update preserves both existing provider class names and validated native calendar data. Rebuild the **release APK**: changes to Java/Expo prebuild cannot be activated by JS hot reload or OTA update.
- `node scripts/verify-widget-native-runtime.mjs` verifies that no broadcast entrypoint calls synchronous refresh and that plugin source-copying includes the worker. This is a static regression check, **not** proof of on-device latency or ANR absence.
- Physical release QA: repeat 3–5 launches with 1+1 widgets installed, 3–5 with widgets removed, resume/background, midnight boundary, reboot, and manual location change. Use Perfetto to confirm there is no widget refresh stack blocking Android main while monitoring `startupPerformance.monitor` and `operationsMs`. Treat 18s as unresolved until measured again.
