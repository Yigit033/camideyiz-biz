# Paylaşım Galerisi 2.0 — Onaylı Fotoğraf Teslim ve Katolog Kılavuzu

> Sürüm: 2026-11-15. Bu yapı, ürün sahibinin daha sonra teslim edeceği
> 20–30 fotoğrafı bekler. Şu anda **24 şablon alanı hazır, 0 gerçek fotoğraf
> ekli**. Henüz görsel üretimi veya rastgele stok fotoğraf kullanımı yapılmadı.

## Ürün gereksinimleri ve sınırlar

**Akış:** Galeri → kategori / fotoğraf → Tasarım Atölyesi → hazır mesaj
veya 160 karaktere kadar kişisel metin → dört font tarzı, üç yazı yeri,
üç boyut, dört renk, üç kontrast düzeyi → WhatsApp Durumu (9:16) veya
normal gönderi (4:5) → telefonda raster PNG oluştur → işletim sistemi
paylaşım menüsü → kullanıcı WhatsApp kişisi veya Durum hedefini seçer.

Bu bir sosyal ağ değildir. Kullanıcı hesapları, arkadaş listesi, uygulama
içi fotoğraf yükleme, sunucuda tasarım üretimi, kimlerin paylaştığının
izlenmesi, WhatsApp API'si ya da otomatik mesaj/durum gönderme YOKTUR.
Metin taslakları cihazda AsyncStorage ile saklanır; internet erişimi,
kullanıcıdan fotoğraf erişimi veya konum izni gerekmez.

**Dürüst platform sınırı:** `expo-sharing`, Android/iOS'un kendi paylaşım
menüsünü açar. WhatsApp uygulamasının kişi / Durum seçeneği sunmasını
kontrol edemeyiz. WhatsApp Durumu'na tek tıkla doğrudan yayınlama
garanti edilmez. Durum hedefi paylaşım menüsünde yoksa `Kaydet`
ile fotoğraf galeriye alınır ve WhatsApp içinden
`Güncellemeler > Durum` yoluyla seçilir.

## Fotoğraf kabul şartları

- Ürün sahibinin paylaşım ve dağıtım hakkına sahip olduğu fotoğraflar.
  Telif, marka veya kişinin görüntü izni sorunları ürün yayını
  öncesinde çözümlenmelidir.
- WebP (tercihen), JPG veya PNG. Metin overlay ile çatışmaması için
  fotoğrafın orta ve üst-alt güvenli alanlarında belirgin metin
  ve çok yoğun detay bulunmaması gerekir.
- Hikâye için orijinal fotoğraf ideal **1080×1920 / 9:16**,
  gönderi için **1080×1350 / 4:5**. Bu oranlar dışındaki fotoğraflar
  mevcut editörde `resizeMode=cover` ile merkezden kırpılır.
- Her dosya için tanımlı `id`, tema, alt metin / başlık,
  telif sahibi ve uygunsa kaynak/izin kaydı tutulmalıdır.
- Önerilen dosya boyutu: WebP için yaklaşık 150–500 KB,
  sahne detayına ve okunabilirliğe göre ayarlanır. 24 adet
  aşırı büyük PNG, APK boyutunu gereksiz artıracaktır.

## Görselleri sonradan eklemek (tek manifest)

1. Onaylanan dosyaları `apps/mobile/assets/gallery/` içine koy.
2. `apps/mobile/src/features/gallery/galleryCatalog.ts` dosyasında,
   `APPROVED_GALLERY_IMAGES` haritasına açıkça **statik require**
   ekle. Örneğin:

```ts
export const APPROVED_GALLERY_IMAGES:Record<string,ImageSourcePropType>={
  'cuma-01':require('../../../assets/gallery/cuma-01.webp'),
  'cuma-02':require('../../../assets/gallery/cuma-02.webp'),
  'dua-01':require('../../../assets/gallery/dua-01.webp'),
};
```

3. İlgili kategori/başlık/hazır metin `SLOT_INPUTS` listesindeki
   aynı id ile eşleşmelidir. 24 alandan yalnızca onaylıları
   yayınlamak mümkündür; eksikler etiketlenir ve dışa aktarılamaz.
4. Ekranda bütün fotoğraflar hemen yerel paket üzerinden çalışır;
   CDN, kullanıcı galerisi seçme akışı veya yeni servis gerekmez.
