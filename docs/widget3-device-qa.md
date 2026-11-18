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
