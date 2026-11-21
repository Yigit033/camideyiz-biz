# Camideyiz Biz — Widget Engine 4.1 · Android QA ve Release

## Değişiklikler

- **Tek doğrulanmış veri kaynağı:** mevcut yayımlanmış namaz vakitleri, ilçe kimliği ve native persisted snapshot korunur. Vakitler hesaplanmaz.
- **Üç ayrı aşama:** \`WidgetBoundaryAsyncRefresh\` (native coordinator / saklama) → \`WidgetRenderPipeline\` içindeki tek iş parçacıklı, **3 işlik sınırlandırılmış bitmap kuyruğu** → ayrı, **3 işlik sınırlandırılmış RemoteViews dispatcher**. React Native köprüsü Android UI thread'de çizim beklemez.
- **Native durum sorgusu:** \`getStatus()\` ağır koordinatörden ayrı read-only executor kullanır.
- **Generation guard:** ilçe değişikliği, yeni takvim ve widget kurulum değişikliği eski render'ları iptal eder. Native render bitmesi veri kaynağını değiştiremez.
- **Family dirty keys:** yalnız gerçekten güncellenecek sekiz widget ailesi için \`AppWidgetManager.updateAppWidget\` gönderilir. Gerçek ID listesi, tema, seçili ilçe, altı saat, sıradaki vakit ve görünüm marka revizyonu dikkate alınır. İlgili widget ailesindeki kurulu bütün kopyalar birlikte güncellenebilir.
- **goAsync:** provider yayınları 75 ms'de birleştirilir, farklı provider talepleri \`launcher:update:all\` ile kaybolmaz. Broadcast normalde gerçek render/dispatch bitince tamamlanır; Android ANR riskine karşı **8 saniyelik watchdog** yalnız pending broadcast receipt'ini tamamlar, takvim verisini silmez.
- **Geri sayım:** Android \`Chronometer\` launcher içinde ilerler; saniyelik React Native veya WorkManager işi yok.
- **Widget logosu:** kullanıcının gönderdiği şeffaf arka planlı, cami sembolü ve **içinde camideyiz.biz yazısı bulunan tek parça logo**, widget alanı için 128×128 PNG (palet optimizasyonu) olarak \`apps/mobile/assets/widget-brand-lockup.png\` dosyasına eklendi. Aynı dosya CNG tarafından \`drawable-nodpi/widget_brand_lockup.png\` olarak kopyalanır; sekiz widgetın açık/koyu layoutlarında ayrıca marka adını yazan bütün TextView'ler kaldırıldı. Uygulamanın launcher icon'u değiştirilmedi.
- **Tanı raporu:** iş/queue bekleme, Bitmap render, disk commit, host dispatch, eski nesil render iptali, boyanmakta olan takvim ve logo sürümü.

## Sınırlar / davranış

- \`publishCalendar\` çağrısı güvenli **kalıcı kayıt + render kuyruğuna kabul** sonrasında yanıtlayabilir. Launcher'ın pikselleri ayrı bir uygulama/işlemdedir; native \`launcherConfirmed=false\` kalır. Render sürerken \`nativeRenderPending=true\` ve kullanıcıya “hazırlanıyor” gösterilir.
- Kuyruk dolması / çizim hatasında native hata rapora kaydedilir; geçmiş ilçenin çizimi yeni ilçeyi ezmez. Güncel native takvimi silmez. Sonraki güvenli OS/foreground yenileme onarabilir.
- Android Doze ve üretici kısıtları AlarmManager geçişini geciktirebilir. Bu motor exact alarm/arka plan sınırsız çalışma iddiasında bulunmaz.
- Premium görsel kalite ve ANR/jank düzelmesi **cihaz testi yapılmadan kesinleşmez**.

## Pull / QA / APK (Windows PowerShell)

\`\`\`powershell
cd C:\active_projects\camideyiz-biz
git fetch origin
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
npm install
npm test
npm run typecheck
node scripts/verify-widget-engine4.mjs
node scripts/verify-widget-engine41.mjs
node scripts/verify-widget-designs.mjs
node --experimental-strip-types scripts/verify-widget-headless-gate.mjs
node --experimental-strip-types scripts/verify-widget-native-runtime.mjs
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
\`\`\`

Yeni Android Java dosyaları / RemoteViews / drawable kaynakları Expo OTA ile değil, **yeni native APK** ile aktarılır. Windows builder \`C:\cb\` izole çalışma alanını kullanır. \`git pull\` esas GitHub checkout'unda yapılmalıdır.

## Cihaz test matrisi

1. Sekiz widget, uygulama açılışından önce kurulu. 5 soğuk açılış, 5 arkaplan→ön plan dönüşü, bir eşitleme; her seferinde UI kaydırma/test. \`startupPerformance\` ile beraber native 4.1 raporu kaydet.
2. Hiç widget kurulu değilken aynı test; farkın gerçekten widgetlardan gelip gelmediğini değerlendir.
3. \`nativeRenderQueueWaitMs\`, \`nativeDispatchQueueWaitMs\`, \`nativeStaleRenderDrops\`, \`nativeSkippedFamilies\`, \`nativeDispatchedFamilies\`, \`nativeRingBitmapMs\`, \`nativeCommitMs\`, \`worstEventLoopLagMs\` değerlerini karşılaştır.
4. İlçe değişikliği sırasında 4×4 çember ve 4×2 şerit yüklüyken eski ilçenin saatlerinin geri gelmediğini doğrula.
5. Hızlı sekiz widget ekle/kaldır; reboot, tarih/saat değişimi, uçak modu, Doze, karanlık/açık tema ve aynı gün namaz sınırı. Sekiz farklı provider yeniden yayınlandığında hiçbiri boş kalmamalı.
6. 1×1, 1×2, 2×2 mini, 2×2 sıradaki, 4×2 günlük/odak/şerit ve 4×4 çember **her birinde yalnız tek tam marka görseli**. Ayrıca “Camideyiz Biz” TextView yok. Küçük launcher/özel DPI/büyük erişilebilirlik fontunda taşma yok.
7. Namaz widgetlarının, 30 günlük namaz takvimi ve Dini Günler sayfalarının doğru ilçe verisini koruduğunu doğrula.
8. Perfetto/System Trace ile gerçek UI / JS / native coordinator / bitmap render / RemoteViews dispatcher sürelerini karşılaştır; release APK ve gerçek donma kaydı olmadan performans sorunu kapatılmaz.

## CI kapıları

- \`scripts/verify-widget-engine4.mjs\`, \`scripts/verify-widget-engine41.mjs\`, \`scripts/verify-widget-designs.mjs\`, \`scripts/verify-widget-native-runtime.mjs\`.
- Widget logo PNG'sinin SHA-256 değeri doğrulanır. CNG native Java ve yeni PNG yerleşimi test edilir.
- \`.github/workflows/android-preview-apk.yml\` native Release APK derler; Gradle/Android SDK bağımlılıklarından kaynaklanan çevre hataları çalışma sonunda rapor edilir.
- Bu sürümde yeni Supabase SQL veya Diyanet API değişikliği yoktur.
