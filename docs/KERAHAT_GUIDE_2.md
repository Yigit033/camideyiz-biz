# Kerahat Vakitleri — Ağır / Hafif Rehberi

## Kullanıcı geri bildirimi ve uygulanan UX

Kullanıcının gönderdiği iki görsel, kaynak metinleri ve renk kodlu şematik bir
çember içeren "Ağır Kerahat Vakitleri" ile "Hafif Kerahat Vakitleri" posterleriydi.
Posterler telefonda büyütme gerektirecek statik görseller olduğu için uygulamaya
fotoğraf olarak gömülmedi.

**Yeni kullanıcı akışı:**

1. Ana sayfa `Kerahat Vakitleri` kartında **Ağır Kerahat** ve **Hafif
   Kerahat** eylemleri var; her biri Expo Router `/kerahat-guide?tab=...`
   ekranına kendi başlangıç sekmesiyle gider.
2. Ekranın üstünde iki seçimli sekme bulunur. Geçiş sırasında sayfa
   kapanmaz; ilgili bilgi kartları ve halkada renklendirmeler değişir.
3. Kaynağı doğrulanmış gün ve ilçe için **gerçek 24 saatlik açı ölçeği**
   üzerinde ağır kerahat tahminleri / koşullu hafif kısıtlar görselleştirilir.
   Home içindeki okunurluk için *eşitsiz görsel dilimler* bu şemaya
   taşınmadı. İki çizimin farklı ölçek kullandığı özellikle belirtilir.
4. Kartlar dokunularak açılır, dinî hükümler açıkça okunur; 24 saat
   dışında kalan Cuma hutbesi, Bayram namazı ve farzın kılınma zamanı
   **takvimden otomatik çıkarılmış gibi gösterilmez.**
5. Kaynaksız/yanlış ilçe/eski gün/demoya ait veriyle kesin saat
   gösterilmez; şema ve açıklamalar takvim gelmese bile kullanılabilir.
6. Diyanet açıklamasına ve hafif konusundaki İlmihal PDF'sine
   ayrı doğrulanabilir kaynak bağlantıları eklenmiştir.
7. `Diğer > Kerahat Vakitleri` ayarları (görsel halka tercihi)
   rehber ekranındaki ayarlar simgesiyle erişilebilir.

## Dinî içerik doğruluğu ve fotoğraf uyarlaması

- Posterlerde **öğle öncesi yaklaşık 30 dakika** ifadesi vardı.
  Din İşleri Yüksek Kurulunun 12 Temmuz 2017 tarihli açıklaması,
  mutedil bölgeler için yaklaşık **10 dakika** belirtir; uygulama
  özgün metni körlemesine aktarmadı.
- Ağır kerahat: güneş doğuşu, zeval ve batış çevresindeki üç aralık;
  güneş batışında o günün ikindi farzına ilişkin istisna açıkça yazıldı.
- Hafif: İmsak ile güneş doğuşu arasındaki nafile kısıtlaması; ikindi
  farzı kılındıktan sonraki kısıtlama; akşam farzından önce, Cuma
  hutbesinde ve Bayram namazı çevresindeki durumlar. Nafile ile kaza/farz
  namazları aynı hüküm gibi anlatılmaz.
- Ağır/Hafif başlığı bir **öğretici kategori** olarak sunulur. Mezhep
  farklılıkları ve fiilî namaz türü ayrımları saklanmaz.
- Hafif ikindi görseli, *ezan ile güneş batışı arasındaki olası*
  aralığı kesikli renkle gösterir. Gerçek kişisel sınır, farzın
  kılındığı zamana bağlı olduğundan "şimdi hafif kerahat" gibi otomatik
  yargı verilmez.

## Kaynaklar

- Diyanet Din İşleri Yüksek Kurulu:
  https://kurul.diyanet.gov.tr/tr/fetva/mekruh-vakitler-hangileridir-hangi-vakitlerde-kaza-ve-hangi-vakitlerde-nafile-namaz-kilinmaz/0193c42d-52b7-7186-d5b4-f1d3c950ad73
- Diyanet İlmihali:
  https://namaz.diyanet.gov.tr/namaz/html/kutuphane/HTML/NamazIlmihali/assets/common/downloads/publication.pdf
- İmsak sonrası kaza / nafile açıklaması:
  https://kurul.diyanet.gov.tr/tr/fetva/imsak-vakti-ile-gunesin-dogusu-arasinda-sabah-namazinin-sunneti-disinda-kaza-veya-nafile-namaz-kilmak-caiz-midir/0193c42d-52ce-7e39-fa37-db2f64ee15bf

## Kabul testi (fiziksel cihazda yapılacak)

- Ana sayfada ağır ve hafif rehber butonları küçük ekranlarda taşmasın.
- Doğru ilk sekme açılsın; iki sekme arasında geçiş rahat olsun.
- Aktif dilim/öğe seçimi ve açıklama aç-kapa davranışı tutarlı olsun.
- İlçe değiştirilince yanlış ilçeye ait saatler görünmesin.
- Kaynak kapalı/çevrimdışı/konum seçilmemiş hallerinde sahte saat olmasın.
- Açık/koyu temada kontrast, yazı taşmaları, Android geri düğmesi,
  SafeArea ve ekran okuyucu açıklamaları kontrol edilsin.
- Görsel şema ve dini hükümler "kesin güneş yüksekliği" veya
  "kişinin kıldığı farz namazı" bilgisini uydurmasın.
- GitHub CI TypeScript, core testleri, Android native prebuild, Metro ve
  JS bundle testleri geçsin.

**Not:** Fiziksel Android/iOS QA sonucu görülmeden görsel kaliteye
nihai onay verilmemeli. Bu özellik `feat/widgets-and-prayer-alerts-2`
geliştirme dalında; `main`e merge ve branch silme yapılmadı.
