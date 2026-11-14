# Widget ve Bildirimler 2.0 — Camideyiz Biz

## İşlev kapsamı (Uygulama-1.pdf)
- Logo + **Camideyiz Biz**, seçili ilçe, sıradaki namaz vakti / kalan süre.
- İkinci widget: bugünün tüm altı vakti.
- Widget'a dokununca uygulama açılır.
- Kullanıcı her vakit için uyarıyı açabilir, vakit girdiğinde veya
  5/10/15/30/45/60 dakika öncesinde bildirim almayı seçebilir.
- Sistem sesi veya sessiz uyarı; bildirimleri aç/kapat.
- Uygulamanın **gerçekten gözlemlediği** bildirimin yerel geçmişi ve kaydı silme.

## Teknik mimari ve ticari kısıtlar
- Expo SDK 58 \`expo-widgets\` + \`@expo/ui\`: **Android Jetpack Compose ve iOS SwiftUI native widget'ları**.
- \`expo-notifications\`: yalnızca **cihaz üstünde planlanan yerel bildirimler**.
  Sunucu, kullanıcı veritabanı, Firebase, ücretli API, push token veya yeni
  abonelik gerekmiyor.
- Namaz vakti kaynağı yine üçüncü taraf ücretsiz İdamedya takvim aktarıcısı.
  \`PrayerSourceProvider\` aynı kaydı Home, widget ve hatırlatmalarla paylaşır:
  iki kez sorgulama yok.
- Resmî Diyanet onayı hâlen mevcut alternatif API katmanı için tutulur.
  Bu dal Diyanet anahtarı, production migration veya deploy gerektirmez.
- Provider'daki yayımlanmış gün dizisi \`upcoming\`, iki günlük namaz
  çizelgesinden ayrı doğrulanır; önbellek 55 dakikadır, kaynak 15+ günlük
  takvim veriyorsa gelecek 7 gün için kullanılabilir.
- \`packages/core/src/prayerCompanion.ts\`: saf veriye dayalı alarm ve widget
  zaman çizelgesi. \`createPrayerAlertPlan\` 7 gün / en fazla 60 bildirim;
  iOS sistem sınırı 64 bekleyen bildirim olduğu için 60'la bırakılır.
- \`prayerInstant\`: gün/saat dönüşümü **Europe/Istanbul** IANA takvimiyle
  çapraz doğrulanır; yanlış saat dilimi durumunda bildirim üretilmez.
- Hatalı/eksik/sahte saatler ve astronomik hesaplamalar kullanılmaz.

## İki native widget
1. **Sıradaki Vakit:** küçük 2×2; zümrüt/altın, seçili ilçe,
   sıradaki vakit, saat ve referans kalan süre.
2. **Günlük Namaz Vakitleri:** orta 4×2, iOS büyük seçenek;
   altı namaz vakti + sonraki vakit.

iOS:
- WidgetKit için her namaz sınırı ve gece yarısında \`updateTimeline\`;
  \`timerInterval\` sistemce güncellenen geri sayım sağlar.
- Sistem widget timeline'ını ekonomik nedenlerle erteleyebilir; bunu
  milisaniye garantili işlem gibi sunmuyoruz.
- Widget'a dokunma \`camideyizbiz:///\` URL'si üzerinden uygulamayı açar.
- WidgetKit extension / Apple geliştirici imzalama ve gerçek iPhone QA gerekli.

Android:
- Native Jetpack Compose widget \`expo-widgets\` ile üretilir.
- \`updateSnapshot\` yalnızca uygulama çalışırken veya yeniden açıldığında
  yenilenir. Android sistem, uygulama kapalıyken API'yi yeniden çağırmaz.
- Bu nedenle Android'de eski sayacı "anlık kalan" diye göstermeyiz;
  **sıradaki namazın HH:MM saati** birincildir ve snapshot kalan
  süre açıkça "son yenilemede" olarak etiketlenir.
- Widget'a dokununca uygulama açılma davranışı cihazda test edilmeli.
- Gerçek Play build'in Android manifesti ve widget receiver'ları
  \`expo prebuild\` / Gradle derlemesiyle doğrulanmalı.

### Expo Go ile test edilemez!
Native widget tanımı CNG config plugin'de yapıldığı için
\`npm run mobile\` ile sadece **uygulama içi widget önizlemesi ve
JS bildirim ayarları** görülebilir. OS widget galerisinde gerçek
widget'ı görmek için native modül içeren **yeni development / production APK**
(Android) ya da Xcode/EAS iOS build gereklidir.

Geliştirme akışı:
\`\`\`powershell
cd C:\active_projects\camideyiz-biz
git fetch origin
git switch --track origin/feat/widgets-and-prayer-alerts-2
npm install
npm run mobile
\`\`\`
Dal yerelde varsa \`git switch feat/widgets-and-prayer-alerts-2\`
ve \`git pull --ff-only\`.

Android native smoke:
\`\`\`powershell
cd apps/mobile
npx expo prebuild --platform android --no-install
npx expo run:android
\`\`\`
Android SDK + JDK ve emulator/fiziksel cihaz kurulu olmalıdır; prebuild
native Android proje oluşturur, \`android/\` klasörü kaynak kod yerine
derleme çıktısı olarak ele alınmalıdır. iOS gerçek widget testi için
Mac/Xcode + signing gerekir.

## Bildirimler
- Varsayılan **kapalı**. Kullanıcı açınca sistem bildirim izni istenir.
- Her vaktin bağımsız kuralı var; Güneş doğuşu doğrudan ezan vakti
  olmadığı için ilk açılışta kapalıdır.
- Vaktin başladığı an veya seçilen dakika öncesi planlanır; örneğin
  öğle 12:53 ve "10 dakika önce" -> 12:43.
- Android iki kanala ayrılır: sistem sesi ve sessiz.
- Android cihaz üreticisinin pil optimizasyonu, Android 12+ exact alarm
  kısıtları, iOS Focus/Sessiz mod nedeniyle sistem uyarıyı geciktirebilir.
  **Kesin saniye veya tam vaktinde çalma garantisi yoktur.**
- \`expo-notifications\` yerel Date trigger'ları kullanır; tekrarlanan sabit
  günlük alarmlar kullanılmaz çünkü her gün vakitler değişiyor.
- Gelecekteki 7 gün için 60 kayıtla sınırlı plan; ilçe değişiminde
  eski ilçenin hatırlatmaları temizlenir; uygulama öne gelince eşitlenir.
- Harici kaynak takvimi değiştirirse cihazdaki henüz eşitlenmemiş
  bildirimler eski saate göre kalabilir. Arka planda periyodik API
  yenileme garantimiz YOK; uygulama zaman zaman açılmalı.
- App inbox: yalnızca uygulamanın gördüğü veya OS bildirim merkezinde
  hâlâ mevcut olan teslimatlar; daha önce sistemden silinen tüm
  geçmişi hatasız geri getirme vaadi yoktur. Silinen kayıtlar
  tombstone ile yeniden içe alınmaz.
- Bildirim tarihi ve kaynak ilçe eşlenir, uygulamadaki diğer
  geliştirici bildirimleri topluca iptal edilmez.
- PDF'deki dinî uyarı sesleri ("hayye ale's-salâh" vb.)
  **henüz entegre edilmedi**. Lisanslı veya kullanıcı tarafından
  sağlanan/orijinal bir ses kaydı ile ayrı bir native ses asset'i
  olarak eklenmesi gerekir.

## Gerçek cihaz test listesi
Android:
- Fresh install POST_NOTIFICATIONS izni deny/grant, genel toggle ve 6 vakit.
- 5 dakikalık test bildirimi, ekran açık/kapalı, telefon güç tasarrufundayken davranış.
- Başka ilçe seçince önceki ilçenin planlı bildirimlerinin silinmesi.
- App reboot/kill -> OS-local planın kalması, Expo JS açılınca yeni 7 günlük
  zaman çizelgesine geçiş.
- 2×2/4×2 widget galerisinde görünüm, koyu/açık sistem, küçük ekran,
  widget tap, uygulama yeniden kurulumunda temiz varsayılan.
iPhone:
- iOS WidgetKit small / medium / large, geri sayımın ileri işlemesi,
  gece yarısı geçişi, açılır URL, düşük güç modu.
- Local notification izinleri, sessiz odak modu, tarih geçişi, 64-limit.
- Gerçek cihazda widget extension code signing ve provisioning.

## Yayın engelleri
- Native Android/iOS **fiziksel testleri henüz yapılmadı**.
- Android Gradle uygulama+widget native derlemesi ve iOS Xcode widget
  extension imzalama/release provisioning.
- Bildirim sesi medya hakları ve varsa mağaza uygunluk kontrolleri.
- Üçüncü taraf veri kaynağının uzun süreli ve ticari kullanım koşulları.
- Diyanet resmî API ayrı doğrulama süreci.

Yayınlamadan önce bu kapılar onaylanmalıdır.
