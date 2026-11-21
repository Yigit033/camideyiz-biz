# Camideyiz Biz — Widget Engine 4.3 · Android QA

## Neler değişti

1. **Vakit geçişi tam dakikada.** Widget'ı bir sonraki vakte geçiren tek alarm, "Alarmlar ve hatırlatıcılar" izni varsa artık **kesin alarm** (`setExactAndAllowWhileIdle`) olarak tam yayımlanmış dakikada kurulur. Önceden kesin olmayan alarm Doze altında dakikalarca gecikebiliyor, `Chronometer` bu sürede eksiye düşebiliyordu (`−07:12`).
   - İzin yoksa eski yöntem (kesin olmayan alarm) güvenli yedek olarak kalır. İzin geri alınırsa `SecurityException` yakalanır ve yine yedek kullanılır.
   - Alarm artık `+1200 ms` gecikmeyle değil tam sınırda çalar. Sınıra 1,5 sn içinde düşen bir yenileme yeni vakti gösterir (`BOUNDARY_LEAD_MS`), böylece sayaç `−00:01` göstermez.
   - Kullanıcı izni sonradan verirse `SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` yayını widget alıcısına da gelir ve alarm hemen kesin olarak yeniden kurulur.
   - Günde yaklaşık 7 alarm kurulur; dokuz widget türü tek alarmı paylaşır. Pil etkisi ihmal edilebilir düzeydedir.
2. **Sistem gece/gündüz modu anında uygulanır (Android 12+).** Uygulama teması "Sistem" iken widget'lar `values` / `values-night` takma adlarıyla (`*_auto` layout ve vurgu drawable'ları) çizilir. Renkler `RemoteViews.setColorInt(gündüz, gece)` ile verilir. Launcher, sistem modu değişince (zamanlanmış gün batımı dahil) widget'ı **uygulamayı uyandırmadan** doğru temayla yeniden çizer.
   - Açık/Koyu tema zorla seçildiyse veya cihaz Android 11 ve altıysa davranış eskisi gibidir.
   - Tema anahtarı `auto` sabit kaldığından gece/gündüz geçişi gereksiz yeniden çizim kuyruğa almaz.
3. **Çember widget'larının gerçek açık teması.** Mini, Premium 4×4 ve Kare 2×2 çemberin açık düzenleri önceden koyunun birebir kopyasıydı. Artık fildişi arka plan, lacivert yazı ve koyu altın sayaçla diğer widget'larla aynı paleti kullanırlar. Premium'un altı vakit satırı da temaya göre renklenir.
   - Çember bitmap'i temadan bağımsızdır (yarı saydam iz renkleri her iki zeminde okunur). Tek önbelleklenmiş bitmap tüm temalara hizmet eder.
4. **Widget seçme ekranında önizleme ve açıklama (Android 12+).** Dokuz widget'ın her birine `previewLayout` ve tek satırlık Türkçe açıklama eklendi. Önizlemeler gerçek layout'tur. Altı satırlı tasarımlarda yalnız **vakit adları** görünür; uydurma saat gösterilmez (`--:--`). Çemberlerde boş delik yerine "takvim bekleniyor" durumuyla aynı nötr iz görünür.
5. **"En yeni kazanır" render kuyruğu.** Bitmap ve RemoteViews kuyrukları doluyken yeni iş reddedilip hata yazılmıyordu; artık kuyruğun başındaki (zaten geçersiz) en eski iş atılıyor ve onun `goAsync` tamamlaması hemen çalışıyor. Atılan işin widget aileleri kalıcı imzalarına göre kirli kaldığından, yeni nesil onları yeniden çizer. Tanı: `nativeRenderQueueEvicted`.
6. **Widget Durumu paneli.** Başlık "Widget Durumu" oldu. Kurulu widget varken geçiş kesin değilse tek dokunuşla "Alarmlar ve hatırlatıcılar" ayarını açan bir uyarı gösterilir. Ayrıntılarda "Vakit geçiş hassasiyeti" ve okunabilir tema adı yer alır.
7. `BRAND_VERSION=4`: yeni APK kurulunca tüm kurulu widget'lar bir kez temiz yeniden çizilir. JS tarafındaki `WIDGET_BRAND_ASSET_VERSION` ile eşitliği artık `verify-widget-headless-gate.mjs` zorunlu kılar. Eşleşmezse arka plan görevi her seferinde ağır takvim motorunu yükler.

