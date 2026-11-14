# Camideyiz Biz — Camiler 2.1: Google Maps + Google Places

## Why the previous version froze or seemed limited to Fatih
The prior iteration mixed a Google Maps **base map** on Android with OSM/Overpass for **place search**.
Its initial Istanbul center was near Fatih, with a 3.5 km radius; it wasn't an all-city search.
Fetching/parsing large JSON datasets, O(n²) near-duplicate checks and rendering up to 130
custom view markers could block JS or increase native map redraw overhead.

## What changed
- **Google Maps SDK** as the native basemap on Android and iOS (iOS requires a dedicated Google SDK development/production binary).
- **Google Places API (New)** as the mosque search source. Request type="mosque", localized name/address, explicit "Bu bölgede ara" user action, at most 20 results per request.
- Supports map gestures/zoom and searching the new map center, on-demand geolocation, and typed text searches scoped toward the chosen map center.
- Lightweight native Google map markers instead of up to 130 custom Marker children.
- Small, explicit field masks to reduce billing; no auto-API calls while panning.
- In-app map or list, Google Maps data attribution, place details on tap, source photos with author attribution and link, Google Maps walking navigation.
- Favorited **Place IDs only** persisted on device; names/locations/details and photo names are not stored in AsyncStorage or a database.
- No Diyanet prayer-time logic changed.

## Important caveats
1. **Map ≠ Places.** Google Maps SDK renders maps. Google Places (New) must be enabled separately to return mosque results.
2. A Nearby Search request returns at most **20 places**, NOT all mosques in Istanbul. Search a different region or zoom; do not claim completeness.
3. **Google Cloud project with billing is mandatory.** Maps SDK Android, Maps SDK iOS and Places API (New) need their respective enabled services and restricted keys.
4. **iOS Expo Go cannot provide a native Google Maps SDK**. Test iOS with an Expo development build or EAS custom build. The app refuses to display Google Places on an Apple basemap to avoid Google Maps Platform policy issues.
5. No Place details, names, coordinates, photos or addresses are stored in persistent app cache. The only persistent favorite data is the Google Place ID. Google content and photo names are subject to license and caching restrictions.
6. Public Places proxy contains only best-effort per-process throttling. A **durable/distributed rate limiter + app attestation + server-side quotas** are required before an unrestricted public rollout. Otherwise key abuse may incur unexpected bills.
7. Photos are fetched from current Place Details results via short-lived media endpoint; credit is displayed when Google requires author attributions.
8. The server must never leak GOOGLE_PLACES_API_KEY to an Expo public variable, JavaScript bundle, screenshot or GitHub.
9. Privacy notice must explain that the selected map center/location is sent to the app server and Google when the user searches; no silent background searches.
10. True device-frame performance, iOS setup, accessibility, varied screen sizes and real Google Places API data cannot be verified without configured keys and hardware QA.
11. Legacy OSM/Overpass runtime is retired for this feature. Do not silently fall back to OSM when a Google request fails.

## Setup: Google Cloud
Create or select a Google Cloud project and attach an active Billing account.

Enable:
- **Places API (New)** — Places server key
- **Maps SDK for Android** — native Android map key
- **Maps SDK for iOS** — native iOS map key

Create **three different restricted API keys**:
1. GOOGLE_PLACES_API_KEY (server only, API-restricted to Places API New; add appropriate server IP restrictions when stable outbound IPs exist).
2. GOOGLE_MAPS_ANDROID_API_KEY (Android app restriction by \`biz.camideyiz.app\` + your signing SHA-1).
3. GOOGLE_MAPS_IOS_API_KEY (iOS app restriction by \`biz.camideyiz.app\`).

Set quotas to safe limits; configure billing budget alerts (alerts alone do not guarantee a hard spending cap).
Use Google Places FieldMask and a per-user/app verified quota before production.

### Development on Windows, Android phone on same Wi-Fi
Run two terminals. Files \`.env.local\` must not be committed.

Terminal A:
\`\`\`powershell
cd C:\active_projects\camideyiz-biz
git fetch origin
git switch feat/mosques-2-premium-explore
git pull --ff-only origin feat/mosques-2-premium-explore
npm install
# Add GOOGLE_PLACES_API_KEY in apps/api/.env.local (server ONLY).
npm run dev --workspace @camideyiz/api
\`\`\`

Terminal B:
\`\`\`powershell
cd C:\active_projects\camideyiz-biz\apps\mobile
# Create .env.local with your PC LAN address:
# EXPO_PUBLIC_MOSQUE_API_URL=http://192.168.1.100:3001
npx expo start --clear
\`\`\`

If Android device and PC share Wi-Fi, replace 192.168.1.100 with the actual LAN IPv4 address.
The standalone Android build needs a restricted Google Maps native SDK key.
For iOS Google Maps, create a development build with GOOGLE_MAPS_IOS_API_KEY configured in EAS.

## Operator / release gate
- DO NOT deploy until you have billing limits, durable shared throttling and allowed-host/proxy security.
- DO NOT store Google Places content in Supabase/Postgres as if it were OSM. Place IDs are the persistent favorite key.
- Device QA: map movement keeps 60 fps where reasonably possible; search explicitly triggers at most one call; spinner does not block gestures; errors show retry; country/region movement works; favorites survive restart by ID; photo credits and Google logo are visible.
- No astronomical prayers. Only officially approved Diyanet API provides namaz vakitleri separately.

### Verified documentation
- https://docs.expo.dev/versions/v58.0.0/sdk/map-view/
- https://developers.google.com/maps/documentation/places/web-service/nearby-search
- https://developers.google.com/maps/documentation/places/web-service/place-types
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- https://developers.google.com/maps/documentation/places/web-service/place-photos
