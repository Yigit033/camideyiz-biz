# Namaz Vakitleri 3.1 — “Takvim Bekleniyor” kurtarma

## Rapor (15 Kasım 2026)

Fiziksel Android release APK'da İstanbul/Tuzla ve Mersin/Tarsus,
başka birçok il/ilçe seçildiğinde üst bölümde doğru ilçe adı
görülüyor ancak ana çemberde **Takvim Bekleniyor** kalıyor.
Kaynak adı ("İdamedya · açık takvim kaynağı") ham teknik bir
metin olarak ana sayfada gösteriliyordu.

## Kodda tespit edilen eksikler

1. İl/ilçe seçimi düzgün kaydedilse bile `getMirrorPrayerTriplet`
   yalnızca tek `https://idamedya.org/api/v1/namaz/{ilce}`
   isteğine dayanıyordu. HTTP, ağ, tarih veya veri doğrulama
   başarısızlığında **yedek namaz vakti** yoktu.
2. `usePrayerSource` yakaladığı hatayı saklamıyor ve
   `unavailable` dışında açıklama vermiyordu. Böylece
   gerçek fiziksel cihazdaki başarısızlığın nedeni gizleniyordu.
3. 55 dakikadan eski (fakat aynı ilçenin/günün daha önce
   doğrulanmış) takvimi kesinti durumunda dahi atıyorduk.
4. Ana ekrandaki teknik sağlayıcı adı üretim arayüzüne
   sızmıştı. Gerekli kaynak atfı **Diğer > Kaynaklar ve
   doğruluk** ve **Takvim bilgisi** açıklamasına taşındı.

**Önemli doğruluk sınırı:** Belirli telefonda alınan HTTP
durum kodu / Android ağ hatası henüz kullanıcıdan
gelmediğinden, kök nedenin tam olarak DNS, sertifika, timeout
ya da upstream hata yanıtı olduğunu iddia etmiyoruz.
Bağımsız 2. kaynak + hata kategorileri bu ayrımı test
etmeye ve kaynak kesintilerinde çalışmaya yönelik.

## Yapılan düzeltmeler

- Birincil: İdamedya yayımlanmış Diyanet kodlu takvim.
- İkincil: `https://namazvakti.mtopal.dev/vakitler/{ilceId}`
  (yıl sonuna kadar yayımlanmış Diyanet kodlu JSON takvimi).
- Üçüncül: `https://ezanvakti.emushaf.net/vakitler/{ilceId}`.
  Bir önceki kaynak erişim/doğrulamada başarısız olunca denenir.
  İlçe rehberi de aynı bağımsız kaynak sırasını izler.
- Yedek sonuç, Türkiye yerel tarihinin **DD.MM.YYYY**
  metninden okunuyor; global ISO saat dilimi dönüşümüyle
  bir gün öteye kaydırılmıyor.
- İki kaynak için de gerçek `HH:mm` verileri,
  artan vakitler, bugünün ve ertesi günün varlığı,
  yinelenmeyen tarihler ve ilçe kodu URL parametresi
  zorunlu. Başka ilçenin veya demo saatleri kullanılmaz.
- Tüm gün/ertesi günler beraber geliyor;
  Widget/Ezan Bildirimleri aynı takvim modelini kullanıyor.
- Kaynak `provider` bilgisi `idamedya|mtopal|emushaf` olarak
  saklanıyor; kullanıcıya veri hangi yayından geldiyse
  bilgi ayrıntısında doğru atıf yapılıyor.
- Daha önce alınmış **aynı gün ve ilçenin**
  doğrulanmış verisi, bağlantı kesildiğinde
  azami 24 saatlik yerel önbellekten alınabiliyor.
  Tarih değişince önceki günün saatleri taşınmaz.
- Yeni hata durumları: `calendar_network_unavailable`,
  `calendar_missing_dates`, `calendar_invalid_response`,
  `calendar_rate_limited`. Ana sayfada yeniden deneme var.
- Birim testleri; İstanbul/Tuzla için kaynak şema,
  geçmiş/farklı gün/yanlış ilçe ve imkânsız saat reddi,
  kesintide cache ömrü gibi güvenlik doğrulamalarını kapsıyor.
- CI canlı entegrasyon denemesi İstanbul, Tuzla, Pendik ve
  Tarsus'u paralel kontrol ediyor; upstream kesintisi
  tek başına kod kalitesi denetimlerini bloke etmiyor.
- **15.11.2026 GitHub canlı testi:** İstanbul merkez İdamedya'dan
  başarılı; Tuzla HTTP 503, Pendik HTTP 503, Tarsus HTTP 404.
  eMushaf bu ilçelerde HTTP 403 verdi.
  Üçüncü kaynağımız mtopal JSON 200 ve doğrulanmış saatleri döndürdü:
  İstanbul merkez imsak 06:16, Tuzla 06:15, Pendik 06:15,
  Tarsus 05:49; ertesi gün 16.11.2026 takvimi de doğrulandı.
  Kaynak, ay sonuyla sınırlı olmayan ve bazı aylarda 45 günden
  uzun takvim döndürüyor. Eski parser 45 günlük sınırıyla bu
  **geçerli yanıtı yanlış reddediyordu**; yeni parser bir
  takvim yılına kadar sınırı koruyarak kabul ediyor.
  Kanıt: https://github.com/Yigit033/camideyiz-biz/actions/runs/43717968507
  (non-blocking live source adımı başarılı, ayrıntılar job logunda).

## Cihazda zorunlu kabul testleri

1. **Yeni release APK** (eski sürümle tekrar test etmeyin).
   İstanbul > Tuzla ve İstanbul > Pendik,
   Mersin > Tarsus, ayrıca Ankara > Çankaya seçin.
2. Beklenen: 6 gerçek namaz vakti, çemberde gerçek
   sayaç, ilçe ismi ve ilgili tarih; "Takvim Bekleniyor" yok.
3. Veri gelmezse ekrandaki kısa hata kategorisini not edin,
   tekrar deneyin; eş zamanlı olarak telefonun tarayıcısında
   `idamedya.org/api/v1/namaz/{ilceId}` ve
   `ezanvakti.emushaf.net/vakitler/{ilceId}` kontrol edin.
4. Wi-Fi ve mobil veri ayrı test edilsin.
5. Sonraki gün/saat sınırında doğru günün ve ilçenin
   yayımlanmış verisi kullanılsın.
6. Takvim kullanılabilir hale geldiğinde
   Widget 2.0 ve yerel ezan hatırlatmaları da
   doğrulanmış yayımlanmış günleri alsın.
7. Ana sayfada sağlayıcı adları bulunmasın;
   ayrıntılardaki kaynak atfı korunmuş olsun.

## Yayın ve Git politikası

Sadece `feat/widgets-and-prayer-alerts-2`.
Production migration/deploy, main merge, branch silme yok.
Gerçek cihazın yeni APK testinden önce production-ready denilemez.
