# Namaz Bildirimleri 4.0: Zamanında teslim ve bildirim yerine ezan

## Ne kullanıyoruz

- **Vakit bildirimleri:** `expo-notifications`. Telefonda, yayımlanmış ilçe takviminden yerel olarak planlanır; sunucu kullanılmaz.
- **Ezan:** Android'e özel native modül.
  - `AdhanAlarmScheduler` alarmı kurar.
  - `AdhanAlarmReceiver` alarmı karşılar.
  - `AdhanPlaybackService` ezanı arka planda medya servisi olarak çalar.
  - `AdhanNotifier` "vakti girdi" bildirimini gönderir.
  - Kayıt APK'ya gömülü MP3'tür; internet gerekmez.

## 4.0 ile değişenler

### Zamanında teslim

- **İzin:** Bildirimler açılırken Android 12+'da "Alarmlar ve hatırlatıcılar" izni nedeniyle birlikte istenir. İzin yoksa ekranda "birkaç dakika gecikebilir" uyarısı ve izin düğmesi görünür.
- **"Dakikası dakikasına" (varsayılan açık):**
  - Vakit bildirimleri `setAlarmClock` ile kurulur (Expo `delivery:'alarmClock'`). Ezan alarmları da bu seçenekle aynı şekilde kurulur.
  - Sistem bu alarmları pil tasarrufu modlarında bile ertelemez. ColorOS ve MIUI'nin `setExactAndAllowWhileIdle` alarmlarını dakikalarca ertelediği bilinir.
  - Bedeli: durum çubuğunda alarm simgesi görünür.
  - Kapatılırsa kesin alarm (`setExactAndAllowWhileIdle`) kullanılır.
- **İzin sonradan verilirse:** Önceden yaklaşık olarak kurulmuş tüm bildirimler kesin olarak yeniden kurulur. Expo, kesin ya da yaklaşık API'yi planlama anında seçtiği için her talep "nasıl kurulduğu" etiketini taşır.
- **Plan ufku:** Android'de 10 gün ve 120 uyarı; iPhone'da 7 gün ve 60 uyarı (iOS 64 sınırı). Uygulama bir haftadan uzun açılmasa da bildirimler sürer.

### Bildirim yerine ezan

- **Seçim:** "Vakit geldiğinde → Ezan okunsun" ve vakit bazlı seçim (öğle, ikindi, akşam, yatsı).
- **Hangi bildirimler değişir:** Yalnız seçilen vakitlerin "vakit girdi" bildirimi ezana dönüşür. Erken hatırlatmalar bildirim olarak kalır.
- **Ortak kural:** Ezan mı bildirim mi kararı tek bir çekirdek kuralda (`playsFullAdhan`) verilir. İki planlayıcı birbirinden ayrışamaz.
- **İzin yoksa:** Ezan alarmı kurulamazsa normal sesli bildirim gelir; vakit kaybolmaz.
- **Ezan çalınamazsa** (aşağıdaki her durumda) sesli **"X vakti girdi"** bildirimi gelir:
  - Telefon sessiz veya titreşimde.
  - Medya sesi 0.
  - Telefon görüşmesi sürüyor.
  - Alarm 3 dakikadan geç teslim edildi (en fazla 2 saat geç gelenler).
  - Servis başlatılamadı.
  - Çalma hatası oluştu.
- **Ezan sırasında:**
  - Kısa ses kesintilerinde (navigasyon, bildirim sesi) ezan duraklar ve devam eder.
  - Ezan bitince ya da durdurulunca bildirim alanında sessiz bir "Öğle vakti girdi · Tuzla · 12:54" kaydı kalır.
- **Bildirim simgesi:** Bildirimler artık amblemin tek renkli silueti ve marka mavisi `#0C76B4` ile görünür (`notification-icon.png`, `build-notification-icon.mjs`).

### Sabah ezanı

Uygulamadaki kayıt öğle ezanıdır. Sabah ezanı "es-salâtü hayrun mine'n-nevm" ifadesini içerdiği için imsakta bu kayıt çalınmaz; imsakta bildirim gelir. Sabah ezanı kaydı sağlanınca dosya eklenir ve `SABAH_EZANI_AVAILABLE=true` yapılır.

## Doğrulama

