# Camideyiz Biz — Diyanet Awqat Salah entegrasyonu

## Gerçek durum
Bu PR içinde yetkilendirilmiş Diyanet servisiyle konuşan ayrı \`apps/api\` sunucusu ve Expo mobil istemcisi hazırlanmıştır. **Gerçek bir Diyanet API hesabı, Supabase projesi ve yayındaki servis URL'si henüz tanımlı değilse canlı veri ÇALIŞMAZ.** Örnek saatler gerçekmiş gibi gösterilmez. Herhangi bir üretim migration/deploy yapılmamıştır.

### Resmî kaynaklar (14.11.2026)
- API ana sayfa: https://awqatsalah.diyanet.gov.tr/
- Etkileşimli dokümantasyon: https://awqatsalah.diyanet.gov.tr/scalar/
- Başvuru formu: https://awqatsalah.diyanet.gov.tr/files/b8ed95e5-95fc-4635-9c40-406caeeddc1d.pdf
- Kullanım kılavuzu: https://awqatsalah.diyanet.gov.tr/files/56d83ac4-f7f5-4f6e-9b9e-b1ffeebf1b6a.pdf
- Form okunaklı doldurulup imzalandıktan sonra kurumun belirttiği adrese gönderilir: dinisleriyk@diyanet.gov.tr.
- Güncel resmî API ana sayfası: access token 45 dk, refresh 7 gün/rotation. Kota işleme ve parametreye göre çok düşük (genelde 10), DateRange şehir bazlı 10 istek/ay.

## Mimari
\`\`\`
Expo iOS/Android (only EXPO_PUBLIC_PRAYER_API_URL)
    -> apps/api (public read endpoints, HTTPS)
    -> Supabase Postgres cached days/states/cities (server-role only)
                               ^
          POST /api/internal/sync (secret bearer)
                               |
              Diyanet Awqat Salah JWT/refresh (server ONLY)
\`\`\`

Telefon Diyanet'e doğrudan bağlanmaz. Kullanıcı il ve ilçe seçer (il=State, ilçe=City).
Aynı ilçenin gün boyu tüm kullanıcı istekleri kalıcı veritabanı önbelleğinden döner; Diyanet kotası kullanıcı sayısıyla orantılı değildir.
Saatler altı anahtarla doğrulanır: fajr, sunrise, dhuhr, asr, maghrib, isha.
Türkiye'nin ilk sürümü için \`Europe/Istanbul\` sabittir. Dünya genelinde lokasyon/zaman dilimi eşlemesi yapılana dek diğer ülkeler engellenir.
Gece yarısında bugünkü Yatsı + ertesi günkü İmsak ve bugünkü İmsak öncesi bir önceki günkü Yatsı gerçek takvimden hesaplanır.
Yeterli doğrulanmış tarih yoksa mobil örnek saat göstermez.

## İlk kurulum — Production'a uygulamadan önce kullanıcı onayı gerekli
1. Diyanet Awqat Salah başvurusunu yapın ve size atanmış e-posta/şifreyi temin edin.
2. Supabase projesi oluşturup \`infra/supabase/migrations/202611140001_diyanet_prayer_cache.sql\` SQL migration'ını **gözden geçirdikten sonra** çalıştırın.
3. Ayrı bir özel/prod Next.js servis olarak \`apps/api\` dizinini yayımlayın; aşağıdaki gizli sunucu değişkenlerini yalnızca bu deployment'ta tutun:
   - \`DIYANET_EMAIL\`, \`DIYANET_PASSWORD\`
   - \`SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\` (server-only legacy service-role JWT)
   - \`PRAYER_SYNC_SECRET\` (en az 32 rastgele karakter)
4. İzinli yönetici bilgisayarından \`POST https://YOUR-API/api/internal/sync\` Bearer \`PRAYER_SYNC_SECRET\` ile şu sıralamayı kullanın:
   - \`{"mode":"states"}\` ülke kodunu doğrulayıp Türkiye illerini kaydeder.
   - \`{"mode":"cities","stateId":<Diyanet il ID>}\` tek ilin ilçelerini çeker.
   - \`{"mode":"monthly","cityId":<Diyanet ilçe ID>}\` aylık takvimi kaydeder.
   - \`{"mode":"weekly","cityId":<Diyanet ilçe ID>}\` ertesi güne/kaydırmalı haftaya yönelik sınır kayıtlarını tamamlar.
   İller/ilçeler listesinde Diyanet'ten gelen gerçek ID'leri kullanın, internetten tahmini ID girmeyin.
5. \`GET /api/v1/states\`, \`/api/v1/cities?stateId=...\`, \`/api/v1/prayer-times?cityId=...&date=YYYY-MM-DD\` ile kaynak, tarih ve 3-gün formatını test edin.
6. \`apps/mobile/.env.local\` içerisine **yalnızca** \`EXPO_PUBLIC_PRAYER_API_URL=https://your-api\` yazın ve \`npx expo start --clear\` ile yeniden başlatın.
7. Yetkili POST `/api/internal/targets` isteğine `{"cityId":<onaylanmış Diyanet ilçe ID>,"enabled":true}` gövdesi gönderin. Böylece ilçe günlük otomatik güncelleme listesine eklenir. `apps/api/vercel.json` günde bir kez (01:00 UTC, Türkiye'de 04:00 civarı) `/api/internal/cron` tetikler; bu uç noktaya Vercel tarafından yalnızca `Authorization: Bearer CRON_SECRET` ile erişilir. Her çalışmada en fazla 6 **önceden onaylanmış** ilçe işlenir; daha büyük katalog için ayrı kuyruğa/işleyiciye geçilmelidir.
8. İlk açılışta il ve ilçe seçin. Kaynak veri yoksa açıklamalı boş durum çıkar; demo namaz saati çıkmaz.
9. Diyanet kotasını ve sözleşme koşullarını izleyin. Otomatik cron yalnızca ilgili Vercel uygulaması production'a **onaylı bir deployment** yapıldığında çalışır; şu an aktif değildir. Mobil kullanıcıların canlı Diyanet API çağrısı başlatmasına izin VERMEYİN.

## Tasarım ve güvenlik tercihleri
- Production kişisel verilere erişim yok: seçili ilçe sadece cihazda AsyncStorage'a kaydedilir.
- Public mobil API yalnızca önbellek OKUR. Yazma işlemleri Bearer sync secret + service-role yetkisine bağlıdır.
- Supabase RLS açık, public/anon/authorized doğrudan tablo erişimi yok.
- Durable sync lease/interval/automatic 30dk failure backoff ile kota tüketimi frenlenir.
- API şifresi/tokens/log içerikleri asla \`EXPO_PUBLIC\` değişkeni olmamalı ve GitHub'a gönderilmemeli.
- İnternet kesintisinde yalnızca tarih, kimlik ve orijinal fetchedAt doğrulaması geçen daha önce indirilmiş takvim kullanılır ve “Çevrimdışı” olarak işaretlenir.
- Şüpheli, tarihi yanlış, eksik veya tutarsız içerik **fail closed** davranışıyla reddedilir.
- Örnek kerahat aralıkları gerçek Diyanet verisi gelince **aktif olmaz**. Doğrulanmış fıkhî yöntem, özel istisnalar ve dinî uzman incelemesi ayrıca gereklidir.

## Önemli eksikler
- Gerçek API hesabı, Supabase anahtarları, canlı Next deployment ve gerçek telefon testi yok.
- Diyanet ile gerçek uçtan uca bağlantı ancak yetkilendirme yapıldıktan sonra doğrulanabilir.
- İlk sürümde il/ilçe manuel seçilir; GPS koordinatlarından Diyanet ilçe ID eşlemesi yapılmaz.
- Onaylı ilçe için Vercel günlük cron iskeleti eklendi ancak canlıya alınmadı. Public talep kuyruğu, kotaya göre ölçeklenebilir job runner, API erişim izni, gerçek canlı veri testleri, widget ve ezan bildirimi sonraki aşamadır.
