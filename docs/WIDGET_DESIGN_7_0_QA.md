# Camideyiz Biz — Widget 7.0 / Engine 4.2
## Değişiklik kapsamı
- Önceki **sekiz** widgetın native component class adı ve mevcut pin kimlikleri korunur; yeni `SquarePrayerRingWidgetProvider` **dokuzuncu** seçenek olarak sunulur.
- **1×1 kompakt:** küçük tek parça logo, sıradaki vakit/saati ikincil, altta koyu chip üzerinde altın renkli 15sp sıkıştırılmış yazı biçimli native geri sayım. Bir sütunda uzun `HH:MM:SS` yazısının sığmasına öncelik verilir.
- **1×2 dikey:** üst yarıda logo/sıradaki vakit, alt yarıda “KALAN SÜRE” ve 16sp sıkıştırılmış geri sayım. İki bölüm 1:1 ağırlıkla alanı kullanır; büyük görünümde alt kısım boş kalmaz.
- **2×2 sıradaki vakit:** üst logo/konum tek satır, ortada vakit adı ve saat, altta 23sp altın geri sayım.
- **4×2 odak:** “ŞU AN” ikincil, sağ bölümde 27sp altın geri sayım ve altta sonraki vakit bilgisi.
- **4×2 günlük:** artık altı yayımlanmış saatin altında **native Chronometer** vardır. Eski statik dipnot kaldırılır; Android'in kendi sayaç motoru kullanılır.
- **4×2 altı vakit şeridi:** her altı saatin gerçek saatleri korunur; 45dp footer geri sayım alanı ve altın 24sp sayaç önceliklidir.
- **2×2 mini çember:** orantılı halka büyütüldü; küçük vakit/saat merkezde, 18sp altın kalan süre alt chip'te.
- **4×4 premium çember:** çember görüntüsü daha geniş; 31sp altın sayaç merkezde, sonraki vakit/saat ikincil, altta altı saatin açık listesi.
- **2×2 sabit kare çember (YENİ):** ayrı Android widget provider; 150×150dp minimum kare, `targetCellWidth=2`, `targetCellHeight=2`, `resizeMode=none`. Geri sayım doğrudan çemberin merkezindedir, tek parça marka logosu üsttedir. Mevcut mini çemberin yeniden boyutlandırılabilirliği geriye dönük korunur.
- Tüm tiplerde yalnız kullanıcının sağladığı tam `camideyiz.biz` logo görseli var. Ayrı marka yazısı yok. Koyu lacivert ve sıcak altın vurgu sistemi.
- **Widget Engine 4.2:** dokuzuncu tip bütün CNG Android kaydı, manifest/metadata, native durum/tanılama, widget sayımı, headless sağlık kapısı ve kaynak önbelleği kontrollerine eklendi. Yeni çember, mevcut 224px bitmap ile **aynı üretimi paylaşır**. Ayrı JavaScript timer veya yeni data/API sorgusu yok. Android `Chronometer` native çalışır.
- `BRAND_VERSION=3` mevcut widgetların yeni APK ile temiz çizimini zorunlu kılar, eski ilçe ve eski render görevlerinin geri gelmesini engelleyen generation kontrolü korunur.

## QA
```powershell
cd C:\active_projects\camideyiz-biz
git fetch origin
git switch feat/widgets-and-prayer-alerts-2
git pull --ff-only origin feat/widgets-and-prayer-alerts-2
npm test
npm run typecheck
node scripts/verify-widget-designs.mjs
node scripts/verify-widget-engine41.mjs
node --experimental-strip-types scripts/verify-widget-native-runtime.mjs
node --experimental-strip-types scripts/verify-widget-headless-gate.mjs
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-windows.ps1
```

**Test matrisi:** bütün dokuz widget türünü tek tek kur; yaklaşık 1–12 saat arası kalan sürelerde tam `HH:MM:SS` alanı taşmasın; 1×1 ve 1×2'de son karakter kırpılmasın; 2×2 sabit çember MIUI/One UI/Pixel Launcher altında kare olmalı (launcher OEM davranışı farklılık gösterebilir). Açık/koyu tema, 4×4/4×2 altı saat, farklı ilçe, reboot, uygulama zorla kapatılıp yeniden açılması, çevrimdışı vakitler, Widget Engine tanısı ve Perfetto ile UI takılma karşılaştırması yapılmalıdır. Yeni APK native Java ve XML'leri içerdiğinden OTA yeterli değildir.

**Sınırlama:** Statik XML/testler gerçek launcher'ın metin taşmasını, sayaç akıcılığını veya pil tüketimini ispatlamaz. Gradle Release APK derlemesi ve fiziksel cihaz görüntüsü gerekir. Bu sürüm yeni Supabase SQL veya Diyanet API entegrasyonu gerektirmez.