5. `npm run typecheck`, `npm test`, Android native prebuild/JS
   bundle ve fiziksel Android/iOS dışa aktarma testlerini tekrar çalıştır.

**Not:** Metro'nun `require` çağrısı statik dosya yolu ister; bir
`require('../../../assets/gallery/'+filename)` döngüsü yazılmamalıdır.

## Uygulanan modüller

- `packages/core/src/shareGallery.ts`: yerleşik, dinî kaynak
  iddiası taşımayan 14 Türkçe hazır kutlama mesajı;
  160 karakter sınırı, yazı ve oran doğrulaması, güvenli taslak.
- `apps/mobile/src/features/gallery/galleryCatalog.ts`: 24
  ürün-sahibi görsel slotu ve tek asset manifesti.
- `apps/mobile/src/features/gallery/GalleryCanvas.tsx`:
  hem ekran önizlemesi hem de final PNG'de kullanılan
  **aynı React Native render ağacı**; fotoğraf üstü yazı, kontrast,
  pozisyon, 9:16 ve 4:5 oranları, görsel yoksa ayırt edilebilir
  tasarım önizleme modu.
- `apps/mobile/src/app/(tabs)/gallery.tsx`: kategorili ve
  aranabilir iki sütunlu galeri.
- `apps/mobile/src/app/gallery-editor.tsx`: dört font,
  hazır metinler, kişisel yazı, yer/renk/boyut, son taslağı
  yalnızca cihazda saklama; PNG oluşturma ve native share/save.
- `react-native-view-shot` 6.1.1: önizlemenin
  `captureRef(..., format:'png', width:1080, height:1920|1350)`
  çıktısı. Tüm metin **fotoğraf piksellerinin içine gömülür**;
  WhatsApp'ta ayrı fotoğraf+metin olarak gitmez.
- `expo-sharing` ~58.0.23: Android/iOS sistem paylaşım menüsü.
- `expo-media-library` ~58.0.14: kullanıcı izin verdiğinde
  isteğe bağlı galeriye kaydetme (WhatsApp Durumu için yedek yol).
  Gereksiz fotoğraf okuma izni istenmeyecek; yalnızca yazma
  gerektiren durumda izin verilir. Android manifesti ve Google Play
  fotoğraf erişimi politikası **release öncesinde denetlenmelidir**.

## Fotoğraflar gelmeden çalışanlar / çalışmayanlar

Çalışan: 24 kart + kategori filtresi + arama + editör +
mesaj/font/konum/boyut/renk/görsel oranı değişimi + cihazda taslak
saklama ve geri dönünce açılma.

**Bilinçli olarak devre dışı:** Fotoğraf bulunmayan kartın paylaşımı
ve kaydı. Onaylı görsel eklenince bu işlemler otomatik açılır;
`Image.onLoad` tamamlanmadan kullanılamaz.

## QA / yayın öncesi gerçek cihaz kontrolü

1. Fotoğraf içeriği yüklendiğinde Android ve iOS'ta 9:16/4:5
   kırpma, Türkçe `İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü` karakterleri,
   dört font ve metnin güvenli ekrandaki konumu kontrol edilsin.
2. Tam 160 karakter ve beş satır taşma kontrolü.
3. PNG açılarak fotoğraf + yazının **tek dosyada** olduğu ve
   1080×1920 / 1080×1350 çözünürlük doğrulansın.
4. Android 13+ ve iOS'ta galeriden paylaşım/galeriye kaydetme
   izinleri; WhatsApp'a kişi ve Durum akışları ayrı test edilsin.
5. Paylaşım menüsü iptal edilirse gönderildi şeklinde başarı
   mesajı üretilmesin; tekrar deneme mümkün olsun.
6. Uygulama tamamen çevrimdışıyken aynı görsel şablonlar açılsın;
   kişisel mesaj veya görsel sunucuya gitmesin.
7. Farklı launcher, küçük Android ekran ve iPhone notch,
   klavye açıkken editör ve alt butonlar test edilsin.
8. Düşük bellekli cihazda 1080p PNG render başarısızlığında
   kullanıcıya hatanın açıklaması gösterilsin; uygulama çökmesin.
9. Görsel hakkı, marka kullanımı, Play fotoğraf izinleri ve
   uygulama mağaza beyanları gözden geçirilsin.

**Git politikası:** Özellikler `feat/widgets-and-prayer-alerts-2` üzerinde.
`main` dalına merge, deploy, ürün yayınlama veya yeni branch yok.
