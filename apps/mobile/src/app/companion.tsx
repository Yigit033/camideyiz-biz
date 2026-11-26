import {useEffect,useMemo,useState} from 'react';
import {
  Alert,Linking,Platform,Pressable,ScrollView,StyleSheet,Switch,Text,View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import {PRAYER_KEYS,voicedAdhanPrayers,
  type AlertSound,type PrayerKey,type PrayerSchedule} from '@camideyiz/core';
import {Atmosphere} from '@/components/LuxuryArtwork';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';
import {useCompanion} from '@/features/companion/CompanionProvider';
import {CHANNEL_AUDIBLE,CHANNEL_SILENT,setPrayerChannels} from '@/features/companion/notificationService';
import {isExpoGoRuntime} from '@/features/native/nativeRuntime';
import {nativeAdhanSupported,nativeAdhanStatus,openAdhanSettings}
  from '@/features/companion/nativeAdhan';
import {AdhanPanel} from '@/features/companion/AdhanPanel';
import {Widget3Diagnostics} from '@/features/widgets/Widget3Diagnostics';
import {WidgetPreview} from '@/features/widgets/WidgetPreview';

const NAMES:Record<PrayerKey,string>={
  imsak:'İmsak',gunes:'Güneş',ogle:'Öğle',ikindi:'İkindi',aksam:'Akşam',yatsi:'Yatsı',
};
const ICONS:Record<PrayerKey,keyof typeof Feather.glyphMap>={
  imsak:'moon',gunes:'sunrise',ogle:'sun',ikindi:'clock',aksam:'sunset',yatsi:'moon',
};
const LEADS=[0,5,10,15,30,45,60] as const;
/** Section titles stay on one line and shrink to fit beside their control. */
const SECTION_TITLE_FIT={numberOfLines:1,adjustsFontSizeToFit:true,minimumFontScale:.65} as const;
const SOUND_OPTIONS:readonly {id:AlertSound;label:string;icon:keyof typeof Feather.glyphMap}[]=[
  {id:'default',label:'Bildirim sesi',icon:'bell'},
  {id:'adhan',label:'Ezan',icon:'volume-2'},
  {id:'silent',label:'Sessiz',icon:'volume-x'},
];

function InfoPill({text,icon}:{
  text:string;icon:keyof typeof Feather.glyphMap;
}){
  const {colors}=useAppTheme();
  return <View style={[styles.infoPill,{borderColor:colors.border,backgroundColor:colors.soft}]}>
    <Feather name={icon} size={13} color={colors.gold}/>
    <Text style={{color:colors.text,fontSize:10,fontWeight:'700'}}>{text}</Text>
  </View>;
}
function WidgetShowcase(){
  const {colors}=useAppTheme();
  const source=useSharedPrayerSource();
  const days=useMemo(():readonly PrayerSchedule[]=>{
    const d=source.days;
    if(!d||d.city.id!==source.place?.id)return [];
    return d.source==='idamedya-diyanet-republished'?d.upcoming:[d.today,d.next];
  },[source.days,source.place?.id]);
  return <View style={{gap:11}}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLead}>
        <MaterialCommunityIcons name="widgets-outline" size={21} color={colors.gold}/>
        <Text {...SECTION_TITLE_FIT} style={[styles.sectionTitle,{color:colors.text}]}>
          Ana ekran widget’ları
        </Text>
      </View>
      <InfoPill icon="smartphone" text="Önizleme"/>
    </View>
    <WidgetPreview days={days} dark={colors.isDark}/>
  </View>;
}

