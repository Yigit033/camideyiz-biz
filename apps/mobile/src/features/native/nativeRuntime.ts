import Constants from 'expo-constants';

/**
 * Expo Go includes a general Expo runtime, but NOT our compiled widget
 * extension. StoreClient alone is not sufficient: it also covers dev clients.
 * This guard intentionally supports both the current and legacy Expo markers.
 */
export function isExpoGoRuntime():boolean {
  return Constants.expoGoConfig != null || Constants.appOwnership === 'expo';
}
