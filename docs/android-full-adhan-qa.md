# Android tam ezan alarmı — QA ve sınırlar

## Kullanıcı akışı

1. Android standalone APK kur (Expo Go'da native bridge yok).
2. **Widget ve Bildirimler → Namaz Vakti Hatırlatmaları** bölümünü aç.
3. Hatırlatmaları etkinleştir ve bildirim izni ver.
4. **Vakit geldiğinde → Tam ezan** seç.
5. Android **Alarmlar ve hatırlatıcılar** özel iznini etkinleştir; geri dön.
6. “Kesin alarm izni açık” durumunu gör; “Vakitleri eşitle” ile doğrula.
7. **Ezanı test et** ve telefonu kilitle. Yaklaşık 10 saniye sonra sistem ekranındaki durdurma kontrolleriyle birlikte paket içindeki MP3'ün baştan çalmasını bekle.

## Cihaz test matrisi (yayın öncesi zorunlu)

- [ ] Ekran açık, uygulama açık: test ezanı kendi kendine başlıyor.
- [ ] Ekran kilitli, 10 saniyelik test: ezan başlıyor (uygulamaya dokunmadan).
- [ ] Uygulama arka planda, ekran kilitli, gerçek namaz vakti: ses başlıyor.
- [ ] 2+ saat Doze / pil optimizasyonu sonrası gerçek vakit: teslim saatini kaydet.
- [ ] Zamanı veya saat dilimini değiştirince alarmlar yeniden planlanıyor.
- [ ] Telefonu yeniden başlatınca gelecekteki alarmlar yeniden kuruluyor.
- [ ] İl/ilçe değiştirince eski konum için kalan ezan alarmları kaldırılıyor.
- [ ] Hatırlatmaları veya Tam ezan modunu kapatınca sonraki yerel ezan planı kaldırılıyor.
- [ ] Güneş doğuşunda / erken hatırlatmada tam ezan **başlamıyor**.
- [ ] Medya ses düzeyi 0 iken sessiz kalıyor; DND sistem kuralları ihlal edilmiyor.
- [ ] Ezan çalarken **Ezanı durdur** işlemi sesi kesiyor ve servisi kapatıyor.
- [ ] Arka arkaya gönderilen senkronizasyonlar duplicate alarm üretmiyor.
- [ ] Android 14/15/16'da özel kesin alarm izni reddedilirse kullanıcıya açık uyarı görünüyor, asla “ezan çalışıyor” iddiası gösterilmiyor.
- [ ] Sadece normal bildirim veya sessiz modda native servis başlatılmıyor.
- [ ] Expo Go'da native ezan seçeneği sunulmuyor.
- [ ] iOS'ta “tam ezan otomatik çalar” seçeneği sunulmuyor.

## Mimari

- **Kaynak:** Yalnızca uygulama tarafından doğrulanmış yayımlanmış ilçe namaz vakitleri.
- **Plan:** En fazla 7 günlük, yalnızca atTime/imsak, öğle, ikindi, akşam, yatsı.
- **Alarm:** Android \`setExactAndAllowWhileIdle\`; Android 12+ için kullanıcı onaylı \`SCHEDULE_EXACT_ALARM\`.
- **Ses:** Android foreground media playback servisi, uygulamaya gömülü user-supplied SHA-verified MP3.
- **Denetim:** Android, çalma esnasında durdurma aksiyonu olan bir servis bildirimi göstermek zorundadır. Bu olağan bildirim zili değildir.
- **İzin yoksa:** Tam sesli alarm kurulmaz; hatırlatma normal sistem sesi olan OS bildirimi olarak kalır, kullanıcıya açık eksiklik gösterilir.
- **İleri hatırlatmalar:** 5–60 dk erken bildirimler mevcut sistemle çalışır; tam ezan yalnızca vakit girişinde başlar.
- **iOS:** Standart özel bildirim sesleri 30 saniye ile sınırlıdır; tam ezan için telefon kilitliyken otomatik medya oynatma garanti edilemez.

## Gerçek sınırlamalar

Özel alarm izni bile tüm OEM pil kısıtlamalarını, zorla durdurma davranışını veya kullanıcı ses ayarlarını ortadan kaldırmaz. Kullanıcı uygulamayı sistem ayarlarından **zorla durdurursa** Android planlanmış alarmları uygulama tekrar açılıncaya kadar engelleyebilir. Google Play'e yayımlamadan önce \`SCHEDULE_EXACT_ALARM\` kullanımının Play politikası ve açıklaması doğrulanmalıdır. \`USE_EXACT_ALARM\` talep edilmez.

Resmî belgeler:
- https://developer.android.com/develop/background-work/services/alarms
- https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- https://developer.apple.com/documentation/usernotifications/unnotificationsound
