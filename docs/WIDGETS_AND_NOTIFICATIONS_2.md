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


## 14 Kasım 2026 — Expo Go / native runtime ayrımı

Gözlenen iki hata: `Cannot find native module 'ExpoWidgets'` ve Android
`ExpoNotificationChannelManager.setNotificationChannelAsync` sırasında
`NullPointerException`.

- Expo Go yalnızca **uygulama içi widget görsellerini** gösterebilir;
  ExpoWidgets native modülü içermediğinden işletim sistemi widget'ı
  yüklenmez. Runtime kontrolü `Constants.expoGoConfig` ve eski
  `appOwnership` göstergelerini birlikte kullanır (development client
  yanlışlıkla devre dışı bırakılmaz).
- `widgetSync.android.ts` ve `widgetSync.ios.ts` içinde native
  widget giriş dosyaları artık Expo Go'da Metro'nun önceden
  değerlendirebildiği `import()` parçaları üzerinden açılmaz.
  Native modül sadece native build ortamında koşullu `require()` ile
  çağrılır; yöntem bulunamazsa açık hata döndürülür.
- Bildirim kanalları **genel ayar kapalıyken oluşturulmaz**. Native
  Android'de kullanıcı etkinleştirdiğinde kanallar oluşturulur.
  Expo Go'da özel kanal kurma çağrısından kaçınılır; varsa sistemin
  varsayılan kanalıyla yalnızca sınırlı local notification testi denenir.
  Bu Expo Go için teslim garantisi veya OS widget desteği iddiası değildir.
- SDK 58 / Android 16'da artık kullanılmayan
  `android.edgeToEdgeEnabled` kaldırıldı.

### Regresyon kabul testi

1. `npm run mobile` ile Expo Go: uygulama açılmalı, Widget ve
   Bildirimler sayfasındaki iki önizleme görünmeli; `ExpoWidgets`
   kırmızı hata ekranı veya boş/sahte native widget durumu olmamalı.
2. İlk kurulumda bildirimler kapalıyken Android kanal oluşturma
   `NullPointerException` hatası oluşmamalı.
3. İzin/onay sonrası Expo Go'da yerel bildirimleri denemek **opsiyonel**
   ve garanti edilmez. Native Android uygulamasında 5 sn test bildirimi,
   gerçek vakit planı, ses/sessiz kanal ayrımı, izin ret ve ilçe
   değişimi tek tek sınanmalı.
4. `npx expo run:android` ile **yeni native APK** derlenip emülatör
   ana ekranında 2×2 ve 4×2 widget kurulum/tıklama/güncelleme
   kontrol edilmeli. `expo prebuild` tek başına APK yüklemez.
5. iOS WidgetKit cihaz/Xcode kod imzalama kontrolü **hâlâ bekliyor**.

Bu düzeltmenin GitHub CI'da TypeScript, Expo export ve prebuild
kontrollerinden geçmesi **fiziksel Android/iPhone kabul testi** yerine
geçmez; üretime alma kapıları değişmemiştir.

## Windows native APK build (Reanimated/Ninja)

Windows üzerinde `react-native-reanimated:buildCMakeRelWithDebInfo` ve `ninja: error: mkdir(...): No such file or directory` başarısızlığı için ayrı kısa checkout, Windows uzun yol desteği ve CMake 3.31.6/Ninja 1.12.1 kullanan test betiği eklendi. Bu işlem gerçek cihaz testlerinin geçtiği anlamına gelmez. Kurulum: [WINDOWS_ANDROID_APK.md](WINDOWS_ANDROID_APK.md).

## 15 Kasım 2026 — Gerçek Android telefonu ile ilk widget QA

Kullanıcı Windows'ta imzalı `app-release.apk` (52.703.863 bayt) üretti;
Android `apksigner verify` **v2 verified: true**. Fiziksel telefonda
Launcher'ın iki native widget'ı da gösterdiği doğrulandı.

Görülen sonuç: İlk kurulumda her iki widget da yalnızca
`createWidget(..., initialProps)` içindeki boş durumu görüntüledi:
`Konum seç` / `Takvim verisi bekleniyor`. Wide widget başlığında
konumla marka bitişik ve kalan alanda çok fazla boşluk vardı.
**Bu gözlem tek başına güncelleme servisinin arızalı olduğunu kanıtlamaz.**
Widget'lar, uygulama açılıp gerçek takvim okunmadan önce başlangıç
özelliklerini göstermelidir. Telefon uygulaması içinde veri okunması
ve `Yenile` eyleminden sonraki davranış kullanıcı cihazında ayrıca
doğrulanmalıdır.

