import {useCallback,useEffect,useMemo,useState} from 'react';
import {
  AppState,NativeModules,Platform,Pressable,Share,StyleSheet,Text,View,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useCompanion} from '@/features/companion/CompanionProvider';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';

type NativeWidgetHealth={
  supported:true;nativeCityId:number;installedNext:number;installedDay:number;
  lastReady:boolean;persisted:boolean;hasTimeline:boolean;state:string;
  lastError:string;lastNextName:string;lastNextTime:string;lastDateISO:string;
  lastCity:string;lastAppliedAt:number;lastAttemptAt:number;
  lastHostDispatchAt:number;lastRefreshReason:string;
  lastSyncAt:number;nextAlarmAt:number;
  calendarSourceAt:number;calendarEndsAt:number;sourceAgeHours:number;
  osRecoveryMinutes:number;
};
type WidgetBridge={
  getStatus:()=>Promise<string>;
  refreshNow?:()=>Promise<string>;
};
function bridge():WidgetBridge|null{
  if(Platform.OS!=='android')return null;
  const value=NativeModules.CamideyizWidgetBridge as WidgetBridge|undefined;
  return typeof value?.getStatus==='function'?value:null;
}
function readHealth(raw:string):NativeWidgetHealth{
  const value:unknown=JSON.parse(raw);
  if(value===null||typeof value!=='object'||Array.isArray(value))
    throw Error('Geçersiz native tanı kaydı');
  const v=value as Partial<NativeWidgetHealth>;
  if(v.supported!==true||typeof v.nativeCityId!=='number'||
     typeof v.installedNext!=='number'||typeof v.installedDay!=='number'||
     typeof v.lastReady!=='boolean'||typeof v.persisted!=='boolean'||
     typeof v.hasTimeline!=='boolean'||typeof v.lastError!=='string'||
     typeof v.lastRefreshReason!=='string'||typeof v.lastAppliedAt!=='number'||
     typeof v.lastHostDispatchAt!=='number'||typeof v.calendarEndsAt!=='number'||
     typeof v.sourceAgeHours!=='number'||typeof v.nextAlarmAt!=='number')
    throw Error('Native widget tanı alanları eksik; APK güncel olmayabilir');
  return v as NativeWidgetHealth;
}
function clock(value:number):string{
  return value>0?new Date(value).toLocaleString('tr-TR',{
    day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',
  }):'—';
}
function displayState(status:NativeWidgetHealth|null,cityId:number|null){
  if(!status)return {title:'Widget motoruna erişilemiyor',
    description:'Eski APK veya native bağlantı sorunu. Yeni Android APK ile test et.',
    icon:'alert-triangle' as const};
  if(status.installedNext+status.installedDay===0)return {
    title:'Ana ekranda kurulu widget yok',
    description:'Telefonun Widget’lar menüsünden Camideyiz Biz’i ana ekrana ekle.',
    icon:'smartphone' as const};
  if(status.lastError)return {title:'Native widget hatası',
    description:status.lastError,icon:'alert-triangle' as const};
  if(cityId!==null&&status.nativeCityId!==cityId)return {
    title:'Widget farklı ilçenin verisini tutuyor',
    description:'Yeni ilçe henüz native belleğe yazılmadı; takvimi yenile.',
    icon:'map-pin' as const};
  if(!status.hasTimeline||!status.lastReady)return {
    title:'Widget için geçerli takvim yok',
    description:'Seçilen ilçe için doğrulanmış yayın veya ileri tarihler bekleniyor.',
    icon:'calendar' as const};
  if(!status.persisted)return {title:'Native veri kaydı doğrulanmadı',
    description:'Takvimi yenile ve tanılama çıktısını paylaş.',
    icon:'alert-circle' as const};
  return {title:'Android’e widget güncellemesi iletildi',
    description:'Native kayıt hazır. Ana ekranda çizimin tamamlandığını Android uygulamaya bildirmez; cihaz ekranında karşılaştır.',
    icon:'check-circle' as const};
}
export function Widget3Diagnostics(){
  const {colors}=useAppTheme();
  const companion=useCompanion();
  const source=useSharedPrayerSource();
  const [opened,setOpened]=useState(false);
  const [health,setHealth]=useState<NativeWidgetHealth|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const cityId=source.place?.id??null;
  const query=useCallback(async()=>{
    const native=bridge();
    if(!native){setHealth(null);setError('Native widget köprüsü bulunamadı');return;}
    try{
      setHealth(readHealth(await native.getStatus()));
      setError(null);
    }catch(e){setHealth(null);setError(e instanceof Error?e.message:'Native tanılama başarısız');}
  },[]);
  useEffect(()=>{
    if(Platform.OS!=='android')return;
    void query();
    const listener=AppState.addEventListener('change',state=>{
      if(state==='active')void query();
    });
    return ()=>listener.remove();
  },[query,companion.widget.lastNativeWriteAt]);
  const description=useMemo(()=>displayState(health,cityId),[health,cityId]);
  const selected=health!==null&&cityId!==null&&health.nativeCityId===cityId;
  const installed=(health?.installedNext??0)+(health?.installedDay??0);
  const repair=async()=>{
    if(busy)return;
    setBusy(true);
    setError(null);
    try{
      await companion.refreshWidgets();
      const native=bridge();
      if(native?.refreshNow){
        // Native repair is idempotent. It never invents an unpublished clock.
        setHealth(readHealth(await native.refreshNow()));
      }
      await query();
    }catch(e){
      setError(e instanceof Error?e.message:'Widget onarma isteği başarısız');
      await query();
    }finally{setBusy(false);}
  };
  const share=async()=>{
    try{
      await Share.share({message:
        'Camideyiz Biz · Widget 3.0 tanılama\n'+
        JSON.stringify({
          time:new Date().toISOString(),
          selectedDistrictId:cityId,
          selectedDistrict:source.place?.name??null,
          state:description.title,
          native:health,
          widgetSync:companion.widget,
          backgroundRegistered:companion.backgroundRegistered,
          backgroundReport:companion.backgroundReport,
          error,
        },null,2)});
    }catch{/* user dismissed OS sharing or it failed */}
  };
  if(Platform.OS!=='android')return null;
  return <View style={[styles.outer,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <View style={styles.header}>
      <View style={[styles.round,{backgroundColor:colors.soft}]}>
        <Feather name={description.icon} size={19} color={health?.lastReady?colors.emerald:colors.gold}/>
      </View>
      <View style={{flex:1,gap:5}}>
        <Text style={{fontFamily:'serif',fontSize:16,fontWeight:'700',color:colors.text}}>
          Widget 3.0 · Sistem Tanısı
        </Text>
        <Text style={{fontSize:12,color:colors.text,fontWeight:'800'}}>
          {description.title}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Widget teknik ayrıntılarını aç"
        onPress={()=>setOpened(v=>!v)} style={{padding:8}}>
        <Feather name={opened?'chevron-up':'chevron-down'} size={20} color={colors.gold}/>
      </Pressable>
    </View>
    <Text style={{fontSize:11,lineHeight:18,color:colors.muted}}>
      {description.description}
    </Text>
    <View style={styles.indicators}>
      <Text style={[styles.indicator,{color:colors.muted}]}>
        <Feather name="layers" size={12}/> {' '+installed+' kurulu'}
      </Text>
      <Text style={[styles.indicator,{color:colors.muted}]}>
        <Feather name="database" size={12}/> {' '+(selected&&health?.lastReady?'Takvim hazır':'Takvim bekliyor')}
      </Text>
      <Text style={[styles.indicator,{color:colors.muted}]}>
        <Feather name="clock" size={12}/> {' '+(health?.nextAlarmAt?'Geçiş planlı':'Kontrol bekliyor')}
      </Text>
    </View>
    {opened?<View style={[styles.detail,{borderColor:colors.border}]}>
      {([
        ['Seçili ilçe',source.place?.name??'Henüz seçilmedi'],
        ['Native ilçe kodu',String(health?.nativeCityId??0)],
        ['Kurulu widgetlar',String(health?.installedNext??0)+' / '+String(health?.installedDay??0)],
        ['Native takvim',health?.hasTimeline?'Kayıtlı':'Yok'],
        ['Son yayın',clock(health?.calendarSourceAt??0)],
        ['Takvim kapsamı',clock(health?.calendarEndsAt??0)],
        ['Son native çizim isteği',clock(health?.lastHostDispatchAt??0)],
        ['Son kontrol',clock(health?.lastAttemptAt??0)],
        ['Son tetikleyici',health?.lastRefreshReason||'—'],
        ['Sonraki geçiş',clock(health?.nextAlarmAt??0)],
        ['Sonraki vakit',(health?.lastNextName??'')+' '+(health?.lastNextTime??'')],
        ['Arka plan işi',companion.backgroundRegistered?'Kayıtlı (kesin zaman yok)':'Kayıtlı değil'],
        ['Hata',error||health?.lastError||'Yok'],
      ] as [string,string][]).map(([name,value])=><View key={name} style={styles.detailRow}>
        <Text style={{fontSize:10.5,color:colors.muted,flex:1}}>{name}</Text>
        <Text style={{fontSize:10.5,fontWeight:'700',color:colors.text,flex:1.35,
          textAlign:'right'}}>{value.trim()||'—'}</Text>
      </View>)}
      <Text style={{color:colors.muted,fontSize:10,lineHeight:16,marginTop:4}}>
        Native kayıt ve güncelleme istekleri gerçek ana ekran piksellerinin doğrulanması değildir.
      </Text>
    </View>:null}
    {error?<Text accessibilityRole="alert" style={{fontSize:11,color:colors.warning}}>
      {error}
    </Text>:null}
    <View style={{flexDirection:'row',gap:8}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Widget'ı tanıla ve yeniden çizdir"
        disabled={busy} onPress={()=>void repair()}
        style={[styles.button,{backgroundColor:colors.accentStrong,opacity:busy?.6:1,flex:1.45}]}>
        <Feather name="refresh-cw" size={15} color="#FFFFFF"/>
        <Text style={{fontSize:11,fontWeight:'800',color:'#FFFFFF'}}>
          {busy?'Kontrol ediliyor…':'Tanıla ve yeniden çizdir'}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Widget tanı raporunu paylaş"
        onPress={()=>void share()}
        style={[styles.button,{backgroundColor:colors.soft,borderColor:colors.border,
          borderWidth:1,flex:1}]}>
        <Feather name="share-2" size={15} color={colors.gold}/>
        <Text style={{fontSize:11,fontWeight:'800',color:colors.text}}>Raporu paylaş</Text>
      </Pressable>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  outer:{borderWidth:1,borderRadius:20,padding:14,gap:12},
  header:{flexDirection:'row',alignItems:'center',gap:9},
  round:{width:38,height:38,borderRadius:13,alignItems:'center',justifyContent:'center'},
  indicators:{flexDirection:'row',flexWrap:'wrap',gap:12},
  indicator:{fontSize:10.5},
  detail:{borderTopWidth:1,paddingTop:9,gap:9},
  detailRow:{flexDirection:'row',alignItems:'flex-start',gap:12,justifyContent:'space-between'},
  button:{minHeight:42,borderRadius:12,flexDirection:'row',alignItems:'center',
    justifyContent:'center',gap:5,paddingHorizontal:8},
});
