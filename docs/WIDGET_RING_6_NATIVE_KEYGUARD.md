# Camideyiz Biz — Widget 6.0 · Vakit Çemberleri / Android Kilit Ekranı

## Kapsam

Bu sürüm **mevcut beş native widgetı koruyarak** Android widget seçicisine iki ayrı sağlayıcı daha ekler:

- **Vakit Çemberi Mini 2×2** — ortada sıradaki vakit, sabit saat ve Android `Chronometer` geri sayımı. Altı renkli sektörün süreleri **aynı ilçenin doğrulanmış ve yayımlanmış** günlük namaz vakitlerine göre orantılıdır. Çok küçük hücrede saatler çember etrafına yazılmaz; merkez okunabilirliği önceliklidir.
- **Vakit Çemberi Premium 4×4** — aynı süre-orantılı altı renkli halka, halkanın çevresinde altı **gerçek yayımlanmış saat**, ortada orijinal marka logosu, konum, sıradaki vakit ve canlı sistem geri sayımı.

Tüm Java/XML bileşenleri Expo `withWidgetBoundaryBridge` CNG eklentisiyle `android/app/src/main` altına kopyalanır; React Native uygulaması veya ayrı bir arka plan servisi başlatılmaz.

## Doğru veri ve halka matematiği

- Kullanılan değerler yalnızca `WidgetBoundaryScheduler` tarafından doğrulanmış yerel `props.times` alanıdır; altı vaktin artan `HH:mm` sırası Java'da da kontrol edilir.
- Halka, İstanbul yerel saatinde **00:00–24:00** gerçek günlük periyotlarını gösterir. Gece yarısı ile aynı günün İmsak vakti arası önceki Yatsı diliminin devamıdır; bugünkü Yatsı–24:00 de aynı renkle tamamlanır. Dönemler yılın tarihine göre otomatik genişler/daralır. Dönem verisi olmayan gün için varsayım yapılmaz.
- `PrayerRingBitmapRenderer` halka görselini `Canvas` ile **224×224** (Mini) veya **432×432** (Premium) pikselde, `ARGB_8888` biçiminde üretir. `LruCache` üst sınırı 2 MiB'dir. Önbellek anahtarı altı saat, geçerli dönem, tema ve boyutu içerir.
- Yalnızca kurulu çember widgetı varsa görüntü üretilir. `RemoteViews.setImageViewBitmap` + **tam** `updateAppWidget` çağrısı kullanılır; `partiallyUpdateAppWidget` ile eski bitmap işlemleri biriktirilmez.
- Renkli halka **sürekli dönen animasyon değildir**. Android çember görselini vakit geçişi/native yenilemede günceller; merkezin kalan süresini ise sistemin `Chronometer` bileşeni canlı gösterir. Android Doze nedeniyle tam vakit sınırında çember güncellemesi gecikebilir.
- Çemberler **widget üzerindeyken parmakla döndürülemez**. Kullanıcının ana ekrandaki parmakla çevirebildiği `PrayerWheel.tsx` bileşeni uygulamanın içinde aynı davranışı korur.

## Kilit ekranı / gizlilik

- Mevcut beş widget ve iki yeni çember `widgetCategory="home_screen|keyguard"` olarak işaretlenmiştir. Bu yalnızca **uyumlu Android widget host'larına** bildirilen bir yetenektir; Android sürümü, OEM, launcher ve kilit ekranı sunumu belirleyicidir. Özelliği bulunmayan cihazlarda bunu zorla açamaz.
- Kilit ekranı widgetlarının açılma/tıklanma davranışında Android kilit açmayı isteyebilir; normal durumdur.
- Kullanıcının kilit ekranına **özellikle kendisinin yerleştirdiği** widget, seçili ilçe adını gösterebilir. Kilit ekranı gizliliği önemliyse Mini Çember gibi yer adı göstermeyen sürüm seçilmeli.
- iPhone için mevcut iki `systemSmall/systemMedium/systemLarge` WidgetKit widgetı kilit ekranının `accessoryCircular` ailesi değildir. iOS kilit ekranına ayrı küçük `accessoryCircular` widget eklenmesi ayrıca gereklidir; Android CNG değişiklikleri iOS'a uygulanmaz.

## QA / kabul koşulları

1. `node scripts/verify-widget-designs.mjs` ve `node --experimental-strip-types scripts/verify-widget-native-runtime.mjs` geçmeli.
2. GitHub Android QA Release APK `assembleRelease` başarılı olmalı; `expo prebuild --clean` yeni Java, XML, yedi provider ve orijinal logoyu üretmeli.
3. Fiziksel Android'de 2×2 ve 4×4 tüm tema varyantlarında logo, altı saat, sektör oranı, merkez metinleri, geri sayım ve taşmalar test edilmeli.
4. Yatsı→İmsak, gün değişimi, bir sonraki günün vakti, internet kapalı, konum değişimi, pil tasarrufu, cihaz yeniden başlatma ve widget ekleme/kaldırma senaryoları doğrulanmalı.
5. Widgetlar kurulu iken ve kurulu değilken cold-start karşılaştırılmalı; görünür donma/anlamsız bekleme kabul edilmemeli.
6. Uyumlu kilit ekranında widget seçme menüsünde sunulduğu ve metinlerin gizlilik/alan koşullarına uyduğu kontrol edilmeli; uyumsuz cihazlara kurulum vaadi verilmemeli.

Kodun static kontrollerden geçmesi **ekran görüntüsü, işletim sistemi davranışı veya fiziksel cihaz doğrulaması yerine geçmez.**
