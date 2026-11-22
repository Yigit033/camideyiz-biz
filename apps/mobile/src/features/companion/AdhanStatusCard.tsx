import {useCallback,useEffect,useState} from 'react';
import {AppState,Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useCompanion} from './CompanionProvider';
import {nativeAdhanStatus,openNativeAppSettings,
  type AdhanOutcome,type NativeAdhanStatus} from './nativeAdhan';

const WARN='#C68049';
const OUTCOME_TEXT:Record<AdhanOutcome,string>={
  STARTED:'Okunuyor',
  COMPLETED:'Okundu',
  STOPPED:'Durduruldu',
  SILENT:'Telefon sessizdeydi, bildirim geldi',
  MUTED:'Alarm sesi kapalıydı, bildirim geldi',
  BUSY:'Görüşme sürüyordu, bildirim geldi',
  LATE:'Telefon geç uyandırdı, bildirim geldi',
  FAILED:'Telefon ezanı başlatmadı, bildirim geldi',
};
const VOICED:ReadonlySet<AdhanOutcome>=new Set(['STARTED','COMPLETED','STOPPED']);
const clock=(at:number)=>new Date(at).toLocaleString('tr-TR',{
  timeZone:'Europe/Istanbul',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',
});

/**
 * Live answer to "will the ezan really be voiced, and what happened last
 * time?" Reads the native alarm state (cheap SharedPreferences read) on
 * open, after every reconcile, on return from Settings and every 5 s while
 * visible, so a test's result appears without leaving the screen.
 */
export function AdhanStatusCard({exactMissing,onAskExact}:{
  exactMissing:boolean;onAskExact:()=>void;
}){
  const {colors}=useAppTheme();
  const companion=useCompanion();
  const {settings,sync}=companion;
  const [status,setStatus]=useState<NativeAdhanStatus|null>(null);
  const read=useCallback(()=>{
    nativeAdhanStatus().then(setStatus).catch(()=>setStatus(null));
  },[]);
  useEffect(()=>{read();},[read,sync]);
  useEffect(()=>{
    const id=setInterval(read,5000);
    const sub=AppState.addEventListener('change',s=>{if(s==='active')read();});
    return ()=>{clearInterval(id);sub.remove();};
  },[read]);

  const armed=!exactMissing&&(sync.adhanScheduled??0)>0&&status?.nextAt;
  const last=status?.lastOutcome??null;
  const lastVoiced=last?VOICED.has(last.outcome):false;
  const askBattery=status?.batteryUnrestricted===false||
    last?.outcome==='LATE'||last?.outcome==='FAILED';

  return <View style={[styles.card,{backgroundColor:colors.soft,borderColor:
    armed?colors.border:WARN}]}>
    <View style={styles.row}>
      <Feather name={armed?'check-circle':'alert-triangle'} size={17}
        color={armed?colors.gold:WARN}/>
      <View style={{flex:1,gap:2}}>
        <Text style={[styles.title,{color:colors.text}]}>
          {armed?'Ezan kurulu':exactMissing?'Ezan için izin gerekli':'Ezan henüz kurulmadı'}
        </Text>
        <Text style={[styles.body,{color:colors.muted}]}>
          {armed&&status?.nextAt?'Sıradaki ezan: '+clock(status.nextAt)
            :exactMissing?'“Alarmlar ve hatırlatıcılar” iznini aç; yoksa ezan yerine bildirim gelir.'
              :sync.error??'Aşağıdaki “Vakitleri eşitle”ye dokun.'}
        </Text>
      </View>
    </View>
    {exactMissing?<Pressable accessibilityRole="button" onPress={onAskExact}
      style={styles.link}>
      <Text style={[styles.linkText,{color:colors.gold}]}>İzni aç</Text>
    </Pressable>:null}

    {last?<View style={[styles.row,styles.divider,{borderTopColor:colors.border}]}>
      <Feather name={lastVoiced?'volume-2':'bell'} size={16}
        color={lastVoiced?colors.gold:WARN}/>
      <Text style={[styles.body,{flex:1,color:colors.text}]}>
        {(last.test?'Son test':'Son ezan')+
          (last.label&&!last.test?' · '+last.label:'')+' · '+clock(last.at)+'\n'}
        <Text style={{color:lastVoiced?colors.muted:WARN,fontWeight:'700'}}>
          {OUTCOME_TEXT[last.outcome]}
        </Text>
      </Text>
    </View>:null}

    <View style={[styles.row,styles.divider,{borderTopColor:colors.border}]}>
      <Feather name="volume-x" size={16} color={colors.gold}/>
      <View style={{flex:1,gap:2}}>
        <Text style={[styles.title,{color:colors.text}]}>Sessiz moddayken de oku</Text>
        <Text style={[styles.body,{color:colors.muted}]}>
          {settings.adhanInSilent
            ?'Telefon titreşimde de olsa ezan alarm sesiyle okunur.'
            :'Kapalıyken sessiz veya titreşimdeki telefona bildirim gelir.'}
        </Text>
      </View>
      <Switch value={settings.adhanInSilent}
        accessibilityLabel="Telefon sessiz moddayken de ezan oku"
        onValueChange={companion.setAdhanInSilent}
        trackColor={{false:colors.border,true:colors.emerald}}
        thumbColor={settings.adhanInSilent?'#F4D49C':'#FFFFFF'}/>
    </View>

    {askBattery?<View style={[styles.row,styles.divider,{borderTopColor:colors.border}]}>
      <Feather name="battery-charging" size={16} color={WARN}/>
      <View style={{flex:1,gap:2}}>
        <Text style={[styles.title,{color:colors.text}]}>Arka planda çalışmaya izin ver</Text>
        <Text style={[styles.body,{color:colors.muted}]}>
          Uygulama ayarlarında Pil bölümünden kısıtlamayı kaldır; telefon ezanı geciktirmez.
        </Text>
        <Pressable accessibilityRole="button" style={styles.link}
          onPress={()=>void openNativeAppSettings().catch(()=>false)}>
          <Text style={[styles.linkText,{color:colors.gold}]}>Uygulama ayarlarını aç</Text>
        </Pressable>
      </View>
    </View>:null}
  </View>;
}

const styles=StyleSheet.create({
  card:{borderWidth:1,borderRadius:14,padding:12,gap:10},
  row:{flexDirection:'row',alignItems:'flex-start',gap:9},
  divider:{borderTopWidth:StyleSheet.hairlineWidth,paddingTop:10},
  title:{fontSize:12,fontWeight:'800'},
  body:{fontSize:10.5,lineHeight:16},
  link:{paddingVertical:4,alignSelf:'flex-start'},
  linkText:{fontSize:11,fontWeight:'800'},
});
