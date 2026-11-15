# P1 — Prayer Wheel & Kerahat Visual Upgrade
Last updated: 2026-11-15

## Scope completed on feat/widgets-and-prayer-alerts-2

1. **Prayer names/icons visually follow their starting HH:MM labels**
   rather than floating at the middle of each wedge. Clock pills remain
   tied to the exact opening boundary of their coloured segment; a
   deterministic sector-angle inset moves text closer without crossing
   wedge boundaries. Rotation/counter-rotation and live countdown stay.
2. **Inner kerahat arcs are thicker and more legible** (baseline 7.1,
   approaching 9.1, active 10.6 SVG units, with restrained inner glow).
   Inner circle radius is 112, outside the centre medallion.
3. **The outer annular warning is aligned** with the same
   approximate window angles (outer r=173) and the dial's rotation.
   Inactive intervals are muted, the 20 minutes immediately preceding
   a kerahat interval show amber, and an active interval shows deep
   burgundy. The time marker and live-progress colour reflect the same
   approaching/active signal. This is intentionally not a fast animation,
   alarm, or promise that a prayer is impermissible.
4. **Kerahat Vakitleri home card** displays a concise city/subtitle,
   active/approaching/ordinary status, three compact HH:MM–HH:MM
   bands and the existing **Ağır Kerahat** / **Hafif Kerahat** guides.
   Settings remain separately configurable; if the user hides kerahat,
   neither the wheel nor the card pretends that real windows were drawn.

## Safeguards

- This is an **approximate educational visualization**, derived from
  the selected district's already verified published 6 prayer times
  and the user's existing kerahat settings.
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
  sector label placement and the exact start/approach/end kerahat
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
   inner kerahat arcs and matching outer alignment while rotating the
   dial. Segments must follow the ring rotation together.
3. View a selected day *20 minutes before* sunrise, zenith start
   and sunset warning start: amber near state. At exact start:
   burgundy. At exact end: muted again. This must be checked using
   actual clock changes or a separate dev-only controlled test,
   **not** by changing prayer hour data.
4. Changing kerahat settings adjusts both inner/outer windows;
   hiding kerahat removes both. Switching districts must use only
   that district's validated hours.
5. Home panel active/approaching status must match the wheel.
   Both guide buttons must open their respective heavy/light tabs.
6. No changes to underlying published namaz hours. No production
   deployment, main merge or additional feature branch.

Note: The prayer dial uses *nonlinear visual wedges*: angular length
is not proportional to a civil clock's actual elapsed minutes.
Actual prayer times and kerahat interval bounds are calculated from
published times; the outer progress track separately uses real
elapsed duration. The visual arc is explanatory and approximate.
