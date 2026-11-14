# Camideyiz Biz — Camiler 2.0

## Durum ve kapsam
Bu geliştirme, Expo SDK 58 ve React Native için gerçek harita içeren cami keşif deneyimidir. Namaz vakitleri/Diyanet koduna dokunmaz.

### Uygulanan özellikler
- react-native-maps 1.29.11: Android Google Maps, iOS Apple Maps, Expo Go geliştirme testi.
- Gerçek OpenStreetMap node / way / relation cami verisi, yakınında ara (3.5 km), isim/adres araması, liste-harita anahtarı ve harita üzerinde dokunulabilir pinler.
- 'Bu bölgede ara' yalnızca kullanıcı haritayı taşıyıp düğmeye bastığında sorgu gönderir. Konum izni yalnızca istenince alınır; reddedilirse İstanbul başlangıç haritası manuel taşınabilir.
- Tümü, favoriler, fotoğraf etiketi, erişilebilirlik filtreleri. Kaynakta alan yoksa tesis/erişilebilirlik bilgisi uydurulmaz.
- Cami detay sayfası: kaynakla eşlenen lisanslı Wikimedia Commons fotoğrafı varsa gösterim, yoksa özel vektör amblem; koordinat, varsa adres/telefon/site/erişilebilirlik, paylaşım, harici harita yol tarifi, OSM kaynak kaydı.
- Yerel favoriler (AsyncStorage), konum bazlı 12 saatlik önbellek ve azami 7 günlük açıkça belirtilmiş çevrimdışı OSM POI bilgisi.
- OSM/ODbL atfı. İsim veya verilerin resmen doğrulandığı iddia edilmez.
- apps/api/src/app/api/v1/mosques/route.ts: production endpoint iskeleti, giriş doğrulama, sınırlı yarıçap, 12 saat isolate-içi cache ve basit eşzamanlı istek kontrolü.

### Bilgisayarda test
PowerShell:
cd C:\active_projects\camideyiz-biz
git fetch origin
git switch --track origin/feat/mosques-2-premium-explore
npm install
cd apps\mobile
npx expo start --clear

Expo Go geliştirme sürümünde EXPO_PUBLIC_MOSQUE_API_URL boşken kamuya açık Overpass servisine sınırlı sorgu yapılır. Bu ücretsiz servis geliştirme testi içindir, kalıcı yüksek trafikli backend değildir. İstekler 429 veya 503 döndüğünde uygulama yeniden deneme ve önbellek kullanma seçeneklerini gösterir.

### Yayın öncesi zorunlu
1. Production için kendi veya sözleşmeli, kota güvenceli cami POI sunucusu sağlayın. Public Overpass sunucuları çok kullanıcıya hizmet vermek üzere tasarlanmamıştır.
2. Özel API HTTPS kökünü mobil ortamda EXPO_PUBLIC_MOSQUE_API_URL ile tanımlayın. Namaz vakitleri API'si ile aynı apps/api deployment'ı kullanılabilir; Diyanet giriş bilgileri Camiler için gerekmez.
3. Android bağımsız build için Google Maps API anahtarını EAS/CI secret GOOGLE_MAPS_ANDROID_API_KEY altında kısıtlayın. app.config.js bu anahtarı yalnızca native build'e geçirir. Expo Go için ayrıca anahtar gerekmez.
4. iOS Apple Maps'i ve Android Google Maps'i gerçek cihazlarda doğrulayın; GPS reddi, farklı ekranlar, koyu/açık tema, erişilebilirlik, 150 marker ve ağ kesintisini sınayın.
5. Fotoğraf lisansı zorunludur. Wikimedia Commons imageinfo metadata'sı CC/PD lisans ve eser sahibi sunmuyorsa görsel yerleştirilmez. İçerik telif denetimi sürdürülmelidir.
6. OSM noktaları topluluk verisidir; adresler ve camilerin varlığı değişebilir. Üretim kalitesi için veri doğrulama, kayıt bildirme/düzeltme ve mümkünse resmî cami listeleriyle karşılaştırma gerekir.
7. Harici yol tarifi telefon harita uygulamasında açılır; uygulama içinde rota hesaplama veya trafik tahmini yapılmaz.
8. Favoriler yalnızca mevcut cihazdadır, hesaplar arası sync yoktur.

### Kaynaklar
- https://docs.expo.dev/versions/v58.0.0/sdk/map-view/
- https://wiki.openstreetmap.org/wiki/Overpass_API
- https://www.openstreetmap.org/copyright
- https://www.mediawiki.org/wiki/API:Imageinfo

### Özellik dışı
Namaz vakitlerinde yalnızca resmî Diyanet API onayı beklenir; astronomik hesaplamaya geçilmez. Topluluk/Galeri ve Widget projeleri ayrı geliştirme aşamalarıdır.