İş parçacığı modeli değişmedi: ana thread ve React Native modül kuyruğu yalnız iş kuyruğa alır. Koordinatör, bitmap render ve RemoteViews dispatcher ayrı, sınırlı, düşük öncelikli tek thread'lerdir. Yeni JS zamanlayıcı, ağ isteği, bağımlılık veya Supabase/Diyanet değişikliği yoktur.

## Yerel doğrulama (yapıldı)

```powershell
npm test
npm run typecheck
node scripts/verify-widget-engine43.mjs
node scripts/verify-widget-designs.mjs
node scripts/verify-widget-engine4.mjs
node scripts/verify-widget-engine41.mjs
node scripts/verify-widget3-contracts.mjs
node --experimental-strip-types scripts/verify-widget-headless-gate.mjs
node --experimental-strip-types scripts/verify-widget-native-runtime.mjs
node --experimental-strip-types scripts/verify-widget-foreground-gate.mjs
```

Ek olarak widget kaynakları `aapt2` ile derlenip bağlandı (47 kaynak). React köprüsü hariç 15 widget Java dosyası `javac` ile `android-36` SDK'sına karşı derlendi. Gradle Release derlemesi ve cihaz testi bu kontrollerin yerine geçmez.

## APK

```powershell
cd C:\active_projects\camideyiz-biz
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1 -CheckoutPath C:\cb
```

Native Java, XML, `values-night` ve manifest değiştiği için **yeni APK şarttır**; OTA yetmez.

## Cihaz test matrisi

1. **Tam dakikada geçiş:** "Widget ve Bildirimler" ekranında "Vakit geçiş hassasiyeti" değerini kontrol et. İzin yoksa uyarıya dokun, izni aç, geri dön; değer "Tam dakika" olmalı. Bir vakit girişini ekran açıkken izle: sayaç 00:00'da yeni vakte geçmeli ve hiç `−` göstermemeli. Ekran kapalı 10+ dakika bekleyip (Doze) bir vakit sınırından sonra aç; widget doğru vakitte olmalı.
2. **İzin yokken:** İzni kapat; widget yine çalışmalı, panel "Yaklaşık" göstermeli. Geçiş en geç ~30 dk içinde (launcher yenilemesi) düzelmeli.
3. **Gece/gündüz (Android 12+):** Uygulama teması "Sistem". Hızlı ayarlardan karanlık modu aç/kapat; dokuz widget'ın hepsi **uygulamayı açmadan** anında tema değiştirmeli. Seçili vakit vurgusu (günlük, şerit, premium) her iki temada doğru renkte olmalı.
4. **Zorla tema:** Uygulamada Açık sonra Koyu seç; sistem modundan bağımsız uygulanmalı.
5. **Çember açık tema:** Mini, Premium 4×4 ve Kare 2×2 açık temada fildişi zemin; yazılar ve altın sayaç okunaklı; çember izi görünür ama baskın değil.
6. **Widget seçme ekranı:** Dokuz widget farklı önizleme ve açıklamayla görünmeli; önizlemede uydurma saat yok. (Bazı OEM launcher'lar `previewLayout` desteklemeyip uygulama simgesini gösterebilir.)
7. **Regresyon:** İlçe değişimi, reboot, saat dilimi değişimi, uçak modu, hızlı ekle/kaldır, gece yarısı. Eski ilçe saatleri geri gelmemeli; `nativeRenderQueueRejected` 0 kalmalı.
8. **Performans:** Widget'lar kuruluyken 5 soğuk açılış, ön plana dönüş ve kaydırma; Engine raporundaki kuyruk bekleme süreleri 4.2 ile karşılaştırılmalı.

## Bilinen sınırlar

- Kesin alarm Android 12+ cihazda kullanıcının verdiği "Alarmlar ve hatırlatıcılar" iznine bağlıdır. Bazı üreticilerin (MIUI, ColorOS) agresif pil yönetimi alarmları yine geciktirebilir.
- Gece/gündüz anlık değişimi launcher'ın RemoteViews'i yeniden şişirmesine dayanır (AOSP/Pixel/One UI). Gerçek cihazda doğrulanmalıdır.
- Android 11 ve altında sistem teması değişimi bir sonraki vakit geçişinde veya uygulama açılışında uygulanır.
