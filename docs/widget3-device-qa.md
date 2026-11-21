# Camideyiz Biz · Widget 3.0: test ve hata ayıklama

## Mimari ve veri bütünlüğü

- Android: native AppWidgetProvider + RemoteViews + Android sistem widget güncellemesi. Expo arka plan görevi yalnızca yardımcı yenileme.
- Takvim, kullanıcı tarafından seçilen ilçeye ait doğrulanmış yayımlanmış vakitlerden oluşturulur; native tarafta astronomik hesaplama yapılmaz.
- Doğrulanmış takvim verisi 16 güne kadar korunur; yayımlanmış günler bittiğinde sahte saat gösterilmez.
- Native verinin yalnızca seçilen ilçe koduyla eşleşmesi durumunda çevrimdışı yeniden çizim yapılabilir.
- Periyodik Android host yenilemesi en az 30 dakika; namaz sınırı AlarmManager inexact/Doze-aware. İşlemlerin hiçbiri kesin zaman garantisi sunmaz.
- Önceki NextPrayerWidget ve PrayerDayWidget provider sınıf adları ve Android widget ID'leri korunur.

## Fiziksel cihaz test matrisi (yayın öncesinde yapılmalı)

- [ ] Yeni release APK kur; önceki kurulu iki widget yükseltme sonrasında yerinde kalıyor mu?
- [ ] Ana ekran, Sıradaki Vakit, Günlük Namaz Vakitleri: ikisi de aynı seçilen ilçenin yayımlanmış saatlerini gösteriyor mu?
- [ ] Widget 3.0 tanısında native ilçe kodu, kayıtlı takvim, native son güncelleme ve kurulu widget sayısı doğru mu?
- [ ] Uygulamayı arka plana alıp kilit ekranında bir sonraki vakti bekle; gecikmeyi kaydet.
- [ ] İnternet bağlantısını kapat ve yayımlanmış günlerde sabah/akşam ve gece yarısı güncellemesini doğrula.
- [ ] Uygulamayı kapatıp telefonu yeniden başlat; native widgetların yayımlanmış veriden toparlandığını kontrol et.
- [ ] İlçe değiştir; eski ilçenin saatleri yeni ilçenin widgetına sızmamalı.
- [ ] Takvim kapsamı sona erdiğinde sistem uydurma vakit göstermemeli.
- [ ] Android Doze, batarya optimizasyonu ve farklı launcher/üretici koşullarında tekrar test et.
- [ ] iOS WidgetKit, ayrı bir cihaz derlemesinde regresyon testinden geçirilmeli.

## Tanı sonuçlarını yorumlama

| Durum | İncelenecek alan |
|---|---|
| Kurulu sayısı 0 | Widget ana ekrana ekli mi, APK'daki provider sınıfı doğru mu? |
| Native ilçe kodu farklı | İlçe değişimi sonrası yeni veri aktarımı |
| Takvim yok / native hazır değil | Yayın erişimi, kayıt, tarih doğrulaması veya takvim kapsamının bitmesi |
| lastError dolu | Android logcat ve native broadcast/RemoteViews istisnaları |
| Son çizim isteği yeni, widget hâlâ eski | Launcher çizimi/host katmanı; Android API çizimin sonucunu doğrudan bildirmez |
| Son tetikleyici launcher:update | Android sisteminin periyodik host güncellemesi tetiklenmiş |
| Son tetikleyici receiver | Alarm veya sistem olayı alınmış |

## Windows ADB kontrolü

~~~powershell
adb shell dumpsys appwidget | Select-String 'camideyiz|NextPrayer|PrayerDay'
adb shell dumpsys alarm | Select-String 'Camideyiz|WIDGET_BOUNDARY'
adb logcat -d -s CamideyizWidget:V CamideyizWidgetP0:V AndroidRuntime:E
~~~

## Yerel test ve derleme

~~~powershell
git fetch origin feat/widgets-and-prayer-alerts-2
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
node scripts/verify-widget3-contracts.mjs
npm test
npm run typecheck
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
~~~

Bu Windows betiği varsayılan olarak C:\cb izole çalışma kopyasını kullanır ve kullanıcı değişikliklerini korur. Gerçek launcher görüntüsü ve kullanıcı cihazı testleri tamamlanmadan üretimde kusursuz çalıştığı iddia edilmemelidir.


## Widget 3.1 — Native ilk aktarım P0 düzeltmesi (18 Kasım 2026)

Cihaz ekranında iki Android widget'ı (1/1) kayıtlı, fakat
`nativeCityId=0`, `hasTimeline=false`; buna rağmen
`launcher:update:daily` ve `manual:diagnostic-repair`
tetikleyicileri çalışmış. Bu, launcher'ın değil takvimin native
belleğe **yazılmaması** katmanının incelenmesi gerektiğini gösterir.
Veri sağlayıcısının asıl nedenini son kullanıcı cihazında
`source.failureReason` ve `lastTransferDetail` açıklayabilir.

Yenilikler:

- `selectDistrict` ile ilçe seçimi veri yayınlamadan ayrıdır.
- `publishCalendar('')` native tarafta reddedilir. Kaynak beklemesi
  aynı ilçenin daha önce yayımlanmış vakitlerini silmez.
- GPS/ilk açılışta seçili ilçe henüz bulunamamışsa takvim silinmez.
- Eski ilçenin verisi, yeni ilçe seçildiğinde güvenle geçersiz kılınır.
- Kalıcı `lastTransferError` rutin Android güncellemesinde silinmez;
  yalnızca yeni bir başarılı yayın veya gerçek ilçe değişimi temizler.
- Kullanıcının eşitleme düğmesi, mevcut cache boşsa seçili ilçenin
  yayımlanmış vakitlerini doğrudan yeniden çeker, doğrular ve native
  belleğe aktarır; rastgele yerel astronomik saat üretmez.
- Tanılama, gerçek `background task` kayıt durumunu ve engelleme
  nedenini ayrıca gösterir.

Yeni APK için kabul kontrolü:

1. Mevcut kurulu uygulamanın üzerine **uyumlu imzalı** QA APK kur.
   İmza uyumsuzsa kullanıcı izni olmadan uygulamayı silme.
2. İlçe seç ve yayımlanmış vakitlerin ana sayfada göründüğünü kontrol et.
3. Widget 3.0 kartında **Takvimi eşitle ve çizdir** işlemini çalıştır.
4. `Android seçili ilçe kodu` = `Yayımlanmış takvim ilçe kodu` ve her ikisi de
   sıfırdan büyük olmalı. Native takvim **Kayıtlı**,
   `Aktarım aşaması` = `native-committed` olmalı.
5. Başarısızsa `Uygulama veri hatası`, `Son eşitleme sonucu`,
   `Son aktarım açıklaması` ve `Hata` alanlarını içeren
   **Raporu paylaş** çıktısını al.
6. İnterneti kapatıp aynı ilçede widget yenile: geçerli veri silinmemeli.
7. Farklı ilçe seçildiğinde eski ilçenin saatleri gösterilmemeli.
8. Android'in launcher piksellerinin gerçekten değiştiğini ayrıca telefon
   ana ekranından doğrula. CI/Java derlemesi bunu kanıtlamaz.

