import Constants from 'expo-constants';
import {NativeModules,Platform} from 'react-native';
import {widgetBridgeAvailable} from './widgetBridgeAvailability';

/**
 * Expo Go includes a general Expo runtime, but NOT our compiled widget
 * extension. This marker remains relevant to OTHER Expo-only features;
 * never use it as the sole Android RemoteViews/widget capability check.
 */
export function isExpoGoRuntime():boolean {
  return Constants.expoGoConfig != null || Constants.appOwnership === 'expo';
}

/**
 * The widget JS publisher and Android launcher must agree on the same native
 * bridge. This is authoritative even when Expo appOwnership is misleading.
 */
export function hasAndroidNativeWidgetBridge():boolean {
  return widgetBridgeAvailable(Platform.OS,NativeModules.CamideyizWidgetBridge);
}