- `npm test` (çekirdek: ezan kuralı, eski ayar uyumluluğu, Android ufku).
- `node scripts/verify-prayer-alerts.mjs`.
- `node scripts/verify-adhan-playback-contracts.mjs`.
- `node scripts/build-notification-icon.mjs --check`.

Bunlar CI, Android APK iş akışı ve Windows APK betiğinde çalışır.

## Cihaz test matrisi

1. **Bildirim + izin:** Bildirimleri aç; izin penceresinden "Alarmlar ve hatırlatıcılar" iznini ver. "Zamanında teslim" kartı yeşil olmalı ve durum çubuğunda alarm simgesi görünmeli.
2. **Kilitli ekranda bildirim:** Ekranı kilitle, 20+ dk bekle. Bir vakit bildirimi saniye düzeyinde vaktinde gelmeli. İzni kapatıp aynı testi tekrarla, farkı kaydet.
3. **Ezan:** "Ezan okunsun" seç, öğle/ikindi/akşam/yatsı seçili olsun.
   - Ekran kilitliyken ezan vaktinde başlamalı.
   - "Ezanı durdur" çalışmalı.
   - Ezandan sonra bildirim alanında sessiz "vakti girdi" kaydı kalmalı.
4. **Ezan çalamazsa:** Telefonu titreşime al; vakitte ezan çalmamalı, sesli/titreşimli "vakti girdi — Telefon sessiz, titreşimde…" bildirimi gelmeli ve "Son ezan" satırında aynı neden yazmalı. "Sessiz moddayken de oku" açıkken aynı testte ezan alarm sesiyle okunmalı. Medya sesi 0 iken ezan **okunmalı** (alarm sesi kullanılır); görüşme sırasında okunmamalı.

## 4.1 — "Ezan açık ama sadece bildirim geldi" düzeltmesi

Ezan, sessizce bildirime düşen beş yoldan geçiyordu ve "Ezanı test et" bu kontrollerin hiçbirini yapmıyordu. Bu yüzden test başarılıyken gerçek vakitte yalnızca bildirim gelebiliyordu.

| Yol | Önce | Şimdi |
|---|---|---|
| Medya sesi 0 | Bildirime düşüyordu | Ezan **alarm** ses akışında; medya sesi önemsiz |
| Sessiz/titreşim/Rahatsız Etmeyin | Her zaman bildirim | Varsayılan bildirim; "Sessiz moddayken de oku" ile ezan. Tam sessizlikte her zaman bildirim |
| Ses odağı alınamadı | Bildirime düşüyordu | Yalnız telefon görüşmesinde bildirim; diğer durumlarda ezan okunur, müzik ezandan sonra devam eder (geçici odak) |
| Vakitten birkaç saniye önce eşitleme | Tüm ezan planı reddediliyor, hepsi bildirime düşüyordu | Yaklaşan vakit atlanır, plan kurulur |
| Alıcıdan servise geçiş | Cihaz arada uyuyabilirdi | 20 sn'lik uyandırma kilidi |

- **Test = gerçek yol:** Test aynı ses kontrollerinden ve aynı AlarmManager API'sinden (`setAlarmClock`) geçer. Okunamazsa nedeni bildirimde yazar.
- **Görünür sonuç:** Her ezan ya da test sonucu (okundu, okunuyor, durduruldu ya da neden) native tarafta kaydedilir. "Ezan durumu" kartı sıradaki ezanı, son sonucu ve gerekiyorsa pil kısıtlaması uyarısını gösterir.
- **Yedek bildirimler nedeni söyler:** Native yedek bildirim kapalı görünümde nedeni gösterir. Ezan kurulamadıysa Expo bildirimi "Ezanın okunması için uygulamayı aç" der.
5. **İmsak:** Ezan seçiliyken imsakta bildirim gelmeli, ezan çalmamalı.
6. **Kesinti:** Ezan sırasında bir navigasyon anonsu ya da kısa ses çal; ezan durup devam etmeli.
7. **Sistem olayları:** Yeniden başlatma, saat dilimi değişimi ve ilçe değişiminden sonra alarmlar yeniden kurulmalı; eski ilçenin vakitleri gelmemeli.
8. **Simge:** Bildirim simgesi amblem silueti, rengi marka mavisi olmalı.
