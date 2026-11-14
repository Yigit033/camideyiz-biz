# Camideyiz Biz — Release Readiness (14 Kasım 2026)

## 14 Kasım 2026 — Ücretsiz takvimli ana ekran

- [x] Ana ekranın bütünü Diyanet sunucusu eksik diye gizlenmiyor.
- [x] İdamedya (üçüncü taraf) il/ilçe/takvim JSON kaynağı eklendi; ücretsiz ve anahtarsız.
- [x] Yayımlanmış takvim verisi kullanılıyor; cihazda astronomik vakit hesabı yok.
- [x] Tarih/kimlik/saat doğrulaması, 55 dakika cache, kaynak etiketleri.
- [x] Kaynak yanıtı yoksa yanlış namaz saati üretmeyen tam tasarım.
- [x] İstanbul 14.11.2026 vakitleri resmi Diyanet web takvimiyle örnek karşılaştırmada eşleşti.
- [ ] Gerçek Android/iOS cihaz ve diğer il/ilçelerde veri/kullanım koşulları QA.
- [x] Kerahat 2.0 yaklaşık üç aralık için çember vurgusu, konuma bağlı saat, kişisel gösterim ayarı.
- [x] Günün Ayeti/Hadisi 2.0: 12+7 kaynaklı kısa alıntı, günlük döngü, yerel favori, paylaşım.
- [ ] Haftalık görünüm, çoklu konum, ezan bildirimleri, widget ve Galeri ürün özellikleri.

Ayrıntı: [FREE_CALENDAR.md](FREE_CALENDAR.md). Resmî Awqat Salah beklemeye devam ediyor.



## Özelliklerin güncel durumu
- **Ana ekran / namaz çemberi:** Expo React Native / TypeScript, açık/koyu tema, fiziksel çember etkileşimi ve zaman dilimi mantığı kodlandı. Gerçek cihaz UX/performans QA hâlâ gerekli.
- **Diyanet namaz vakitleri:** Resmî Awqat Salah API için sunucu, doğrulama, kota bilinçli senkronizasyon, il/ilçe seçimi ve üç günlük çevrimdışı takvim altyapısı kodlandı. **Resmî hesap onayı, veritabanı migration ve HTTPS yayına alma yok; resmî API aktif değil. Ancak ayrı ücretsiz üçüncü taraf takvim kaynağıyla doğrulanan vakitler artık ana ekranda görüntülenebilir.** Astronomik hesaplama fallback eklenmeyecek.
- **Camiler:** Ücretsiz Google Maps URL yönlendirmesi. Premium açık/koyu temalı arama ekranı, seçilen il/ilçe/semt veya yakınımdaki camiler araması, açılış hata yönetimi. **Yerel native harita, cami verisi, Google Places API, Google Maps SDK, OSM/Overpass endpoint, Google API anahtarı veya faturalandırma yok.** Fotoğraf, yorum, rota ve sonuçlar harici Google Haritalar tarafından sunulur.
- **Kıble:** Konum + true-north sensörüne dayalı temel ekran var. Gerçek cihaz doğrulama/kalibrasyon/premium tasarım bekliyor.
- **Galeri/Topluluk:** Henüz üretim kullanıcı içeriği ve moderasyon altyapısı yok.
- **Widget / bildirim / ezan:** Yayına hazır değil.
- **Yönetim paneli:** Yetkilendirme olmayan prototip, production'a deploy edilmemeli.

## Camiler kabul testi (bu branch)
- [x] Google Maps URLs anahtarsız, doğru encode edilen ve uzunluğu sınırlı arama URL'si
- [x] Ücretli Places/SDK/OSM arama dosyaları ve bağımlılıkları silindi
- [x] Camiler sekmesi otomatik konum izni veya dış veri fetch'i yapmıyor
- [x] Açık ve koyu tema için premium responsive keşif ekranı
- [ ] Android cihazda Google Maps uygulamasına veya tarayıcıya geçişi fiziksel olarak test et
- [ ] iPhone'da Google Maps uygulaması yüklü/yüklü değil senaryolarını test et
- [ ] 320dp telefon, büyük yazı ve ekran okuyucuyla UI QA yap
- [ ] Ağ yokken Linking hatası / tarayıcı davranışı test et

