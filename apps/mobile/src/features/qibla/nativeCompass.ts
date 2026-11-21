import {NativeEventEmitter,NativeModules,Platform} from 'react-native';

/** Fused, tilt-aware Android compass (plugins/compass-native). */
export type NativeCompassReading={
  trueHeading:number;   // -1 until a GPS fix provides declination
  magHeading:number;    // -1 when the phone is held vertically (no top-edge projection)
  quality:number;       // Android SENSOR_STATUS 0..3 (magnetometer calibration)
  accuracyDeg:number;   // sensor's own heading-error estimate, -1 if unknown
  tiltDeg:number;       // 0 = flat, 90 = upright
  fieldUT:number;       // measured magnetic field strength, -1 if unknown
  expectedUT:number;    // geomagnetic model strength at the GPS fix, -1 if unknown
  source:string;
  timestamp:number;
};
type CompassModule={
  getCapabilities:()=>Promise<{supported:boolean;source:string;magnetometer:boolean}>;
  start:()=>Promise<string>;
  stop:()=>void;
  setLocation:(latitude:number,longitude:number,altitude:number)=>void;
  addListener:(event:string)=>void;
  removeListeners:(count:number)=>void;
};
const module_=Platform.OS==='android'
  ?NativeModules.CamideyizCompass as Partial<CompassModule>|undefined
  :undefined;
const native:CompassModule|null=module_&&typeof module_.start==='function'&&
  typeof module_.stop==='function'&&typeof module_.setLocation==='function'
  ?module_ as CompassModule:null;
const emitter=native?new NativeEventEmitter(NativeModules.CamideyizCompass):null;

let capability:Promise<boolean>|null=null;
/** True only on an APK with the module AND a rotation-vector sensor. */
export function nativeCompassAvailable():Promise<boolean>{
  if(!native)return Promise.resolve(false);
  capability??=native.getCapabilities().then(c=>c.supported===true).catch(()=>false);
  return capability;
}
export function setNativeCompassLocation(latitude:number,longitude:number,altitude:number|null){
  native?.setLocation(latitude,longitude,altitude??0);
}
/** Starts the sensors and returns an unsubscribe that stops them again. */
export async function watchNativeCompass(
  onReading:(reading:NativeCompassReading)=>void,
):Promise<()=>void>{
  if(!native||!emitter)throw new Error('Native compass unavailable');
  const subscription=emitter.addListener('CamideyizCompass',
    value=>onReading(value as NativeCompassReading));
  try{await native.start();}
  catch(error){subscription.remove();throw error;}
  let stopped=false;
  return ()=>{
    if(stopped)return;
    stopped=true;
    subscription.remove();
    native.stop();
  };
}
