# Camideyiz Biz — Marka Açılış Ekranı (Splash)

## Akış

1. **Native splash (JS yüklenmeden önce, ilk kare):** `expo-splash-screen`, `app.json` üzerinden `#050A1D` gece laciverti zemin ve ortada 150dp marka amblemi + `camideyiz.biz` yazısı. Açık ve koyu sistem temasında aynı marka anı kullanılır.
2. **Görünmez devir:** `BrandSplash` (`apps/mobile/src/features/brand/BrandSplash.tsx`) aynı rengi ve aynı görseli aynı 150dp kutuda çizer. Native splash yalnız JS görseli çözülüp ilk karesi ekrana geldikten sonra kaldırılır; atlama ya da parlama olmaz.
3. **Marka anı:** Amblemin arkasında hafif mavi radyal ışıma belirir (UI thread animasyonu).
4. **Açılış:** Ana ekran ilk veri durumuna (önbellek, ağ veya konum seçimi) geçince amblem %10 büyüyerek kaybolur, lacivert zemin çözülür. Altta zaten çizilmiş olan ana ekran ortaya çıkar.

Sınırlar:
- En az 380 ms gösterilir; yavaş ağda en geç 1,1 sn beklenir. Açılış animasyonu 520 ms sürer.
- Açılış başladığı an dokunmalar ana ekrana geçer.
- Hiçbir veri, ağ veya widget işi splash yüzünden bekletilmez.
- "Hareketi azalt" açıksa ışıma ve ölçekleme kapanır; yalnız 200 ms solma uygulanır.
- Render hatasında native splash en geç 5 sn'de kaldırılır.

## Görsel kaynağı

`apps/mobile/assets/splash-mark.png`, sahibinin onayladığı `app-icon.png` görselinden `scripts/build-splash-mark.mjs` ile türetilir. Yalnız kırpma ve mavi ışığın lacivert zeminden ayrıştırılması yapılır; yeniden çizim veya üretim yoktur. Çerçeve parlaması dışarıda bırakılır.

```powershell
node scripts/build-splash-mark.mjs          # yeniden üret
node scripts/build-splash-mark.mjs --check  # onaylı ikon kuruluysa birebir eşleşme
node scripts/verify-splash.mjs              # sözleşmeler
```

`verify-splash.mjs` şunları denetler:
- Native ve JS kare eşliği (renk, görsel, 150dp).
- Görselin SHA-256 değeri.
- Android 12+ çember maskesi uyumu: amblemin en uç noktası merkezden 91,7dp, sınır 96dp.
- Şeffaf köşeler, toplam süre sınırı, dokunma geçişi ve "Hareketi azalt" desteği.

## Cihaz testi

- Uygulamayı tamamen kapatıp başlatıcıdan aç: lacivert zemin ve amblem anında görünmeli. Native'den JS'e geçişte titreme, kayma veya boş kare olmamalı.
- Açık ve koyu sistem temasında, uçak modunda (önbellekli ve önbelleksiz) ve ilk kurulumda (konum seçimi) dene.
- Bildirim ya da widget dokunuşuyla açılış ve "Hareketi azalt" ayarını dene.
- Android 12+ cihazda amblemin kenarlarının kırpılmadığını doğrula.
- Native splash için yeni APK gerekir; OTA yetmez.
