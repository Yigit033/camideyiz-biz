// Android-only full ezan playback, with explicit exact alarm opt-in.
// Expo CNG plugin: safe alongside the existing native widget bridge.
const {withAndroidManifest,withDangerousMod,withMainApplication}=require('expo/config-plugins');
const fs=require('node:fs/promises');
const path=require('node:path');

const PACKAGE='biz.camideyiz.app.adhan';
const FILES=[
  'AdhanAlarmScheduler.java',
  'AdhanAlarmReceiver.java',
  'AdhanPlaybackService.java',
  'AdhanNotifier.java',
  'CamideyizAdhanBridge.java',
  'CamideyizAdhanPackage.java',
];
const PERMISSIONS=[
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.WAKE_LOCK',
  'android.permission.RECEIVE_BOOT_COMPLETED',
];

function withAdhanManifest(config){
  return withAndroidManifest(config,async cfg=>{
    const manifest=cfg.modResults.manifest;
    manifest['uses-permission']??=[];
    for(const permission of PERMISSIONS){
      if(!manifest['uses-permission'].some(x=>x.$?.['android:name']===permission))
        manifest['uses-permission'].push({$:{'android:name':permission}});
    }
    const application=manifest.application?.[0];
    if(!application)throw Error('Android application missing');
    application.receiver??=[];
    const receiver=PACKAGE+'.AdhanAlarmReceiver';
    const filter={'action':[
      'android.intent.action.BOOT_COMPLETED',
      'android.intent.action.TIME_SET',
      'android.intent.action.TIMEZONE_CHANGED',
      'android.intent.action.MY_PACKAGE_REPLACED',
      'android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED',
    ].map(name=>({$:{'android:name':name}}))};
    const existing=application.receiver.find(x=>x.$?.['android:name']===receiver);
    if(!existing){
      application.receiver.push({$: {'android:name':receiver,'android:exported':'false'},
        'intent-filter':[filter]});
    }else{
      existing.$['android:exported']='false';
      existing['intent-filter']=[filter];
    }
    application.service??=[];
    const service=PACKAGE+'.AdhanPlaybackService';
    const found=application.service.find(x=>x.$?.['android:name']===service);
    const attrs={
      'android:name':service,
      'android:exported':'false',
      'android:foregroundServiceType':'mediaPlayback',
      'android:stopWithTask':'false',
    };
    if(found)found.$={...found.$,...attrs};
    else application.service.push({$:attrs});
    return cfg;
  });
}

function withAdhanRegistration(config){
  return withMainApplication(config,cfg=>{
    const source=cfg.modResults.contents;
    const imp='import '+PACKAGE+'.CamideyizAdhanPackage';
    let next=source;
    if(!next.includes(imp))
      next=next.replace(/^(package\s+[^\r\n]+\r?\n)/m,'$1\n'+imp+'\n');
    const needle='PackageList(this).packages.apply {';
    if(!next.includes('add(CamideyizAdhanPackage())')){
      if(!next.includes(needle))throw Error('Cannot locate React Native package registration');
      next=next.replace(needle,needle+'\n          add(CamideyizAdhanPackage())');
    }
    cfg.modResults.contents=next;
    return cfg;
  });
}

function withAdhanResources(config){
  return withDangerousMod(config,['android',async cfg=>{
    const root=path.join(cfg.modRequest.platformProjectRoot,'app','src','main');
    const target=path.join(root,'java','biz','camideyiz','app','adhan');
    await fs.mkdir(target,{recursive:true});
    for(const name of FILES)
      await fs.copyFile(path.join(__dirname,'adhan-native',name),path.join(target,name));
    const rawDir=path.join(root,'res','raw');
    await fs.mkdir(rawDir,{recursive:true});
    const audio=path.resolve(__dirname,'..','assets','audio','camideyiz-biz-ezan.mp3');
    const stat=await fs.stat(audio);
    if(stat.size<200_000||stat.size>6_000_000)
      throw Error('Bundled ezan MP3 is missing or corrupt; run npm run prepare:adhan');
    await fs.copyFile(audio,path.join(rawDir,'camideyiz_adhan.mp3'));
    return cfg;
  }]);
}

module.exports=function withNativeAdhanAlarm(config){
  return withAdhanResources(withAdhanRegistration(withAdhanManifest(config)));
};
