import {useCallback,useEffect,useMemo,useState} from 'react';
import {
  AppState,NativeModules,Platform,Pressable,Share,StyleSheet,Text,View,
} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useCompanion} from '@/features/companion/CompanionProvider';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';
import {hasAndroidNativeWidgetBridge} from '@/features/native/nativeRuntime';
import {readStartupDiagnostics} from '@/features/performance/startupMetrics';

type NativeWidgetHealth={
  supported:true;nativeCityId:number;activeCityId:number;
  installedNext:number;installedDay:number;
  installedCompact?:number;installedFocus?:number;installedStrip?:number;
  installedMiniRing?:number;installedPremiumRing?:number;installedSlim?:number;widgetTheme?:string;
  lastTransferAttemptAt:number;lastTransferStage:string;
  lastTransferDetail:string;lastTransferError:string;
  lastReady:boolean;persisted:boolean;hasTimeline:boolean;state:string;
  lastError:string;lastNextName:string;lastNextTime:string;lastDateISO:string;
  lastCity:string;lastAppliedAt:number;lastAttemptAt:number;
  lastHostDispatchAt:number;lastRefreshReason:string;
  lastSyncAt:number;nextAlarmAt:number;
  calendarSourceAt:number;calendarEndsAt:number;sourceAgeHours:number;
  osRecoveryMinutes:number;
  engineVersion?:number;engineRevision?:string;
  nativeQueueWaitMs?:number;nativeBridgeQueueWaitMs?:number;
  nativeBatchMs?:number;nativeMaxBatchMs?:number;
  nativeLastBatchSize?:number;nativeCoalescedEvents?:number;
  nativeRefreshBatches?:number;nativeBridgeCalls?:number;
  nativeRefreshMs?:number;nativeCommitMs?:number;nativeRenderMs?:number;
  nativeAlarmMs?:number;nativeSkippedRenders?:number;nativeRenderedBatches?:number;
  nativeRingBitmapMs?:number;nativeRingMaxBitmapMs?:number;
  nativeRenderQueueWaitMs?:number;nativeDispatchQueueWaitMs?:number;
  nativeStaleRenderDrops?:number;nativeRenderQueueRejected?:number;
  nativeRenderPending?:boolean;nativeDispatchedFamilies?:number;
  nativeSkippedFamilies?:number;brandAssetVersion?:number;
  nativeRingCacheHits?:number;nativeRingCacheMisses?:number;
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
     typeof v.activeCityId!=='number'||typeof v.lastTransferError!=='string'||
     typeof v.lastTransferDetail!=='string'||typeof v.lastTransferStage!=='string'||
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
    description:'Bu APK eski olabilir veya native modüle bağlanılamıyor.',
    icon:'alert-triangle' as const};
  if(status.installedNext+status.installedDay+
      (status.installedCompact??0)+(status.installedFocus??0)+
      (status.installedStrip??0)+
      (status.installedMiniRing??0)+(status.installedPremiumRing??0)+
      (status.installedSlim??0)===0)return {
    title:'Ana ekranda kurulu widget yok',
    description:'Telefonun widget menüsünden sekiz Camideyiz Biz tasarımından birini ekle.',
    icon:'smartphone' as const};
  if(cityId!==null && status.activeCityId!==cityId)return {
    title:status.activeCityId===0?'İlçe native belleğe henüz aktarılmadı':
      'Widget henüz yeni ilçeye geçmedi',
    description:'Seçili ilçe ile Android widget seçim kaydı uyuşmuyor; yeniden eşitle.',
    icon:'map-pin' as const};
  if(status.lastTransferError)return {title:'Takvim aktarımında hata',
    description:status.lastTransferError,icon:'alert-triangle' as const};
  if(status.lastError)return {title:'Android çizim / alarm hatası',
    description:status.lastError,icon:'alert-triangle' as const};
  if(!status.hasTimeline)return {
    title:'Android henüz doğrulanmış takvim almadı',
    description:status.lastTransferDetail||
      'Seçilen ilçe için yayımlanmış güncel vakitlerin alınması bekleniyor.',
    icon:'calendar' as const};
  if(cityId!==null&&status.nativeCityId!==cityId)return {
    title:'Kayıtlı takvim farklı ilçeye ait',
    description:'Eski ilçenin saatleri güvenlik nedeniyle gösterilmiyor.',
    icon:'map-pin' as const};
  if(!status.lastReady)return {
    title:'Kayıtlı takvimin geçerli günü yok',
    description:'Yayımlanmış ileri tarihler için takvimi yeniden eşitle.',
    icon:'calendar' as const};
  if(status.nativeRenderPending)return {title:'Doğrulanmış takvim hazırlanıyor',
    description:'Vakitler kaydedildi; Android widget çizimi asenkron tamamlanacak.',
    icon:'clock' as const};
  if(!status.persisted)return {title:'Native veri doğrulanamadı',
    description:'Android kayıt onayı eksik, rapordaki aktarım nedenini kontrol et.',
    icon:'alert-circle' as const};
  return {title:'Android’e doğrulanmış vakitler gönderildi',
    description:'Native kayıt hazır. Ana ekran launcher çizimini telefon ekranında ayrıca kontrol et.',
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
  const installed=(health?.installedNext??0)+(health?.installedDay??0)+
    (health?.installedCompact??0)+(health?.installedFocus??0)+
    (health?.installedStrip??0)+
    (health?.installedMiniRing??0)+(health?.installedPremiumRing??0)+
    (health?.installedSlim??0);
  const repair=async()=>{
    if(busy)return;
    setBusy(true);
    setError(null);
    try{
      const result=await companion.refreshWidgets();
      // The verified foreground publisher already sends native RemoteViews.
      // A second forced refresh here was repainting all eight types again.
      await query();
      if(!result.updated)setError(result.detail);
    }catch(e){
      await query();
      setError(e instanceof Error?e.message:'Widget onarma isteği başarısız');
    }finally{setBusy(false);}
  };
  const share=async()=>{
    try{
      await Share.share({message:
        'Camideyiz Biz · Widget Engine 4.1 tanılama\n'+
        JSON.stringify({
          time:new Date().toISOString(),
          selectedDistrictId:cityId,
          selectedDistrict:source.place?.name??null,
          state:description.title,
          native:health,
          widgetSync:companion.widget,
          backgroundRegistered:companion.backgroundRegistered,
          backgroundReport:companion.backgroundReport,
          startupPerformance:readStartupDiagnostics(),
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
          Widget Engine 4.1 · Sistem Tanısı
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
        ['Android seçili ilçe kodu',String(health?.activeCityId??0)],
        ['Yayımlanmış takvim ilçe kodu',String(health?.nativeCityId??0)],
        ['Uygulama takvim durumu',source.status],
        ['Uygulama veri hatası',source.failureReason??'Yok'],
        ['Son eşitleme sonucu',companion.widget.detail],
        ['Android native bağlantısı',
          hasAndroidNativeWidgetBridge()?'Hazır — gerçek APK köprüsü':'Eksik — APK desteği yok'],
        ['Kurulu widgetlar (1×1 / 2×2 / Günlük / Odak / Şerit / Mini Çember / Premium Çember / 1×2 Dikey)',
          [health?.installedCompact??0,health?.installedNext??0,
            health?.installedDay??0,health?.installedFocus??0,
            health?.installedStrip??0,health?.installedMiniRing??0,
            health?.installedPremiumRing??0,health?.installedSlim??0].join(' / ')],
        ['Widget teması',health?.widgetTheme??'Sistem'],
        ['Native takvim',health?.hasTimeline?'Kayıtlı':'Yok'],
        ['Son yayın',clock(health?.calendarSourceAt??0)],
        ['Takvim kapsamı',clock(health?.calendarEndsAt??0)],
        ['Son native çizim isteği',clock(health?.lastHostDispatchAt??0)],
        ['Son kontrol',clock(health?.lastAttemptAt??0)],
        ['Son tetikleyici',health?.lastRefreshReason||'—'],
        ['Native motor sürümü',String(health?.engineRevision??health?.engineVersion??'Eski APK')],
        ['Native son işlem / kayıt / çizim (ms)',[
          health?.nativeRefreshMs??'—',health?.nativeCommitMs??'—',
          health?.nativeRenderMs??'—'].join(' / ')],
        ['Native alarm yenilemesi (ms)',String(health?.nativeAlarmMs??'—')],
        ['Broadcast kuyrukta bekleme (ms)',String(health?.nativeQueueWaitMs??'—')],
        ['React Native köprü kuyruğu (ms)',String(health?.nativeBridgeQueueWaitMs??'—')],
        ['Native son batch / en yavaş batch (ms)',[
          health?.nativeBatchMs??'—',health?.nativeMaxBatchMs??'—'].join(' / ')],
        ['Birleştirilen Android olayları',String(health?.nativeCoalescedEvents??'—')],
        ['Atlanan gereksiz çizimler',String(health?.nativeSkippedRenders??'—')],
        ['Native çizim batch sayısı',String(health?.nativeRenderedBatches??'—')],
        ['Çember bitmap son / en yavaş (ms)',[
          health?.nativeRingBitmapMs??'—',health?.nativeRingMaxBitmapMs??'—'].join(' / ')],
        ['Çember bitmap önbelleği (isabet / üretim)',[
          health?.nativeRingCacheHits??'—',health?.nativeRingCacheMisses??'—'].join(' / ')],
        ['Render / RemoteViews sıra bekleme (ms)',[
          health?.nativeRenderQueueWaitMs??'—',
          health?.nativeDispatchQueueWaitMs??'—'].join(' / ')],
        ['Eski nesil çizim iptali',String(health?.nativeStaleRenderDrops??'—')],
        ['Değişen / atlanan widget türleri',[
          health?.nativeDispatchedFamilies??'—',
          health?.nativeSkippedFamilies??'—'].join(' / ')],
        ['Çizim işi devam ediyor',health?.nativeRenderPending?'Evet':'Hayır'],
        ['Marka görsel sürümü',String(health?.brandAssetVersion??'—')],
        ['Aktarım aşaması',health?.lastTransferStage||'Başlamadı'],
        ['Son aktarım denemesi',clock(health?.lastTransferAttemptAt??0)],
        ['Son aktarım açıklaması',health?.lastTransferDetail||'—'],
        ['Sonraki geçiş',clock(health?.nextAlarmAt??0)],
        ['Sonraki vakit',(health?.lastNextName??'')+' '+(health?.lastNextTime??'')],
        ['Arka plan işi',companion.backgroundRegistered?'Kayıtlı (kesin zaman yok)':'Kayıtlı değil'],
        ['Arka plan servis durumu',companion.backgroundReport?.registrationStatus??'Henüz kontrol edilmedi'],
        ['Arka plan kayıt sorunu',companion.backgroundReport?.registrationError||'Yok'],
        ['Hata',error||health?.lastTransferError||health?.lastError||'Yok'],
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
          {busy?'Eşitleniyor…':'Takvimi eşitle ve çizdir'}
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
