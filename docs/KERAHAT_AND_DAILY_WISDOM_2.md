# Kerahat 2.0 + Günün Ayeti ve Hadisi 2.0 — Mimari ve kalite

## 1. Kerahat 2.0: konuma göre yaklaşık zamanlar
Kaynak: Diyanet Din İşleri Yüksek Kurulu, "Mekruh vakitler hangileridir?"
https://kurul.diyanet.gov.tr/tr/fetva/mekruh-vakitler-hangileridir-hangi-vakitlerde-kaza-ve-hangi-vakitlerde-nafile-namaz-kilinmaz/0193c42d-52b7-7186-d5b4-f1d3c950ad73

Diyanet'in *mutedil bölgeler için yaklaşık* açıklamalarından üç aralık türetilir:
- Güneş doğuşu → +45 dakika (yayın açıklaması 40–50 dakika)
- Öğle vaktinden önceki 10 dakika (yaklaşık)
- Akşam namazından önceki 45 dakika (yayın açıklaması 40–50 dakika)

Bunlar **resmî yayımlanmış dakika aralıkları değildir**; namaz vakti sağlayıcısı
sadece altı namaz saatini döndürür. Zaman aralıkları yerel olarak seçilen ilçenin
gerçek **Güneş, Öğle ve Akşam** saatlerine göre yeniden hesaplanır; İstanbul
değerleri başka bir ilçe için sabitlenmez. Namaz saatlerini değiştirmez.

### Görünüm ve ayarlar
- Altın/kehribar üç kerahet bandı doğrudan dönen PrayerWheel üzerinde görünür;
  aktif aralık daha belirgin vurgulanır.
- Ana ekranda üç adet başlangıç–bitiş saatini, mevcut/yaklaşan aralığı gösteren
  açıklanabilir panel vardır; dokunulduğunda ilmihal ve kaynak açıklaması açılır.
- Ayarlar **Otomatik**, **Kişisel görsel aralıklar** ve **Gizle** olarak ayrılır.
- Otomatik değerler: 45/10/45 dk.
- Manuel sınırlamalar: güneş sonrası 40–50, öğle öncesi 5–15,
  akşam öncesi 40–50 dakika. Bunlar **kişisel görsel tercih** olarak etiketlenir.
  İl/ilçe değişince konuma bağlı saatler yeniden hesaplanır;
  kullanıcı tercihleri cihazda saklanır.
- Değişiklik yalnızca görsel işaretlemeyi etkiler, Diyanet/İdamedya takvim saatleri
  ve herhangi bir dinî hüküm etkilenmez.
- Namaz saatleri eski, demo veya yanlış tarihteyse canlı kerahet uyarısı verilmez.
- İmsak sonrası, ikindi namazından sonrası vb. **sadece nafile** namazlara ilişkin
  kısıtlamalar üç kırmızı bandın içine karıştırılmaz; açıklama panelinde ayrı anlatılır.
  Bunlar namazın kılınıp kılınmadığı bilinmeden kesin süreyle belirlenemez.
- Yüksek enlem/gerçek solar altitude konularında *dakikası kesin* iddiası yoktur.
  Diyanet'in mezhepler arası istisnaları, özellikle o günün ikindi farzı açıkça belirtilir.

