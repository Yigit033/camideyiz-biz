# Bildirimler 3.0 — Ezan Vakti ve Yönetici Duyuruları

**Hazırlık: 15 Kasım 2026.**
Bu çalışma mevcut `feat/widgets-and-prayer-alerts-2` üzerinde. Yeni branch,
`main` merge, production deploy, Supabase migration çalıştırma,
gerçek kullanıcıya push gönderimi **YAPILMADI**.

## 1. Gerçek mevcut durum

Namaz bildirimleri daha önce de `expo-notifications` ile Android/iOS'a
**cihaz üstünde** `Date` tetikleyicileriyle planlanıyordu.

- Genel izin / bildirim anahtarı varsayılan **kapalıdır**.
- İmsak, öğle, ikindi, akşam ve yatsı için `atTime=true` varsayılan
  kural, kullanıcı etkinleştirdikten sonra çalışır.
- Güneş doğuşu **ezan değildir**; otomatik beş vakit seçimine alınmaz.
- Her vakit için 0, 5, 10, 15, 30, 45, 60 dk öncesi uyarı seçenekleri.
- Ses: `default` sistem sesi veya `silent`; gerçek ezan kaydı yoktur.
- Resmî kaynaktan doğrulanmış günler / İdamedya'da yayımlanmış günler,
  maksimum **7 gün, 60 yerel talep**. Takvim uydurulmaz.
- Yanlış ilçe bildirimleri yeni bölge değişiminde temizlenir.
- Sonraki uyarı ve plan sayısı kullanıcıya görünür.
- Android WorkManager'ın **uygun görüp çalıştırdığı** widget/background
  görevi, izin verilmişse doğrulanmış takvimle namaz bildirimlerini
  yeniden planlamayı da dener. Hiçbir zaman arka planda izin istemez.
- Android 12+ exact alarm izni kullanıcı/mağaza kısıtlarına bağlıdır;
  mevcut tetikleyiciler `bestEffort`tır, kesin zaman garantisi yoktur.
  `USE_EXACT_ALARM` veya `SCHEDULE_EXACT_ALARM` sessizce eklenmedi.

**Gerçek ezan seslendirmesi** yalnızca izin/lisansı netleşmiş bir ses
asset'i ve yeni bildirim kanalı ile ayrıca eklenebilir. Telefonu sessize
alma ve odak modunun bypass edileceği vaat edilmez.

## 2. Ürün sahibinin özel duyuruları: ayrı abonelik ve sunucu

Ezan bildirimlerinden **tamamen bağımsız**, opt-in `Özel Duyurular`
anahtarı eklendi. Kullanıcı izin verene ve sunucu yapılandırılana
kadar push token alınmaz.

- Anonim cihaz kaydı: Expo token, cihazda üretilen UUID ve SecureStore'da
  tutulan 256-bit rastgele abonelik sırrıyla kontrol edilir.
- Tek cihaz kayıt sırrını bilen kullanıcı iptal/yenileme yapabilir.
  Yönetici veya diğer kullanıcı token listesine erişemez.
  RLS açık, anonim tablo SELECT/UPDATE izinleri kapalıdır.
- Vercel'in güvenilir istemci-IP başlığı yalnızca HMAC hash olarak
  saatlik kayıt limiti için saklanır; ham IP kaydedilmez.
- Duyuru onayı iki adımdır:
  **Taslak oluştur → yönetici onayı → zamanlanan gönderim.**
  Varsayılan veya programatik otomatik onay YOK.
- Tarih aralığı: +5 dakika ile +60 gün, **açık timezone** gereklidir:
  `2026-11-20T18:00:00+03:00`.
- Duyurular, güvenilir cron tarafından Süresi Gelince
  `rpc/cb_push_materialize_due` ile tüm o anki opt-in cihazlara
  iş kuyruğu olarak hazırlanır. `SKIP LOCKED`/lease/batch(80)
  sayesinde aynı anda iki süreç de çalışsa görevler yarışmadan
  işlenir. Sunucu çökmesinde yeniden deneme nedeniyle bazı cihazlara
  **nadiren mükerrer push** gidebilir; exactly-once garantisi yoktur.
