# Camideyiz Biz — Widget 6.1 · Görsel QA ve performans

## Gerçek cihaz geri bildirimi / uygulanmış düzeltmeler (19 Kasım 2026)

Önceki cihaz fotoğrafında **2×2 ve 4×4 halkalar beyaz zeminliydi**, çok kalın çok katmanlı daireler metinlerle çakışıyordu ve büyük halkada altı namaz saati çevreye taşarak kesiliyordu. Tekli 1×1 widgetın `Kalan 9:26:...` satırı da hücre dışına taşıyordu; diğer 2×2 ve odak widgetlarının sağındaki dekoratif `☾` anlamsızdı.

Yeni sürümde:
- **2×2 Mini**: ürünün gece mavisi yüzeyi her iki tema kaynağında da korunur; tek sakin native Canvas halka; merkezde yalnız sıradaki vakit ve **sabit saati**; alt bölümde ayrı `Chronometer` sayacı. Mini widgetta halkaya dış saat çizilmez.
- **4×4 Premium**: orijinal marka ikonu ve ilçe bilgisi üstte, süre-orantılı tek halka ortada, yalnız vakit ve `Chronometer` merkezde; altı yayımlanmış vaktin saatleri ayrı **6 sütunlu footer** içinde. Böylece asla dışarı taşan Canvas saat etiketleri yok.
- **1×1 Tekli**: logo, küçük marka, vakit adı, sabit saat ve tek satırlık canlı kalan süre korunur; uzun `Kalan` + HH:MM:SS aynı satıra sıkıştırılmaz. Küçük launcher hücreleri için toplam satır yükseklikleri azaltıldı.
- **1×2 Dikey Vakit** yeni provider'dır: dikey tek sütun, logo, marka, vakit ve saat, ayrı kalan süre. İlçe metnini bilinçli kaldırdık; dar sütunda geri sayımı kırpmamak daha önemli.
- **2×2 Sıradaki Vakit** ve **4×2 Vakit Odağı**: sağ üst dekoratif hilal kaldırıldı. Altı Vakit Şeridi ve Günlük Vakitler değişmeden korunur.

### Teknik sınırlar

Her widget aynı mevcut doğrulanmış namaz vakti kaynağını kullanır, yeni API/astronomik hesap yoktur. Çember `PrayerRingBitmapRenderer` ile sadece kurulu widget varken hazırlanır; görsel **saniyede döndürülmez**. Canlı kalan süreyi Android `RemoteViews.Chronometer` taşır; React JS interval, HTTP poll, Android foreground service veya saniyelik AlarmManager yoktur. 2 MiB bitmap `LruCache` sınırı korunur.

Çemberin açık tema seçeneği de bu sürümde **bilinçli gece mavisidir**: gelen ekran görüntülerindeki beyaz bloklar ürünün ana görsel kimliğini bozduğu için yalnızca bu iki vitrin widgetı koyu tutulmuştur. Diğer altı widget açık/koyu tema mantığını korur.

### QA kabul

- `node scripts/verify-widget-designs.mjs`, `node --experimental-strip-types scripts/verify-widget-native-runtime.mjs`, `npm test`, `npm run typecheck` ve Expo CNG kaynak kontrolleri
- Fiziksel telefonda 1×1/1×2 çok dar launcher hücresi, yüksek sistem fontu, iki çemberde merkez metinlerinin ve 4×4 footer saatlerinin çakışmaması
- Vakit değişimi, Yatsı → ertesi gün İmsak, internet yok, tema değişimi, cihazı yeniden başlatma ve iki farklı ilçe
- Widgetlar yüklüyken uygulama soğuk açılışı (önceki 18 saniyelik performans şikayeti geri gelmemeli)
- Pixel/Samsung/Xiaomi launcher değişkenlikleri: statik XML testleri piksel doğrulaması değildir

**Derleme altyapısı notu:** 19 Kasım GitHub Android Release workflow'u Java widget derlemesine geçmeden, Maven/Gradle'ın mevcut Kotlin bağımlılıklarını çözümleyememesi nedeniyle durdu. GitHub'daki TypeScript/Expo ve unit test geçişi, çalışır APK kanıtı değildir; Windows Release APK ve fiziksel cihaz testi ayrıca gereklidir.