### Kod
- \`packages/core/src/kerahat.ts\`: saf, testli aralık hesabı ve ayar doğrulaması.
- \`apps/mobile/src/features/prayer/useKerahatSettings.ts\`: yerel AsyncStorage
  (anahtar \`@camideyiz/kerahat-preferences/v2\`).
- \`apps/mobile/src/features/prayer/KerahatPanel.tsx\`: kaynaklı UI, ayarlar, erişilebilir kontroller.
- Mevcut \`indicativeKerahatWindows\` hesabı yeniden kullanılır.
- Herhangi bir ilave sunucu, ödeme, API anahtarı veya Supabase tablo migration'ı yoktur.

## 2. Günün Ayeti / Günün Hadisi 2.0: güvenilir içerik kataloğu
Kaynaklar:
- https://kuran.diyanet.gov.tr/
- https://hadislerleislam.diyanet.gov.tr/

**Karar: İlk sürümde veritabanı DEĞİL, uygulamayla birlikte gelen sürümlü
TypeScript içerik kataloğu kullanılır.** Sebepler: ödeme/sunucu gerektirmez;
çevrimdışı çalışır; kullanıcı aynı tarihte aynı seçkiyi görür; hatalı veya
doğrulanmamış metinlerin üretim veritabanından aniden dağıtılması engellenir.

### İlk doğrulanmış kataloğun kapsamı
- **12 ayrı ayet** ve **7 ayrı hadis** kısa alıntısı, kimlik, kategori, ayet numarası /
  rivayet referansı, Diyanet kaynak URL'si, meal/baskı bilgisi ve **editoryal not**.
- Kartlarda **tam ayet/hadis olduğu iddia edilmeyen kısa alıntı** gösterilir.
  Detay modali kullanıcıyı Diyanet'teki tam metin ve bağlama yönlendirir.
  Özet ile kutsal metin ayrımı korunur.
- Yerel \`dailyWisdom(dateISO)\` aynı gün aynı ayet ve hadisi seçer; ertesi gün değişir.
  12 ve 7 farklı uzunlukta dizi nedeniyle ikili kombinasyon 84 günde tekrar eder;
  **tekil ayetler 12, hadisler 7 günde yeniden döner**. Bunu daha geniş katalog için
  nihai yeterlilik sanmamalıyız.
- Favoriler AsyncStorage içinde yalnızca katalog kimlikleriyle saklanır;
  "Kaydedilenler" listesi, detay ve işletim sisteminin paylaşım menüsü bulunur.
- Paylaşılan metnin **kısa alıntı olduğu** ve kaynak bağlantısı belirtilir.
- Dinî açıklamaları AI ile üretmek, rastgele hadis API'siyle doğrulanmamış
  alıntılar çekmek veya çevirileri lisanssız topluca kopyalamak yoktur.

### Yayın öncesi açık noktalar
- Editoryal/yayın izinleri: Diyanet çevirilerinin ve Hadislerle İslâm alıntılarının
  ticari uygulamada nasıl kullanılabileceği yayınlanmadan önce teyit edilmeli.
- Katalog küçük bir başlangıçtır; yaygınlaştırma için 90–365 gün editoryal onaylı
  içerik kaynağı, çeviri sürüm yönetimi, atıf ve düzeltme sistemi gerekir.
- Günlük seçki otomatik, fakat önceden seçilmiş güvenilir kaynaklardan gelir.
  Eş zamanlı içerik değiştirmek/yönetim paneli yazmak gerekirse ancak o zaman
  yönetimli CMS/veritabanı ve içerik onay iş akışı kurmak anlamlıdır.
- Fiziksel Android/iOS görsel QA: 320 dp ekranlarda iki kartın satır/ikon yerleşimi,
  büyük yazı, erişilebilirlik, Modal klavye/geriye dönüşü, offline favoriler.
- Kerahat dinî doğruluk için uzman incelemesi ve mezhepsel açıklamaların kontrolü.

## Testler ve güvenlik
- \`kerahat.test.ts\`: 3 aralık ve gerçek İstanbul takvim saati, ilçe kaydırma, manuel
  aralık sınırları, yanlış tarihte gösterim yasağı, kesin boundary saniyeleri.
- \`dailyWisdom.test.ts\`: benzersiz ID, HTTPS/Diyanet domain, farklı gün döngüsü,
  kaynak ve metin minimum doğrulaması.
- Native e2e, gerçek cihaz ve dinî uzman onayı **otomatik testlerle kanıtlanamaz**.
- Resmî Diyanet Awqat Salah sunucusu hâlen ayrı; seçilmiş İdamedya üçüncü taraf takvimi devam eder.
- **Değişiklikler feature branch üzerindedir; main merge/deploy/migration yok.**