export default function CompanionScreen(){
  const {colors}=useAppTheme();
  const companion=useCompanion();
  const source=useSharedPrayerSource();
  const {settings,permission,sync,ready,settings:alerts}=companion;
  const announcement=companion.announcement;
  const allAtTime=(['imsak','ogle','ikindi','aksam','yatsi'] as const)
    .every(key=>settings.rules[key].enabled&&settings.rules[key].atTime);
  const nextReminder=sync.nextAt
    ?new Date(sync.nextAt).toLocaleString('tr-TR',{
      timeZone:'Europe/Istanbul',day:'numeric',month:'short',hour:'2-digit',
      minute:'2-digit',
    }):null;
  const [working,setWorking]=useState(false);
  // One source of truth: the provider tracks Android "Alarms & reminders"
  // access, refreshes it on return from Settings and re-arms reminders.
  const exactAlarms=companion.exactAlarms;
  const exactMissing=Platform.OS==='android'&&exactAlarms===false;
  // The full ezan is native Android playback; Expo Go and iOS never offer it.
  const adhanAvailable=Platform.OS==='android'&&!isExpoGoRuntime();
  const voicedNow=new Set<PrayerKey>(voicedAdhanPrayers(settings));
  const openExactAccess=()=>void companion.requestExactAlarms().catch(()=>
    openAdhanSettings('exact').catch(()=>
      Alert.alert('Ayar açılamadı','Uygulama izinlerinden “Alarmlar ve hatırlatıcılar” iznini aç.')));
  const askExactAlarms=(reason:'notifications'|'adhan')=>{
    Alert.alert(reason==='adhan'?'Ezan için bir izin kaldı':'Dakikası dakikasına teslim',
      reason==='adhan'
        ?'Ezanın vaktinde okunması için “Alarmlar ve hatırlatıcılar” iznini aç.'
        :'Bildirimlerin tam vaktinde gelmesi için “Alarmlar ve hatırlatıcılar” iznini aç.',
      [{text:'Daha sonra',style:'cancel'},{text:'İzni aç',onPress:openExactAccess}]);
  };
  const selectSound=async(choice:AlertSound)=>{
    if(choice!=='adhan'){companion.setSound(choice);return;}
    if(!nativeAdhanSupported){
      Alert.alert('Ezan bu cihazda okunamıyor','Bildirim sesini seçebilirsin.');
      return;
    }
    // Choosing the ezan turns reminders on: an ezan chosen while they were
    // off used to change nothing that could ever play.
    if(!await companion.chooseAdhan()){
      Alert.alert('Bildirim izni gerekli','Ezan için bildirim iznini aç.',
        [{text:'Kapat',style:'cancel'},
         {text:'Ayarları aç',onPress:()=>void openAdhanSettings('notifications')
           .catch(()=>Linking.openSettings())}]);
      return;
    }
    // Ask right away when the one permission the ezan cannot work without
    // is missing (Android 14+ denies it by default on a fresh install).
    const native=await nativeAdhanStatus().catch(()=>null);
    if(native?.supported&&!native.exactPermission)askExactAlarms('adhan');
  };

  const toggleMaster=async(next:boolean)=>{
    setWorking(true);
    try{
      const ok=await companion.setEnabled(next);
      if(!ok)Alert.alert('Bildirim izni gerekli',
        'Namaz vakti hatırlatmaları için telefon ayarlarından bildirim izni vermen gerekir.',
        [{text:'Kapat'}, {text:'Sistem ayarları',onPress:()=>void Linking.openSettings()}]);
      else if(next&&exactMissing)askExactAlarms('notifications');
    }finally{setWorking(false);}
  };
  // The ezan has its own "Vakitteki gibi dene" in the ezan panel; this one
  // checks the notification path (early reminders, İmsak, fallbacks).
  const test=async()=>{
    if(permission!=='granted'){
      Alert.alert('İzin gerekli','Önce bildirimleri etkinleştir.');return;
    }
    try{
      await setPrayerChannels();
      await Notifications.scheduleNotificationAsync({
        content:{
          title:'Camideyiz Biz · test bildirimi',
          body:'Vakit hatırlatmaları için bildirim denemesi başarılı.',
          sound:settings.sound==='silent'?false:'default',
          data:{kind:'companion-test'},
        },
        trigger:{
          type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds:5,
          ...(isExpoGoRuntime()?{}:{
            channelId:settings.sound==='silent'?CHANNEL_SILENT:CHANNEL_AUDIBLE,
          }),
        },
      });
      Alert.alert('Test ayarlandı','Test bildirimi yaklaşık 5 saniye sonra görüntülenecek.');
    }catch{
      Alert.alert('Test yapılamadı','Bildirim ayarlarını ve izinlerini kontrol et.');
    }
  };
  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <Atmosphere dark={colors.isDark}/>
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Geri dön"
          onPress={()=>router.back()} style={[styles.back,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Feather name="arrow-left" size={20} color={colors.text}/>
        </Pressable>
        <View style={{flex:1,gap:4}}>
          <Text style={{fontFamily:'serif',fontSize:28,fontWeight:'700',color:colors.text}}>
            Widget ve Bildirimler
          </Text>
          <Text style={{fontSize:11,color:colors.muted,lineHeight:17}}>
            Vakitleri ana ekranında gör, hatırlatmalarını yönet.
          </Text>
        </View>
      </View>
      <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <WidgetShowcase/>
      </View>
      <Widget3Diagnostics/>
      <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLead}>
            <Feather name="bell" size={21} color={colors.gold}/>
            <Text {...SECTION_TITLE_FIT} style={[styles.sectionTitle,{color:colors.text}]}>
              Namaz Vakti Hatırlatmaları
            </Text>
          </View>
          <Switch
            value={settings.enabled}
            disabled={!ready||working}
            onValueChange={v=>void toggleMaster(v)}
            accessibilityLabel="Namaz vakti bildirimlerini etkinleştir"
            trackColor={{false:colors.border,true:colors.emerald}}
            thumbColor={settings.enabled?'#F5D6A4':'#FFFFFF'}/>
        </View>
        <Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>
          Vakit girdiğinde ya da 5–60 dakika önce hatırlatma al.
        </Text>
        <View style={{gap:8}}>
          <Text style={{fontSize:12,color:colors.text,fontWeight:'800'}}>Vakit geldiğinde</Text>
          <View accessibilityRole="radiogroup"
            style={[styles.segment,{backgroundColor:colors.soft,borderColor:colors.border}]}>
            {SOUND_OPTIONS.filter(option=>option.id!=='adhan'||adhanAvailable).map(option=>{
              const selected=settings.sound===option.id;
              return <Pressable key={option.id}
                accessibilityRole="radio" accessibilityState={{selected}}
                accessibilityLabel={option.label}
                onPress={()=>void selectSound(option.id)}
                style={[styles.soundOption,{
                  backgroundColor:selected?colors.accentStrong:'transparent',
                  borderColor:selected?colors.gold:'transparent'}]}>
                {option.id==='adhan'
                  ?<MaterialCommunityIcons name="mosque" size={17}
                    color={selected?'#FFFFFF':colors.gold}/>
                  :<Feather name={option.icon} size={16}
                    color={selected?'#FFFFFF':colors.gold}/>}
                <Text style={{fontSize:12,fontWeight:'800',
                  color:selected?'#FFFFFF':colors.text}}>{option.label}</Text>
              </Pressable>;
            })}
          </View>
          <Text style={{fontSize:10.5,color:colors.muted,lineHeight:16}}>
            {settings.sound==='adhan'
              ?'Seçtiğin vakitlerde bildirim yerine ezan okunur.'
              :settings.sound==='silent'
                ?'Bildirimler sessiz gelir.'
                :'Bildirimler telefonun bildirim sesiyle gelir.'}
          </Text>
          {settings.sound==='adhan'&&nativeAdhanSupported
            ?<AdhanPanel onAskExact={openExactAccess}/>:null}
        </View>
        <View style={[styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          <MaterialCommunityIcons name="mosque" size={21} color={colors.gold}/>
          <View style={{flex:1,gap:7}}>
            <Text style={{fontSize:13,fontWeight:'800',color:colors.text}}>
              Beş vakitte bildir
            </Text>
            <Pressable accessibilityRole="button"
              accessibilityState={{selected:allAtTime}}
              onPress={()=>companion.setEzanAtTimeForAll(!allAtTime)}
              disabled={!settings.enabled}
              style={[styles.miniButton,{alignSelf:'flex-start',
                backgroundColor:allAtTime?colors.accentStrong:colors.surface,
                borderWidth:allAtTime?0:1,borderColor:colors.border,
                opacity:settings.enabled?1:.5}]}>
              <Feather name={allAtTime?'check-circle':'bell'} size={14}
                color={allAtTime?'#FFFFFF':colors.gold}/>
              <Text style={{fontSize:11,fontWeight:'800',
                color:allAtTime?'#FFFFFF':colors.text}}>
                {allAtTime?'Beş vakit açık':'Beş vakti etkinleştir'}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
          <InfoPill text={permission==='granted'?'İzin verildi':
            permission==='denied'?'İzin kapalı':'İzin bekleniyor'}
            icon={permission==='granted'?'check-circle':'alert-circle'}/>
          <InfoPill text={sync.scheduled+' planlanan uyarı'} icon="calendar"/>
          <InfoPill text={source.place?.name??'Konum seçilmedi'} icon="map-pin"/>
          {nextReminder?<InfoPill text={'Sıradaki: '+nextReminder} icon="clock"/>:null}
        </View>
        {sync.error?<Text style={{fontSize:11,color:'#D17E70'}}>
          Uyarı: {sync.error}
        </Text>:null}
        <View style={{gap:11}}>
          {PRAYER_KEYS.map(key=>{
            const rule=alerts.rules[key],label=NAMES[key];
            return <View key={key} style={[styles.ruleCard,{
              borderColor:colors.border,backgroundColor:colors.soft}]}>
              <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
                <View style={[styles.prayerIcon,{backgroundColor:colors.surface}]}>
                  <Feather name={ICONS[key]} size={17} color={colors.gold}/>
                </View>
                <View style={{flex:1,gap:3}}>
                  <Text style={{color:colors.text,fontSize:14,fontWeight:'800'}}>{label}</Text>
                  <Text style={{color:colors.muted,fontSize:10}}>
                    {key==='gunes'?'Güneş doğuşu (ezan değil)':voicedNow.has(key)?'Vakitte ezan':'Vakit uyarısı'}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={label+' bildirimini aç veya kapat'}
                  value={rule.enabled} disabled={!settings.enabled}
                  onValueChange={v=>companion.setRule(key,{enabled:v})}
                  trackColor={{false:colors.border,true:colors.emerald}}
                  thumbColor={rule.enabled?'#F4D49C':'#FFFFFF'}/>
              </View>
              {settings.enabled&&rule.enabled?<View style={{gap:9,marginTop:3}}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{checked:rule.atTime}}
                  onPress={()=>companion.setRule(key,{atTime:!rule.atTime})}
                  style={{flexDirection:'row',alignItems:'center',gap:8}}>
                  <Feather name={rule.atTime?'check-square':'square'}
                    size={18} color={colors.emerald}/>
                  <Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>{voicedNow.has(key)?'Vakit girdiğinde ezan okunsun':'Vakit girdiğinde hatırlat'}</Text>
                </Pressable>
                <Text style={{color:colors.muted,fontSize:10}}>Ek erken hatırlatma</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{gap:5}}>
                  {LEADS.map(lead=><Pressable key={lead} accessibilityRole="button"
                    accessibilityState={{selected:rule.minutesBefore===lead}}
                    onPress={()=>companion.setRule(key,{minutesBefore:lead})}
                    style={[styles.lead,{borderColor:rule.minutesBefore===lead?colors.gold:colors.border,
                      backgroundColor:rule.minutesBefore===lead?colors.accentStrong:colors.surface}]}>
                    <Text style={{color:rule.minutesBefore===lead?'#FFFFFF':colors.text,
                      fontSize:11,fontWeight:'700'}}>
                      {lead===0?'Yok':lead+' dk'}
                    </Text>
                  </Pressable>)}
                </ScrollView>
                {!rule.atTime&&rule.minutesBefore===0?<Text style={{fontSize:10,color:'#D09660'}}>
                  Bu vakit için hiçbir uyarı seçilmedi.
                </Text>:null}
              </View>:null}
            </View>;
          })}
        </View>
        {Platform.OS==='android'&&!isExpoGoRuntime()?<View style={[styles.note,{
          backgroundColor:colors.soft,borderColor:exactMissing?'#CE8C67':colors.border,
        }]}>
          <Feather name={exactMissing?'alert-triangle':'clock'} size={18}
            color={exactMissing?'#C68049':colors.emerald}/>
          <View style={{flex:1,gap:6}}>
            <Text style={{color:colors.text,fontSize:11,fontWeight:'800'}}>
              {exactMissing?'Bildirimler birkaç dakika gecikebilir':'Zamanında teslim'}
            </Text>
            <Text style={{color:colors.muted,fontSize:10,lineHeight:16}}>
              {exactMissing
                ?'Tam vaktinde gelmesi için “Alarmlar ve hatırlatıcılar” iznini aç.'
                :settings.precise
                  ?'Bildirimler tam dakikasında gelir; durum çubuğunda alarm simgesi görünür.'
                  :'Bazı telefonlarda bildirimler birkaç dakika gecikebilir.'}
            </Text>
            {exactMissing?<Pressable accessibilityRole="button"
              onPress={()=>askExactAlarms(settings.sound==='adhan'?'adhan':'notifications')}
              style={{paddingVertical:6}}>
              <Text style={{color:colors.emerald,fontSize:11,fontWeight:'800'}}>
                Alarmlar ve hatırlatıcılar iznini aç
              </Text>
            </Pressable>:<View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{flex:1,color:colors.text,fontSize:11,fontWeight:'700'}}>
                Dakikası dakikasına (önerilir)
              </Text>
              <Switch value={settings.precise} disabled={!settings.enabled}
                accessibilityLabel="Bildirimleri alarm saati önceliğiyle dakikası dakikasına kur"
                onValueChange={v=>companion.setPrecise(v)}
                trackColor={{false:colors.border,true:colors.emerald}}
                thumbColor={settings.precise?'#F4D49C':'#FFFFFF'}/>
            </View>}
          </View>
        </View>:null}
        <View style={{flexDirection:'row',gap:8}}>
          <Pressable disabled={!settings.enabled||companion.syncing}
            onPress={companion.refresh} accessibilityRole="button"
            style={[styles.action,{flex:1,backgroundColor:colors.accentStrong,
              opacity:!settings.enabled?.5:1}]}>
            <Feather name="refresh-cw" color="#FFFFFF" size={16}/>
            <Text style={{color:'#FFFFFF',fontWeight:'800',fontSize:12}}>Vakitleri eşitle</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={permission!=='granted'}
            onPress={()=>void test()} style={[styles.action,{flex:1,backgroundColor:colors.soft,
              opacity:permission!=='granted'?.5:1,borderWidth:1,borderColor:colors.border}]}>
            <Feather name="send" color={colors.gold} size={16}/>
            <Text style={{fontWeight:'800',fontSize:12,color:colors.text}}>Test bildirimi</Text>
          </Pressable>
        </View>
      </View>
      {(announcement.available||announcement.enabled||
        announcement.status==='pending-disable')?
      <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLead}>
            <MaterialCommunityIcons name="bullhorn-outline" size={20} color={colors.gold}/>
            <Text {...SECTION_TITLE_FIT} style={[styles.sectionTitle,{color:colors.text}]}>
              Özel Duyurular
            </Text>
          </View>
          <Switch
            accessibilityLabel="Ürün sahibinin duyuru bildirimlerine abone ol"
            value={announcement.enabled}
            disabled={!announcement.ready||announcement.status==='syncing'||
              (!announcement.available&&!announcement.enabled)}
            onValueChange={next=>void announcement.setEnabled(next)}
            trackColor={{false:colors.border,true:colors.emerald}}
            thumbColor={announcement.enabled?'#F4D49C':'#FFFFFF'}/>
        </View>
        <Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>
          Camideyiz Biz duyurularını al.
        </Text>
        <View style={[styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          <Feather name={announcement.status==='registered'?'check-circle':
            announcement.status==='not-configured'?'shield':'info'}
            size={18} color={colors.gold}/>
          <View style={{flex:1,gap:6}}>
            <Text style={{fontSize:12,fontWeight:'800',color:colors.text}}>
              {announcement.status==='registered'?'Duyurular açık':
                announcement.status==='pending-disable'?'Duyurular kapatılıyor':
                announcement.status==='not-configured'?'Duyurular yakında':
                announcement.status==='error'?'Duyurulara bağlanılamadı, tekrar dene':
                announcement.status==='syncing'?'Güncelleniyor…':
                'Duyurular kapalı'}
            </Text>
          </View>
        </View>
        {announcement.available&&
          (announcement.enabled||announcement.status==='pending-disable')
          ?<Pressable accessibilityRole="button"
            onPress={()=>void announcement.refresh()}
            style={[styles.miniButton,{alignSelf:'flex-start',
              backgroundColor:colors.soft,borderWidth:1,borderColor:colors.border}]}>
            <Feather name="refresh-cw" size={14} color={colors.gold}/>
            <Text style={{fontSize:11,fontWeight:'800',color:colors.text}}>
              Yeniden dene
            </Text>
          </Pressable>:null}
      </View>:null}
      <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLead}>
            <Feather name="inbox" size={20} color={colors.gold}/>
            <Text {...SECTION_TITLE_FIT} style={[styles.sectionTitle,{color:colors.text}]}>
              Bildirim geçmişi
            </Text>
          </View>
          {companion.inbox.length?<Pressable onPress={companion.clearInbox} accessibilityRole="button">
            <Text style={{color:'#BD756C',fontSize:12,fontWeight:'700'}}>Tümünü sil</Text>
          </Pressable>:null}
        </View>
        {companion.inbox.length?
          companion.inbox.slice(0,40).map(item=><View key={item.id} style={[styles.inboxRow,{
            borderColor:colors.border,backgroundColor:colors.soft}]}>
            <Feather name="bell" size={17} color={colors.gold}/>
            <View style={{flex:1,gap:4}}>
              <Text style={{fontSize:12,fontWeight:'800',color:colors.text}}>{item.title}</Text>
              <Text style={{fontSize:11,color:colors.muted}}>{item.body}</Text>
              <Text style={{fontSize:9.5,color:colors.muted}}>
                {new Date(item.receivedAt).toLocaleString('tr-TR')}
              </Text>
            </View>
            <Pressable onPress={()=>companion.deleteInbox(item.id)}
              accessibilityRole="button" accessibilityLabel="Bu geçmiş kaydını sil">
              <Feather name="trash-2" size={17} color="#BF7770"/>
            </Pressable>
          </View>):
          <View style={styles.emptyInbox}>
            <Feather name="bell-off" size={25} color={colors.gold}/>
            <Text style={{fontSize:13,fontWeight:'700',color:colors.text}}>
              Henüz alınmış hatırlatma yok
            </Text>
          </View>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{paddingHorizontal:16,paddingTop:15,paddingBottom:48,gap:15},
  header:{flexDirection:'row',gap:12,alignItems:'center',marginBottom:5},
  back:{height:41,width:41,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center'},
  panel:{borderWidth:1,borderRadius:23,padding:14,gap:15},
  sectionHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:9},
  // Takes only the width the trailing switch or button leaves (minus the
  // 9pt gap), so a long title can never run under it.
  sectionLead:{flex:1,flexDirection:'row',gap:8,alignItems:'center'},
  sectionTitle:{flexShrink:1,fontFamily:'serif',fontSize:18,fontWeight:'700'},
  infoPill:{paddingHorizontal:8,minHeight:26,borderWidth:1,borderRadius:15,
    flexDirection:'row',gap:5,alignItems:'center'},
  note:{borderWidth:1,borderRadius:13,padding:11,flexDirection:'row',alignItems:'flex-start',gap:8},
  miniButton:{height:33,paddingHorizontal:10,borderRadius:11,
    flexDirection:'row',gap:6,alignItems:'center'},
  ruleCard:{borderWidth:1,borderRadius:16,padding:12,gap:8},
  prayerIcon:{width:33,height:33,borderRadius:12,alignItems:'center',justifyContent:'center'},
  lead:{borderWidth:1,borderRadius:13,paddingHorizontal:11,minHeight:32,
    justifyContent:'center',alignItems:'center'},
  segment:{borderWidth:1,borderRadius:15,padding:4,flexDirection:'row',gap:4},
  soundOption:{flex:1,borderWidth:1,minHeight:44,borderRadius:12,flexDirection:'row',
    alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:6},
  action:{minHeight:45,borderRadius:13,flexDirection:'row',gap:7,
    alignItems:'center',justifyContent:'center'},
  inboxRow:{borderWidth:1,borderRadius:14,padding:11,
    flexDirection:'row',alignItems:'flex-start',gap:10},
  emptyInbox:{alignItems:'center',gap:9,padding:22},
});
