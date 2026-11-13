# Ana ekran v0.2 — Görsel kalite standardı

Bu sürüm, referans konsept görsellerden ilham alan **gerçek Expo arayüzüdür**, 3D/photoreal mockup değildir.

## Bilgi hiyerarşisi
1. Marka, tema seçimi, demo konum ve güncel tarih
2. İbadette kullanılmaması için açıkça görülen örnek veri uyarısı
3. Tek odak: 24 saatlik, zamana göre orantılı, renk kodlu sürüklenebilir çember
4. Çember içi vakit etiketi/saati, merkezde seçili vakit veya kalan süre
5. Çemberde ayrı canlı zaman noktası ve seçili vakit tutamacı
6. Alt yatay vakit şeridi, kerahet bilgi satırı ve günlük içerik kartları

## Renk, animasyon ve erişilebilirlik
- Açık tema: fildişi yüzey, zümrüt tipografi, şampanya altın detaylar.
- Koyu tema: koyu zümrüt, mat altın, düşük parlamalı gradyanlar.
- Vakit segmentleri ayrı renk ve yazılı etiket kullanır; yalnızca renge güvenilmez.
- Çember üzerinde sürükleme vakit seçer ve desteklenirse haptik geri bildirim verir.
- Merkez metni, seçili vakit değişiminde kısa fade ile geçer.
- Çember en fazla 326 dp, küçük ekranda küçülür; sayfa dikey kaydırılır.
- Ayet ve hadis verileri kaynaklı içerik entegre edilince gelecek; örnek alıntı uydurulmayacak.

## Gerçeklik sınırları
- İstanbul ve vakitler **temsili**; gerçek ibadet vakti yerine geçmez.
- Gerçek kerahet vakti aralıkları henüz hesaplanmadığından çember üzerinde sahte kırmızı süre çizilmez.
- Görsel referanslardaki süslemeler gerçek zamanlı UI unsurları olarak SVG ile yapıldı; referansın her pikseli birebir hedeflenmemiştir.
- Son kalite kararı gerçek Android ve iPhone ekran görüntüsü ve dokunma testlerine bağlıdır.
