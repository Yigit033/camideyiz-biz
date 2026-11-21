# Camideyiz Biz — Widget Tasarım 5.0 (Android native)

## Aynı orijinal marka, ürünle aynı palet

- Uygulamanın kendi `apps/mobile/assets/camideyiz-original-symbol.png` markası `drawable-nodpi/widget_brand_symbol.png` olarak **byte-for-byte** kopyalanır. Yapay SVG cami çizimleri widgetlarda kullanılmaz; kaynak SHA-256 testi korunur.
- Koyu renkler `src/theme/tokens.ts` içindeki gece mavisi `#071725` (canvas), `#102B40` (surface), `#173D58`, `#2B536B`, `#D8BF8D` (gold) ile aynıdır. Açık tema fildişi ve açık yüzeyleri korur.
- Widget için ayrı RN / React / network engine yoktur: Android `RemoteViews`, `AlarmManager`, doğrulanmış yayımlanmış takvim, `Chronometer` çalışır. JS her saniye güncelleme yapmaz.

## Beş widget

1. **Tekli Vakit 1×1** — orijinal 3D logo, Camideyiz Biz başlığı, sıradaki vaktin adı, yayımlanmış saat ve Android native küçük geri sayım (`Kalan`). Küçük telefonda 1×1 hücre çok dar olabilir; font ölçeği/launcher QA zorunludur.
2. **Sıradaki Vakit 2×2** — marka, ilçe, vakit adı, sabit saat ve canlı geri sayım.
3. **Günlük Namaz Vakitleri 4×2** — yayımlanmış altı saat, sıradaki gün-içi vakit altın vurgulu; ertesi günün imsakına sayarken bugünkü geçmiş imsak satırı vurgulanmaz.
4. **Vakit Odağı 4×2** — mevcut aralık adı ve sıradaki vakte kalan sistem geri sayımı.
5. **Altı Vakit Şeridi (6-sütunlu)** — 6 vakit yan yana, geçerli sıradaki vakit vurgulu ve alt satırda native geri sayım. Android'in standart 4 sütunlu telefon ana ekranına 6×2 *gerçek ızgara ölçüsü* sığmaz. `targetCellWidth=4` ile yüklenebilir ve `resizeMode=horizontal|vertical` ile altı sütun destekleyen launcher/tablet üzerinde 6×2'ye genişletilebilir. Bu bir tasarım 6'lısıdır; fiziksel altı launcher hücresi her cihazda mümkün değildir.

## Sınırlamalar ve test

- Android Doze/Güç tasarrufu vaktin bitişi sınırında `inexact` native alarmı geciktirebilir; `Chronometer` işletim sistemi tarafından yürütülür, ama yeni vakte geçiş her cihazda tam saniyesinde garanti edilmez. Yanlış güven vermek için saat tahmini / astronomik hesaplama kullanılmaz.
- Uygulama değişmediğinde widget kendi verisini hafif native bellekte tutar. Her saniye alarm, servis veya network isteği yoktur.
- Logo veya widget Java/XML değiştiği için **yeni native Release APK** şarttır; Expo OTA/Metro hot reload yeterli değildir.

### Yerel release kontrolleri

```powershell
git fetch origin
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
node scripts/verify-brand-symbol.mjs
node scripts/verify-widget-designs.mjs
node scripts/verify-widget-native-runtime.mjs
node scripts/verify-widget3-contracts.mjs
node scripts/verify-startup-performance.mjs
npm test
npm run typecheck
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
```

**Fiziksel test:** Beş widgetı yükle, iki temada kontrol et; 1×1 taşma, düşük çözünürlük, büyük font ve 6-vakit şerit; gece yarısı İmsak geçişi, sayaç 00:00 ve Doze; verisiz/bozuk ilçe; widgetlar kurulu/kurulu değilken cold start. Kaynak kod testleri launcher ekran piksel doğrulaması değildir.

## 5.1 — Altı Vakit Şeridi: referans düzeni (4×2)

- Android launcher üzerinde fiziksel **4×2** hücre kaplar; içindeki **6 bağımsız eşit genişlikli** vakit hücresi tek yatay satırda gösterilir. Altı vakit olması altı launcher sütunu gerektirmez.
- Üst panel koyu modda ürünün gece mavisi, açık modda açık mavi yüzeydir. Sıradaki aynı güne ait vakit **beyaz/fildişi yuvarlatılmış kart** ve koyu okunaklı yazı ile vurgulanır. Yatsı sonrası ertesi günün İmsak vaktine kalan süre gösterilirken bugünkü İmsak yanlışlıkla işaretlenmez.
- Alttaki ayrı beyaz/fildişi panelde **“Akşam vaktine kalan süre”** gibi gerçek sıradaki vakit adı ve Android'in saniyelik çalışan `Chronometer` değeri iki satırda gösterilir. Panelin sağındaki 3D amblem özgün marka PNG dosyasından gelir.
- Referansta ayrıca bir **kerahat geri sayımı** bulunmaktadır. Bu alanı kesin bir takvim saati gibi eklemedik: uygulamanın kerahat aralıkları kullanıcı tarafından değiştirilebilen yaklaşık dini uyarılardır; mevcut Android widget verisine güvenle aktarılmıyor. Yanlış bir kesinlik ima etmektense yalnız yayımlanmış namaz vakti geri sayımını sunuyoruz.
- Vakitler **ilk kurulumda tahmini/örnek sayılarla doldurulmaz**. Günlük doğrulanmış kaynak takvimden yayınlanır. Tamamı native `RemoteViews` layout'tur, arka planda JS interval veya saniyelik alarm yoktur.
- Açık/koyu XML dosyaları ile altı yeni `drawable` kaynağı Expo CNG eklentisinin `RESOURCES.drawable` listesinde kayıtlıdır. Eklenti yeni logo oluşturmaz.
- Test: 4 sütun Android launcher, altı uzun Türkçe isim, font scale 1.0/1.3, Android 12–16, tema değişimi, kalan sürenin saniyelik akışı, imsakın ertesi güne geçişi, boş takvim, widget yokken açılış performansı. Kullanıcı cihazında piksel yerleşimi ayrıca doğrulanmalıdır.