- `Expo Push Service` mesajı FCM/APNs'e iletir.
  Makbuz polling `cb_push_claim_receipts` ve
  `cb_push_finish_receipts` ile gönderim kabul/ret durumunu kontrol
  eder. `DeviceNotRegistered` tokenları iptal edilir.
  **Makbuz “bildirimi gördü” veya “okudu” anlamına gelmez.**
- Kullanıcı vazgeçerse abonelik iptali hemen cihazda saklanır;
  internet yoksa sunucu iptali sonraki bağlantıda denenir.
  Önceden kabul edilmiş gönderimler geri alınamaz. Sunucuda
  bekleyen gönderimler aboneliği iptal edilmiş cihazlara gönderilmez.
- Özel duyuru bildirimi tıklandığında `/companion` bildirim
  geçmişi açılır. Yalnızca uygulamanın gerçekten gözlemlediği OS
  bildirimleri yerel geçmişte yer alır.
- Anonim cihaz kaydına konum, ilçe, fotoğraf, galeri metni,
  iletişim rehberi veya hesap bilgisi **eklenmez**.

## 3. Kurulum — henüz canlı değil

**Önemli:** Mevcut `apps/admin` yalnızca güvenliksiz tasarım
prototipidir. Kimlik doğrulama tamamlanmadan o panelden tüm
kullanıcılara push gönderebilen herkese açık arayüz eklenmedi.

### A. Supabase (sadece staging ilk aşamada)

Uygulanacak ve önce **staging** üzerinde test edilecek SQL:

`infra/supabase/migrations/202611150001_notifications_announcements.sql`

Tablolar:
`cb_push_devices`, `cb_push_registration_limits`,
`cb_announcements`, `cb_announcement_deliveries`.
RLS açık; service-role tek yetkili. SQL RPC fonksiyonları
atomik rate-limit, taslak/iş oluşturma, lease, sonuç ve
makbuz kayıt işlemlerini yürütür. **Production migration
kullanıcı onayı olmadan çalıştırılmayacak.**

### B. Expo/FCM/APNs ve Vercel API

- Gerçek EAS `projectId` oluştur ve Android için Firebase FCM
  v1 service account / iOS için APNs anahtarlarını Expo/EAS
  credential sisteminde yapılandır.
- `apps/api/.env.example` şablonundaki `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (en az 48 karakter),
  `CB_ANNOUNCEMENT_ADMIN_SECRET` (en az 48),
  `CB_PUSH_IP_HASH_SECRET` (en az 32), opsiyonel
  `CB_EXPO_ACCESS_TOKEN` **yalnızca Vercel API sunucusunda**
  tutulmalı. **EXPO_PUBLIC** içine gizli anahtar KONMAMALI.
- Gönderime ve mobil kayıt almaya hazır olunca
  `CB_ANNOUNCEMENTS_ENABLED=true`. Öncesinde hem API
  hem de uygulama **fail-closed** kalır.
- Mobil build için herkese açık değişkenler:
  `EXPO_PUBLIC_CB_ANNOUNCEMENTS_API_URL=https://api.example.com`,
  `EXPO_PUBLIC_CB_EAS_PROJECT_ID=<gerçek-project-uuid>`.
  Uygulama, sunucu sağlık kontrolünden geçmedikçe kullanıcıdan
  duyuru izni istemez.
- `GET /api/internal/announcements/dispatch` uç noktasına
  `Authorization: Bearer <CRON_SECRET>` başlığıyla **güvenilir,
  1–5 dakika aralıklı bir zamanlayıcı** bağlanmalı. Mevcut
  `vercel.json` günde bir kez Diyanet sync'idir; bu çağrı
  onunla aynı şey değildir. Vercel Hobby planı dakikada cron'a
  izin vermeyebilir; plan limitini doğrula veya harici güvenli
  zamanlayıcı kullan. Cron olmadan duyurular **gönderilmez**.
- Mesajın planlanan dakikada cihazda görünmesi, sunucu
  aralığı + Expo/APNs/FCM + işletim sistemi kısıtları nedeniyle
  garantilenemez.

