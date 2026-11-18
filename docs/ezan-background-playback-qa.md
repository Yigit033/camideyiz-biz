# Ezan çalma, arka plan modu ve kişisel MP3 — QA

## Kaynaklar ve dağıtım

- APK ile birlikte gelen varsayılan ses: Wikimedia Commons CC0 lisanslı mevcut `beautiful-adhan.mp3`.
- Kullanıcının seçtiği MP3 sistem dosya seçicisiyle alınır; telefonun uygulamaya özel `Paths.document/camideyiz_user_adhan.mp3` alanına taşınır. Sunucuya veya Github'a gönderilmez.
- Tercih edilen Uşşak/Öğle kaydı: https://konyacami.com/ses_dosya/Ogle_ezani.mp3 . Bağlantı dinlemek ve kullanıcı tarafından kaydedilmek içindir. Sesin uygulama ile toplu yeniden dağıtım izni doğrulanmadı; otomatik indirme ve APK içine katma YOK.
- Kaydı sunucuya gömmek veya uygulamanın varsayılan paketi olarak dağıtmak için kayıt sahibinden lisans/izin gereklidir.

## Kullanım

1. Telefonunda kaydı bir MP3 dosyası olarak indir; sahip olduğun kullanma haklarına uygun hareket et.
2. Camideyiz Biz → Ana Sayfa → Ezanı Dinle → **MP3 seç** üzerinden bu dosyayı seç.
3. Uygulama dosyayı çevrimdışı ve özel depoya kopyalar. Manuel dinlemedeki ses ve **Android native vakit alarmında** çalınacak ses aynı dosya olur.
4. İstersen **Varsayılana dön** ile CC0 lisanslı başlangıç kaydını geri yükle.

## Kullanıcı testi

- [ ] MP3 seçimi geçersiz/çok büyük dosyaları (>12 MB) ve .mp3 dışındaki uzantıları reddediyor.
- [ ] MP3 seçimi gerçekten seçili dosyayı oynatıyor; başta ve sonda kesik çalma yok.
- [ ] Ezanı başlat, ana ekrana dön: ses devam etmeli.
- [ ] Uygulamanın başka sekmesine gir: ses devam etmeli.
- [ ] Telefon ekranını kilitle: ses devam etmeli. Android kilit ekranı ve bildirim kontrolünden duraklat/oynat.
- [ ] Ezan tamamen bittikten sonra sürekli çalışan medya servisi kalmamalı.
- [ ] Gelen arama/başka müzik sesi, ses odağı kurallarına göre oynatımı durdurabiliyor.
- [ ] Uygulamayı normal açıp kapatıp tekrar aç: seçilen MP3 özel dosyadan geri yüklenmeli.
- [ ] Android özel alarm izni ve tam ezan seçeneği açıkken **Ezanı test et**: kendi MP3 dosyasından tam çalma başlamalı.
- [ ] Aynı MP3 seçiliyken telefon internetsiz ve kilitli: tam ezan sesi yerelden çalmalı.
- [ ] Varsayılan kayıt geri yüklendiğinde hem manuel hem otomatik ezan varsayılan CC0 kaydına dönmeli.
- [ ] OEM pil optimizasyonu/Doze, Android 14–16, iOS arka plan ses denetimini ayrıca gerçek cihazda test et.
- [ ] Android'in uygulamayı zorla durdurma (force-stop) veya kullanıcı tarafından kaldırma davranışı için garanti verme.

## Mimari

- `AdhanPlaybackProvider` `_layout` içinde, navigasyon ağacının üzerinde kalır; `expo-audio` SDK 58 `enableBackgroundPlayback`, `shouldPlayInBackground` ve `setActiveForLockScreen(true)` kullanır.
- Android native `AdhanPlaybackService` Android `Context.getFilesDir()/camideyiz_user_adhan.mp3` dosyasını görürse onu açar; yoksa lisanslı APK içi `R.raw.camideyiz_adhan` dosyasını kullanır.
- iOS'ta manuel arka plan oynatma mümkündür, ancak uygulama çalışmıyorken namaz vakti geldiğinde Android'deki tam sesli native alarm davranışını garanti eden iOS çözümü yoktur.

## Kaynak/derleme

- https://docs.expo.dev/versions/v58.0.0/sdk/audio/
- https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/
- https://konyacami.com/cami-musikisi
- `node scripts/verify-adhan-playback-contracts.mjs`, `npm test`, `npm run typecheck` ve Android QA APK.