## Diğer yayın engelleri
- Resmî Diyanet API hesabı, yetkili veri kaynağına uçtan uca bağlantı, production secret'ları ve migration onayı
- Kesin kerahet yorumları için uzman incelemesi
- Bildirimler ve widget'ların gerçek vakitlerle takvimlendirilmesi
- Gerçek Android/iOS cihaz kalite ve performans testleri, store asset/privacy ve imzalı build'ler

## Branch ve güvenlik
- Camiler geliştirmeleri: `feat/mosques-2-premium-explore`, taslak PR #2, base `feat/mobile-foundation-prayer-wheel`.
- `main` merge, production deploy ve production migration yapılmadı.
- Google Cloud billing ve API key eklemek Camiler için GEREKMİYOR.
- Diyanet sistemine dokunulmadı; resmî erişim bekleniyor.

Kaynaklar:
- Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started
- Diyanet Awqat Salah: https://awqatsalah.diyanet.gov.tr/

## 14 Kasım 2026 — Kıble 2.0 referans tasarımı

- Kıble ekranı baştan tasarlandı: işlemeli altın SVG pusula, katmanlı zümrüt arka plan, mimari kemer, cami silüeti, Kâbe işaretçisi, animasyonlu ibre, altın kart ve butonlar, açık/koyu tema, responsive kaydırma.
- Referanstaki `117°`, `İstanbul` ve `±2°` gibi örnek bilgiler **sabitlenmedi**; gerçek kullanıcı konumu, gerçek kuzey ve Expo sensör doğruluk kategorileri kullanılıyor.
- Konum izni yok, pusula verisi hatalı veya trueHeading=-1 ise yön geçerliymiş gibi gösterilmiyor.
- "Yeniden Kalibre Et" yazılımın donanım kalibrasyonu yapması değil, manuel 8 hareketi rehberi ve sensör aboneliğini yenilemedir.
- Alt sekmeler referansa yakın beş ikon / isimle güncellendi.
- Diyanet ve Camiler'in ücretsiz Google Maps URLs akışı değiştirilmedi.
- Fiziksel iOS/Android pusula doğruluğu, animasyon davranışı ve piksel yerleşimi **henüz cihazda doğrulanmadı**. Yayın öncesi zorunlu.
- Daha fazla ayrıntı: [Qibla 2.0 implementation](QIBLA_2_REFERENCE.md).


### Kıble follow-up (14 Kasım 2026)
- Prominent main text is now **relative, live phone-turn instruction** (right/left by angle), not a fixed geographic label.
- Labelled "Kâbe açısı" remains secondary and calculated from live location.
- Invalid/low-accuracy/stale trueHeading no longer presents actionable turn cues.
- On foreground tab focus, location is refreshed if older than 90s; sensor is unsubscribed on blur.
- Kıble bottom-tab label overlap corrected; physical Android/iOS screenshot QA still pending.

## 14 Kasım 2026 — Kerahat ve Günün Seçkisi 2.0

- Yaklaşık kerahat bantları gerçek namaz saatine göre çizilir; dakika ayarı kişisel görselleştirmedir, fetva değildir.
- Günlük kartlar artık sabit değil; kaynaklı yerel 12 ayet / 7 hadis kataloğu vardır.
- Uygulama ek DB/sunucu/API anahtarı gerektirmeden çevrimdışı günlük seçki ve favori yönetimi sunar.
- Yayın engeli: dinî uzman incelemesi, alıntıların yayın izni, fiziksel Android/iOS QA; dokümantasyon [KERAHAT_AND_DAILY_WISDOM_2.md](KERAHAT_AND_DAILY_WISDOM_2.md).
