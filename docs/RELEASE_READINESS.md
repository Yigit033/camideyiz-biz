# Release readiness — Camideyiz Biz (2026-11-14)

## What is implemented on the feature branch
- React Native / Expo Android + iOS application skeleton and light/dark themes
- Interactive physically rotating prayer-time dial, fixed selection needle, and a separate time-progress ring
- Unique transparent **SVG mosque crest** inside the dial; former screenshot-photo crop is no longer rendered
- Nonlinear readability-weighted sectors; chronological time-to-angle mapping tested in the core
- 22+ timeline/core tests, Android bundle and Metro startup CI checks
- On-demand device permission for nearby-mosque Google Maps search
- Basic location- and true-north-based qibla direction screen
- Verse/hadith share cards with source links, and a source-aware settings screen
- Tab-bar safe-area adjustment; remaining physical-device visual check required

## BLOCKERS — NOT YET A PRODUCTION/STORE-READY PRODUCT

1. **Prayer times are still a demo sample**. The official Diyanet Awqat Salah API requires an approved user account/credentials and quota-compliant server-to-server integration. It cannot be honestly shown as live without this.
   https://awqatsalah.diyanet.gov.tr/
2. **Kerahat periods are estimated prototype ranges**, not precise religious judgments. Different prayer categories and special conditions change the ruling; do not enable as official guidance before review by qualified specialists.
3. Authenticated server component, city-ID mapping, offline timestamped caching, next-day schedule fetch and source-verified time-zone transitions are not connected.
4. Prayer notifications, prayer sounds, iOS/Android widgets and system-time/background refresh are not implemented.
5. Gallery is currently a small curated, shareable selection, **not** a production content management system.
6. Nearby mosques open Google Maps; an in-app nationwide mosque database/list is not implemented.
7. Admin panel remains a **non-authenticated visual prototype**. It must NOT be deployed publicly.
8. Store assets, privacy/data safety disclosures, signed builds, automated accessibility tests and real-device QA are incomplete.

## Release gate
- Do not merge the draft feature PR to main for a public production release until official data and the above checks are signed off.
- DO NOT hide the one discreet data-provenance notice while displaying sample prayer hours.
- Do not claim the source is Diyanet until data is actually retrieved from the authorized service.
- QA required on multiple Android phones and iPhones, including screen-reader/fat-font, rotation jank, touch vs vertical scroll, and safe-area overlaps.

## Sources
- Diyanet Awqat Salah official service: https://awqatsalah.diyanet.gov.tr/
- Diyanet kerahat guidance: https://yayin.diyanet.gov.tr/File/Download?id=389&path=fetvalar.pdf
- Diyanet Nisa 4:103: https://kuran.diyanet.gov.tr/tefsir/Nis%C3%A2-suresi/596/103-ayet-tefsiri
- Diyanet Hadislerle İslam, Niyet ve Davranış: https://hadislerleislam.diyanet.gov.tr/pdf/hadislerle_islam_cilt3.pdf


## 14.11.2026 — Diyanet entegrasyonu geliştirme dalına eklendi

- Ayrı `apps/api` Next.js servisi: resmî Diyanet authentication/refresh, istek kotalarını sınırlayan durable sync leasing, RLS korumalı Supabase takvim/konum önbelleği
- Türkiye Diyanet il / ilçe seçimi, gerçek tarihe bağlı 3 günlük doğrulanmış takvim, gece yarısında ertesi günün imsak saati
- Cihazda yalnızca gerçek tarih ve kaynak doğrulamasını geçmiş offline takvim; kaynak gelmezse demo yerine açıklamalı boş durum
- Yalnızca yetkili sunucuya açık sync/target/cron rotaları, otomatik Vercel günlük cron tanımı; **hiçbiri henüz üretimde aktive edilmedi**
- Resmî Diyanet API hesabı, Supabase migration onayı, service-role secrets ve HTTPS API deployment gereklidir
- Kesin kerahet, ezan/bildirim ve mağaza sürümü hâlâ yayına hazır değildir
- Tekil cron 6 kayıt / gün ile sınırlı; yüksek kullanıcı ve ilçe sayısı için planlı indeksleme ve genişletilmiş iş kuyruğu gerekecektir
