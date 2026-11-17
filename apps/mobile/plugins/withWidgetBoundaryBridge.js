// Expo SDK 58 Android P0 widget continuity.
// Adds a tiny, isolated React Native Java module and system receiver without
// replacing the application's React/Expo architecture or its iOS WidgetKit.
// All generated files are managed by CNG; this plugin is safe to run repeatedly.
const {withAndroidManifest,withDangerousMod,withMainApplication}=require('expo/config-plugins');
const fs=require('node:fs/promises');
const path=require('node:path');

const PACKAGE='biz.camideyiz.app.widget';
const RECEIVER=PACKAGE+'.WidgetBoundaryReceiver';
const PERMISSION='android.permission.RECEIVE_BOOT_COMPLETED';
const FILES=[
  'WidgetBoundaryScheduler.java',
  'WidgetBoundaryReceiver.java',
  'CamideyizWidgetBridge.java',
  'CamideyizWidgetPackage.java',
];

function withReceiver(config){
  return withAndroidManifest(config,async cfg=>{
    const manifest=cfg.modResults.manifest;
    manifest['uses-permission']??=[];
    if(!manifest['uses-permission'].some(p=>p.$?.['android:name']===PERMISSION)){
      manifest['uses-permission'].push({$:{'android:name':PERMISSION}});
    }
    const application=manifest.application?.[0];
    if(!application)throw new Error('Android application manifest not generated');
    application.receiver??=[];
    const intentFilters=[
      {'action':[
        {'$':{'android:name':'android.intent.action.BOOT_COMPLETED'}},
        {'$':{'android:name':'android.intent.action.TIME_SET'}},
        {'$':{'android:name':'android.intent.action.TIMEZONE_CHANGED'}},
        {'$':{'android:name':'android.intent.action.MY_PACKAGE_REPLACED'}},
      ]},
    ];
    const entry=application.receiver.find(r=>r.$?.['android:name']===RECEIVER);
    if(!entry){
      application.receiver.push({
        $:{'android:name':RECEIVER,'android:exported':'false'},
        'intent-filter':intentFilters,
      });
    }else{
      entry.$['android:exported']='false';
      entry['intent-filter']=intentFilters;
    }
    return cfg;
  });
}

function withRegistration(config){
  return withMainApplication(config,cfg=>{
    const source=cfg.modResults.contents;
    if(cfg.modResults.language!=='kt'&&!source.includes('PackageList(this).packages.apply')){
      throw new Error('Android widget bridge requires current Kotlin MainApplication template');
    }
    let rewritten=source;
    const imp='import '+PACKAGE+'.CamideyizWidgetPackage';
    if(!rewritten.includes(imp)){
      rewritten=rewritten.replace(/^(package\s+[^\r\n]+\r?\n)/m,'$1\n'+imp+'\n');
    }
    const needle='PackageList(this).packages.apply {';
    if(!rewritten.includes('add(CamideyizWidgetPackage())')){
      if(!rewritten.includes(needle))
        throw new Error('Cannot safely locate React PackageList registration');
      rewritten=rewritten.replace(needle,needle+'\n          add(CamideyizWidgetPackage())');
    }
    cfg.modResults.contents=rewritten;
    return cfg;
  });
}

function withSources(config){
  return withDangerousMod(config,['android',async cfg=>{
    const target=path.join(cfg.modRequest.platformProjectRoot,'app','src','main','java',
      ...PACKAGE.split('.'));
    await fs.mkdir(target,{recursive:true});
    for(const file of FILES){
      const source=path.join(__dirname,'widget-native',file);
      await fs.copyFile(source,path.join(target,file));
    }
    return cfg;
  }]);
}

module.exports=function withWidgetBoundaryBridge(config){
  return withSources(withRegistration(withReceiver(config)));
};