Düzeltmeler:
- Native widget eşitleme `CompanionProvider` içindeki bildirim
  zamanlama kuyruğundan ayrıldı. Takvim değiştiğinde ve kullanıcı
  `Yenile` dediğinde, bildirim izni kapalı olsa bile bağımsız çalışır.
- Eşitlenecek takvim verisi yoksa gerçeğe aykırı vakit gönderilmez;
  ilk kurulum veya kaynak sorunu ayrı bilgilendirme metni verir.
- Android 2×2 widget: okunur markalama, konum ve büyük vakit saati.
- Android 4×2 widget: markalama/konum üst üste gelmez; altı vakit
  iki kolonda, küçük Android launcher boyutlarına uygun düzenlenir.
- Sürekli canlı geri sayım iddiası yok: Android'de görüntülenen
  HH:MM ve takvim ancak native uygulama eşitlediğinde güncellenir.

### Mevcut APK için manuel ayırıcı test

1. Expo Go değil, yüklü `Camideyiz Biz` APK uygulamasını aç.
2. Ana ekranda canlı kaynaklı güncel namaz saatlerini ve ilçe adını gör.
3. `Widget ve Bildirimler` ekranında `Yenile` düğmesine bas.
4. Yanındaki durum metnini kaydet:
   - `... widget vakitleri güncellendi` => Android updateSnapshot çağrısı çalıştı
   - `Native widget güncellenemedi: ...` => gerçek native hata metni
   - `Takvim verisi henüz doğrulanmadı` => veri kaynağı/konum katmanı
5. Ana ekrana dön ve **iki** widget'ın görüntüsünü kontrol et.

İlk mevcut APK'da bir kez widget görünmesi, Android'in sistemden
düzenli arka plan yenilemesini sağladığımız anlamına gelmez. Test
sonuçlarına göre OS arka plan senkronizasyonu ayrıca ele alınmalı.

**Yukarıdaki yeni kodların görülmesi için APK'nın yeniden derlenmesi
zorunlu.** Expo Go veya yalnızca `git pull` telefonun native
`expo-widgets` paketini değiştirmez.


## 15 Kasım 2026 — Widget 2.0 Android WorkManager iyileştirmesi

Expo SDK 58 Android native widget'ları `updateTimeline` **desteklemez**;
bu API yalnızca iOS içindir. Önceki Android sürümünde
`updateSnapshot` sadece uygulama açıldığında çalışıyordu.

Yeni mimari:
- `expo-background-task` (~58.0.13) + `expo-task-manager`
  (~58.0.14) ile Android WorkManager üzerine **15 dk minimum
  aralıklı**, Android tarafından zamanlanan bir görev eklendi.
- Görev Expo Router'ın kök modülünde global olarak tanımlanır.
  `expo-background-task` Android'de TaskManager headless JS ile
  uygulama arka plandayken çalışmayı dener; Expo Go'da native widget
  görevi kaydedilmez.
- Kullanıcının uygulamada seçtiği **ilçe** ve doğrulanmış yayımlanmış
  takvim, AsyncStorage içinde ayrıca saklanır. GPS ile farklı ilçe
  tahmin edilmez.
- Arka planda sonraki namazı önce doğrulanmış kayıtlar üzerinden
  yeniden hesaplar. Takvim kaydı **72 saati** aşarsa veya yanlış
  ilçeye aitse atılır. Ağ sorguları en fazla yaklaşık **2 saatte
  bir**, veriler eksik/gün dışıysa daha erken yapılabilir. İnternet
  yokken daha önce doğrulanmış ve hâlâ geçerli günlerin bilgisi
  kullanılabilir; kaynaksız takvim **üretilmez**.
- Yanlış şehir, bozuk sıralama, eksik takvim günü, demo saatleri,
  negatif/ilerideki kaynak tarihi ve zamanı geçmiş önbellek
  fail-closed reddedilir.
- Android native `updateSnapshot` hem foreground hem de headless
  görevde kullanılmak üzere çağrılır. Doğrudan bildirim iznine bağlı
  değildir.
