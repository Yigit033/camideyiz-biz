# Camideyiz Biz · Ezan Arka Plan / Manuel ve Otomatik QA

## Tek ses dosyası

- Kullanıcının yüklediği **Camideyiz_Biz_Ezan.mp3**; 197,3 saniye (3:17), 128 kbps, MP3.
- **SHA-256:** `09b6077c9ec6acaa3de1721de4a1f558c9e7ec0044c916d29ba6ea19b53ea77f`
- Yerel yol: `apps/mobile/assets/audio/camideyiz-biz-ezan.mp3` (`.gitignore` içinde).
- `npm run prepare:adhan`, dosya varsa yalnızca doğrular; yoksa kayıt sahibinin açık bağlantısından **derleme sırasında** indirir ve tam SHA-256 eşleşmesini zorunlu tutar. Eski sesle sessiz geri dönüş YOK.
- Manuel oynatıcı ve native otomatik ezan servisi bu aynı dosyayı kullanır; uygulama **çalışma zamanında ağdan ses çekmez**.
- Kullanıcıdan MP3 dosyası seçmesi istenmez; **Ezanı Dinle** butonu anında çalar.

## Arka planda dinleme

- `expo-audio` background playback etkin. Medya oynatıcı `AdhanPlaybackProvider` içinde, Expo Router Stack'inden üstte.
- Android'in sistem medya bildirimi ve iOS Now Playing erişimi açık; oynatma başka sekmeye geçince veya ekran kilitlenince devam edecek şekilde yapılandırılmıştır.
- Kullanıcı uygulamayı sistem ayarlarından **zorla durdurursa** veya işletim sistemi uygulamayı sonlandırırsa devam etme garantisi yoktur.
- **Vakit geldiğinde otomatik ezan** Android'de ayrı native `AlarmManager` + `AdhanPlaybackService` üzerinden çalışır; kullanıcı kesin alarm izni vermelidir. Cihaz pil kısıtlamaları saat hassasiyetini etkileyebilir.

## Fiziksel cihaz kabul testi

- [ ] Ana ekranda tek tuşla, kullanıcı tarafından yüklenen 3:17 ezan çalıyor; MP3 seçici görünmüyor.
- [ ] Aynı ses, uygulama arka plandayken ve kilit ekranındayken devam ediyor.
- [ ] Kilit ekranı medya kontrollerinden duraklatma ve devam ettirme yapılabiliyor.
- [ ] Kayıt bittiğinde servis ve oynatıcı düzgün kapanıyor.
- [ ] Android **Tam ezan** modu ve kesin alarm izni açıkken kilitli telefonda 10 saniyelik test çalışıyor.
- [ ] Gerçek namaz vakti testinde de **aynı** ses dosyası kullanılıyor.
- [ ] İki ses dosyası eşzamanlı başlatılırsa ses odağı politikaları inceleniyor.
- [ ] Birden fazla Android sürümünde ve iOS'ta gerçek cihaz testi yapılıyor.

## Telif / lisans notu

Kaydı kullanıcı bizzat sağladı. MP3'ün GitHub kaynak deposunda tutulmaması, dağıtılan APK/IPA'nın kaydı içerdiği gerçeğini değiştirmez. Ticari ve kamuya açık yeniden dağıtım izni ayrıca değerlendirilmelidir.

## Doğrulama

`npm run prepare:adhan`, `node scripts/verify-adhan-playback-contracts.mjs`,
`npm run typecheck` ve Android QA APK derlemesi.
