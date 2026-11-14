# Camideyiz Biz

iOS ve Android için namaz vakitleri ve günlük ibadet rehberi. **Expo SDK 58 / React Native / TypeScript** mobil uygulaması, **Next.js** yönetim paneli prototipi ve ortak TypeScript çekirdeği.

> **ÖNEMLİ: yalnızca prototip.** Namaz vakitleri örnek veridir; gerçek ibadet vakti olarak kullanılmamalıdır. Resmî veri kaynağı, kerahet aralıkları, bildirimler ve widget'lar henüz uygulanmadı.

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

**Güvenlik:** API secret değerlerini istemciye koymayın. Admin kimlik doğrulama, RBAC/RLS kurulmadan yönetim fonksiyonu açmayın. Diyanet veri kaynağı ve izinleri doğrulanmadan gerçek namaz vakti yayınlamayın. Mevcut demo verisi dinî referans yerine geçmez.

İlk sürüm gerçek cihazlarda veya CI bağımlılık kurulumunda henüz doğrulanmadı.

## Resmî Diyanet entegrasyonu

Yetkili sunucu, il/ilçe senkronizasyonu ve doğrulanmış üç günlük mobil takvim kurulum adımları: [docs/DIYANET_INTEGRATION.md](docs/DIYANET_INTEGRATION.md). Sunucu paketi `apps/api`, SQL migrations `infra/supabase/migrations/` altındadır. API hesabı/DB/URL yapılandırılmadan mobil örnek namaz vakti **göstermez**.

## Camiler 2.0

Google Maps + Google Places (New) ile kullanıcı kontrollü bölgesel cami araması, Google fotoğrafları, kaynaklı detaylar ve Place ID tabanlı favoriler için [Camiler 2.1 teknik kılavuzu](docs/MOSQUES_2.md).
