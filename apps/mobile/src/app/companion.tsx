import {useEffect,useMemo,useState} from 'react';
import {
  Alert,AppState,Linking,Platform,Pressable,ScrollView,StyleSheet,Switch,Text,View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import {PRAYER_KEYS,buildPrayerWidgetSnapshot,zonedClock,type PrayerKey,type PrayerSchedule}
  from '@camideyiz/core';
import {Atmosphere} from '@/components/LuxuryArtwork';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';
import {useCompanion} from '@/features/companion/CompanionProvider';
import {CHANNEL_AUDIBLE,CHANNEL_SILENT,setPrayerChannels} from '@/features/companion/notificationService';
import {isExpoGoRuntime} from '@/features/native/nativeRuntime';
import {nativeAdhanSupported,nativeAdhanStatus,requestNativeAdhanPermission,testNativeAdhan}
  from '@/features/companion/nativeAdhan';

const NAMES:Record<PrayerKey,string>={
  imsak:'İmsak',gunes:'Güneş',ogle:'Öğle',ikindi:'İkindi',aksam:'Akşam',yatsi:'Yatsı',
};
const ICONS:Record<PrayerKey,keyof typeof Feather.glyphMap>={
  imsak:'moon',gunes:'sunrise',ogle:'sun',ikindi:'clock',aksam:'sunset',yatsi:'moon',
};
const LEADS=[0,5,10,15,30,45,60] as const;

function InfoPill({text,icon}:{
  text:string;icon:keyof typeof Feather.glyphMap;
}){
  const {colors}=useAppTheme();
  return <View style={[styles.infoPill,{borderColor:colors.border,backgroundColor:colors.soft}]}>
    <Feather name={icon} size={13} color={colors.gold}/>
    <Text style={{color:colors.text,fontSize:10,fontWeight:'700'}}>{text}</Text>
  </View>;
}
function WidgetShowcase({now}: {now:number}){
  const {colors}=useAppTheme();
  const source=useSharedPrayerSource();
  const companion=useCompanion();
  const days=useMemo(():readonly PrayerSchedule[]=>{
    const d=source.days;
    if(!d||d.city.id!==source.place?.id)return [];
    return d.source==='idamedya-diyanet-republished'?d.upcoming:[d.today,d.next];
  },[source.days,source.place?.id]);
  const preview=buildPrayerWidgetSnapshot(days,now);
  const displayTimes=preview.times;
  return <View style={{gap:11}}>
    <View style={styles.sectionHeader}>
      <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
        <MaterialCommunityIcons name="widgets-outline" size={21} color={colors.gold}/>
        <Text style={[styles.sectionTitle,{color:colors.text}]}>Ana ekran widget’ları</Text>
      </View>
      <InfoPill icon="smartphone" text="Önizleme"/>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{gap:12,paddingRight:12}}>
      <View style={[styles.widgetCompact,{backgroundColor:'#063B34',borderColor:'#D1AC6D'}]}>
        <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
          <Feather name="moon" size={15} color="#F2CE8A"/>
          <Text style={styles.widgetBrand}>Camideyiz Biz</Text>
        </View>
        <Text style={{fontSize:11,color:'#B1D9C8'}} numberOfLines={1}>
          {preview.status==='ready'?preview.city:'Takvim seçilmedi'}
        </Text>
        <View style={{gap:2,flex:1,justifyContent:'center'}}>
          <Text style={{fontSize:11,color:'#DCE9DD'}}>
            {preview.status==='ready'?'Sıradaki · '+preview.nextName:'Vakitler yükleniyor'}
          </Text>
          <Text style={{fontSize:33,fontWeight:'800',color:'#F1CF8D'}}>
            {preview.status==='ready'?preview.nextTime:'—'}
          </Text>
          <Text style={{fontSize:10,color:'#BCDCCC'}}>
            {preview.status==='ready'?'Vakte yaklaşık '+preview.remainingMinutes+' dakika':'Takvimi aç'}
          </Text>
        </View>
        <Text style={{fontSize:9,color:'#8EB8A9'}}>Sıradaki Vakit · 2×2</Text>
      </View>
      <View style={[styles.widgetWide,{backgroundColor:'#063B34',borderColor:'#D1AC6D'}]}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <Text style={styles.widgetBrand}>☪  Camideyiz Biz</Text>
          <Text numberOfLines={1} style={{fontSize:10,color:'#B1D9C8',maxWidth:105}}>
            {preview.city}
          </Text>
        </View>
        <Text style={{fontSize:11,fontWeight:'600',color:'#F1CF8D'}}>Bugünün vakitleri</Text>
        <View style={{gap:5,flex:1}}>
          {displayTimes.length?
            displayTimes.map(item=><View key={item.key}
              style={{flexDirection:'row',justifyContent:'space-between'}}>
              <Text style={{fontSize:10.5,color:'#BEDACC'}}>{item.label}</Text>
              <Text style={{fontSize:10.5,color:'#FBF1E1',fontWeight:'800'}}>{item.time}</Text>
            </View>)
            :<Text style={{fontSize:12,color:'#A5CDBE'}}>
              Vakitler henüz yüklenmedi.
            </Text>}
        </View>
        <Text style={{fontSize:9,color:'#A0C8B9'}}>
          {preview.status==='ready'?'Sıradaki: '+preview.nextName+' · '+preview.nextTime:'Yenilemek için aç'}
        </Text>
      </View>
    </ScrollView>
    {companion.lastWidgetTransfer&&
      companion.lastWidgetTransfer.cityId===source.place?.id&&
      companion.lastWidgetTransfer.dateISO===
        zonedClock(new Date(now),'Europe/Istanbul').dateISO
      ?<View style={[styles.note,{backgroundColor:colors.soft,
        borderColor:colors.border}]}>
        <Feather name="check-circle" size={17} color={colors.emerald}/>
        <View style={{flex:1,gap:5}}>
          <Text style={{fontSize:12,fontWeight:'800',color:colors.text}}>
            Native belleğe aktarılan takvim
          </Text>
          <Text style={{fontSize:11,color:colors.text,fontWeight:'700'}}>
            {companion.lastWidgetTransfer.city} ·
            {' '+companion.lastWidgetTransfer.nextName+' '+
              companion.lastWidgetTransfer.nextTime}
          </Text>
          <Text style={{fontSize:10.5,color:colors.muted,lineHeight:17}}>
            {companion.lastWidgetTransfer.times
              .map(item=>item.label+' '+item.time).join(' · ')}
          </Text>
          <Text style={{fontSize:10,color:colors.muted}}>
            {'Son aktarım: '+new Date(companion.lastWidgetTransfer.sentAt)
              .toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
          </Text>
          <Text style={{fontSize:10,color:colors.muted,lineHeight:16}}>
            Telefonun ana ekranındaki widget saatlerini bunlarla karşılaştır.
            Aktarım kaydı, telefonun görüntülediğini tek başına doğrulamaz.
          </Text>
        </View>
      </View>:null}
    {Platform.OS==='android'&&companion.widget.available?<View style={[
      styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
      <Feather name="shield" size={16} color={colors.gold}/>
      <View style={{flex:1,gap:5}}>
        <Text style={{fontSize:12,color:colors.text,fontWeight:'800'}}>
          Android widget çalışma durumu
        </Text>
        <Text style={{fontSize:11,color:colors.text}}>
          {'Ana ekrana ekli: '+(companion.widget.installedNext??0)+
            ' sıradaki vakit · '+(companion.widget.installedDay??0)+' günlük takvim'}
        </Text>
        <Text style={{fontSize:10.5,lineHeight:17,color:colors.muted}}>
          {companion.widget.nativePersisted
            ?'Doğrulanmış takvim iki native widget kaydına yazıldı. '+
              'Ekranda çizim tamamlandığını Android bildirmez.'
            :'Native kayıt henüz doğrulanmadı.'}
        </Text>
        {companion.widget.lastNativeWriteAt
          ?<Text style={{fontSize:10.5,color:colors.muted}}>
            {'Son native yazım: '+new Date(companion.widget.lastNativeWriteAt)
              .toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
          </Text>:null}
        {companion.widget.nextNativeAlarmAt
          ?<Text style={{fontSize:10.5,color:colors.muted}}>
            {'Sonraki vakit geçişi için planlanan kontrol: '+
              new Date(companion.widget.nextNativeAlarmAt)
                .toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}
          </Text>:null}
        <Text style={{fontSize:10,color:colors.muted,lineHeight:16}}>
          Alarm zamanı pil tasarrufuna bağlı gecikebilir. Saatlerin gerçek
          görünümünü telefonunun ana ekranında karşılaştır.
        </Text>
      </View>
    </View>:null}
    <Text style={{fontSize:11,lineHeight:18,color:colors.muted}}>
      Telefonun ana ekranında boş bir alana uzun bas, Widget’lar bölümünden
      Camideyiz Biz’i bul ve boyut seç. Buradaki önizleme, telefon
      ana ekranındaki widget’ın güncellendiği anlamına gelmez.
    </Text>
    <View style={[styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
      <Feather name="refresh-cw" size={15} color={colors.gold}/>
      <View style={{flex:1,gap:4}}>
        <Text style={{fontSize:11,fontWeight:'800',color:colors.text}}>
          {Platform.OS==='ios'?'Otomatik vakit yenileme'
            :companion.backgroundRegistered
              ?'Otomatik yenileme planlandı'
              :'Otomatik yenileme şu anda etkin değil'}
        </Text>
        <Text style={{fontSize:10.5,lineHeight:17,color:colors.muted}}>
          {Platform.OS==='ios'
            ?'Vakitler telefonun izin verdiği aralıklarda yenilenir.'
            :companion.backgroundRegistered
              ?'Telefonun izin verdiği zamanlarda yenilenir. Pil tasarrufu geciktirebilir.'
              :'Saatler widget’a elle aktarılabilir. Arka plan güncellemesi telefon tarafından kısıtlanmış olabilir.'}
        </Text>
        {companion.backgroundReport?.status==='updated'
          ?<Text style={{fontSize:10,color:colors.muted}}>
            {'Son güncelleme: '+new Date(companion.backgroundReport.lastAttempt)
              .toLocaleString('tr-TR')}
          </Text>:null}
      </View>
    </View>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10}}>
      <Text style={{flex:1,fontSize:10.5,color:colors.muted}} numberOfLines={2}>
        {companion.lastWidgetTransfer?.cityId===source.place?.id&&
        companion.lastWidgetTransfer?.dateISO===
          zonedClock(new Date(now),'Europe/Istanbul').dateISO
          ?'Namaz takvimi native belleğe kaydedildi'
          :preview.status==='ready'
            ?companion.widget.updated
              ?'Native veri doğrulandı; ana ekran görünümünü kontrol et'
              :'Widget’a aktarım başarısız. Ayrıntıları incele'
            :'Vakitler yüklendiğinde widget güncellenecek'}
      </Text>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Ana ekran widget'larını şimdi yenile"
        onPress={()=>void companion.refreshWidgets()}
        style={[styles.miniButton,{backgroundColor:colors.accentStrong}]}>
        <Feather name="refresh-cw" size={14} color="#FFF9ED"/>
        <Text style={{color:'#FFF9ED',fontSize:11,fontWeight:'800'}}>Widget’ı yenile</Text>
      </Pressable>
    </View>
    {preview.status==='ready'&&!companion.widget.updated
      ?<Pressable accessibilityRole="button"
        onPress={()=>Alert.alert('Widget güncelleme ayrıntısı',
          companion.widget.detail+
          '\n\nAna sayfada saatler görünüyorsa Widget Yenile butonuna bas. Sorun sürerse bu açıklamayı paylaş.')}
        style={{alignSelf:'flex-start',paddingVertical:5}}>
        <Text style={{fontSize:11,fontWeight:'700',color:colors.gold}}>
          Neden güncellenmedi?
        </Text>
      </Pressable>:null}
  </View>;
}

export default function CompanionScreen(){
  const {colors}=useAppTheme();
  const companion=useCompanion();
  const source=useSharedPrayerSource();
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{
    const id=setInterval(()=>setNow(Date.now()),45_000);
    return ()=>clearInterval(id);
  },[]);
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
  const [exactAllowed,setExactAllowed]=useState<boolean|null>(null);
  useEffect(()=>{
    let live=true;
    const probe=()=>{
      if(!nativeAdhanSupported)return;
      nativeAdhanStatus().then(s=>{if(live)setExactAllowed(s.exactPermission);})
        .catch(()=>{if(live)setExactAllowed(false);});
    };
    probe();
    const sub=AppState.addEventListener('change',state=>{
      if(state==='active'&&settings.sound==='adhan'){
        probe();
        // Exact permission is granted in Android system settings. Returning
        // to the app must replan the native alarm without waiting for a new day.
        companion.refresh();
      }
    });
    return ()=>{live=false;sub.remove();};
  },[settings.sound,companion.refresh]);
  const selectSound=async(choice:'default'|'silent'|'adhan')=>{
    if(choice!=='adhan'){companion.setSound(choice);return;}
    if(!nativeAdhanSupported){
      Alert.alert('Tam ezan yalnızca Android sürümünde',
        'Bu cihazda otomatik tam ezan desteklenmiyor. Ana sayfadan ezanı elle dinleyebilirsin.');
      return;
    }
    companion.setSound('adhan');
    try{
      const current=await nativeAdhanStatus();
      setExactAllowed(current.exactPermission);
      if(!current.exactPermission){
        Alert.alert('Kesin alarm izni gerekli',
          'Telefon kilitliyken ezanın zamanında başlaması için Android’in “Alarmlar ve hatırlatıcılar” özel iznini açmalısın. Bu izin verilmeden tam ezan otomatik çalmaz.',
          [{text:'Daha sonra',style:'cancel'},
           {text:'İzin ayarlarını aç',onPress:()=>void requestNativeAdhanPermission().catch(()=>
             Alert.alert('Ayar açılamadı','Android uygulama izinlerinden Alarmlar ve hatırlatıcılar iznini aç.'))}]);
      }
    }catch{
      Alert.alert('İzin kontrol edilemedi',
        'Tam ezan ayarı kaydedildi ancak sistem izinleri doğrulanamadı.');
    }
  };

  const toggleMaster=async(next:boolean)=>{
    setWorking(true);
    try{
      const ok=await companion.setEnabled(next);
      if(!ok)Alert.alert('Bildirim izni gerekli',
        'Namaz vakti hatırlatmaları için telefon ayarlarından bildirim izni vermen gerekir.',
        [{text:'Kapat'}, {text:'Sistem ayarları',onPress:()=>void Linking.openSettings()}]);
    }finally{setWorking(false);}
  };
  const test=async()=>{
    if(settings.sound==='adhan'&&nativeAdhanSupported){
      try{
        const current=await nativeAdhanStatus();
        setExactAllowed(current.exactPermission);
        if(!current.exactPermission){
          Alert.alert('Kesin alarm izni gerekli',
            'Ezan testi için önce Android’in özel kesin alarm iznini etkinleştir.');
          return;
        }
        await testNativeAdhan();
        Alert.alert('Ezan testi ayarlandı',
          'Yaklaşık 10 saniye sonra yerel ezan kaydı otomatik başlayacak. Telefonu kilitleyerek dene. Durdurmak için sistemdeki “Ezanı durdur” kontrolünü kullan.');
      }catch{
        Alert.alert('Ezan testi yapılamadı',
          'Kesin alarm iznini ve bu sürümün native ezan desteğini kontrol et.');
      }
      return;
    }
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
        <WidgetShowcase now={now}/>
      </View>
      <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.sectionHeader}>
          <View style={{flex:1,flexDirection:'row',gap:8,alignItems:'center'}}>
            <Feather name="bell" size={21} color={colors.gold}/>
            <Text style={[styles.sectionTitle,{color:colors.text}]}>Namaz Vakti Hatırlatmaları</Text>
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
          İmsak, öğle, ikindi, akşam ve yatsı vakti başladığında bildirim
          alabilir, ayrıca 5–60 dakika öncesini seçebilirsin. Güneş doğuşu
          ezan vakti değildir. Başlangıçta izin ve bildirimler kapalıdır.
        </Text>
        <View style={[styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          <MaterialCommunityIcons name="mosque" size={21} color={colors.gold}/>
          <View style={{flex:1,gap:7}}>
            <Text style={{fontSize:13,fontWeight:'800',color:colors.text}}>
              Beş vakitte bildir
            </Text>
            <Text style={{fontSize:10.5,color:colors.muted,lineHeight:17}}>
              Ezan vakitlerinin başlangıcında telefonun bildirimini planlar.
              Ses türünü aşağıdan seçebilirsin: sistem uyarısı, sessiz veya Android'de tam ezan.
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
                    {key==='gunes'?'Güneş doğuşu (ezan değil)':'Vakit uyarısı'}
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
                  <Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>Vakit girdiğinde hatırlat</Text>
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
        <Text style={{fontSize:12,color:colors.text,fontWeight:'800'}}>Vakit geldiğinde</Text>
        <View style={{flexDirection:'row',gap:7,flexWrap:'wrap'}}>
          {([
            {id:'default',label:'Bildirim sesi',icon:'bell'},
            {id:'silent',label:'Sessiz',icon:'volume-x'},
            ...(Platform.OS==='android'&&!isExpoGoRuntime()
              ?[{id:'adhan',label:'Tam ezan',icon:'music'} as const]:[]),
          ] as const).map(option=><Pressable key={option.id}
            accessibilityRole="button" accessibilityState={{selected:settings.sound===option.id}}
            onPress={()=>void selectSound(option.id)}
            style={[styles.soundOption,{flex:1,minWidth:90,
              backgroundColor:settings.sound===option.id?colors.accentStrong:colors.soft,
              borderColor:settings.sound===option.id?colors.gold:colors.border}]}>
            <Feather name={option.icon} size={16}
              color={settings.sound===option.id?'#FFFFFF':colors.gold}/>
            <Text style={{fontSize:11,fontWeight:'800',
              color:settings.sound===option.id?'#FFFFFF':colors.text}}>{option.label}</Text>
          </Pressable>)}
        </View>
        <Text style={{fontSize:10,color:colors.muted,lineHeight:17}}>
          Tam ezan seçeneği Android'de vakit girince uygulamaya gömülü MP3'ü
          otomatik çalmak üzere kesin alarm kurar. Erken hatırlatmalar standart
          bildirim olarak kalır. Sessiz modda ses çıkmaz. Ezan yalnızca beş namaz
          vaktinde çalar; güneş doğuşu ve erken hatırlatmalarda çalmaz.
        </Text>
        {settings.sound==='adhan'&&nativeAdhanSupported? <View style={[styles.note,{
          backgroundColor:colors.soft,borderColor:exactAllowed?colors.border:'#CE8C67',
        }]}>
          <Feather name={exactAllowed?'check-circle':'alert-triangle'} size={18}
            color={exactAllowed?colors.emerald:'#C68049'}/>
          <View style={{flex:1,gap:5}}>
            <Text style={{color:colors.text,fontSize:11,fontWeight:'800'}}>
              {exactAllowed?'Android kesin alarm izni açık':'Kesin alarm izni gerekiyor'}
            </Text>
            <Text style={{color:colors.muted,fontSize:10,lineHeight:16}}>
              Ezanın arka planda çalması cihazın sistem ayarlarına bağlıdır.
              Pil kısıtlamaları ve ses düzeyi yine etkileyebilir.
            </Text>
            {!exactAllowed?<Pressable accessibilityRole="button"
              onPress={()=>void requestNativeAdhanPermission().catch(()=>
                Alert.alert('Ayar açılamadı','Özel alarm iznini Android ayarlarından aç.'))}
              style={{paddingVertical:8}}>
              <Text style={{color:colors.emerald,fontSize:11,fontWeight:'800'}}>
                Alarmlar ve hatırlatıcılar iznini aç
              </Text>
            </Pressable>:null}
          </View>
        </View>:null}
        {Platform.OS==='ios'?<Text style={{fontSize:10,color:colors.muted,lineHeight:17}}>
          iPhone, 30 saniyeden uzun özel bildirim seslerine izin vermediği için
          otomatik tam ezan seçeneği sunulmuyor. Ezanı ana sayfadan dinleyebilirsin.
        </Text>:null}
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
            <Text style={{fontWeight:'800',fontSize:12,color:colors.text}}>{settings.sound==='adhan'?'Ezanı test et':'Test bildirimi'}</Text>
          </Pressable>
        </View>
        <View style={[styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          <Feather name="shield" size={16} color={colors.gold}/>
          <Text style={{fontSize:11,lineHeight:18,color:colors.muted,flex:1}}>
            Bildirimler seçtiğin ilçenin namaz vakitlerine göre telefonunda planlanır.
            Vakitlerin güncel kalması için uygulamayı ara sıra açabilirsin.
          </Text>
        </View>
      </View>
      {(announcement.available||announcement.enabled||
        announcement.status==='pending-disable')?
      <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.sectionHeader}>
          <View style={{flex:1,flexDirection:'row',gap:8,alignItems:'center'}}>
            <MaterialCommunityIcons name="bullhorn-outline" size={20} color={colors.gold}/>
            <Text style={[styles.sectionTitle,{color:colors.text}]}>
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
          Camideyiz Biz ekibinin özel duyurularını ayrı bir izinle alabilirsin.
          Bu seçenek namaz vakti bildirimlerinden bağımsızdır. Kişisel ilçe
          tercihin, mesajların veya fotoğrafların duyuru sunucusuna gönderilmez.
        </Text>
        <View style={[styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          <Feather name={announcement.status==='registered'?'check-circle':
            announcement.status==='not-configured'?'shield':'info'}
            size={18} color={colors.gold}/>
          <View style={{flex:1,gap:6}}>
            <Text style={{fontSize:12,fontWeight:'800',color:colors.text}}>
              {announcement.status==='registered'?'Duyurular etkin':
                announcement.status==='pending-disable'?'Sunucudan kayıt silme bekleniyor':
                announcement.status==='not-configured'?'Duyuru altyapısı hazırlık aşamasında':
                announcement.status==='error'?'Duyuru bağlantısında sorun var':
                announcement.status==='syncing'?'Duyuru tercihi eşitleniyor':
                'Duyurular kapalı'}
            </Text>
            <Text style={{fontSize:10.5,lineHeight:18,color:colors.muted}}>
              {announcement.detail}
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
              Duyuru kaydını eşitle
            </Text>
          </Pressable>:null}
      </View>:null}
      <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.sectionHeader}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Feather name="inbox" size={20} color={colors.gold}/>
            <Text style={[styles.sectionTitle,{color:colors.text}]}>Bildirim geçmişi</Text>
          </View>
          {companion.inbox.length?<Pressable onPress={companion.clearInbox} accessibilityRole="button">
            <Text style={{color:'#BD756C',fontSize:12,fontWeight:'700'}}>Tümünü sil</Text>
          </Pressable>:null}
        </View>
        <Text style={{fontSize:11,lineHeight:18,color:colors.muted}}>
          Son hatırlatmaların burada görünür. Telefonun bildirim merkezinden
          silinen bazı bildirimler listede yer almayabilir.
        </Text>
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
  sectionTitle:{fontFamily:'serif',fontSize:18,fontWeight:'700'},
  infoPill:{paddingHorizontal:8,minHeight:26,borderWidth:1,borderRadius:15,
    flexDirection:'row',gap:5,alignItems:'center'},
  widgetCompact:{width:207,height:209,borderRadius:21,borderWidth:1.4,padding:15,gap:8},
  widgetWide:{width:258,height:209,borderRadius:21,borderWidth:1.4,padding:15,gap:7},
  widgetBrand:{fontFamily:'serif',fontSize:14,fontWeight:'700',color:'#F1CE8D'},
  note:{borderWidth:1,borderRadius:13,padding:11,flexDirection:'row',alignItems:'flex-start',gap:8},
  miniButton:{height:33,paddingHorizontal:10,borderRadius:11,
    flexDirection:'row',gap:6,alignItems:'center'},
  ruleCard:{borderWidth:1,borderRadius:16,padding:12,gap:8},
  prayerIcon:{width:33,height:33,borderRadius:12,alignItems:'center',justifyContent:'center'},
  lead:{borderWidth:1,borderRadius:13,paddingHorizontal:11,minHeight:32,
    justifyContent:'center',alignItems:'center'},
  soundOption:{borderWidth:1,minHeight:45,borderRadius:13,flexDirection:'row',
    alignItems:'center',justifyContent:'center',gap:8},
  action:{minHeight:45,borderRadius:13,flexDirection:'row',gap:7,
    alignItems:'center',justifyContent:'center'},
  inboxRow:{borderWidth:1,borderRadius:14,padding:11,
    flexDirection:'row',alignItems:'flex-start',gap:10},
  emptyInbox:{alignItems:'center',gap:9,padding:22},
});
