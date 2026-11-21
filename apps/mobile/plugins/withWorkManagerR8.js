// Expo SDK 58 + AGP 9 / R8 full mode may strip constructors created
// reflectively by AndroidX Room/WorkManager in minified release APKs.
// Reference: expo/expo#52173 and expo/expo#51337.
const {withDangerousMod}=require('expo/config-plugins');
const fs=require('node:fs/promises');
const path=require('node:path');

const MARKER='# Camideyiz Biz: retain WorkManager/Room reflective constructors';
const RULES=[
  MARKER,
  '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
  '-keep class * extends androidx.work.InputMerger { <init>(); }',
].join('\n');

module.exports=function withWorkManagerR8(config){
  return withDangerousMod(config,['android',async config=>{
    const file=path.join(config.modRequest.platformProjectRoot,
      'app','proguard-rules.pro');
    const source=await fs.readFile(file,'utf8');
    if(!source.includes(MARKER)){
      await fs.writeFile(file,source.trimEnd()+'\n\n'+RULES+'\n','utf8');
    }
    return config;
  }]);
};
