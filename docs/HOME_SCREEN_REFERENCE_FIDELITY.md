# Design fidelity — Two reference home screens

## The benchmark
These two user-provided generated mockups are the design benchmarks:
- Original dark concept: \`image(20261113-204122).png\`
- Original light concept: \`image(20261113-204129).png\`

Compare the reference source screenshots with the actual **running Android/iOS screen**. Our repo already stores two small original concept previews in \`design/references\`. This implementation uses actual native components, NOT the mockup screenshot as a background.

## Fidelity v0.4: what is implemented
- Centered serif wordmark with ornamental arch, city pill, right controls and calendar lines
- Independent ivory / emerald day theme and deep midnight green / matte gold night theme
- Full-screen, subtle radial sky wash and architectural arabesque atmosphere
- Larger, unboxed 360° rotating dial, gold bezel and selection jewel at twelve o'clock
- Six icon / label / time combinations counter-rotate to remain upright
- Multi-layer SVG ring highlights, bright selected sectors, rotating current-time point
- Separate static central medallion with gilded circles and **theme-specific Istanbul silhouette photos**
- Photo layers cropped from the user-supplied artwork **outside the telephone UI**, not a screenshot of the app
- Six selectable compact prayer tiles with gilded selected state and tiny progress rail
- Miniature ornamental Ayet/Hadis cards with deep emerald and warm ivory styling
- Custom floating-feel emerald-accent navigation bar
- Existing Reanimated 4 / Gesture Handler 3 physically rotating wheel with inertia preserved

## Deliberate differences from image mockups
- Current date instead of the hardcoded mockup February 2025 date; Hijri display is approximate
- Example prayer times remain clearly marked **DEMO**. They cannot be used for religious practice.
- No long fictional red kerahet period inserted in the wheel. Correct intervals require approved schedule calculations.
- Content quote from user's image is displayed ONLY as a labelled design example. Hadith remains a source-review placeholder.
- Shadows and photo treatments vary slightly by platform, DPI and GPU.
- Native small-screen scroll behavior takes priority over static screenshot composition.

## QA criteria
- Both themes checked on at least two Android widths, plus iPhone in a dev build
- Dial rotates under a fixed top needle, captions remain upright, touch competes correctly with vertical ScrollView
- No overflow at 320-400dp width or with increased font scaling
- Tab bar remains tappable above safe area
- Smooth interaction on low- and mid-tier device; reduced motion respected
- Correctly switch both theme-specific skyline assets
- Diyanet API and proper kerahet still **out of scope** for design-only v0.4
- Do not merge until approved after real-device screenshot comparison
