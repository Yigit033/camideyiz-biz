# Kerahat Vakitleri — Ağır / Hafif Orijinal Poster Rehberi

## Kullanıcı kararı — 15 Kasım 2026

Önceki dinamik `DailyRing` (özel çizilen halka), ayrıntı akordeonları
ve kaynak açıklaması kartları **/kerahat-guide** ekranından kaldırıldı.
Kullanıcı tarafından gönderilen iki 1126×2000 PNG görselin **piksel
içeriğine dokunulmadan** gösterilmesi istendi. Görsel üzerindeki çizim,
renkler, tipografi, metin ve kaynak notları değiştirilmedi.

Yeni ekranda:
- Üstte kalıcı iki sekme: **Ağır Kerahat** ve **Hafif Kerahat**.
- Her sekmede birebir kendi poster dosyası, orijinal 1126:2000
  oranıyla, **contain** biçiminde: kesinlikle `cover` veya crop yok.
- Telefon ekranında küçük okunabilecek yazılar için 2× büyütme,
  yatay ve dikey kaydırarak okuma. Büyütme görseli yeniden üretmez.
- Light/dark temalarda posteri asla yeniden renklendirmeyen nötr
  zemin. Android geri ve iki ayrı ana sayfa rehber bağlantısı korunur.
- Önceki dinamik namaz / kerahat hesapları ana sayfa çemberinde
  **aynen kalır**; yalnızca ayrı bilgi rehberi değişir.

## Dosya adları (orijinal ve değiştirilmemiş)

- `apps/mobile/assets/kerahat/agir-kerahat.png`
  SHA-256:
  `dd7a26f775110bc3a911be35c78ec9c90e3d3e0a2e0a470343cfaedb410babf7`
- `apps/mobile/assets/kerahat/hafif-kerahat.png`
  SHA-256:
  `f403909395ea5e9f676680f9c6df53e7a1b0cd9f9730328b8ba3a3b1a3cce5`

### Önemli entegrasyon sınırı

Bağlı GitHub metin dosyası API'si, bu sohbetin yüklediği
binary PNG'leri doğrudan repoya yükleyemedi. Expo'nun statik
`require` çözümlemesi / TypeScript CI bozulmaması için iki yola
geçici 1×1 PNG **placeholder** kondu.

**Bunlar gerçek görseller değildir.** Gerçek dosyalar eklenmeden
Release APK kabul edilmez: `scripts/build-android-windows.ps1`
orijinal SHA-256 kontrolüyle derlemeyi durdurur. Bu
bitirilmemiş bir entegrasyon adımıdır; son kullanıcıya demo
resim göndermek hedeflenmemektedir.

Orijinal iki görselin kayıpsız ZIP'i bu sohbetten
`camideyiz-kerahat-orijinal-gorseller.zip` olarak alınır.

Windows'ta bir defaya mahsus:
```powershell
cd C:\active_projects\camideyiz-biz
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
powershell -ExecutionPolicy Bypass -File .\scripts\install-kerahat-posters.ps1 -ArchivePath "C:\Users\<kullanici>\Downloads\camideyiz-kerahat-orijinal-gorseller.zip" -Publish
```

`-Publish` yalnızca iki PNG dosyasını var olan feature
branch'ine commit/push eder; `main` merge veya deploy yapmaz.
Ardından Windows kısa-yol APK betiği tekrar çalıştırılabilir:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1 -CheckoutPath C:\cb -Configuration Release
```

## Fiziksel cihaz kabul kriterleri

1. Ana sayfa **Ağır Kerahat** bağlantısı doğru sekmeyi, **Hafif
   Kerahat** bağlantısı diğer sekmeyi açmalı; sekmeler değişirken
   her seferinde ilgili poster görünmeli.
2. İki PNG görselde kaynak metinleri ve şekiller
   **birebir aynı**; yanlış kırpma, kapatma veya renk filtresi yok.
3. 360px altında dar ekranlarda dahi görsel tam sığmalı;
   büyütme açıkken yatay kaydırmayla tüm orijinal metin
   okunabilmeli, dikey kaydırma normal işlemeli.
4. Dark/light tema yalnızca uygulama çerçevesini değiştiriyor;
   görsellerin gri zemin/baskı renkleri değişmiyor.
5. Ana sayfadaki canlı kerahat halkası ile bildirim/ayar
   işlevleri rehber görseli değişikliğiyle bozulmamalı.
6. Orijinal SHA-256 olmayan posterle APK üretimi başarısız
   olmalı; kullanıcı fark etmeden boş poster yayınlanmamalı.

## Dinî içerik kontrol notu

Posterler kullanıcı talebine uygun olarak **bilinçli biçimde
değiştirilmeden** gösterilir. Önceki dinamik bilgi ekranı
posterlerdeki bazı yaklaşık zaman ifadeleri ile Diyanet'in
kamu açıklamaları arasında farklılık olabileceğini not ediyordu.
Baskı/posterlerin içeriksel fetva doğruluğunu kod testi
kanıtlamaz; kamuya açık mağaza sürümünden önce uzman
editör incelemesi önerilir.

## Git politikası

Sadece `feat/widgets-and-prayer-alerts-2`.
`main` merge, production deployment veya yeni branch yok.
