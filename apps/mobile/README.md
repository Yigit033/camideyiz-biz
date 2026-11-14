# Camideyiz Biz — Mobile

Expo SDK 58 mobile prototype. Node 22.13+.

Run from the repository root:
- \`npm install\`
- \`npm run mobile\`
- \`npm run android\` or \`npm run ios\` for device/emulator.

**All prayer times are fictitious demo data.** Do not use for worship or publish as production prayer times. The live schedule API, verified kerahet intervals, prayer notifications and widgets are not connected.

The wheel uses react-native-svg and PanResponder. This is a functional gesture prototype, not yet the final polished Skia/Reanimated animation engine.

The qibla screen requires device location and a true-north heading; sensor reliability depends on device calibration.
