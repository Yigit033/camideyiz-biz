// Expo's default Metro config, unchanged (identical to having no file).
// The Windows release builder sets CAMIDEYIZ_METRO_MAX_WORKERS so a cold
// bundle does not start one Node worker per CPU next to a Gradle build and
// exhaust a laptop's memory. Unset everywhere else (CI, `expo start`).
const {getDefaultConfig}=require('expo/metro-config');

const config=getDefaultConfig(__dirname);
const workers=Number(process.env.CAMIDEYIZ_METRO_MAX_WORKERS);
if(Number.isInteger(workers)&&workers>0)config.maxWorkers=workers;

module.exports=config;
