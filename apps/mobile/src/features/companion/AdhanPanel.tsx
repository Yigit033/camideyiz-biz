import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,AppState,Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {
  ADHAN_PRAYERS,SABAH_EZANI_AVAILABLE,adhanBlockers,adhanPrayerOn,voicedAdhanPrayers,
  type AdhanBlocker,type AdhanPrayer,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useAdhanPlayback} from '@/features/adhan/AdhanPlaybackProvider';
import {useCompanion} from './CompanionProvider';
import {
  nativeAdhanStatus,openAdhanSettings,raiseNativeAlarmVolume,stopNativeAdhan,testNativeAdhan,
  type AdhanOutcome,type AdhanSettingsTarget,type NativeAdhanStatus,
} from './nativeAdhan';

const NAMES:Record<AdhanPrayer,string>={
  imsak:'İmsak',ogle:'Öğle',ikindi:'İkindi',aksam:'Akşam',yatsi:'Yatsı',
};
const OUTCOME_TEXT:Record<AdhanOutcome,string>={
  STARTED:'Okunuyor',
  COMPLETED:'Okundu',
  STOPPED:'Durduruldu',
  SILENT:'Telefon sessizdeydi, bildirim geldi',
  MUTED:'Alarm sesi kapalıydı, bildirim geldi',
  BUSY:'Görüşme sürüyordu, bildirim geldi',
  LATE:'Telefon geç uyandırdı, bildirim geldi',
  FAILED:'Telefon ezanı başlatmadı, bildirim geldi',
  MISSED:'Telefon uygulamayı durdurdu, ezan okunmadı',
};
const VOICED:ReadonlySet<AdhanOutcome>=new Set(['STARTED','COMPLETED','STOPPED']);
/** Outcomes that prove the phone's background limits got in the way. */
const BACKGROUND_EVIDENCE:ReadonlySet<AdhanOutcome>=new Set(['MISSED','LATE','FAILED']);
const BACKGROUND_VISITED='@camideyiz/adhan-background-visited/v1';
const clock=(at:number)=>new Date(at).toLocaleString('tr-TR',{
  timeZone:'Europe/Istanbul',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',
});
const hourMinute=(at:number)=>new Date(at).toLocaleTimeString('tr-TR',{
  timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',
});

type Row={
  icon:keyof typeof Feather.glyphMap;title:string;detail?:string;
  action:string;onPress:()=>void;
};

/**
 * Everything about "ezan instead of the notification" in one place: which
 * prayers, a live "will it really play?" answer with a one-tap fix for each
 * blocker, an in-app preview, the real end-to-end test and the last result.
 * Reads the native alarm state (a cheap SharedPreferences read) on open,
 * after every reconcile, on return from Settings and every few seconds while
 * visible, so a fix made in Settings shows up the moment the user is back.
 */
