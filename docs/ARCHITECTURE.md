# Architecture — ADR-001

- **Mobile:** React Native / Expo SDK 58 / TypeScript / Expo Router.
- **Wheel v0.1:** react-native-svg + PanResponder; animation and advanced effects may use Skia / Reanimated after device benchmarks.
- **Core:** dependency-free TypeScript for prayer schedules, timezones and qibla maths.
- **Admin prototype:** Next.js, deliberately without auth, DB or writing endpoints.
- **Future backend:** Supabase PostgreSQL, RLS, Edge Functions, validated schedule API adapter.
- **Future offline:** SQLite prayer schedules; do not assume JS runs continuously in background.

## Non-negotiable rules

1. Do not present static demo times as real prayer times.
2. Official data source and license, cache validity, location ID, timezone, DST and the following day's times must be validated before launch.
3. Kerahet cannot be a made-up red sector; its individual periods must be calculated only from an approved religious reference.
4. Native push/local notifications must follow iOS/Android permission and timing limits.
5. Server secrets must never be embedded in a mobile binary.
6. Photo copyrights and attribution must be audited before sharing.
7. Admin must have authentication, authorisation and audited writes before deployment.

## Scope of the first pull request

Foundation only: Expo starter, design tokens, demo wheel, five screens, qibla prototype, core unit tests, static admin prototype. iOS/Android device builds are **not yet verified**.
