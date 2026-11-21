# Camideyiz Biz · Widget Engine 4.0 — Native Asenkron Senkronizasyon (21 Kasım 2026)

## Amaç ve sınır

Önceki Android P0 raporunda (~18 s gözlenen gecikme) widgetların tek başına hatalı olduğu **kanıtlanmadı**. Fiziksel cihazda Perfetto / FrameTimeline ve gerçek launcher görüntüsü ayrıca gereklidir. Bu değişiklik, kodda kanıtlanmış gereksiz kaynak kullanımı, tek kuyrukta native module blokajı ve tekrarlı widget güncellemelerini azaltır.

**Sekiz bağımsız WorkManager oluşturulmadı.** Sekiz widget için aynı takvimi sekiz kere indirmek, sekiz ayrı çalışma kuyruğunda ilçe/veri yarışına ve pil tüketimine yol açar. Bunun yerine uygulama verisini paylaşan tek, sıralı native otorite ve ayrı Android/Expo WorkManager veri yenileme mekanizması korunur.

## Mimari

1. **React Native köprüsü**, \`CamideyizWidgetBridge\` üzerindeki tüm \`@ReactMethod\` çağrılarını \`WidgetBoundaryAsyncRefresh.executeBridge\` ile özel \`CamideyizWidgetCoordinator\` thread'ine gönderir. \`Promise\` artık native JSON/disk/RemoteViews/AlarmManager işi bittikten sonra resolve edilir. React Native JS/native-module çağrı kuyruğu bloklanmaz. Android main thread üzerinde bekleme/yapay sleep yoktur.
2. **Kurulu widgetlar ve Android broadcastleri**, eski provider sınıf/adlarını ve appWidget ID'lerini korur. \`goAsync()\` ile çağrılan onUpdate/onDisabled/boot/time/date olayları 75 ms'lik birleştirme penceresinde bir kez işlenir. Her \`PendingResult\` başarılı veya başarısız işlemden sonra tamamlanır. Bu yol ağ, JS runtime veya uzun periyodik işler için kullanılmaz.
3. **Takvim ve konum için sıralı mutasyon** korunur. Aynı ilçe için geçici ağ hatası, geçerli yayınlanmış takvimi silmez; eski ilçe kimliği yeni ilçeye bulaşmaz.
4. **Yalnız gerekli görsel güncellenir:** İsim, tarih, altı yayınlanmış saat, sonraki vakit, tema ve sekiz provider'ın gerçek kurulu widget ID'leri \`lastRenderSignature\` ile karşılaştırılır. Aynı içerikte Canvas/bitmap ve sekiz \`updateAppWidget\` çağrısı atlanır. Launcher Chronometer kendisi saniyelik ilerler. İlçe, yeni vakit, tema, kurulu widget ID değişikliği, manuel onarım veya sistem yeniden yayını varsa yeniden çizim yapılır. Yetersiz veride uydurma saat üretilmez.
5. **Alarm**: Aynı vakit sınırı için sürekli \`cancel\` + \`setAndAllowWhileIdle\` yapılmaz. Yeni Android prosesi, cihaz restartı, elle saat/saat dilimi değişikliği ve uygulama güncellemesinde alarm zorla yeniden kurulur. Alarm exact değildir; Android Doze geciktirebilir.
6. **Headless WorkManager**: TaskManager'ın hafif kayıt dosyası mevcut. Artık native ilçe, sağlık, 24+ saat kapsama, aktif bir vakit alarmı ve 2 saat içinde yayın şartları doğrulanmadan ağır \`widgetBackground\` JS modülü import edilmez. Bu denetim hatalı, eksik veya başka ilçeye ait veride güvenli şekilde \`false\` döner. Arka planda uygulama aktifleşirse veri işi geri çekilir.
7. **Gereksiz tekrar**: WorkManager geçerli native veriyi her çalışmada manuel yenilemez; UI tanılama düğmesi veriyi yayınladıktan sonra tekrar zorlanmış ikinci render yapmaz.
8. **Tanılama**: \`Widget Engine 4.0 · Sistem Tanısı → Raporu paylaş\` native işlem / disk commit / host render / alarm sürelerini; köprü ve broadcast kuyruk beklemesini; birleşen olay sayısını; atlanan render sayısını ve mini/premium çember bitmap cache hit/miss ve render sürelerini raporlar. Bunlar process-local ölçümlerdir; native launcher piksellerinin gerçekten çizildiğini kanıtlamaz.

## Uygulama adımları

\`\`\`powershell
cd C:\active_projects\camideyiz-biz
git fetch origin
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
npm install
npm test
npm run typecheck
node --experimental-strip-types scripts/verify-widget-native-runtime.mjs
node scripts/verify-widget3-contracts.mjs
node scripts/verify-widget-engine4.mjs
node --experimental-strip-types scripts/verify-widget-headless-gate.mjs
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
\`\`\`

APK builder'ın orijinal ikon/poster ve MP3 kaynak doğrulamaları korunur. Native Java/Expo config plugin değişiklikleri **OTA update** ile gelmez; yeni release APK kurulmalıdır. Derleme sürecinde **\`C:\cb\` izole checkout**, kaynak Git klasörü değildir; \`git pull\` asıl \`C:\active_projects\camideyiz-biz\` klasöründen yapılır.

## QA test matrisi

1. **Soğuk açılış karşılaştırması**: Aynı cihazda ve aynı veri kaynağında 3–5 kez sekiz widget kurulu; 3–5 kez widget yok; ekran akıcılığı, ilk gerçek piksel ve \`startupPerformance.monitor.worstEventLoopLagMs\` karşılaştır. Ölçülen farkı ağ ya da UI thread'e nedensel olarak bağlamadan önce Perfetto ile doğrula.
2. **Eş zamanlı kurulum / silme**: Aynı launcher üzerinde sekiz widgetı hızlıca ekle/sil. \`nativeCoalescedEvents\` artabilir; kayıp \`goAsync\`, alarm iptali hatası, ANR veya yanlış ilçe olmamalı.
3. **Native performans**: Rapor \`nativeBridgeQueueWaitMs\`, \`nativeQueueWaitMs\`, \`nativeRenderMs\`, \`nativeCommitMs\`, \`nativeAlarmMs\`, \`nativeRingBitmapMs\`, \`nativeSkippedRenders\` alanlarını içermeli. 75 ms bekleme penceresi doğal gecikmedir; sıfır queue wait iddia etmeyin. Sürdürülebilir hedef: normal yenilemede gözle görülür takılma yok, P95 native bridge kuyruk beklemesi 100 ms altında (cihazda ölçülecek).
4. **Değişmeyen veri**: Uygulama aktif olup kapanınca ve 15 dakikalık arka plan işi koşunca aynı vakit için sekiz full \`updateAppWidget\` tekrarlanmamalı. \`nativeSkippedRenders\` sayısı artabilir.
5. **Vakit sınırı**: Öğle → İkindi, Yatsı → ertesi İmsak, 23:59 → 00:00; native \`Chronometer\` doğru; resmi yayınlanmış vakit dışına geçiş yok.
6. **Durum tutarlılığı**: Pendik 9545 → Tuzla seç; önceki ilçe saatleri yeni ilçe etiketi altında görünmemeli. Veri kesilince hâlâ aynı ilçeye ait geçerli cache korunmalı.
7. **Zorla kapama/reboot/launcher reset**: Force Stop sonrası Android alarmları iptal edebilir; kullanıcı yeniden uygulamayı açınca scheduler kendi prosesindeki ilk çalışmada alarmı yeniden kurmalı. Launcher appwidget onUpdate olduğunda eski imzaya bakıp yanlışlıkla boş görünüm bırakmamalı.
8. **Sistem**: Tema açık/koyu, cihaz saatini/saat dilimini değiştirme, bağlantısız başlatma, pil optimizasyonları ve WorkManager restricted hali. Native alarm Doze gecikmesine dair kesin zaman vaadi yok.
9. **Ezan bildirimleri ve yeni Takvim Merkezi**: Var olan native ezan alarmı, otomatik bildirim, 30 günlük takvim ve dini günler 1.0 normal çalışmalı. Yeni widget motoru bunların veri modellerine veya Supabase şemasına müdahale etmez.

## CI ve uyarılar

- \`scripts/verify-widget-engine4.mjs\`: bridge/goAsync/dirty render/AlarmManager/diagnostik statik kod kontratı.
- \`scripts/verify-widget-headless-gate.mjs\`: gerçek çalışan saf TS politika testi (başka ilçe, stale source, eksik alarm ve cache invalid).
- \`scripts/verify-widget-native-runtime.mjs\`: Expo CNG native kaynak ve provider sürekliliği.
- \`.github/workflows/quality.yml\`: TypeScript, Expo prebuild, widget ve perf betikleri.
- \`.github/workflows/android-preview-apk.yml\`: Android JNI/native Java derlemesi ve QA APK; internet/Gradle/Maven bağımlılığına göre çalışabilirlik değişebilir.
- **Derleme ve statik testlerin geçmesi performansın iyileştiğinin kanıtı değildir.** Android Release fiziksel cihaz testlerinden sonraki raporla önceden kaydedilmiş gecikmeler kıyaslanmalı.
