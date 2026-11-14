# Camideyiz Biz — ücretsiz takvim kaynağı (2026-11-14)

## Karar
Diyanet resmî Awqat Salah REST API onayı beklenirken ana ekran boş bırakılmaz.
Ücretsiz ve anahtarsız **İdamedya** namaz vakti JSON kaynağı devreye alınır:
https://idamedya.org/api/

**Çok önemli:** İdamedya, Diyanet verilerini aktardığını belirten bağımsız bir hizmettir.
Diyanet'in resmî onaylı API'si değildir; verilerin uzun vadeli yayın hakkı,
sürekli erişilebilirlik ve doğruluk garantisi Diyanet tarafından verilmez.
Uygulama bu kaynağı ayrı açıkça etiketler.

## Kaynak uç noktaları
- İl listesi: https://idamedya.org/api/v1/namaz/iller
- İstanbul ilçeleri: https://idamedya.org/api/v1/namaz/ilceler/539
- İstanbul merkezi namaz saatleri: https://idamedya.org/api/v1/namaz/9541
- Yanıt formatı: ok/data; vakitler günler[] içinde tarih/hicri/imsak/gunes/ogle/ikindi/aksam/yatsi.
- Varsayılan İstanbul merkezi ID 9541, il ID 539 doğrudan sağlayıcının il listesinden doğrulandı.
  Bu başlangıç seçimidir; **telefonun GPS konumu değildir**.
- Türkiye ilk sürüm, saat dilimi Europe/Istanbul. İl ve ilçe değiştirilebilir;
  ancak üçüncü taraf sağlayıcının bazı ilçeleri listede eksik olabilir.

## Veri ve güvenlik mimarisi
- Mobil cihazdaki ücretsiz kaynak istemcisi HTTPS üzerinden JSON GET kullanır.
- Cihazda veya başka bir API ile **astronomik vakit hesaplaması yapılmaz**.
- Üç ardışık gün bulunmalı (önceki/bugün/ertesi): doğru gece yarısı/imsak hesabı için.
- Her vaktin HH:MM formatı, kronolojik dizilişi, tarih ve ilçe ID bilgisi doğrulanır.
- İdamedya cache süresi belgede 1 saat: cihazda 55 dakikadan eski veriler canlı kullanılmaz;
  45 dakika civarı yenilenir; açık ekran 10 dakikalık kontrolle yenileme dener.
- Geçersiz/çok eski veriler reddedilir. Ücretsiz kaynak yoksa **ana sayfa tasarımı
  korunur**, fakat uydurma namaz saatleri/geri sayım üretilmez.
- Harici sağlayıcı adı ve kaynak koşulları uygulamanın kaynağı menüsünde belirtilir.
- Diyanet Awqat Salah sunucu yığını, erişim onayı gelirse bağımsız resmî birincil kaynak olarak hazır;
  URL yapılandırıldığında ayrı veri akışı ve ayrı cihaz cache anahtarı kullanılır.
- Ücretsiz harici kaynağın sürmesi, yoğun API trafiğinde kısıtlanmaması veya gelecekte
  ücretsiz kalması garanti edilemez. Ticari/kurumsal büyümede izin/sözleşme ve cache katmanı yeniden değerlendirilmelidir.

## Doğrulama: İstanbul, 14 Kasım 2026
Kaynak JSON ile Diyanet'in kamuya açık resmî İstanbul takviminde aşağıdaki altı saat eşleşti:
- İmsak 06:15
- Güneş 07:43
- Öğle 12:53
- İkindi 15:30
- Akşam 17:54
- Yatsı 19:17

Bu, yalnızca **tek il merkezinde, tek tarihte yapılan örneklem karşılaştırmasıdır**.
Özellikle iller, ilçeler, Ramazan ve ileri tarihler için yeni eşleştirmeler gereklidir.
Kaynak: https://namazvakitleri.diyanet.gov.tr/tr-TR/9541/istanbul-icin-namaz-vakti

## Tasarım ve davranış
- Asıl HomeScreen, PrayerWheel, namaz çipleri, tarih, gece devri, canlı geri sayım,
  tema ve ayet/hadis kartları gerçek veriyle aynen açılır.
- Sağlayıcı yüklenirken veya bağlantı kesildiğinde tüm sayfa yerine teknik hata
  ekranı gösterilmez; sayfanın tam tasarımı görünür. Saatler uydurulmaz.
- 1 haftalık günlük tablolama ve birden fazla konumun yatay kaydırma deneyimi
  PDF kapsamındadır ancak henüz **tamamlanmış değildir**.
- Günlük ayet/hadisler şu anda sabit seçmelerdir; yönetim panelinden
  rotasyon ve yayın onayı henüz yapılmadı.
- Widget, ezan/sessiz bildirim, sosyal galeri, kerahet ilmihal görselleri, Sehiv ve
  Hac/Umre de sonraki iş paketleri. Resmî dinî hüküm çıkarımı yapan yaklaşık
  kerahet işaretleri canlı rehber olarak açılmadı.

## Yerel çalışma
```powershell
cd C:\active_projects\camideyiz-biz
git fetch origin
git switch --track origin/feat/free-calendar-full-home
npm install
npm run mobile
```
Dal yerelde varsa `git switch feat/free-calendar-full-home` ve `git pull --ff-only`.

Ücretsiz veri kaynağı için API anahtarı, kredi kartı, yeni API sunucusu veya Supabase
gerekmiyor. Ağ erişimi ve üçüncü taraf sağlayıcının hizmette olması gerekiyor.
Resmî entegrasyonda yalnızca sunucu uygulamasına yetkili Diyanet anahtarları verilir.

## Yayın öncesi kalite kapıları
- Gerçek Android/iOS cihazda başlangıç İstanbul vakitlerinin canlı gelmesi;
  seçilen il/ilçe uyumu; saat dilimi/gece devri; 55 dakikalık cache geçerliliği;
  yanlış/boş servis yanıtında hatasız tam ekran ve kaynak etiketi.
- Çoklu şehir/dilçe veri eksiksizliği ve Diyanet resmî örneklemleri.
- Servis sağlayıcı kullanım koşullarının uygulama ölçeği ve hukuki dağıtım bakımından
  incelenmesi. Ücretsiz halka açık API, bir SLA veya dağıtım sözleşmesi değildir.
- Ana sayfa farklı ekran ölçüleri, kaydırma, ekran okuyucu, konum değişimi, tema.
- Diyanet resmî API geldiğinde eski mirror cache'i resmî doğrulanmış kaynak olarak tanımama testi.
