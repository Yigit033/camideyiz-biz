# Widget 2.0 — Android gerçek cihaz kabul testi

## Ne değişti? (15 Kasım 2026)

Önceki sürümde `CompanionProvider` veri henüz gelmemişken
`syncPrayerWidgets([])` çağırarak iki Android widget'ının kayıtlı
vakitlerini boş başlangıç durumuna döndürebiliyordu.

Yeni akışta:

1. Kullanıcının seçili Diyanet ilçe kodu ilk önce yerel kayıtla eşitlenir.
2. Yeni yayımlanmış takvim, seçili ilçenin adı, tarih, saatlerin artışı,
   Türkiye saat dilimi ve en az iki ardışık gün koşullarıyla doğrulanır.
3. Birincil veri isteği beklerken yalnızca **aynı seçili ilçeye ait**
   ve **halen bugünü kapsayan** doğrulanmış son takvim kullanılır.
4. İlçe değişince eski ilçenin takvimi ile son widget aktarım kaydı
   temizlenir. Yeni ilçe için saatler bulunamıyorsa **yanlış eski
   ilçenin saatleri yerine boş durum** gösterilir.
5. React yeniden render/izleme değişiklikleri gelen widget yazmaları
   tek bir sırada işler; artık bekleyen/eski render görevleri yeni
   render görevlerinin arkasından rastgele native widget güncellemez.
6. İki Android `updateSnapshot` çağrısı geçtikten sonra
   `Widget ve Bildirimler` sayfasında **hangi ilçe için hangi altı
   namaz saatinin widget'a aktarıldığı ve aktarım zamanı** görüntülenir.
7. Android WorkManager, uygun zamanda headless JavaScript ortamında
   gerçek yayınlanmış namaz takvimini yenileyip iki native widget'a
   göndermeye devam eder. Bu işlemin zamanlaması Android tarafından
   belirlendiğinden 15 dakika **kesin güncelleme süresi değildir**.

### Yapılan otomatik kontroller

- `packages/core/src/widgetCalendarCache.test.ts`:
  İstanbul/Tuzla (9551) için doğru altı saat, imsak/yatsı geçişi,
  gece yarısından sonraki gün, 72 saatlik kayıt üst sınırı,
  Pendik/Tarsus seçilince Tuzla önbelleğini reddetme.
- TypeScript typecheck / Expo SDK 58 Android native prebuild / Metro
  JS bundle GitHub Actions'da çalıştırılır.
- CI, cihaz widget'ının Launcher tarafından gerçekten çizildiğini
  **doğrulamaz**. Son kullanıcı APK screenshot ile doğrulama gerekir.

## Windows'ta APK'yı üretme

```powershell
cd C:\active_projects\camideyiz-biz
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1 -CheckoutPath C:\cb -Configuration Release
```

Beklenen release çıktı:
`C:\cb\apps\mobile\android\app\build\outputs\apk\release\app-release.apk`.

**Eski APK ile test etmeyin.** İmza eşleşirse aynı uygulamanın üzerine
yükleyin; imza hatası alınırsa kullanıcı verilerini kaybetmemek için
eski uygulamayı hemen silmeyin.

## Telefonda tam kabul testi

1. Uygulamayı açıp **İstanbul → Tuzla** seçin. Ana sayfada
   altı namaz saatinin görünmesini bekleyin.
2. `Diğer → Widget ve Bildirimler` sayfasında `Widget'ı yenile`
   düğmesine dokunun. Bu düğme takvim indirmeden önce zaten doğrulanmış
   mevcut ilçe vakitlerini Android launcher'a doğrudan gönderir.
   **Widget'a son aktarılan vakitler** kartında
   Tuzla adı, altı vakit ve aktarım saati görünmeli.
3. Telefonun **ana ekranına iki native widget'ı** (Sıradaki
   Vakit 2×2 ve Günlük Namaz Vakitleri 4×2) ekleyin.
   Widget'ların yerel saatlerini uygulamadaki kartla tek tek
   karşılaştırın. Ekran görüntüsü alın.
