# Paylaşım Galerisi — Kaynak ve Lisans Kaydı

Galeri, sahibinin sağladığı `Mosques.zip` paketinden üretilmiş **27 benzersiz fotoğraf** içerir. Her fotoğraf için bir tam görsel ve bir küçük önizleme olmak üzere **54 WebP** dosyası vardır: `apps/mobile/assets/gallery/`. Entegrasyon tamamlandı; katalog `apps/mobile/src/features/gallery/galleryCatalog.ts`, yapısal kontrol `scripts/verify-gallery-assets.mjs`.

- [`gallery-source-manifest.json`](gallery-source-manifest.json): her slotun kaynak dosyası, boyutları ve SHA-256 değerleri. 21.11.2026'da 54 hash depodaki dosyalarla birebir doğrulandı.
- Kaynak ZIP'teki 27 kopya dosya, macOS meta verileri ve iOS imageset dosyaları çıkarıldı. `m10`, EXIF Orientation 6 dikkate alınarak döndürüldü.

## Yayın öncesi açık konular

- Görsellerin kullanım ve paylaşım hakları kaynak pakette belgelenmemiştir. Kamusal yayından önce lisans teyit edilmelidir.
- `m15` (600×918) ve `m26` (640×960) kaynakları düşük çözünürlüklüdür; yapay büyütme uygulanmadı. 1080×1920 Hikâye dışa aktarımı telefonda kontrol edilmelidir.
