# P1 — Prayer Wheel & Kerahet Visual Upgrade
Last updated: 2026-11-15

## Scope completed on feat/widgets-and-prayer-alerts-2

1. **Prayer names/icons visually follow their starting HH:MM labels**
   rather than floating at the middle of each wedge. Clock pills remain
   tied to the exact opening boundary of their coloured segment; a
   deterministic sector-angle inset moves text closer without crossing
   wedge boundaries. Rotation/counter-rotation and live countdown stay.
2. **Inner kerahet arcs are thicker and more legible** (baseline 7.1,
   approaching 9.1, active 10.6 SVG units, with restrained inner glow).
   Inner circle radius is 112, outside the centre medallion.
3. **The outer annular warning is aligned** with the same
   approximate window angles (outer r=173) and the dial's rotation.
   Inactive intervals are muted, the 20 minutes immediately preceding
   a kerahet interval show amber, and an active interval shows deep
   burgundy. The time marker and live-progress colour reflect the same
   approaching/active signal. This is intentionally not a fast animation,
   alarm, or promise that a prayer is impermissible.
4. **Kerahet Vakitleri home card** displays a concise city/subtitle,
   active/approaching/ordinary status, three compact HH:MM–HH:MM
   bands and the existing **Ağır Kerahet** / **Hafif Kerahet** guides.
   Settings remain separately configurable; if the user hides kerahet,
   neither the wheel nor the card pretends that real windows were drawn.

## Safeguards

- This is an **approximate educational visualization**, derived from
  the selected district's already verified published 6 prayer times
  and the user's existing kerahet settings.
- `getKerahatView` rejects demo, hidden, stale/wrong-date guidance.
  The renderer is fed empty windows in those cases. No solar or
  religious time is newly calculated from geometry or hard-coded.
- Window state is half-open: `start <= now < end`. Only the 20-minute
  pre-start window is amber. No warning lingers past its end.
- 6-colour segment identity, original start-clock position, needle,
  manual wheel rotation, dynamic actual time calculation, dark/light
  themes and prayer countdown are preserved.
- P2 quick cities / 30-day expandable list and P3 religious dates menu
  are explicitly OUT OF SCOPE for this P1.

## Automated checks

- `packages/core/src/prayerWheelPresentation.test.ts` verifies
  sector label placement and the exact start/approach/end kerahet
  state transitions, including sunrise, zenith and sunset.
- GitHub Actions runs TypeScript, core unit tests, Android native
  widget prebuild, Expo dependency compatibility and Android Metro
  JavaScript bundle.
- CI does not render an actual phone display and cannot certify
  final readability on each Android screen density.

## Device acceptance (after new release APK)

1. Compare **dark and light** modes on a narrow phone: each wedge's
   name/icon should be visually grouped with its HH:MM pill, without
   overlap with the separator, labels, or the centre countdown.
2. With a verified selected-district calendar, examine the three
   inner kerahet arcs and matching outer alignment while rotating the
   dial. Segments must follow the ring rotation together.
3. View a selected day *20 minutes before* sunrise, zenith start
   and sunset warning start: amber near state. At exact start:
   burgundy. At exact end: muted again. This must be checked using
   actual clock changes or a separate dev-only controlled test,
   **not** by changing prayer hour data.
4. Changing kerahet settings adjusts both inner/outer windows;
   hiding kerahet removes both. Switching districts must use only
   that district's validated hours.
5. Home panel active/approaching status must match the wheel.
   Both guide buttons must open their respective heavy/light tabs.
6. No changes to underlying published namaz hours. No production
   deployment, main merge or additional feature branch.

P1.1 update: visual wedges are NOW LINEAR / 24-hour proportional.
Each wedge starts at its published clock time and spans its duration
until the next prayer boundary. Night/yatsı is intentionally large,
because a real day has a long overnight interval. The last interval
uses the displayed day's imsak time on the next 24-hour revolution;
tomorrow's slightly different actual imsak is taken from tomorrow's
separate published schedule on that day. Kerahet approximation follows
the same 24-hour angular mapping and is segmented by its own prayer
band, never allowed to draw a whole-wheel progress line.
At most 24 civil-hour marks, colour-matched to their wedges, replace
the previous 72 generic radial ticks. Daily time advancement is
restricted to the CURRENT segment only. The user-supplied logo now
puts its original blue wordmark BELOW the icon. The Hicri | Gregorian
date line is centred without a calendar glyph.

Automatic location: on a fresh install (or when the user taps the
GPS crosshair) an explicit foreground location permission can be
requested. Geocoding only picks an EXACT Turkish province + district
in Diyanet-code directories. The user can override the location
manually and that preference is persistent; an existing user's saved
manual district is retained during upgrade. While automatic mode is
enabled, a district change is checked when the app is open or resumes
afterwards. No persistent background location or "Always" permission
is used. A GPS accuracy weaker than 1.2 km or an ambiguous geocoder
address cannot silently choose a neighbouring district.

Validation: unit tests cover real civil-time proportions, midnight,
narrow label placement, Turkish spelling/transliteration, exact
district matching, movement threshold, and API fallback IDs.
Last device test gate: test fresh install GPS prompt, denied permission
manual fallback, app foreground movement across districts, manually
selected district remaining stable and both light/dark themes.
