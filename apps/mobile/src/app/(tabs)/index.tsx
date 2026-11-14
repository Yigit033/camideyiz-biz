import {useCallback,useEffect,useMemo,useState} from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg,{Circle,Defs,LinearGradient,Path,Stop} from 'react-native-svg';
import {formatCountdown,zonedClock,calculateTimeAwareness,calculateVerifiedPhase,minutesToNextEvent,timeToMinutes} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {PrayerWheel,PRAYER_COLORS} from '@/features/prayer/PrayerWheel';
import {Atmosphere,ArabesqueCorner,GoldenLantern} from '@/components/LuxuryArtwork';
import {usePrayerSource} from '@/features/prayer/usePrayerSource';
import {LocationPicker} from '@/features/prayer/LocationPicker';
import {UnavailablePrayerScreen} from '@/features/prayer/UnavailablePrayerScreen';

const ICONS={
  imsak:'moon-waning-crescent',
  gunes:'weather-sunset-up',
  ogle:'white-balance-sunny',
  ikindi:'timer-sand',
  aksam:'weather-sunset-down',
  yatsi:'weather-night',
} as const;

function formatHijri(now:Date){
  try {
    return new Intl.DateTimeFormat('tr-TR-u-ca-islamic',{
      day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul',
    }).format(now);
  } catch {return null;}
}
function DateDivider({now,dark,timezone,hijriDate}: {now:Date;dark:boolean;timezone:string;hijriDate:string|null}) {
  const {colors}=useAppTheme();
  const date=new Intl.DateTimeFormat('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:timezone}).format(now);
  const hijri=hijriDate??formatHijri(now);
  return <View style={styles.dateSection}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10}}>
      <View style={[styles.dateLine,{backgroundColor:colors.gold}]}/>
      <Feather name="calendar" size={13} color={colors.gold}/>
      <Text style={[styles.dateText,{color:colors.text}]}>{date}</Text>
      <View style={[styles.dateLine,{backgroundColor:colors.gold}]}/>
    </View>
    {hijri?<Text style={[styles.hijri,{color:dark?'#A6D8C3':'#4B806D'}]}>{hijri} · {hijriDate?'Hicrî · Diyanet':'Hicrî (yaklaşık)'}</Text>:null}
  </View>;
}
function Pill({title,active,icon,clock,accent,width,onPress,dark}:{
 title:string;active:boolean;icon:typeof ICONS[keyof typeof ICONS];clock:string;accent:string;width:number;onPress:()=>void;dark:boolean;
}){
  const {colors}=useAppTheme();
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityState={{selected:active}} accessibilityLabel={title+' '+clock}
    style={[
      styles.prayerChip,{
        width,
        borderColor:active?(dark?'#65E5BF':'#177D60'):(dark?'#48615A':'#DAD7CE'),
        backgroundColor:active?(dark?'#076751':'#087351'):(dark?'rgba(6,30,31,.83)':'rgba(255,255,255,.81)'),
        shadowColor:active?'#26BD90':'#776D5E',shadowOpacity:active?.26:.045,
        shadowRadius:active?11:3,elevation:active?4:1,
      }]}>
      <MaterialCommunityIcons name={icon} color={active?'#F7E8C6':dark?'#E4BF7D':'#B78D3D'} size={17}/>
      <Text numberOfLines={1} adjustsFontSizeToFit
        style={[styles.chipLabel,{color:active?'#FAF7EB':colors.text}]}>{title}</Text>
      <Text style={[styles.chipTime,{color:active?'#FDF6E5':colors.text}]}>{clock}</Text>
    </Pressable>;
}
function DailyContent({dark}: {dark:boolean}){
  const {colors}=useAppTheme();
  return <View style={styles.dailyRow}>
    <View style={[styles.dailyAyet,{
      borderColor:dark?'#557961':'#D5B771',
      backgroundColor:dark?'#083A34':'#086446',
    }]}>
      <Svg width="100%" height="100%" viewBox="0 0 230 136" preserveAspectRatio="xMidYMid slice"
        pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ayat" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={dark?'#12645A':'#0C7A5A'}/>
            <Stop offset="55%" stopColor={dark?'#06332E':'#075D44'}/>
            <Stop offset="100%" stopColor="#031E20"/>
          </LinearGradient>
        </Defs>
        <Path d="M0 0H230V136H0Z" fill="url(#ayat)"/>
        <Circle cx="16" cy="132" r="88" stroke="#D2AC69" strokeOpacity=".22" fill="none"/>
        <Circle cx="16" cy="132" r="74" stroke="#D2AC69" strokeOpacity=".11" fill="none"/>
        <Path d="M0 16Q28 42 48 0M210 136Q181 103 230 78"
          stroke="#D5B77B" strokeOpacity=".25" fill="none"/>
      </Svg>
      <ArabesqueCorner dark width={98}/>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
        <MaterialCommunityIcons name="book-open-page-variant-outline" color="#F1CC86" size={22}/>
        <Text style={[styles.dailyHeading,{color:'#F1D49D'}]}>Seçme Ayet</Text>
      </View>
      <Text numberOfLines={3} style={[styles.dailyBody,{color:'#F9F3E6'}]}>
        “Namaz, müminler üzerine vakitleri belli olarak yazılmış bir ödevdir.”
      </Text>
      <Text style={[styles.dailyCredit,{color:'#C3D8C4'}]}>Nisâ 4:103 · Diyanet Kur'an Yolu</Text>
    </View>
    <View style={[styles.dailyHadis,{
      backgroundColor:dark?'#172827':'#FFFBF3',
      borderColor:dark?'#72624B':'#E2C99B',
    }]}>
      <ArabesqueCorner dark width={80}/>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <Text style={[styles.dailyHeading,{color:colors.text}]}>Seçme Hadis</Text>
        <GoldenLantern size={21}/>
      </View>
      <Text numberOfLines={3} style={[styles.dailyBody,{color:colors.text}]}>
        “Ameller niyete göredir.”
      </Text>
      <Text style={[styles.dailyCredit,{color:colors.muted}]}>Buhârî, Bed'ü'l-vahy, 1</Text>
    </View>
  </View>;
}