- Widget & Bildirimler sayfası görevin sisteme kayıtlı olup
  olmadığını ve **son gözlemlenen arka plan çalışmasını** gösterir.
  Bu gözlem sahte/varsayılan bir zamanla doldurulmaz.
- SDK58 + R8 release'de WorkManager/Room constructor stripping
  sorunu için CNG'de idempotent proguard plugin eklendi;
  Android native prebuild CI proguard dosyasını doğrular.

**Sınırlamalar (yayın blokajı):**
- WorkManager **en erken 15 dk** aralıkla ve tamamen OS takdirine
  göre çalışır; pil/Doze ve cihaz üreticisi daha fazla geciktirebilir.
  Kapatılan/force-stop yapılan uygulamanın otomatik çalışması
  garantilenemez. Gerçek widget'ta saniyelik/dakikalık canlı sayacı
  göstermiyoruz.
- `TaskManager` headless Android worker'ın gerçekten
  `expo-widgets.updateSnapshot` çağrısını tetiklediği fiziksel cihaz
  üzerinde doğrulanmalı. TypeScript, JS bundle ve prebuild testleri
  bunu kanıtlamaz.
- iOS hâlâ mevcut WidgetKit zaman çizelgesi üzerinden çalışıyor;
  iOS fiziksel cihaz/signing testleri ayrı.

### Fiziksel Android kabul testi

1. Aynı imzayı koruyan mevcut kısa checkout `C:\cb` içinden
   **release** APK'yı artımlı üretip eski APK'nın üstüne kur.
2. Camideyiz Biz'i aç, doğrulanmış İstanbul/ilçe takvimini yükle.
3. Widget ve Bildirimler sayfasında `Arka plan güncellemesi ·
   Sisteme kaydedildi` ve mevcut widget durumunu gözle.
4. Uygulamadan **normal şekilde** çık (Android Ayarlar içindeki
   `Zorla durdur` değil), telefon ana ekranına iki widget'ı ekle.
5. Ağ açıkken ve pil tasarrufu kapalıyken bir vakit sınırını izle;
   daha sonra ağ kapalıyken aynı güne ait son kaydı incele.
6. Widget ve Bildirimler sayfasında son görev zamanını ve hata
   metnini kontrol et. Gerçek çalışma yoksa başarı iddia etme.
7. Başka ilçe seç; widget'ta eski ilçenin namaz saatlerinin
   gösterilmediğini doğrula.
8. `adb shell dumpsys jobscheduler` çıktısında
   `biz.camideyiz.app` WorkManager görevini kontrol et. Android
   `cmd jobscheduler run -f PACKAGE JOB_ID` komutu QA için
   kullanılabilir; QA'dan sonra normal OS zamanlamasını test et.
9. Kilitli ekran, farklı launcher/boyut, yeniden başlatma, açık/koyu
   tema ve üretici pil yönetimini test et.

### Release APK derleme optimizasyonu

`scripts/build-android-windows.ps1` artık mevcut `C:\cb` kısa
checkout'unu ve native `android/.cxx` Gradle/CMake ara çıktısını
korur; her build'de `expo prebuild --clean` yapmaz. İlk kurulumda
otomatik temiz prebuild yapar, gerektiğinde `-CleanNative` ile
istenebilir. Gradle daemon kapatılmadığından artımlı derlemeler
genellikle daha hızlıdır; ilk yeni native bağımlılık derlemesi
yine uzun sürebilir.

**Geliştirme / bağımsız test farkı:** Debug APK varsayılan olarak
Metro geliştirici sunucusuna ihtiyaç duyar; release APK kendi JS
bundle'ını içerir. Telefonu kablodan ayırıp normal kullanım testi
için release gerekir. Debug APK kendi başına Play Store paketi değildir.

**APK yükseltmesi:** İlk test APK'sı `C:\cb` checkout'unda
imzalandıysa tekrar aynı checkout'u kullan. Ayrı yeni checkout
debug signing key değiştirirse Android mevcut paketin üstüne
kurulumu reddedebilir. Key değişirse uygulamayı/verilerini
silmeden önce imza bilgisi doğrulanmalı.

Referanslar:
- https://docs.expo.dev/versions/v58.0.0/sdk/background-task/
- https://docs.expo.dev/versions/v58.0.0/sdk/widgets/
- https://github.com/expo/expo/issues/52173