export function AdhanPanel({onAskExact}:{onAskExact:()=>void}){
  const {colors}=useAppTheme();
  const companion=useCompanion();
  const {settings,sync,permission}=companion;
  const preview=useAdhanPlayback();
  const [status,setStatus]=useState<NativeAdhanStatus|null>(null);
  const [visited,setVisited]=useState(true);
  const [testing,setTesting]=useState(false);
  const testTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const read=useCallback(()=>{
    nativeAdhanStatus().then(setStatus).catch(()=>setStatus(null));
  },[]);
  useEffect(()=>{read();},[read,sync,settings]);
  const fast=testing||status?.playing===true;
  useEffect(()=>{
    const id=setInterval(read,fast?1500:5000);
    return ()=>clearInterval(id);
  },[read,fast]);
  useEffect(()=>{
    const sub=AppState.addEventListener('change',s=>{if(s==='active')read();});
    return ()=>sub.remove();
  },[read]);
  useEffect(()=>{
    AsyncStorage.getItem(BACKGROUND_VISITED)
      .then(value=>setVisited(value!==null)).catch(()=>setVisited(false));
    return ()=>{if(testTimer.current)clearTimeout(testTimer.current);};
  },[]);

  const last=status?.lastOutcome??null;
  const evidence=Boolean(last&&!last.test&&BACKGROUND_EVIDENCE.has(last.outcome)&&
    Date.now()-last.at<7*86400_000);
  const managed=status?.backgroundManaged===true;
  const blockers=adhanBlockers(settings,{
    notifications:permission,
    // The native answer is the one the ezan scheduler itself uses.
    exactAlarms:status?.supported?status.exactPermission:companion.exactAlarms,
    ringer:status?.ringer??null,
    interruption:status?.interruption??null,
    alarmVolume:status?.alarmVolume??null,
    // Stock Android never defers an alarm-clock ezan for an "optimized"
    // app; ask only where the maker's battery manager stops apps, or after
    // the phone already got in the way.
    batteryUnrestricted:managed||evidence?status?.batteryUnrestricted??null:null,
    backgroundRisk:evidence||(managed&&!visited),
  });

  const open=(target:AdhanSettingsTarget)=>{
    void openAdhanSettings(target).catch(()=>
      Alert.alert('Ayar açılamadı','Telefon ayarlarından Camideyiz Biz’i aç.'));
  };
  const openBackground=()=>{
    setVisited(true);
    AsyncStorage.setItem(BACKGROUND_VISITED,String(Date.now())).catch(()=>undefined);
    open('background');
  };
  const turnOn=()=>{
    void companion.chooseAdhan().then(ok=>{
      if(!ok)Alert.alert('Bildirim izni gerekli','Ezan için bildirim iznini aç.',
        [{text:'Kapat',style:'cancel'},
         {text:'Ayarları aç',onPress:()=>open('notifications')}]);
    });
  };
  const silentTitle=status?.ringer==='vibrate'?'Telefon titreşimde'
    :status?.ringer==='silent'?'Telefon sessizde':'Rahatsız Etmeyin açık';
  const ROWS:Record<AdhanBlocker,Row>={
    'alerts-off':{icon:'bell-off',title:'Hatırlatmalar kapalı',
      action:'Aç',onPress:turnOn},
    'notifications':{icon:'bell-off',title:'Bildirim izni kapalı',
      action:'İzin ver',onPress:()=>open('notifications')},
    'no-prayer':{icon:'check-square',title:'Ezan için vakit seç',
      action:SABAH_EZANI_AVAILABLE?'Beş vakti seç':'Dört vakti seç',onPress:turnOn},
    'exact-alarm':{icon:'clock',title:'“Alarmlar ve hatırlatıcılar” izni gerekli',
      action:'İzin ver',onPress:onAskExact},
    'total-silence':{icon:'moon',title:'Rahatsız Etmeyin tüm sesleri kapatıyor',
      action:'Ayarlar',onPress:()=>open('dnd')},
    'silent-mode':{icon:'volume-x',title:silentTitle,
      detail:'Bu haldeyken ezan yerine bildirim gelir.',
      action:'Yine de oku',onPress:()=>companion.setAdhanInSilent(true)},
    'alarm-muted':{icon:'volume-x',title:'Alarm sesi kapalı',
      action:'Sesi aç',onPress:()=>{
        void raiseNativeAlarmVolume().then(read).catch(()=>open('sound'));
      }},
    'battery':{icon:'battery-charging',title:'Pil kısıtlamasını kaldır',
      detail:'Pil kullanımı › Kısıtlama yok',action:'Aç',onPress:()=>open('battery')},
    'background':{icon:'battery-charging',title:'Arka planda çalışmaya izin ver',
      detail:'Pil kullanımı › Arka planda etkinlik ve otomatik başlatma',
      action:'Aç',onPress:openBackground},
  };
  // One background row is enough where the maker's screen holds both switches.
  const shown=blockers.filter(b=>!(b==='battery'&&blockers.includes('background')));

  const voiced=voicedAdhanPrayers(settings);
  const armed=(sync.adhanScheduled??0)>0&&status?.nextAt!=null&&
    !blockers.some(b=>b==='alerts-off'||b==='notifications'||b==='exact-alarm');
  const headline=status?.playing?'Ezan okunuyor'
    :armed&&status?.nextAt?'Sıradaki ezan · '+(status.nextLabel?status.nextLabel+' ':'')+
      hourMinute(status.nextAt)
    :companion.syncing?'Hazırlanıyor…'
    :shown.length?'Ezan henüz hazır değil'
    :sync.adhanError??'Ezan hazırlanıyor…';

  const test=async()=>{
    try{
      const current=await nativeAdhanStatus();
      if(!current.exactPermission){onAskExact();return;}
      if(preview.playing)preview.pause();
      await testNativeAdhan();
      setTesting(true);
      if(testTimer.current)clearTimeout(testTimer.current);
      testTimer.current=setTimeout(()=>setTesting(false),25_000);
      Alert.alert('Ezan 10 saniye içinde başlar',
        'Ekranı kilitleyip bekleyebilirsin; sonuç bu kartta görünür.');
    }catch{
      Alert.alert('Deneme başlatılamadı','“Alarmlar ve hatırlatıcılar” iznini kontrol et.');
    }
  };
  const stop=()=>{void stopNativeAdhan().then(read).catch(()=>undefined);};

  const listening=preview.playing||preview.starting;
  const lastVoiced=last?VOICED.has(last.outcome):false;
  return <View style={[styles.card,{backgroundColor:colors.soft,
    borderColor:armed&&!shown.length?colors.border:colors.gold}]}>
    <View style={styles.row}>
      <View style={[styles.badge,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <MaterialCommunityIcons name="mosque" size={20} color={colors.gold}/>
      </View>
      <View style={{flex:1,gap:2}}>
        <Text style={[styles.heading,{color:colors.text}]}>Ezan</Text>
        <Text accessibilityLiveRegion="polite" numberOfLines={2}
          style={[styles.body,{color:armed&&!shown.length?colors.muted:colors.gold,
            fontWeight:'700'}]}>
          {headline}
        </Text>
      </View>
      <Pressable accessibilityRole="button"
        accessibilityLabel={listening?'Ezan önizlemesini durdur':'Ezanı dinle'}
        onPress={()=>void preview.toggle()}
        style={[styles.listen,{
          backgroundColor:listening?colors.accentStrong:colors.surface,
          borderColor:colors.gold}]}>
        <Feather name={preview.starting?'loader':preview.playing?'square':'play'} size={14}
          color={listening?'#FFFFFF':colors.gold}/>
        <Text style={{fontSize:11.5,fontWeight:'800',color:listening?'#FFFFFF':colors.text}}>
          {listening?'Durdur':'Dinle'}
        </Text>
      </Pressable>
    </View>
    {preview.error?<Text style={[styles.body,{color:colors.warning}]}>{preview.error}</Text>:null}

    <View style={{gap:7}}>
      <Text style={[styles.label,{color:colors.text}]}>Ezan okunacak vakitler</Text>
      <View style={styles.chips}>
        {ADHAN_PRAYERS.map(key=>{
          const locked=key==='imsak'&&!SABAH_EZANI_AVAILABLE;
          const on=adhanPrayerOn(settings,key);
          return <Pressable key={key} accessibilityRole="switch"
            accessibilityState={{checked:on,disabled:locked}}
            accessibilityLabel={NAMES[key]+' vaktinde ezan'}
            disabled={locked} onPress={()=>companion.setAdhanFor(key,!on)}
            style={[styles.chip,{opacity:locked?.45:1,
              borderColor:on?colors.gold:colors.border,
              backgroundColor:on?colors.accentStrong:colors.surface}]}>
            <Feather name={on?'check':locked?'lock':'plus'} size={12}
              color={on?'#FFFFFF':colors.gold}/>
            <Text style={{fontSize:11.5,fontWeight:'800',color:on?'#FFFFFF':colors.text}}>
              {NAMES[key]}
            </Text>
          </Pressable>;
        })}
      </View>
      <Text style={[styles.body,{color:colors.muted}]}>
        {SABAH_EZANI_AVAILABLE
          ?'Erken hatırlatmalar bildirim sesiyle gelir.'
          :'İmsakta ve erken hatırlatmalarda bildirim sesi çalar.'}
      </Text>
    </View>

    {shown.map(blocker=>{
      const row=ROWS[blocker];
      return <View key={blocker} style={[styles.row,styles.divider,{borderTopColor:colors.border}]}>
        <Feather name={row.icon} size={16} color={colors.gold} style={{marginTop:2}}/>
        <View style={{flex:1,gap:2}}>
          <Text style={[styles.title,{color:colors.text}]}>{row.title}</Text>
          {row.detail?<Text style={[styles.body,{color:colors.muted}]}>{row.detail}</Text>:null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={row.title+': '+row.action}
          onPress={row.onPress}
          style={[styles.fix,{backgroundColor:colors.accentStrong}]}>
          <Text style={styles.fixText}>{row.action}</Text>
        </Pressable>
      </View>;
    })}

    {last?<View style={[styles.row,styles.divider,{borderTopColor:colors.border}]}>
      <Feather name={lastVoiced?'volume-2':'bell'} size={16} style={{marginTop:2}}
        color={lastVoiced?colors.gold:colors.warning}/>
      <Text style={[styles.body,{flex:1,color:colors.text}]}>
        {(last.test?'Son deneme':'Son ezan')+
          (last.label&&!last.test?' · '+last.label:'')+' · '+clock(last.at)+'\n'}
        <Text style={{color:lastVoiced?colors.muted:colors.warning,fontWeight:'700'}}>
          {OUTCOME_TEXT[last.outcome]}
        </Text>
      </Text>
    </View>:null}

    <View style={[styles.row,styles.divider,{borderTopColor:colors.border}]}>
      <Feather name="volume-x" size={16} color={colors.gold} style={{marginTop:2}}/>
      <View style={{flex:1,gap:2}}>
        <Text style={[styles.title,{color:colors.text}]}>Sessiz veya titreşimdeyken de oku</Text>
        <Text style={[styles.body,{color:colors.muted}]}>
          {settings.adhanInSilent?'Ezan alarm sesiyle okunur.':'Kapalıyken bildirim gelir.'}
        </Text>
      </View>
      <Switch value={settings.adhanInSilent}
        accessibilityLabel="Telefon sessiz veya titreşimdeyken de ezan oku"
        onValueChange={companion.setAdhanInSilent}
        trackColor={{false:colors.border,true:colors.emerald}}
        thumbColor={settings.adhanInSilent?'#F4D49C':'#FFFFFF'}/>
    </View>

    {status?.playing?<Pressable accessibilityRole="button" onPress={stop}
      style={[styles.action,{backgroundColor:colors.accentStrong}]}>
      <Feather name="square" size={15} color="#FFFFFF"/>
      <Text style={[styles.actionText,{color:'#FFFFFF'}]}>Ezanı durdur</Text>
    </Pressable>:<Pressable accessibilityRole="button"
      accessibilityHint="10 saniye sonra ezanı vakitteki gibi başlatır"
      disabled={voiced.length===0||!settings.enabled}
      onPress={()=>void test()}
      style={[styles.action,{backgroundColor:colors.surface,borderWidth:1,
        borderColor:colors.border,opacity:voiced.length&&settings.enabled?1:.5}]}>
      <Feather name="clock" size={15} color={colors.gold}/>
      <Text style={[styles.actionText,{color:colors.text}]}>
        {testing?'Ezan birazdan başlıyor…':'Vakitteki gibi dene'}
      </Text>
    </Pressable>}
  </View>;
}

const styles=StyleSheet.create({
  card:{borderWidth:1,borderRadius:16,padding:12,gap:12},
  row:{flexDirection:'row',alignItems:'flex-start',gap:10},
  badge:{width:38,height:38,borderRadius:13,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  heading:{fontFamily:'serif',fontSize:16,fontWeight:'700'},
  divider:{borderTopWidth:StyleSheet.hairlineWidth,paddingTop:11},
  label:{fontSize:11.5,fontWeight:'800'},
  title:{fontSize:12,fontWeight:'800'},
  body:{fontSize:10.5,lineHeight:16},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:6},
  chip:{borderWidth:1,borderRadius:13,paddingHorizontal:11,minHeight:34,
    flexDirection:'row',alignItems:'center',gap:5},
  listen:{borderWidth:1,borderRadius:14,minHeight:34,paddingHorizontal:12,
    flexDirection:'row',alignItems:'center',gap:6,alignSelf:'center'},
  fix:{borderRadius:11,minHeight:32,paddingHorizontal:11,
    alignItems:'center',justifyContent:'center',alignSelf:'center'},
  fixText:{color:'#FFFFFF',fontSize:11,fontWeight:'800'},
  action:{minHeight:42,borderRadius:13,flexDirection:'row',gap:7,
    alignItems:'center',justifyContent:'center'},
  actionText:{fontSize:12,fontWeight:'800'},
});
