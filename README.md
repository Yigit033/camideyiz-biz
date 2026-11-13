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
