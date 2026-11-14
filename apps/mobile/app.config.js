// Expo Go needs no Google key for react-native-maps. Android standalone builds do.
// Keep the restricted Maps API key in EAS/CI, never in Git or EXPO_PUBLIC variables.
module.exports = ({config}) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if(!key)return config;
  return {
    ...config,
    plugins:[
      ...(config.plugins ?? []).filter(p=>!(p==='react-native-maps'||(Array.isArray(p)&&p[0]==='react-native-maps'))),
      ['react-native-maps',{androidGoogleMapsApiKey:key}],
    ],
  };
};
