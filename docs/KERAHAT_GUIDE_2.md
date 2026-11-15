# Kerahat Rehberi — orijinal kaynaklardan kayıpsız WebP

## Durum
- Kerahat rehberinde iki sekme vardır: **Ağır Kerahat** / **Hafif Kerahat**.
- Her sekmede kullanıcı tarafından gönderilen ilgili 1126×2000 poster gösterilir.
- Yakınlaştırma görselin yazı ve çizimlerini değiştirmez, `contain` ile kırpma yoktur.
- Ana sayfanın kerahat aralığı hesapları bu rehber görselinden bağımsızdır.

## Neden WebP ve neden doğrudan kopya değil?
Orijinal kullanıcı PNG'lerine dokunulmaz. Uygulamada **kayıpsız WebP** kullanılır;
`sharp` ile PNG ve WebP'nin decode edilmiş RGBA piksel buffer'ları birebir karşılaştırılır.
Kaynak PNG SHA-256'ları ve dönüştürülmüş WebP'nin hash/piksel özetleri kaydedilir.
Sadece uzantı değişikliği yapılmaz. Görsel içindeki yazılar yeniden oluşturulmaz.
WebP'nin daha küçük olması muhtemeldir ancak garanti değildir; gerçek tasarruf
dönüşüm komutunun çıktısıyla ölçülür.

Kaynak PNG SHA-256:
- ağır: `dd7a26f775110bc3a911be35c78ec9c90e3d3e0a2e0a470343cfaedb410babf7`
- hafif: `f403909395ea5e9f676680f9c6df53e7a1b0cd9f9730328b8bafa3a3b1a3cce5`

## Kritik: Şu anda kaynaktaki PNG dosyaları yer tutucudur
GitHub'a eklenen **1×1 WebP dosyaları** yalnızca Expo statik asset çözümlemesini sağlar.
Orijinal posterler yüklenmeden final APK üretilemez. `poster-integrity.json`
orijinal ZIP'ten gerçek dönüşüm başarıyla tamamlanınca oluşturulur. Release
betiği bu manifesti ve WebP'lerin piksel/byte hash'lerini doğrular; yoksa durur.
Uygulama gerçek poster yoksa bunu görünür biçimde bildirir.

## Kaynak dosyaları kurma ve yayınlama (Windows)
ZIP içindeki **orijinal ve değiştirilmemiş PNG'ler** gerekir.
Bu ZIP önce bilgisayara ayrıca indirilmelidir; `git pull` onu indirmez.

```powershell
cd C:\active_projects\camideyiz-biz
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
npm install
powershell -ExecutionPolicy Bypass -File .\scripts\install-kerahat-posters.ps1 -ArchivePath "$env:USERPROFILE\Downloads\camideyiz-kerahat-orijinal-gorseller.zip" -Publish
npm run verify:kerahat-posters
```

`-Publish` yalnızca iki WebP dosyasını ve bütünlük manifestini feature branch'e
commit/push eder; `main` merge/deploy yapılmaz.

Android standalone Release APK:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1 -CheckoutPath C:\cb -Configuration Release
```

## Kabul koşulları
1. Sekmeler/ana sayfa yönlendirmeleri doğru, ekran altı/safe area korunuyor.
2. İki poster de 1126×2000; görüntü kırpılmıyor ve yeniden renklendirilmiyor.
3. Kayıpsız WebP decode edilmiş RGBA verisi, orijinal PNG ile byte-byte eşit.
4. Dar cihazda zoom ve yatay/dikey kaydırma çalışıyor.
5. Release derlemesi sahte 1×1 posterlerle başarısız oluyor.
6. Fiziksel cihaz (Android/iOS) görsel kontrolleri ve dinî içerik editör onayı
   yalnızca otomatik testlerle tamamlanmış sayılamaz.
