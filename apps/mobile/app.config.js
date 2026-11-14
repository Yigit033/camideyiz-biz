// Same Google Maps provider on Android and iOS in EAS/native builds.
// iOS Expo Go cannot embed Google's iOS Maps SDK; it uses Apple Maps ONLY in Expo Go.
// Store keys in EAS / build secrets. Never commit a key into this repository.
module.exports = ({config}) => {
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const plugins = (config.plugins ?? []).filter(
    p => !(p === 'react-native-maps' || (Array.isArray(p) && p[0] === 'react-native-maps'))
  );
  if(androidKey || iosKey){
    plugins.push(['react-native-maps',{
      ...(androidKey ? {androidGoogleMapsApiKey:androidKey}:{}),
      ...(iosKey ? {iosGoogleMapsApiKey:iosKey}:{}),
    }]);
  }
  return {
    ...config,
    plugins,
    extra:{
      ...(config.extra??{}),
      // This flag indicates that the app's iOS binary was configured with Google SDK.
      googleMapsIosConfigured:Boolean(iosKey),
    },
  };
};
