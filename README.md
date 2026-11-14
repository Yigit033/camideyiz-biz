# Camideyiz Biz

iOS ve Android için namaz vakitleri ve günlük ibadet rehberi. **Expo SDK 58 / React Native / TypeScript** mobil uygulaması, **Next.js** yönetim paneli prototipi ve ortak TypeScript çekirdeği.

> **Yayın öncesi sürüm:** Ana ekran, ücretsiz üçüncü taraf İdamedya takvim servisi üzerinden yayımlanmış vakitleri okuyabilir. Bu Diyanet'in resmî API'si değildir; kaynak uygulamada açıkça etiketlenir. Resmî API onayı ve cihaz testleri tamamlanmış değildir; native widget ve yerel bildirim modülleri geliştirme dalında test aşamasındadır.

## Kurulum

Node.js 22.13+ gerekir.

\`\`\`bash
npm install
npm run mobile
npm test
npm run typecheck
\`\`\`

Ek komutlar: \`npm run android\`, \`npm run ios\` (iOS için Mac/Xcode gerekir), \`npm run admin\` (yalnızca geliştirme prototipi).

## Proje

- \`apps/mobile\`: açık/koyu tema, sürüklenebilir namaz vakitleri çemberi, beş sekme ve kıble hesaplama prototipi.
- \`apps/admin\`: giriş ve veri kaydı olmayan statik yönetim paneli taslağı; deploy edilmemeli.
- \`packages/core\`: platform bağımsız namaz vakti ve kıble yardımcıları, testler.
- \`docs/\`: ürün, tasarım ve mimari kararları.

**Güvenlik:** API secret değerlerini istemciye koymayın. Admin kimlik doğrulama, RBAC/RLS kurulmadan yönetim fonksiyonu açmayın. Üçüncü taraf kaynak resmî Diyanet API olarak etiketlenmez; geçersiz tarihler/saatler canlı gösterilmez.

İlk sürüm gerçek cihazlarda veya CI bağımlılık kurulumunda henüz doğrulanmadı.

## Resmî Diyanet entegrasyonu

Yetkili sunucu, il/ilçe senkronizasyonu ve doğrulanmış üç günlük mobil takvim kurulum adımları: [docs/DIYANET_INTEGRATION.md](docs/DIYANET_INTEGRATION.md). Sunucu paketi `apps/api`, SQL migrations `infra/supabase/migrations/` altındadır. API hesabı/DB/URL yapılandırılmadan mobil uygulama ücretsiz üçüncü taraf takvim servisini deneyebilir; bağlantı başarısızsa **uydurma vakit göstermez**.

## Camiler — Ücretsiz Harita Araması

Ücretli SDK/Places/OSM backend bağımlılığı olmadan Google Haritalar uygulamasına geçiş. Ücretsiz, anahtarsız Maps URLs; bölge alanı ve tek dokunuşla harita araması: [Kurulum ve QA](docs/MOSQUES_2.md).

## Kıble 2.0

Altın/zümrüt referans tasarımından geliştirilmiş canlı gerçek kuzey pusulası, Kâbe yönü, sensör kalibrasyon rehberi ve harici harita bağlantısı: [Teknik notlar](docs/QIBLA_2_REFERENCE.md). Sensör doğruluğu için gerçek cihaz testi zorunludur.

## Ana Ekran — Ücretsiz Takvim Kaynağı

Orijinal namaz çemberi, günlük kartlar ve çevrimli vakit akışı; ücretsiz İdamedya servisinden alınan, Diyanet kaynaklı olduğu belirtilen takvim kayıtlarıyla görüntülenebilir. Resmî Diyanet API onayı beklerken ayrı sağlayıcı/adapör: [ücretsiz kaynak teknik kılavuzu](docs/FREE_CALENDAR.md).

## Kerahat 2.0 ve Günün Seçkisi 2.0

Yayımlanmış il/ilçe namaz vakitlerine dayalı üç yaklaşık kerahat bandı, manuel gösterim ayarları, kaynaklı açıklamalar; ayrıca 12 ayet ve 7 hadisten oluşan offline günlük seçki, favoriler ve paylaşım: [Teknik karar ve QA](docs/KERAHAT_AND_DAILY_WISDOM_2.md).

## Widget ve Bildirimler 2.0

Expo SDK 58 ile iOS/Android native namaz vakti widget'ları (2 boyut), 6 vakte özel cihaz içi hatırlatmalar, ses/sessiz kontrolü ve cihazda saklanan gözlenen bildirim geçmişi: [mimari, kurulum ve test koşulları](docs/WIDGETS_AND_NOTIFICATIONS_2.md). Expo Go gerçek ana ekran widget'larını **göstermez**; yeni native uygulama derlemesi ve cihaz QA şarttır.


## Windows'ta APK testi

Reanimated/CMake/Ninja uzun dosya yolu hatasını aşmak ve emülatör olmadan kendi Android telefonuna yüklenebilir release APK oluşturmayı denemek için [Windows native APK kılavuzu](docs/WINDOWS_ANDROID_APK.md) ve `scripts/build-android-windows.ps1` betiğini kullan. Betik ayrı `C:\\cb` checkout'unda çalışır; asıl proje dizinine dokunmaz. Android cihaz testi hâlâ tamamlanması gereken bir kalite kapısıdır.
