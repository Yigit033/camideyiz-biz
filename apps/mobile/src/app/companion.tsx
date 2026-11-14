import {useEffect,useMemo,useState} from 'react';
import {
  Alert,Linking,Platform,Pressable,ScrollView,StyleSheet,Switch,Text,View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import {PRAYER_KEYS,buildPrayerWidgetSnapshot,type PrayerKey,type PrayerSchedule}
  from '@camideyiz/core';
import {Atmosphere} from '@/components/LuxuryArtwork';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';
import {useCompanion} from '@/features/companion/CompanionProvider';
import {CHANNEL_AUDIBLE,CHANNEL_SILENT,setPrayerChannels} from '@/features/companion/notificationService';

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
      <InfoPill icon="smartphone" text="2 tasarım"/>
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
            {preview.status==='ready'?'Sıradaki · '+preview.nextName:'Güncel veri bekleniyor'}
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
              Namaz vakitleri kaynağı bekleniyor.
            </Text>}
        </View>
        <Text style={{fontSize:9,color:'#A0C8B9'}}>
          {preview.status==='ready'?'Sıradaki: '+preview.nextName+' · '+preview.nextTime:'Uygulamayı açarak yenile'}
        </Text>
      </View>
    </ScrollView>
    <Text style={{fontSize:11,lineHeight:18,color:colors.muted}}>
      Telefonun ana ekranında boş bir alana uzun bas, Widget’lar bölümünden
      Camideyiz Biz’i bul ve boyut seç. Widget’a dokununca ana sayfa açılır.
    </Text>
    <View style={[styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
      <Feather name="info" size={15} color={colors.gold}/>
      <Text style={{flex:1,color:colors.muted,fontSize:11,lineHeight:18}}>
        {Platform.OS==='ios'
          ?'iOS widget’ında sistem tarafından güncellenen canlı geri sayım kullanılır. Yenileme zamanlarını iOS yönetir.'
          :'Android widget’ı sonraki vaktin saatini gösterir. Güncelleme uygulama açıldığında yapılır; arka planda sürekli sayaç garantisi yoktur.'}
        {'\nExpo Go widget desteklemez; uygulamanın yeniden derlenmiş development/production sürümü gerekir.'}
      </Text>
    </View>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10}}>
      <Text style={{flex:1,fontSize:10.5,color:colors.muted}} numberOfLines={2}>
        {companion.widget.detail}
      </Text>
      <Pressable accessibilityRole="button" onPress={companion.refresh}
        style={[styles.miniButton,{backgroundColor:colors.emerald}]}>
        <Feather name="refresh-cw" size={14} color="#FFF9ED"/>
        <Text style={{color:'#FFF9ED',fontSize:11,fontWeight:'800'}}>Yenile</Text>
      </Pressable>
    </View>
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
  const [working,setWorking]=useState(false);
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
          channelId:settings.sound==='silent'?CHANNEL_SILENT:CHANNEL_AUDIBLE,
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
            <Text style={[styles.sectionTitle,{color:colors.text}]}>Namaz vakti uyarıları</Text>
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
          Her namaz vaktini ayrı seçebilir, vaktinde ve öncesinde hatırlatma alabilirsin.
          İzin yalnızca etkinleştirdiğinde istenir. Başlangıçta tüm bildirimler kapalıdır.
        </Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
          <InfoPill text={permission==='granted'?'İzin verildi':
            permission==='denied'?'İzin kapalı':'İzin bekleniyor'}
            icon={permission==='granted'?'check-circle':'alert-circle'}/>
          <InfoPill text={sync.scheduled+' planlanan uyarı'} icon="calendar"/>
          <InfoPill text={source.place?.name??'Konum seçilmedi'} icon="map-pin"/>
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
                  <Text style={{color:colors.text,fontSize:12,fontWeight:'700'}}>Vakit girdiğinde bildir</Text>
                </Pressable>
                <Text style={{color:colors.muted,fontSize:10}}>Ek erken hatırlatma</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{gap:5}}>
                  {LEADS.map(lead=><Pressable key={lead} accessibilityRole="button"
                    accessibilityState={{selected:rule.minutesBefore===lead}}
                    onPress={()=>companion.setRule(key,{minutesBefore:lead})}
                    style={[styles.lead,{borderColor:rule.minutesBefore===lead?colors.gold:colors.border,
                      backgroundColor:rule.minutesBefore===lead?colors.emerald:colors.surface}]}>
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
        <Text style={{fontSize:12,color:colors.text,fontWeight:'800'}}>Bildirim sesi</Text>
        <View style={{flexDirection:'row',gap:9}}>
          {([
            {id:'default',label:'Sistem sesi',icon:'volume-2'},
            {id:'silent',label:'Sessiz',icon:'volume-x'},
          ] as const).map(option=><Pressable key={option.id}
            accessibilityRole="button" accessibilityState={{selected:settings.sound===option.id}}
            onPress={()=>companion.setSound(option.id)}
            style={[styles.soundOption,{flex:1,
              backgroundColor:settings.sound===option.id?colors.emerald:colors.soft,
              borderColor:settings.sound===option.id?colors.gold:colors.border}]}>
            <Feather name={option.icon} size={17}
              color={settings.sound===option.id?'#FFFFFF':colors.gold}/>
            <Text style={{fontSize:12,fontWeight:'800',
              color:settings.sound===option.id?'#FFFFFF':colors.text}}>{option.label}</Text>
          </Pressable>)}
        </View>
        <Text style={{fontSize:10,color:colors.muted,lineHeight:17}}>
          PDF’de önerilen ezan sesleri bu sürümde eklenmedi; kayıt ve kullanım hakları
          netleştirilmeden dinî seslendirme kullanılmayacak. Telefonun sessiz modu,
          odak ayarları ve Android pil optimizasyonu bildirimi geciktirebilir.
          Dakikası kesin teslimat garantisi verilmez.
        </Text>
        <View style={{flexDirection:'row',gap:8}}>
          <Pressable disabled={!settings.enabled||companion.syncing}
            onPress={companion.refresh} accessibilityRole="button"
            style={[styles.action,{flex:1,backgroundColor:colors.emerald,
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
        <View style={[styles.note,{backgroundColor:colors.soft,borderColor:colors.border}]}>
          <Feather name="shield" size={16} color={colors.gold}/>
          <Text style={{fontSize:11,lineHeight:18,color:colors.muted,flex:1}}>
            Uyarılar cihazında, doğrulanmış takvim saatlerinden en fazla 7 gün ve
            60 planlanmış bildirim sınırıyla oluşturulur. Uygulamayı zaman zaman
            açarak ilçe ve takvimi yeniden eşitlemelisin; arka planda sınırsız yenileme garanti edilmez.
          </Text>
        </View>
      </View>
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
          Uygulamanın aldığı veya telefonun hâlâ bildirim merkezinde tuttuğu hatırlatmalar
          burada saklanır. Sistem bildirim merkezinden daha önce kaldırılmış kayıtlar
          her koşulda geri alınamaz.
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
      <Text style={{textAlign:'center',fontSize:10,color:colors.muted,lineHeight:17}}>
        Her iki widget ve bildirimler ek sunucu veya ücretli API gerektirmez.
        Native widget desteği için yeni uygulama derlemesi zorunludur.
      </Text>
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
