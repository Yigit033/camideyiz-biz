# Camideyiz Biz — Takvim Merkezi 1.0 (20 Kasım 2026)

## Ürün kapsamı

Ana sayfanın **en altında** (mevcut Ayet/Hadis, Ezan, Kerahet ve vakit alanları bozulmadan) iki giriş kartı:
1. **30 Günlük Namaz Vakitleri** — ana sayfada halihazırda doğrulanmış bugünkü İmsak, Öğle ve Akşam. Dokununca tam 30 günlük takvim. Yalnız açıldığında ağ/kaynak sorgusu.
2. **Dini Günler ve Geceler** — Diyanet'in doğrulanmış 2026/2027 listelerinden sıradaki olay ve bağımsız yıl/kategori filtreli liste. İnternet gerektirmez.

### Ekranlar

- \`/calendar30\`: bugünden itibaren 30 takvim günü (0..29), ilçe adı, Gregorian gün, hazırsa Hicri tarih. Üç özet saat ve dokununca açılan altı gerçek namaz saati. Her günü ayrı doğrula; eksik yayın varsa **—** yerine açık "Yayımlanmış veri bekleniyor" mesajı. Asla farklı ilçe, eski tarih, yanlış kaynak veya astronomik tahminle doldurma.
- \`/religious-days\`: Yaklaşan / 2026 / 2027, Tümü / Kandiller / Bayramlar / Diğer filtreleri; açılır kart, hicri karşılığı, kandil akşamı bilgisi ve resmî Diyanet kaynak linki. Diyanet güncellemesi gerektiriyorsa \`packages/core/src/religiousDays.ts\` manuel ve kaynak doğrulamasıyla sürümlenir.

## Kaynak mimarisi ve sorumluluklar

- **Diyanet API yapılandırılmışsa:** \`GET /api/v1/calendar30?cityId={id}&date=YYYY-MM-DD\`; mevcut \`diyanet_prayer_days\` Postgres önbelleğini **salt-okunur** şekilde tarar. Yeni Diyanet çağrısı yapmaz; mevcut kota/ücret sınırlarına ilave yük getirmez. Eksik günler boş döner. Sunucu route'u deploy edilmeden resmî API modunda takvim açılmaz (404).
- **Varsayılan bağımsız yayımlanan takvim modu:** seçili Diyanet ilçe kodunu kullanarak, ihtiyaca göre sırasıyla mtopal, İdamedya ve eMushaf kaynaklarındaki yayımlanmış listeler okunur. \`parseCalendar30Source\` altı saatin sıra/doğruluk, kaynak, tekrar, tarih, ilçe eşleştirmelerini denetler. Eksik günler diğer yayımcıdan doldurulabilir, fakat **bir günlük altı saat atomik** kalır. Farklı yayımcıların saatleri aynı gün içinde karıştırılmaz.
- **Cache:** \`@camideyiz/calendar30/v1/{districtId}/{startISO}\` AsyncStorage kaydı. 24 saat sonra yeniden doğrulama; yanlış ilçe/tarih/TTL/bozuk veri reddedilir. Kullanıcının "Yeniden dene" eylemi cache'i atlayıp gerçek ağ isteği gönderir. Çoklu önbellek versiyonlamasıyla eski widget cache'i etkilenmez.
- **Mevcut \`MirrorTriplet.upcoming\` 16 günlük alanı korunur.** Bildirim, widget ve ana sayfanın ilk boyaması bu ekran için 30 güne genişletilmez. Açılışta 30 gün için otomatik internet isteği yoktur.
- **2026 ve 2027 Dini Günler kaynakları:**
  - https://vakithesaplama.diyanet.gov.tr/dinigunler.php?yil=2026
  - https://vakithesaplama.diyanet.gov.tr/icerik.php?icerik=154
  Kandillerde listede yazan **takvim gününün akşamı** ifadesi kullanılır. Bayram günleri ayrı ayrı gösterilir. Üç ayların başlangıcı ve Regaip aynı gün iki ayrı olaydır. Yeni 2028 tarihleri tahmin edilmez; resmî yayımlanan liste çıkınca eklenir.

## SQL / Deploy

- **Yeni Supabase migration veya SQL çalıştırma zorunluluğu yok.** Mevcut \`diyanet_prayer_days\` tablosu salt-okunur olarak kullanılır.
- Uygulama \`EXPO_PUBLIC_PRAYER_API_URL\` ile resmî API modunda çalışıyorsa **yeni server route'u için apps/api deploy edilmelidir.** Resmî API yapılandırılmamışsa default mirror modu mevcut ücretsiz yayıncılarla çalışır.
- İki yeni ekran Expo Router (React Native) tarafında olduğundan **yeni APK native kodu gerektirmez**, ancak kullanıcının diğer native widget/icon değişikliklerini içeren son sürüm için release APK oluşturması önerilir.
- Geriye dönük tüm mevcut widget provider adları, kaynak kodlar ve bildirim zamanlayıcıları değişmeden kalır. 30 günlük takvimin açılması bu akışlara yeni cron eklemez.

## QA doğrulamaları

\`\`\`powershell
git fetch origin
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
npm test
npm run typecheck
node scripts/verify-calendar-views.mjs
node scripts/verify-widget-designs.mjs
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
\`\`\`

Test matrisi:
1. İlk açılış süresi: Widget yüklüyken/yokken, 30 günlük ekrana hiç girilmemişken yeni ağ isteği olmadığını gözle.
2. 30 günlük ekran: 30 tarih, 6 saat/açılış, 30/30 kapsama; internet yok/kısmi kapsam/gün dönümü; belirli tarih boşsa tahmini saat yok.
3. İstanbul → başka il/ilçe: eski ilçenin verileri yeni ilçeye sızmıyor; eski cache geçersiz.
4. 20 Aralık → 18 Ocak, 28 Şubat → 1 Mart, gece 23:59 → 00:00; ay ve yıl rollover.
5. Resmî API: Server deploy yapıldıysa \`/api/v1/calendar30\` salt-okunur endpoint çalışıyor, eksik günler 404 veya null; DB bozuk kayıt hatayla reddedilir.
6. Dini Günler: 10 Aralık 2026'da iki olay; 2027 iki ayrı Miraç; Ramazan 3 gün, Kurban 4 gün; tüm kaynak butonları resmî Diyanet listesine gider.
7. Açık/koyu tema; 320px en ve %130 sistem fontu; FlatList sanallaştırması, uzun ilçe isimleri, VoiceOver/TalkBack düğme etiketleri.
8. Release APK ve fiziksel cihaz ekran görüntüsü gereklidir; TypeScript/test geçişi görsel/pil açısından kanıt değildir.

## Kısıtlar

Üçüncü taraf ücretsiz yayıncılar resmî Diyanet API'si değildir; Diyanet verilerini bağımsız yeniden yayımlar. 30 günün tamamı yayımlanmamışsa ekranda doğru eksik gün uyarısı gösterilir; **30 gün garanti edilmez**. Yeni yılın resmî dini gün takvimi geldiğinde \`religiousDays.ts\` güncellenmelidir.