4. Telefonun internetini geçici kapatıp uygulamayı normal
   şekilde açın (zorla durdurma değil). Doğrulanmış aynı gün
   ve ilçe önbelleği varsa saatler değişmeden kalmalı.
   Ağ bağlantısı yoksa yeni namaz saati **uydurulmamalı**.
5. İnterneti açıp **Mersin → Tarsus** seçin. Doğrulanmış Tarsus
   takvimi gelene kadar Tuzla'nın eski saatleri gösterilmemeli;
   sonra iki widget Tarsus'a geçmeli. Tarsus ve Pendik için de
   ekran görüntüsü alın.
6. Uygulamadan normal çıkın. Telefonun pil tasarrufunu kapatıp
   bir sonraki namaz vakti sınırında ve gece yarısı sonrası
   widget'ları kontrol edin. WorkManager çalışması güç
   yönetimine tabidir; arka plan saatinin güncellendiği
   fiziksel QA'da ayrıca gözlemlenmelidir.
7. Android cihaz yeniden başladıktan sonra widget'ların
   yeniden açılışı ve hangi saatleri gösterdiği kontrol edilsin.
8. Widget'lara dokunduğunuzda uygulama açılmalı.

## Hata durumunda gönderilecek kanıt

- Uygulama sürümü ve seçilen ilçe
- Ana sayfadaki namaz saatlerinin ekran görüntüsü
- `Widget ve Bildirimler` bölümünde son aktarılan altı saatin
  ekran görüntüsü
- Yan yana iki ana ekran widget'ının ekran görüntüsü
- Yeni APK'da `Neden güncellenmedi?` öğesine basınca görülen hata metni
- Wi-Fi / mobil veri, pil tasarrufu ve uygulamanın zorla
  durdurulup durdurulmadığı

Son aktarım kartı, `updateSnapshot` çağrılarının hata vermediğini
ve hangi verilerin gönderildiğini kaydeder; **Widget'ın ekranda
görüldüğünü tek başına iddia etmez.** Bir cihazın gerçek ekran
görüntüsü ve vakit sınırı testi son onay için zorunludur.

iOS WidgetKit için gerçek iPhone imzalama/timeline/gece yarısı testleri
halen ayrı kabul kapısıdır.

Git politikası: `feat/widgets-and-prayer-alerts-2`; `main` merge,
production deploy veya yeni branch oluşturulmamıştır.


### 15 Kasım 2026 ikinci düzeltme

- Ayarlar ekranındaki teknik yayıncı/API bağlantıları ve kaynak açıklaması
  kartı kaldırıldı; iç dokümantasyondaki doğruluk bilgileri korundu.
- `updateSnapshot` sonrasında Android widget'larına açıkça `reload()`
  isteği gönderiliyor. Telefonun launcher'ı bunları yine geciktirebilir.
- Manuel `Widget'ı yenile` doğrudan native aktarımdır;
  eski `Yenile` gibi önce gereksiz kaynak yenilemesi başlatmaz.
- Geçerli foreground takvimi AsyncStorage geçici kaydet/oku
  hatalarına takılmadan doğrudan widget'a gönderilebilir; koruyucu
  ilçe/tarih/gün/saat doğrulaması sürer.
- Başarısız native aktarım önceden genel `bekleniyor` olarak
  gizleniyordu; artık `Neden güncellenmedi?` üzerinden
  çalışma zamanı hata metni görülebilir.
- Uygulama içi görsel artık **Önizleme** olarak etiketlenir,
  Android launcher'da gerçek güncellemeyle karıştırılmaz.
- Yeni APK'da her iki widget hâlâ boşsa önce `Widget'ı yenile`
  ve hata ayrıntısını inceleyin. Telefonun eski widget örnekleri
  bozuk kalıyorsa yalnızca ana ekran widget'larını kaldırıp
  tekrar ekleyin; uygulama verilerini silmeyin.

**Android fiziksel telefon teslimatı son kez başarılı gösterilmeden
tamamlandı denmez**. Otomatik CI Android launcher görüntüsünü ölçemez.
