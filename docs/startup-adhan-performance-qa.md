# Camideyiz Biz — Açılış ve Ezan Etkileşim Performansı (P0)

## 19 Kasım 2026 kod incelemesinde bulunan gerçek riskler

| Risk | Sebep | Uygulanan çözüm |
| --- | --- | --- |
| İlk 5–10 saniye yayımlanmış vakit çemberi boş | 55 dakikayı aşmış fakat 24 saatlik **aynı tarih ve ilçeye ait** doğrulanmış offline cache, ağ yanıtı beklenirken çizilmiyordu | Aynı gün/ilçe yayımlanmış kaynak cache'i doğrulanınca ekrana anında basılıyor, ağ yenilemesi arkada sürüyor |
| Ezanın ilk dokunuşta tepki vermemesi | MP3/player hazır değilken `play()` çağrısı, sessizce yakalanan hata | 3.1MB MP3 ilk çizimden sonra yükleniyor; kullanıcı dokunuşu native `isLoaded` + ses modu hazır olana kadar kuyruklanıyor, yükleniyor göstergesi ve 15 saniyelik hata sınırı var |
| Widget işlerinin ilk ekranla yarışması | Kök dosyada bütün widget backend dosyası eager import, hazır olur olmaz native senkronizasyon ve bildirim planlama | Başta yalnız `defineTask` var, gerçek widget motoru ihtiyaç anında dinamik import ile geliyor. Widget/bildirim bakımı ilk 1600ms ertelendi, yinelenen aynı takvim yazımları tekilleştirildi |
| Saniyede bir bütün kartların yeniden çizilmesi | Canlı çember saati 1 saniye yenileniyor, alt statik Ayet/Hadis/Ezan kartları da yeniden render ediliyordu | Statik kartlar ve namaz badge'leri `memo` ile ayrıldı, kontrast geçiş hesaplaması 1000 yerine 12 aşama |
| Gerçek cihazda hangi aşama yavaş gözlenemiyordu | Başlangıç / ilk kaydedilmiş veri / ilk ses başlama işaretleri yoktu | Uygulama belleğinde anonim süre markaları; Widget 3.0 **Raporu paylaş** içine `startupPerformance` eklendi |

## Güvenlik ve ürün kuralları

- Açılışta asla astronomik takvim saati uydurulmaz. Yalnız aynı tarih ve seçilmiş ilçe için core doğrulayıcıdan geçen **yayımlanmış** namaz vakitleri gösterilir.
- Eski offline kaynak (24 saati aşmış, farklı gün veya ilçe) canlı vakit diye sunulmaz. O durumda yerel saat hemen görünür ancak yayımlanmış namaz vakti veri sağlayıcı gelene kadar **yükleniyor** durumundadır.
- İlk ekran çizimi, GPS/adres bulma, internet ya da widget/WorkManager kaydı tamamlanmasını beklememelidir.
- Önceden sistem alarmına verilmiş ezan/vakit hatırlatmaları zamanında teslim için React JS'nin açılışını beklemez. 1,6 saniyelik erteleme yalnız uygulama açılırken yapılan yeniden planlamayı etkiler.
- Ezan sesinin çevrimdışı dosyası aynı kalmıştır. Arka planda oynatma ve Android kilit ekranı kontrolü korunur.
- TaskManager'ın görev tanımı modül seviyesinde eşzamanlı kalır, yalnız ağır görev **çalıştırıcısı** çağrı anında import edilir.
- Geliştirmeler mobil kaynak kodunu değiştirir; fiziksel cihazda 5–10 saniyelik gecikmeyi sıfıra indirdiği release testi yapılmadan garanti edilmez.

## Android fiziksel cihaz testi

1. Release APK'yı eski uygulamanın üzerine kur. İmza farklıysa uygulamayı veri kaybıyla kaldırma.
2. Uygulamayı son uygulamalardan kapat, tekrar aç. Yerel saat ilk açılışta görünmeli. Aynı günün geçerli takvimi önbellekteyse internet olmadan vakitler de görünmeli.
3. Uygulama açılır açılmaz **Ezanı Dinle**'ye bas: ilk dokunuş `Ezan hazırlanıyor…` gösterecek, ses hazır olunca otomatik başlayacak. Üst üste hızlı dokunmada duplike çalma olmamalı.
4. Ezanı açtıktan sonra uygulamayı arka plana alıp ekranı kilitle; Android medya kontrolünü doğrula.
5. Ağ açık/kapalı, eski ama 24 saat içindeki aynı gün cache, sıfır önbellek ve farklı ilçeye geçme senaryolarını ayrı ayrı dene.
6. Widget'da ilçe/saat ve otomatik ezanın Android izinleri hâlâ doğru mu kontrol et.
7. **Widget ve Bildirimler → Widget 3.0 → Raporu paylaş** üzerinden `startupPerformance.marksMs` ve `firstAudioTapToPlayingMs` değerlerini incele.

## Ölçüm sınırı

`home-first-frame`, React Native JS `requestAnimationFrame` callback zamanıdır; Android'in gerçekten ekranı çizdiği (first contentful frame) anlamına gelmez. `audio-first-playing`, Expo'nun oynatıcı durumunun `playing=true` olmasıdır; hoparlörden gerçekten ses çıkışını veya ses seviyesini doğrulamaz. Gerçek end-to-end gecikme için release cihazında Android Perfetto / system trace ve fiziksel dinleme gerekir.

## Otomatik regresyon

```powershell
node scripts/verify-startup-performance.mjs
node scripts/verify-widget3-contracts.mjs
npm test
npm run typecheck
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
```