### C. Yalnızca sahibi tarafından yönetme (güvenli CLI)

`CB_ANNOUNCEMENTS_API_URL` (HTTPS sunucu origin) ve
`CB_ANNOUNCEMENT_ADMIN_SECRET` **yerel ve gizli**
ortam değişkenleri ayarlandıktan sonra:

```powershell
# Duyuru taslağı kaydet; gönderim yoktur.
powershell -ExecutionPolicy Bypass -File .\scripts\admin-announcements.ps1 `
  -Action draft -Title "Hayırlı Cumalar" `
  -Body "Hayırlı ve bereketli cumalar dileriz." `
  -ScheduledAt "2026-11-20T18:00:00+03:00"

# Taslakları listele. Dönen 'id' değerini kopyala.
powershell -ExecutionPolicy Bypass -File .\scripts\admin-announcements.ps1 -Action list

# Yalnızca açıkça onaylanan taslak sıraya girer:
powershell -ExecutionPolicy Bypass -File .\scripts\admin-announcements.ps1 `
  -Action approve -Id "<returned-uuid>"

# Henüz işleme alınmamış taslak/zamanlamayı iptal et:
powershell -ExecutionPolicy Bypass -File .\scripts\admin-announcements.ps1 `
  -Action cancel -Id "<returned-uuid>"
```

Tüm duyuru yönetimi server-side admin Bearer secret kontrolündedir.
Uygulamadan, web tarayıcısındaki herkese açık admin prototipinden veya
GitHub Secrets'ı kullanıcıya göstererek duyuru gönderilmez.

## 4. Kabul testleri / production release engelleri

1. Bildirimler ilk açılışta OFF ve gerçek ezan kaydı yok.
   İzin reddedilince sistem bildirimleri planlanmasın.
2. Beş vakit kısayolu doğru çalışsın, Güneş doğuşu yanlışlıkla ezan
   listesine girmesin, önceki 5/10/15 dk hatırlatmaları korunabilsin.
3. Android gerçek cihazda bir vakit sınırı ve birkaç farklı ilçe
   ile **ekran kilitliyken** yerel `bestEffort` hatırlatması test edilsin.
4. WorkManager gerçekten yürürse onaylı takvimle yerel
   plan yeniden dolsun. Test cihazındaki son çalıştırma raporuyla
   doğrula; CI bu davranışın kanıtı değildir.
5. Staging Supabase migration ve RLS denetimi:
   `anon` tablo okuma/yazma yapamasın;
   service-role RPC'ler yalnızca backend'den çağrılsın.
6. Opt-in + token saklama, uygulama yeniden kurulumunda iOS
   Keychain taşınması ve çevrimdışı opt-out tekrar deneme.
7. Onaysız taslak **asla** gönderilmesin; yalnızca onaylı
   ve zamanı gelen duyurular gönderilsin.
8. Tekrarlanan cron ve kesilen ağ senaryolarında idempotent
   claim/lease ve retry üst sınırı test edilsin.
9. Expo kabul/ticket makbuzları, yanlış tokenı çıkarma ve
   bildirim iptal/onay durumu ile veri tabanı tutarlılığı doğrulansın.
10. Gerçek APK'da FCM/Google Play, iPhone'da APNs
    credential ve push teslimat testi.
11. Admin endpoint için WAF/rate-limit, yetki yenileme, token/kişi
    verisi saklama ve silme politikası yayın öncesi doğrulansın.
12. Canlı kullanıcıları istem dışı rahatsız etmemek için
    duyuru frekansının ürün politikasında sınırlandırılması gerekir.
    Önerilen başlangıç: haftada en fazla 1–2 duyuru.

**Güvenilirlik değerlendirmesi:** CI yalnızca kod/Expo paketleme
kontrolüdür. SQL migration, gerçek Expo provider teslimatı, Vercel
cron ve fiziksel cihaz QA **bu çalışma kapsamında canlı olarak
çalıştırılmadı**. Bu nedenle duyuru yayını “production-ready”
olarak ilan edilemez. Ezan için de tam dakika garantisi verilmez.