function ConfiguredHome({official,now}: {official:ReturnType<typeof usePrayerSource>;now:Date}){
  const SCHEDULE=official.days!.today;
  const {colors,mode,setMode}=useAppTheme();
  const {width,height}=useWindowDimensions();
  const dark=colors.isDark;
  const wheelSize=Math.min(width-10,366);
  const chipWidth=Math.max(49,(width-26-10)/6);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [timePreview,setTimePreview]=useState<{startSeconds:number;beganAt:number}|null>(null);
  const [manualIndex,setManualIndex]=useState<number|null>(null);
  const [focusRequest,setFocusRequest]=useState(0);
  const handleWheelSelection=useCallback((index:number)=>{
    setManualIndex(index);
    Haptics.selectionAsync().catch(()=>undefined);
  },[]);
  const focusIndex=(index:number|null)=>{
    setManualIndex(index);
    setFocusRequest(value=>value+1);
  };
  useEffect(()=>{setManualIndex(null);setTimePreview(null);},[official.place?.id]);
  const zoned=useMemo(()=>zonedClock(now,SCHEDULE.timezone),[now,SCHEDULE.timezone]);
  // QA only. In demo preview the clock is accelerated; never exposed as an official time.
  const previewSeconds=timePreview
    ? (timePreview.startSeconds+Math.floor((now.getTime()-timePreview.beganAt)/1000)*20)%86400
    : zoned.secondsOfDay;
  const startPreview=(seconds:number)=>{
    setManualIndex(null);
    setFocusRequest(n=>n+1);
    setTimePreview({startSeconds:seconds,beganAt:Date.now()});
  };
  const showPreviewOptions=()=>{
    const maghrib=timeToMinutes(SCHEDULE.times.find(x=>x.key==='aksam')!.time)*60;
    Alert.alert('Geliştirici zaman önizlemesi',
      'Zaman ×20 hızda ilerler. Gerçek ibadet saatleri yerine geçmez.',[
      {text:'Normal saat',onPress:()=>setTimePreview(null)},
      {text:'Akşama yaklaşım',onPress:()=>startPreview(maghrib-65*60)},
      {text:'Kerahet örneği',onPress:()=>startPreview(maghrib-44*60)},
    ]);
  };
  const awareness=useMemo(
    ()=>calculateTimeAwareness(SCHEDULE,previewSeconds,zoned.dateISO,true),
    [previewSeconds,zoned.dateISO],
  );
  const {restriction,indicativeWindows}=awareness;
  const phase=official.days && !timePreview
    ? calculateVerifiedPhase(official.days.previous,official.days.today,official.days.next,previewSeconds)
    : awareness.phase;
  const upcomingIndex=SCHEDULE.times.findIndex(item=>item.key===phase.next.key);
  const remainingText=minutesToNextEvent(phase.secondsRemaining);
  const nafileOnly=phase.current.key==='imsak' && !restriction;
  const accented=restriction
    ? (dark?'#F49A94':'#B84448')
    : nafileOnly ? (dark?'#E9C484':'#A17B3C')
    : phase.urgency==='imminent'?'#F3AF58'
    : phase.urgency==='approaching'?'#EAC178'
    : colors.emerald;
  const stateTitle=restriction
    ? 'KERAHET · TAHMİNÎ ARALIK'
    : nafileOnly ? 'NAFİLE NAMAZ BİLGİSİ'
    : phase.urgency==='imminent' ? phase.next.label.toLocaleUpperCase('tr-TR')+' VAKTİ ÇOK YAKIN'
    : phase.urgency==='approaching' ? phase.next.label.toLocaleUpperCase('tr-TR')+' VAKTİ YAKLAŞIYOR'
    : 'VAKİT AKIŞI';
  const stateDescription=restriction
    ? restriction.description
    : nafileOnly
    ? 'İmsak ile güneş arasında sabah namazının sünneti dışındaki nafile namazlarla ilgili kısıtlamalar vardır.'
    : phase.urgency!=='normal'
    ? phase.next.label+' vaktine '+remainingText+'. '
    : phase.next.label+' vaktine '+remainingText+' · '+Math.round(phase.progress*100)+'% ilerleme.';
  const selectedIndex=manualIndex??upcomingIndex;
  const selectedPrayer=SCHEDULE.times[selectedIndex];
  const compact=height<730;

  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <Atmosphere dark={dark}/>
    <ScrollView showsVerticalScrollIndicator={false} overScrollMode="never"
      contentContainerStyle={[styles.content,{paddingTop:compact?7:11}]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Diyanet ilçe konumunu değiştir"
          onPress={()=>setPickerOpen(true)}
          style={[styles.location,{borderColor:dark?'#42665D':'#D4CCBB',backgroundColor:dark?'rgba(10,43,41,.86)':'rgba(255,255,255,.7)'}]}>
          <Feather name="map-pin" size={14} color={colors.emerald}/>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.locationName,{color:colors.text}]}>{official.place?.name??SCHEDULE.locationName}</Text>
          <Feather name="info" size={11} color={colors.muted}/>
        </Pressable>
        <View style={styles.centralBrand}>
          <Svg width={59} height={23} viewBox="0 0 59 23">
            <Path d="M2 22Q13 8 29 8Q46 8 57 22M28 8V2M28 2Q30 6 35 2"
              fill="none" stroke={colors.gold} strokeWidth="1.5" strokeLinecap="round"/>
            <Path d="M10 22H49" stroke={colors.gold} strokeWidth=".7" opacity=".58"/>
          </Svg>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={[styles.logoText,{color:colors.text}]}>Camideyiz Biz</Text>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
          <Pressable accessibilityRole="button" accessibilityLabel={dark?'Açık temayı göster':'Koyu temayı göster'}
            onPress={()=>setMode(dark?'light':'dark')}
            style={[styles.smallRound,{backgroundColor:dark?'#0C3833':'rgba(255,255,255,.82)',borderColor:colors.border}]}>
            <Feather name={dark?'sun':'moon'} size={17} color={colors.gold}/>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Bildirimler henüz hazır değil"
            onPress={()=>Alert.alert('Bildirimler','Bildirim ayarları resmî namaz vakitleri entegrasyonu tamamlandıktan sonra açılacak.')}
            style={[styles.smallRound,{backgroundColor:dark?'#0C3833':'rgba(255,255,255,.82)',borderColor:colors.border}]}>
            <Feather name="bell" size={17} color={colors.text}/>

          </Pressable>
        </View>
      </View>
      <DateDivider now={now} dark={dark} timezone={SCHEDULE.timezone} hijriDate={official.days?.today.hijriDate??null}/>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Diyanet namaz vakitlerinin kaynağını görüntüle"
        onPress={()=>Alert.alert('Resmî vakit kaynağı',
          'Kaynak: Diyanet Awqat Salah. İlçe: '+(official.place?.name??'')+'\\nSon veri alım tarihi: '+official.days!.today.fetchedAt+'\\nDurum: '+(official.status==='offline'?'Önbellek':'Sunucudan alındı'))}
        onLongPress={__DEV__?showPreviewOptions:undefined}
        style={[styles.demo,{
          backgroundColor:'transparent',
          borderColor:'transparent',
        }]}>
        <Feather name="info" size={12} color={colors.gold}/>
        <Text style={[styles.demoText,{color:colors.muted}]}>
          {timePreview?'Geliştirici zaman önizlemesi':official.status==='offline'?'Diyanet · Çevrimdışı kayıtlı takvim':'Diyanet · Resmî namaz vakitleri'}
        </Text>

      </Pressable>

      <View style={styles.wheelStage}>
        <View style={[styles.halo,{backgroundColor:dark?'rgba(2,75,70,.18)':'rgba(203,168,100,.12)'}]}/>
        <PrayerWheel
          times={SCHEDULE.times} selectedIndex={selectedIndex}
          onSelect={handleWheelSelection} focusRequest={focusRequest}
          nowSeconds={previewSeconds} colors={colors}
          size={wheelSize} countdown={formatCountdown(phase.secondsRemaining)}
          isManualSelection={manualIndex!==null}
          phaseProgress={phase.progress}
          urgency={phase.urgency}
          nextKey={phase.next.key}
          restriction={restriction}
          indicativeWindows={indicativeWindows}
        />
        <View style={{position:'absolute',right:8,top:22,alignItems:'flex-end',gap:3}}
          pointerEvents="none">
          <Feather name="rotate-cw" size={13} color={colors.gold}/>
          <Text style={{fontSize:9,color:colors.muted,textAlign:'right'}}>Çevirerek{'\n'}keşfet</Text>
        </View>
      </View>

      <View style={styles.tinyActions}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6,flex:1}}>
          <View style={{height:7,width:7,borderRadius:4,backgroundColor:accented}}/>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={{fontSize:10.2,color:restriction?accented:colors.muted,fontWeight:restriction?'800':'600',flexShrink:1}}>
            {restriction
              ? 'KERA HET · '+restriction.title+' (örnek)'
              : nafileOnly ? 'İmsak sonrası · Nafile namaz bilgisi'
              : phase.urgency==='normal'
              ? 'Canlı vakit ilerlemesi'
              : phase.next.label+' vaktine '+remainingText}
          </Text>
        </View>
        {manualIndex!==null
          ?<Pressable accessibilityRole="button" onPress={()=>focusIndex(null)}
            style={{minHeight:28,flexDirection:'row',alignItems:'center',gap:5}}>
            <Feather name="rotate-ccw" size={12} color={colors.emerald}/>
            <Text style={{fontSize:11,color:colors.emerald,fontWeight:'700'}}>Canlıya dön</Text>
          </Pressable>
          :<Text style={{fontSize:10,color:colors.muted}}>Çevre halkası: %{Math.round(phase.progress*100)}</Text>}
      </View>

      <View style={[styles.chipsContainer,{
        borderColor:dark?'#5C6353':'#ECE2D1',
        backgroundColor:dark?'rgba(5,32,33,.65)':'rgba(255,255,255,.76)',
      }]}>
        <View style={styles.chipsRow}>
          {SCHEDULE.times.map((item,index)=>
            <Pill key={item.key} title={item.label} clock={item.time}
              icon={ICONS[item.key]} active={selectedIndex===index}
              accent={PRAYER_COLORS[item.key]} width={chipWidth}
              dark={dark} onPress={()=>focusIndex(index)}/>)}
        </View>
      </View>

      <View style={styles.tickBar} pointerEvents="none">
        {SCHEDULE.times.map((item,index)=><View key={item.key} style={{flex:1,alignItems:'center'}}>
          <View style={{
            height:index===selectedIndex?9:5,width:index===selectedIndex?9:5,
            borderRadius:6,borderWidth:index===selectedIndex?2:0,
            borderColor:colors.gold,
            backgroundColor:index===selectedIndex?(dark?'#F0D596':'#FFF9E8'):colors.emerald,
            opacity:index===selectedIndex?1:.53,
          }}/>
        </View>)}
        <View style={[styles.tickTrack,{backgroundColor:colors.gold,opacity:.32}]}/>
      </View>

      <DailyContent dark={dark}/>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Güncel zaman durumu ve kerahet açıklamasını oku"
        onPress={()=>Alert.alert(
          restriction?'Yaklaşık kerahet aralığı':phase.next.label+' vaktine kalan',
          restriction
            ? restriction.description+'\n\nBu aralıklar genel Diyanet açıklamasından türetilmiş yaklaşık değerlendirmelerdir. Farklı namaz türleri için hükümler ve istisnalar bulunmaktadır. Gerçek ibadet için kullanılmamalıdır.'
            : 'Vakit zaman çizelgesinin yaklaşık %'+Math.round(phase.progress*100)+' kısmı geçti. Sonraki vakte '+remainingText+' var. Saatler sadece tasarım örneğidir.',
        )}
        style={[styles.kerahetNote,{
          borderColor:restriction ? (dark?'#B96364':'#D59A98') : colors.border,
          backgroundColor:restriction
            ? (dark?'rgba(165,56,61,.22)':'#FCF0ED')
            : (dark?'rgba(13,59,54,.72)':'rgba(255,255,255,.67)'),
          borderWidth:1,borderRadius:14,padding:10,
        }]}>
        <View style={{height:31,width:31,borderRadius:11,alignItems:'center',justifyContent:'center',
          backgroundColor:restriction?(dark?'#5B3032':'#F4D6D0'):(dark?'#245149':'#D9E9E1')}}>
          <Feather name={restriction?'alert-triangle':nafileOnly?'book-open':phase.urgency==='normal'?'clock':'sun'}
            size={15} color={accented}/>
        </View>
        <View style={{flex:1,gap:3}}>
          <Text style={{fontSize:10,letterSpacing:.85,fontWeight:'800',color:accented}}>{stateTitle}</Text>
          <Text style={{fontSize:11,color:colors.text,lineHeight:16}}>{stateDescription}</Text>
          <Text style={{fontSize:9.5,color:colors.muted}}>Namaz saatleri · Diyanet Awqat Salah</Text>
        </View>
        <Feather name="chevron-right" size={14} color={colors.muted}/>
      </Pressable>
      {phase.current.key==='ikindi' && !restriction
        ?<Text style={{fontSize:10,color:colors.muted,paddingHorizontal:10}}>
          İkindi farzı kılındıktan sonra nafile namazlar konusunda ayrıca kısıtlamalar vardır.
        </Text>
        :null}
      <Text style={{textAlign:'center',color:colors.muted,fontSize:10,marginBottom:11}}>
        Namaz vakitleri · Diyanet Awqat Salah
      </Text>
    </ScrollView>
    <LocationPicker visible={pickerOpen} onClose={()=>setPickerOpen(false)}
      onSelect={p=>{official.selectPlace(p).catch(()=>undefined);setPickerOpen(false);}}/>
  </SafeAreaView>;
}
export default function HomeScreen(){
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const timer=setInterval(()=>setNow(new Date()),1000);
    return ()=>clearInterval(timer);
  },[]);
  const official=usePrayerSource(now);
  return official.days
    ?<ConfiguredHome key={official.place?.id??0} official={official} now={now}/>
    :<UnavailablePrayerScreen official={official}/>;
}
const styles=StyleSheet.create({
  content:{paddingHorizontal:11,paddingBottom:14,gap:8},
  header:{height:62,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:5},
  location:{height:33,minWidth:93,borderRadius:20,borderWidth:1,
    paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:5},
  locationName:{fontFamily:'serif',fontSize:13,fontWeight:'700'},
  centralBrand:{alignItems:'center',justifyContent:'center',flex:1,gap:0,marginHorizontal:-9},
  logoText:{fontFamily:'serif',fontSize:23,fontWeight:'700',letterSpacing:-.7,marginTop:-2},
  smallRound:{height:32,width:32,borderRadius:17,borderWidth:1,alignItems:'center',justifyContent:'center'},
  notificationDot:{position:'absolute',height:6,width:6,borderRadius:3,backgroundColor:'#18BA91',top:3,right:4},
  dateSection:{alignItems:'center',gap:3,marginTop:-4},
  dateLine:{width:27,height:1,opacity:.65},
  dateText:{fontFamily:'serif',fontSize:13.1,fontWeight:'600'},
  hijri:{fontFamily:'serif',fontSize:11},
  demo:{paddingHorizontal:6,paddingVertical:2,borderRadius:10,borderWidth:0,
    flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6,alignSelf:'center',marginTop:3},
  demoText:{fontSize:10,fontWeight:'500',textAlign:'center'},
  wheelStage:{alignItems:'center',justifyContent:'center',position:'relative',marginTop:-2,marginBottom:-12},
  halo:{position:'absolute',height:235,width:235,borderRadius:118},
  tinyActions:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:7,minHeight:26},
  chipsContainer:{borderWidth:1.2,borderRadius:20,padding:3,shadowColor:'#746B5C',
    shadowOpacity:.1,shadowRadius:8,shadowOffset:{height:3,width:0},elevation:2},
  chipsRow:{flexDirection:'row',justifyContent:'space-between',gap:1},
  prayerChip:{borderRadius:15,height:66,borderWidth:1.2,alignItems:'center',justifyContent:'center',gap:2,paddingHorizontal:2},
  chipLabel:{fontFamily:'serif',fontSize:11.6,fontWeight:'700'},
  chipTime:{fontFamily:'serif',fontWeight:'700',fontSize:12.2,fontVariant:['tabular-nums']},
  tickBar:{marginHorizontal:27,marginTop:0,marginBottom:2,height:10,flexDirection:'row',alignItems:'center'},
  tickTrack:{position:'absolute',left:'8%',right:'8%',top:4,height:1,zIndex:-1},
  dailyRow:{flexDirection:'row',gap:8,height:136,marginHorizontal:2,marginTop:6},
  dailyAyet:{flex:1.28,borderRadius:20,borderWidth:1,overflow:'hidden',padding:12,justifyContent:'space-between',
    shadowColor:'#4A6C59',shadowOpacity:.18,shadowRadius:9,elevation:3},
  dailyHadis:{flex:1,borderRadius:20,borderWidth:1,overflow:'hidden',padding:12,justifyContent:'space-between',
    shadowColor:'#5E4932',shadowOpacity:.08,shadowRadius:5,elevation:2},
  dailyHeading:{fontFamily:'serif',fontSize:15,fontWeight:'700'},
  dailyBody:{fontFamily:'serif',fontSize:11.4,lineHeight:16,fontStyle:'italic',marginTop:5},
  dailyCredit:{fontFamily:'serif',fontSize:10.7},
  kerahetNote:{flexDirection:'row',alignItems:'center',gap:7,borderTopWidth:1,paddingVertical:8,marginHorizontal:4,marginTop:1},
});
