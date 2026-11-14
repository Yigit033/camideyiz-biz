# Camideyiz Biz — Kıble 2.0 (Reference-fidelity UI)

Reference: 14 Nov 2026 "Camideyiz Biz" generated emerald/gold portrait screen in the conversation.

## Implementation
- Layered scene with ornate arch, gold outlines, mosque skyline and water reflections, 360-unit responsive faceted SVG compass, dense engraved gold rim, eight-point compass rose and K/B/D/G reference directions.
- Moving ivory/gold Qibla needle and Kaaba glyph, separately animated on the UI thread by React Native Reanimated. Shortest-turn interpolation avoids needle spinning 359° when heading passes north.
- Header brand, serif title, gold status badge, bearing plaque, source-aware location/sensor card, gradient primary CTA, Maps CTA and figure-eight manual calibration guide.
- Five bottom tabs styled to match the reference: Ana Sayfa, Camiler, Kıble (active gold compass), Galeri, Diğer.
- Light/dark adaptation and scrollable layout for smaller devices.
- No new paid SDK, API key, image hosting, subscription or Google Places dependency.

## Correctness / safety
- Never hardcode reference "117°" or "İstanbul, Türkiye" as real user data.
- Coordinates -> \`qiblaBearing\` is WGS84 initial great-circle bearing to the Kaaba. Istanbul center is approx 151.62° true north.
- Sensor \`Location.watchHeadingAsync\` **trueHeading** is required. A \`trueHeading=-1\` is not considered valid; no silent fallback to magnetic north.
- Expo compass calibration accuracy is a **category 0/1/2/3**, not a ±2° measurement. UI shows Yüksek / Orta / Düşük / Güvenilmez / Bekleniyor, never fake numerical confidence.
- Green near-alignment state requires a nominal angular deviation <7° and sensor accuracy 3 (highest category). This is a visual guide, **not a guarantee of true compass error within 7°**.
- Haptic near-alignment feedback is rate-limited (>=12 seconds) and only triggers on aligned transitions.
- User authorizes location once. If previously granted, foreground coordinates are refreshed; heading watcher runs only while Qibla tab is focused and enabled.
- "Yeniden Kalibre Et" restarts the heading watcher and displays the *manual* figure-eight guide. It does **not** claim to calibrate the phone's hardware programmatically.
- If sensor has no true heading, no needle / correct-direction indicator is shown. Permission denied / geocoding unavailable show informative fallbacks.
- "Haritada Gör" opens the Kaaba location in Google Maps via a free Maps URL; it **does not** present a fake straight-line qibla map or drive navigation.
- No Diyanet API, prayer-time calculations or Google Maps SDK fees involved in Qibla 2.0.

## Real device acceptance
1. Android physical devices: allow/deny GPS, true heading available/unavailable, mag interference/low sensor accuracy, landscape not supported by app, low brightness and screen reader.
2. Rotate phone across 359->0 degrees; arrow follows shortest circular transition and **does not spin a full circle**.
3. Walk/turn to align with Kaaba, read live relative angle and heading category; aligned feedback is sensible and repeat haptics do not fire continuously.
4. Tap manual calibrate: show 8 motion guide and re-subscribe heading; no false "calibrated" confirmation.
5. Open Map action: Kaaba map page opens via app/browser; no location is sent to our server.
6. iPhone and Android: 320–430 dp viewport, dark/light themes, tab bar safe-area and font scale.
7. Test with GPS indoors and urban magnetism; do not promise ±2° accuracy.

## Remaining gate
CI TypeScript / Metro / Android JS bundle and geodesic core unit tests check code but **cannot certify native compass accuracy**, which depends on device and magnetic interference. The owner must review reference fidelity on an actual screen before release.

Expo SDK 58 sensor docs: https://docs.expo.dev/versions/v58.0.0/sdk/location/

### Visual asset fidelity
A compact (~3.2 KB) WebP atmospheric crop from the user-approved, image-generated reference is included at `apps/mobile/assets/qibla/reference-istanbul-skyline.webp`. The functional compass, UI texts, tabs and action states are drawn by native React components and SVG, rather than baking the reference screenshot as an inert image. The WebP is decorative only and never used as factual map imagery.


## 14 Nov 2026 — Live turn guidance and usability correction
- The initial UI displayed the **absolute** Kâbe bearing as a prominent "152° Güneydoğu" string. That value was correctly calculated from Istanbul coordinates, not a hardcoded copy of the reference. **But it was inappropriate as the primary instruction** because it does not say how to turn the phone.
- Main guidance card now uses \`qiblaGuidance(absoluteBearing,deviceTrueHeading)\`: "Sağa N° dön" for the shortest clockwise turn, "Sola N° dön" for the shortest counterclockwise turn, or a near-alignment cue.
- The absolute geographic azimuth is an explicitly labelled **secondary** line: "Kâbe açısı 152° · Gerçek kuzeye göre" (derived from live location). No static "Güneydoğu" string remains.
- Sensor \`accuracy=1\` is not considered reliable enough for actionable turn instructions. \`accuracy=2\` may show approximate guidance with no hard alignment certification; \`accuracy=3\` plus a <7° nominal delta permits a qualified *near-alignment* cue, not a definitive degree guarantee.
- On tab focus, foreground GPS fix is refreshed if more than 90 seconds old without an unprompted new location permission request.
- On tab blur, heading subscription is removed and heading invalidated. A compass reading older than 4.5 seconds is invalidated to avoid displaying stale instructions.
- Bottom navigation active Kıble ring has a smaller, contained indicator and additional label separation; this fixes overlap visible in the real-device screenshot.
- Mathematically tested both turn directions, 0°/360° wrapping, changes in source location, and invalid bearing inputs.
- Screenshot used for QA: 921×2048 phone display; physical rendering and actual sensor uncertainty are **still** device test items. Automated tests cannot assert pixel-perfect layout or calibration.
