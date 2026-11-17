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
const PROVIDERS=[
  {name:'NextPrayerWidgetProvider',title:'Sıradaki Vakit',
    info:'widget_next_prayer_info'},
  {name:'PrayerDayWidgetProvider',title:'Günlük Namaz Vakitleri',
    info:'widget_prayer_day_info'},
];
const RESOURCES={
  layout:['widget_next_prayer.xml','widget_prayer_day.xml'],
  drawable:['widget_bg.xml'],
  xml:['widget_next_prayer_info.xml','widget_prayer_day_info.xml'],
};

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
    // Native providers retain the old component FQCNs so existing pinned
    // widgets survive an in-place APK upgrade. The Expo Android renderer is
    // intentionally disabled in app.json; iOS WidgetKit remains enabled.
    for(const item of PROVIDERS){
      const providerName='biz.camideyiz.app.'+item.name;
      const provider={
        $:{'android:name':providerName,'android:exported':'true',
          'android:label':item.title},
        'intent-filter':[{'action':[{
          $:{'android:name':'android.appwidget.action.APPWIDGET_UPDATE'},
        }]}],
        'meta-data':[{$:{'android:name':'android.appwidget.provider',
          'android:resource':'@xml/'+item.info}}],
      };
      const idx=application.receiver.findIndex(x=>
        x.$?.['android:name']===providerName||
        x.$?.['android:name']==='.'+item.name);
      if(idx<0)application.receiver.push(provider);
      else application.receiver[idx]=provider;
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
    const srcRoot=path.join(cfg.modRequest.platformProjectRoot,'app','src','main');
    const javaRoot=path.join(srcRoot,'java','biz','camideyiz','app');
    const target=path.join(javaRoot,'widget');
    await fs.mkdir(target,{recursive:true});
    for(const file of FILES){
      await fs.copyFile(path.join(__dirname,'widget-native',file),
        path.join(target,file));
    }
    await fs.mkdir(javaRoot,{recursive:true});
    for(const item of PROVIDERS){
      const file=item.name+'.java';
      await fs.copyFile(path.join(__dirname,'widget-native',file),
        path.join(javaRoot,file));
    }
    for(const [dir,files] of Object.entries(RESOURCES)){
      const targetDir=path.join(srcRoot,'res',dir);
      await fs.mkdir(targetDir,{recursive:true});
      for(const file of files){
        await fs.copyFile(path.join(__dirname,'widget-native',file),
          path.join(targetDir,file));
      }
    }
    return cfg;
  }]);
}

module.exports=function withWidgetBoundaryBridge(config){
  return withSources(withRegistration(withReceiver(config)));
};
