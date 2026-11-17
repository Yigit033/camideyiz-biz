# Kıble motoru — güvenilirlik mimarisi ve Android cihaz kabul testi

## Kapsam
**Mevcut Kıble ekranı görsel olarak aynen korunur.** Yalnızca konum,
sensör okuma, doğruluk yönetimi, yaşam döngüsü ve ölçülebilir QA değişti.

## Üç farklı güven kaynağı
1. **Konum:** GPS/fused location servisi WGS84 koordinatı ve metre cinsinden
   konum hata yarıçapı sağlar. Koordinattan Kâbe yönüne başlangıç büyük çember
   açısı hesaplanır (`qiblaBearing`); koordinat ile manyetometre aynı şey değildir.
2. **Yön:** Expo Location `watchHeadingAsync` tarafından verilen **gerçek
   kuzey** (`trueHeading`) ve 0–3 kalibrasyon seviyesini kullanır. -1,
   sonsuz değer, 360° ve accuracy=0 reddedilir; magnetic north doğrudan
   true north kabul edilmez. 1 = düşük (yönlendirme yok), 2 = orta, 3 = yüksek.
3. **Tazelik:** Canlı 2,6 s; 2,6–8 s yeniden bağlanıyor; >8 s eski/önlemsiz.
   Yalnızca canlı + accuracy>=2 + geçerli konum olduğunda dönüş önerilir.
   Hata alınca daha önceki kıble bearing'i silinmez.

## P0 davranışları
- `packages/core/src/qiblaTracking.ts`: adaptif shortest-arc filtre,
  359→1 doğru wraparound, titreşim azaltma, tek çok hızlı sıçramayı askıya
  alma, birbirini doğrulayan iki ardışık sıçrama ile gerçek hızlı dönüşe izin
  verme, zaman aşımı sonrası yeniden başlatma, geçersiz sensörü yoksayma.
- `apps/mobile/src/features/qibla/useQiblaEngine.ts`: ön planda sensör aboneliği
  açılır, arka planda kapatılır; ekrana dönüşte yeni örnek beklenir. Sensör
  9 s sağlıklı örnek vermiyorsa 8 s aralıklı yeniden abone olunur. Başarısız
  konum isteği pusula aboneliğini ve hesaplanmış kıbleyi sıfırlamaz.
- İlk konumda `getLastKnownPositionAsync` ancak konum izni verildikten sonra,
  en fazla 4 saat ve en çok 3000 m doğruluk sınırıyla kullanılır. Konum
  mock/sahte, uygunsuz veya zaman aşımındaysa kesin yön üretilmez.
  `getCurrentPositionAsync` ayrıca 10 s boyunca High accuracy ile denenir.
  Timeout, alttaki OS konum isteğini iptal edemez; geç cevaplar ekrana uygulanmaz.
  Hafıza/Expo OS cache dışında hassas GPS koordinatı kaydedilmez veya sunucuya
  gönderilmez.
- Cihaz arka plandan dönünce taze sensör verisi beklenir ve gerekliyse
  güncel konum tekrar istenir. Geçici kesinti, devam eden animasyonu
  sahte canlı pusula olarak sunmaz.
- Kalibrasyon seviyesi, gerçek yönün matematiksel hata payı değildir.
  7° hizalama toleransı cihaz doğruluğu garantisi şeklinde sunulmaz;
  başarı titreşimi yalnızca 650 ms boyunca kararlı hizalanmada tetiklenir.

## P1 — Google Fused Orientation Provider kararı
Android Google Play services `FusedOrientationProviderClient`, ivmeölçer,
jiroskop ve manyetometreyi birleştiren yerel API'dir; yön hatası tahmini
Expo'nun yalnızca 0–3 kalibrasyon seviyesinden daha açıklayıcı olabilir.
Google Play servislerinin bulunduğu cihazlarda desteklenir, fakat bağımlılık
ve Kotlin/Expo Module köprüsü, Android CNG derlemesi ve donanım testi gerektirir.
**Bu revizyonda deneysel bir Kotlin köprüsü yayınlanmadı.** FOP'ye geçiş
ancak aşağıdaki A/B donanım koşulları doğrulanırsa ayrı bir kontrollü
değişiklik olarak yapılmalıdır: aynı cihazda Expo/FOP titreşim ve geçiş
süreleri; hizmet bulunmayan cihazda Expo fallback; Play services hata
durumu; 5 dakika pil/CPU ölçümü; gerçek kuzey/manyetik sapma kontrolü;
release APK Gradle derlemesi. Böylece test edilmemiş yerel kodun mevcut
uygulamada sensörü tamamen bozması önlenir.

Kaynaklar:
- https://docs.expo.dev/versions/v58.0.0/sdk/location/
- https://developers.google.com/android/reference/com/google/android/gms/location/FusedOrientationProviderClient
- https://android-developers.googleblog.com/2024/03/introducing-fused-orientation-provider-api.html

## Donanım üzerinde P1 kabul matrisi (en az iki Android cihaz)

| Senaryo | Beklenen sonuç |
| --- | --- |
| Düz zeminde 60 s sabit tut, metalden uzak | Sıçrama ve sürekli titreme yok; gösterilen doğruluk gerçek kalibrasyona bağlı |
| 359°→0°→1° geçişi | İbre tam tur geriye dönmez |
| 90°/180°/360° yavaş ve hızlı döndürme | Uygun düşük gecikme; tek yüksek hızlı parazit kalıcı yön değişimi üretmez |
| 1–3 s manyetik anlık kesinti | Konum korunur; yön yeniden bağlanma sırasında canlı sayılmaz |
| 8–15 s sensörün veri vermemesi | Yönlendirme devre dışı, abonelik kontrollü yenilenir, geri gelince düzelir |
| Konum izni yok; sonra izin ver | İzin olmadan hedef açı uydurulmaz; izin sonrası konum alınır |
| Kapalı mekânda 10 s GPS timeout | Uygun yaşta OS son konum fallback; aksi hâlde açık hata |
| Konum son verisi 4 saatten eski | Eski konum kesin canlı yön olarak kullanılmaz |
| Uygulamayı arkaya al/geri dön, 10 kez | Abonelik ve animasyon birikmez, veri gelene kadar yanlış canlı yön gösterilmez |
| Hızlı sekme değişimleri, internet yok | Konum servisinden bağımsız hesaplama; bellek/kaynak sızıntısı görülmez |
| Güçlü mıknatıs, araç içi, metal kılıf | Hatalı sensör değerine kesin doğruluk garantisi verilmez; kalibrasyon uyarısı |
| Cihaz 1/2, farklı Android sürümleri | Yön ve manyetik hata davranışları cihaz özelinde incelenir |
| Referans kıble karşılaştırması | Sabit fiziksel referans + güvenilir harita ile sapma ölçülür; otomatik testler donanımı doğrulamaz |

**Release engeli:** En az iki gerçek cihazda bu matris uygulanıp sonuçlar
kaydedilmeden "pusula her cihazda kesin doğrulukla çalışıyor" denilmemelidir.
