# Rotating prayer dial — Interaction ADR 002

The original prototype selected whichever **stationary arc was touched**. This was incorrect.

The intended design behaves as a physical dial:
- A **fixed needle** at 12 o'clock indicates the selected time section.
- The **entire wheel rotates** under the finger as the user traces a circular motion.
- During continuous drag, ring rotation runs on the UI thread via Reanimated 4 + Gesture Handler 3.
- On release, bounded inertial deceleration is followed by a **gentle magnetic alignment** to the selected segment center.
- Labels counter-rotate while orbiting, staying upright and readable.
- External time-chip taps rotate the entire dial to the requested sector along the shortest angular path.
- The current-time dot is a separate indicator and does not cause the ring to rotate by itself.
- Reduced-motion system preferences remove extra inertia.
- Skia renders static, soft lighting below the rotating SVG dial; its graphics do not run a per-frame JS redraw.
- Noninteractive center, selection typography and content panels remain upright.
- Color is supplemented by readable labels.

**Correctness:** Demo timings must remain labelled as demo. No arbitrary long red kerahet band may be manufactured. Live prayer data and kerahet intervals await validation.

**Quality gates:** Android and iOS native device testing is required to verify touch direction, one-finger rotation, angular wrap, inertia, screen readers, slow devices and touch competition with vertical page scroll.
