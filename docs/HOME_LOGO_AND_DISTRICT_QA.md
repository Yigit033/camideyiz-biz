# Ana Sayfa Markası ve İlçe Seçimi — 15 Kasım 2026

## Kullanıcı geri bildirimi

- Verilen **camideyiz.biz mavi kurumsal logo** ekranın en üstüne
  taşınacak; önceki küçük yazı/temsilî cami ikonu değişecek.
- Logo hemen altında **il/ilçe seçimi** ve tema/bildirim kontrolleri yer alacak.
- Ana namaz çemberi ortasında **İmsağa Kalan / canlı kalan süre /
  Pendik veya Tuzla gibi seçilen ilçe** görünecek.
- Kullanıcı telefonunda sol üstteki konum menüsünden **ilçe seçemiyordu**.

## Kodda yapılanlar

- `CamideyizBrandLogo.tsx` kullanıcının gönderdiği siyah zeminli
  mavi logonun **arkaplanı şeffaflaştırılmış vektör izi**:
  amblem ve 'camideyiz.biz' yazı biçimi korunur. Bir resim
  dosyası üzerine büyük siyah dikdörtgen konulmaz; tema uyumludur.
- `HomeBrandHeader.tsx` logo en üstte, altında geniş tıklanabilir
  il/ilçe alanı ve tema/bildirim aksiyonlarını sunar. Aynı üst
  çubuk hem gerçek takvim hem veri bekleme durumunda kullanılır.
- Namaz çemberi medalyonundan eski dekoratif cami resmi çıkarıldı;
  canlı modda sonraki vakit adı, **saniyelik geri sayım** ve
  **açıkça seçilmiş ilçe/il** önceliklidir. Fiziksel çemberi
  elle döndürürken seçilen vakit bilgisi korunur.
- `LocationPicker` iki adımlı ve görünür akış:
  `1/2 İl` ve `2/2 İlçe`. İlçeler filtrelenebilir, kaynak
  hataları yeniden denenebilir, yükleme/kaydetme süreçleri açıkça
  belirtilir. Konum değişikliği yalnızca kalıcı AsyncStorage
  kaydı tamamlanırsa arayüzde etkinleşir. Hatalar sessizce
  bastırılmaz. Çıkış ve ağ istekleri arasında yarış durumu
  generation-id ile engellenir.
- Öncelikli dizin Idamedya `/namaz/ilceler/{sehir}` endpoint'idir;
  erişim yoksa bağımsız **Diyanet kodlu yedek ilçe rehberi**
  `https://ezanvakti.emushaf.net/ilceler/{sehir}` kullanılır.
  Bu kaynak **sadece ilçe kodu/adı** içindir. Namaz saati,
  geçmiş veya hesaplanmış vakit olarak uydurulmaz.
  Yedek kimlikler ve mükerrer kayıtlar sıkı doğrulanır.
- 7 günlük doğrulanmış il/ilçe rehberi önbelleği sayesinde
  kısa süreli bağlantı sorunlarında daha önce açılmış listeler
  tekrar kullanılabilir. Takvim saatleri hâlâ kendi yayıncı
  doğrulamasından geçmek zorundadır.

## Doğrulanmış kimlikler ve kaynaklar

- Idamedya il listesi: `İstanbul / sehir:539, merkez ilce:9541`
  https://idamedya.org/api/v1/namaz/iller
- Yedek Diyanet kodlu ilçe listesi:
  `Pendik / 9545`, `Tuzla / 9551`
  https://ezanvakti.emushaf.net/ilceler/539
- Resmî Diyanet API ile bağımsız sağlayıcı verisi birbirinin
  aynısıymış gibi gösterilmeyecek.

## Fiziksel cihaz kabul testi

1. Ana sayfanın EN ÜSTÜNDE gönderilen mavi logo görünsün;
   il ve ilçe seçimi altında, sağda tema/bildirim butonları olsun.
2. `İstanbul` seçilince ilçe listesi açılabilsin; `Pendik`
   veya `Tuzla` seçimi tamamlanabilsin.
3. Ekranda `İstanbul / Pendik` veya `İstanbul / Tuzla`
   açıkça görünsün, çember ortasında aynı ilçe adı yer alsın.
4. Takvim gerçek sağlayıcıdan yüklenince vakitler ilgili ilçe
   koduyla alınsın. `İmsağa Kalan` uygun saatlerde ve saniyelik
   geri sayım doğru çalışsın. İlçe değişince eski ilçenin vakti
   yeni ilçe adıyla gösterilmesin.
5. Uygulama yeniden açılınca ilçe seçimi kalsın.
6. İnternet kapalı veya sağlayıcı kesintiliyse güvenilir liste
   önbelleği kullanılabilir; doğrulanmamış namaz saatleri
   yayınlanmasın.
7. Küçük Android ekranda, açık/koyu temada, büyük fontta
   logo, butonlar ve çember taşmasın.
8. Jestlerle çember çevrilebilsin, vakit seçimi ve `Canlıya dön`
   davranışları bozulmasın.

**Durum:** GitHub CI TypeScript, Expo Android prebuild, JS bundle,
Metro ve core testleri ile doğrulanır. Fiziksel cihaz testleri
tamamlanmadan nihai üretim onayı verilmez.

Geliştirme dalı `feat/widgets-and-prayer-alerts-2` korundu;
`main` merge ve branch silme yok.
