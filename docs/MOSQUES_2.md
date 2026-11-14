# Camideyiz Biz — Camiler (Ücretsiz Google Haritalar yönlendirmesi)

## Ürün kararı (14 Kasım 2026)
Camiler sekmesi, Camideyiz Biz içinde harita, cami verisi, fotoğraf kataloğu veya sosyal liste **sunmaz**.
Premium görünümlü bir keşif/arama ekranıdır. Kullanıcı **Haritada Ara** düğmesine basınca
Google Maps uygulaması (kurulu değilse cihaz tarayıcısı) bir cami kategori aramasıyla açılır.

Google'ın ücretsiz, anahtarsız **Maps URLs** arayüzü kullanılır:
`https://www.google.com/maps/search/?api=1&query=...`

- Bölge alanı boş: `yakınımdaki camiler`; Google Maps cihazın kendi konum izinlerine
  göre sonuçları göstermeye çalışır. Google'ın seçtiği konum ve sonuçlar kontrolümüzde değildir.
- Bölge alanı dolu: `camiler <girilen il, ilçe veya semt>`; kullanıcı Türkiye'nin istediği
  bölgesini yazabilir veya hızlı şehir seçeneğine basabilir.
- Harici Google Maps üzerinde camiler, fotoğraflar, kullanıcı yorumları, yol tarifleri gibi
  Google'ın kendi işlevleri bulunabilir.
- Konum izni **Camiler için** istenmez. GPS, sonuç konumu ve yol tarifi Google Maps'in sorumluluğundadır.
- İnternet gerekebilir. Harita açılmazsa kullanıcıya hata gösterilir.
- Android ve iOS aynı HTTPS URL'sini kullanır; native Google Maps SDK entegrasyonu yoktur.
- Uygulama içinde Google Places araması, server proxy, OpenStreetMap sorgusu, harita marker'ları
  veya yerel cami fotoğraf/veri cache'i **yoktur**.
- Bu akış için Google Cloud, API anahtarı, kredi kartı, Places API veya Maps SDK ödeme hesabı **gerekmez**.
- Uygulama geliştirme/dağıtım, Apple/Google mağaza üyelikleri ve genel hosting gibi bağımsız giderler kapsam dışıdır.

## Uygulanan görünüm
Mevcut tema token'ları, Atmosphere arka planı, MosqueLandscape ve MosqueCrest vektörleri
ile responsive, açık/koyu temalı keşif ekranı. Erişilebilir düğme/konum girişi,
klavye "Ara", hızlı bölge seçimi, "Haritada Ara" CTA'sı, bilgilendirme ve hata durumu.

## Çalıştırma
PowerShell:
```powershell
cd C:\active_projects\camideyiz-biz
git fetch origin
git switch feat/mosques-2-premium-explore
git pull --ff-only origin feat/mosques-2-premium-explore
npm install
npm run mobile
```

Herhangi bir `GOOGLE_PLACES_API_KEY`, `GOOGLE_MAPS_ANDROID_API_KEY`,
`GOOGLE_MAPS_IOS_API_KEY`, `EXPO_PUBLIC_MOSQUE_API_URL` veya yeni backend gerekmiyor.
Diyanet namaz vakitleri için ayrı ve onay bekleyen resmî API altyapısı korunur.

## QA kabul kriterleri
- Android/iOS: Google Maps kuruluysa uygulamada, değilse tarayıcıda arama açılıyor
- Bölge boşken "yakınımdaki camiler" sorgusu; doluyken örn. "camiler Üsküdar, İstanbul"
- Hızlı şehir seçimi ve metin temizleme, Türkçe karakterli URL encode
- Kullanıcı Camiler'e girer girmez harici servis çağrısı yok; yalnızca düğme tıklamasıyla Maps açılır
- Sürüklenebilir native harita / işaretçi / ağır Overpass JSON olmadığından eski donma tetikleyicileri yok
- Hata durumunda kullanıcıya açıklama; 320dp+, büyük metin, açık/koyu tema görsel testi
- Diyanet veri akışı, Kıble izni ve diğer sekmeler etkilenmiyor

## Sınır
Bu sürümde **Camideyiz Biz içinde** cami fotoğrafları, favoriler, liste veya yol tarifi YOK.
Bunlar Google Haritalar'da açıldıktan sonra Google tarafından sunulan işlevlerdir.
Yayın öncesi gerçek cihazda Android/iOS URL yönlendirme ve görsel QA gerekir.

Kaynak: https://developers.google.com/maps/documentation/urls/get-started
