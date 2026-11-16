import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {formatCountdown,zonedClock,calculateTimeAwareness,calculateVerifiedPhase,minutesToNextEvent,PRAYER_KEYS,MIRROR_SOURCE,MIRROR_CACHE_MS,MIRROR_OFFLINE_CACHE_MS,calculateMirrorPhase,getKerahatView,type PrayerTime} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {PrayerWheel,PRAYER_COLORS} from '@/features/prayer/PrayerWheel';
import {Atmosphere} from '@/components/LuxuryArtwork';
import {HomeBrandHeader} from '@/features/prayer/HomeBrandHeader';
import {useKerahatSettings} from '@/features/prayer/KerahatSettingsProvider';
import {KerahatPanel} from '@/features/prayer/KerahatPanel';
import {DailyWisdomSection} from '@/features/wisdom/DailyWisdomSection';
import {usePrayerSource} from '@/features/prayer/usePrayerSource';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';
import {LocationPicker} from '@/features/prayer/LocationPicker';

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
function DateDivider({now,timezone,hijriDate}:{
  now:Date;timezone:string;hijriDate:string|null;
}){
  const {colors}=useAppTheme();
  const date=new Intl.DateTimeFormat('tr-TR',{
    weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:timezone,
  }).format(now);
  const hijri=hijriDate??formatHijri(now);
  // Equal flexible halves ensure the vertical rule is at the actual screen
  // centre, independent of the very different lengths of Hijri/Gregorian dates.
  return <View style={styles.dateSection}
    accessible accessibilityLabel={hijri?hijri+'; '+date:date}>
    {hijri?<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.67}
      style={[styles.dateText,{color:colors.text}]}>{hijri}</Text>:null}
    {hijri?<View pointerEvents="none" style={{
      width:1,height:18,marginHorizontal:7,backgroundColor:colors.gold,opacity:.85,
    }}/>:null}
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.67}
      style={[styles.dateText,{color:colors.text}]}>{date}</Text>
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
        borderColor:active?(dark?'#80D7FF':'#177D60'):(dark?'#395975':'#DAD7CE'),
        backgroundColor:active?(dark?'#126A9A':'#087351'):(dark?'rgba(13,38,60,.87)':'rgba(255,255,255,.81)'),
        shadowColor:active?'#26BD90':'#776D5E',shadowOpacity:active?.26:.045,
        shadowRadius:active?11:3,elevation:active?4:1,
      }]}>
      <MaterialCommunityIcons name={icon} color={active?'#F7E8C6':dark?'#E4BF7D':'#B78D3D'} size={17}/>
      <Text numberOfLines={1} adjustsFontSizeToFit
        style={[styles.chipLabel,{color:active?'#FAF7EB':colors.text}]}>{title}</Text>
      <Text style={[styles.chipTime,{color:active?'#FDF6E5':colors.text}]}>{clock}</Text>
    </Pressable>;
}
function ConfiguredHome({official,now}: {official:ReturnType<typeof usePrayerSource>;now:Date}){
  const SCHEDULE=official.days!.today;
  const {settings:kerahatSettings}=useKerahatSettings();
  const {colors}=useAppTheme();
  const {width,height}=useWindowDimensions();
  const dark=colors.isDark;
  const wheelSize=Math.min(width-10,366);
  const chipWidth=Math.max(49,(width-26-10)/6);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [manualIndex,setManualIndex]=useState<number|null>(null);
  const [focusRequest,setFocusRequest]=useState(0);
  // Give a user time to explore the wheel, then gently self-center on the
  // actual live prayer. Repeated gestures restart the idle countdown.
  const liveReturnTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const cancelLiveReturn=useCallback(()=>{
    if(liveReturnTimer.current!==null){
      clearTimeout(liveReturnTimer.current);
      liveReturnTimer.current=null;
    }
  },[]);
  const scheduleLiveReturn=useCallback(()=>{
    cancelLiveReturn();
    liveReturnTimer.current=setTimeout(()=>{
      liveReturnTimer.current=null;
      setManualIndex(null);
      setFocusRequest(value=>value+1);
    },1800);
  },[cancelLiveReturn]);
  useEffect(()=>()=>cancelLiveReturn(),[cancelLiveReturn]);
  const handleWheelSelection=useCallback((index:number)=>{
    setManualIndex(index);
    Haptics.selectionAsync().catch(()=>undefined);
  },[]);
  const focusIndex=(index:number|null)=>{
    cancelLiveReturn();
    setManualIndex(index);
    setFocusRequest(value=>value+1);
    if(index!==null)scheduleLiveReturn();
  };
  useEffect(()=>{
    cancelLiveReturn();
    setManualIndex(null);
  },[official.place?.id,cancelLiveReturn]);
  const zoned=useMemo(()=>zonedClock(now,SCHEDULE.timezone),[now,SCHEDULE.timezone]);
  const previewSeconds=zoned.secondsOfDay;
  const awareness=useMemo(
    ()=>calculateTimeAwareness(SCHEDULE,previewSeconds,zoned.dateISO,true),
    [previewSeconds,zoned.dateISO],
  );
  // Live estimates use the selected city's actual published prayer clock values.
  // Settings modify only the approximation bands, never the prayer clock.
  const kerahat=useMemo(()=>getKerahatView(SCHEDULE,zoned.dateISO,previewSeconds,kerahatSettings),
    [SCHEDULE,zoned.dateISO,previewSeconds,kerahatSettings]);
  const restriction=kerahat.active;
  const indicativeWindows=kerahat.windows;
  const approachingKerahat=!restriction&&kerahat.next&&
    kerahat.next.startSeconds-previewSeconds<=20*60
      ?kerahat.next:null;
  const kerahatMinutes=approachingKerahat
    ?Math.ceil((approachingKerahat.startSeconds-previewSeconds)/60):0;
  const phase=official.days
    ? official.days.source===MIRROR_SOURCE
      ? calculateMirrorPhase(official.days.previous,official.days.today,official.days.next,previewSeconds)
      : calculateVerifiedPhase(official.days.previous,official.days.today,official.days.next,previewSeconds)
    : awareness.phase;
  // The top needle follows the prayer period currently in progress, never
  // the next prayer. Countdown in the centre still refers to the next prayer.
  const currentIndex=Math.max(0,SCHEDULE.times.findIndex(item=>item.key===phase.current.key));
  const remainingText=minutesToNextEvent(phase.secondsRemaining);
  const nafileOnly=phase.current.key==='imsak' && !restriction;
  const accented=restriction
    ? (dark?'#F49A94':'#B84448')
    : approachingKerahat ? (dark?'#EBC487':'#A47539')
    : nafileOnly ? (dark?'#E9C484':'#A17B3C')
    : phase.urgency==='imminent'?'#F3AF58'
    : phase.urgency==='approaching'?'#EAC178'
    : colors.emerald;
  const stateTitle=restriction
    ? 'KERAHAT · YAKLAŞIK ARALIK'
    : approachingKerahat?'KERAHAT ARALIĞI YAKLAŞIYOR'
    : nafileOnly ? 'NAFİLE NAMAZ BİLGİSİ'
    : phase.urgency==='imminent' ? phase.next.label.toLocaleUpperCase('tr-TR')+' VAKTİ ÇOK YAKIN'
    : phase.urgency==='approaching' ? phase.next.label.toLocaleUpperCase('tr-TR')+' VAKTİ YAKLAŞIYOR'
    : 'VAKİT AKIŞI';
  const stateDescription=restriction
    ? restriction.description
    : approachingKerahat
      ? 'Yaklaşık '+kerahatMinutes+' dakika sonra bir kerahat zaman aralığı başlayacak. Ayrıntılar için Kerahat Vakitleri bölümüne bak.'
    : nafileOnly
    ? 'İmsak ile güneş arasında sabah namazının sünneti dışındaki nafile namazlarla ilgili kısıtlamalar vardır.'
    : phase.urgency!=='normal'
    ? phase.next.label+' vaktine '+remainingText+'. '
    : phase.next.label+' vaktine '+remainingText+' · '+Math.round(phase.progress*100)+'% ilerleme.';
  const selectedIndex=manualIndex??currentIndex;
  const selectedPrayer=SCHEDULE.times[selectedIndex];
  const compact=height<730;

  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <Atmosphere dark={dark}/>
    <ScrollView showsVerticalScrollIndicator={false} overScrollMode="never"
      contentContainerStyle={[styles.content,{paddingTop:compact?7:11}]}>
      <HomeBrandHeader place={official.place} now={now}
        timezone={SCHEDULE.timezone} compact={compact} onOpenLocation={()=>setPickerOpen(true)}
        locationMode={official.locationMode}
        autoLocationStatus={official.autoLocationStatus}
        onEnableAutoLocation={official.enableAutoLocation}/>
      <DateDivider now={now} timezone={SCHEDULE.timezone} hijriDate={official.days?.today.hijriDate??null}/>
      <View style={styles.wheelStage}>
        <View style={[styles.halo,{backgroundColor:dark?'rgba(2,75,70,.18)':'rgba(203,168,100,.12)'}]}/>
        <PrayerWheel
          times={SCHEDULE.times} selectedIndex={selectedIndex}
          onSelect={handleWheelSelection}
          onGestureStart={cancelLiveReturn}
          onGestureEnd={scheduleLiveReturn}
          focusRequest={focusRequest}
          nowSeconds={previewSeconds} colors={colors}
          size={wheelSize} countdown={formatCountdown(phase.secondsRemaining)}
          isManualSelection={manualIndex!==null}
          previousYatsiTime={official.days?.previous?.times.find(item=>item.key==='yatsi')?.time}
          nextImsakTime={official.days?.next?.times.find(item=>item.key==='imsak')?.time}
          urgency={phase.urgency}
          nextKey={phase.next.key}
          restriction={restriction}
          indicativeWindows={indicativeWindows}
          locationName={official.place?.name
            ?(official.place.name===official.place.stateName
              ?official.place.name
              :official.place.name+' · '+official.place.stateName)
            :SCHEDULE.locationName}
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
            style={{fontSize:10.2,color:restriction||approachingKerahat?accented:colors.muted,
              fontWeight:restriction||approachingKerahat?'800':'600',flexShrink:1}}>
            {restriction
              ? 'KERAHAT · '+restriction.title+' (yaklaşık)'
              : approachingKerahat?'Kerahat aralığına yaklaşık '+kerahatMinutes+' dk'
              : nafileOnly ? 'İmsak sonrası · Nafile namaz bilgisi'
              : phase.urgency==='normal'
              ? 'Canlı vakit ilerlemesi'
              : phase.next.label+' vaktine '+remainingText}
          </Text>
        </View>
        {manualIndex!==null
          ?<View accessible accessibilityLabel="Çember kısa süre sonra otomatik canlı vakte döner"
            style={{minHeight:28,flexDirection:'row',alignItems:'center',gap:5}}>
            <Feather name="rotate-ccw" size={12} color={colors.emerald}/>
            <Text style={{fontSize:10,color:colors.muted}}>Otomatik canlıya döner</Text>
          </View>
          :<Text style={{fontSize:10,color:colors.muted}}>Vakit ilerlemesi %{Math.round(phase.progress*100)}</Text>}
      </View>

      <View style={[styles.chipsContainer,{
        borderColor:dark?'#5C6353':'#ECE2D1',
        backgroundColor:dark?'rgba(12,36,54,.73)':'rgba(255,255,255,.76)',
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

      <KerahatPanel view={kerahat} settings={kerahatSettings}
        locationName={SCHEDULE.locationName} secondsOfDay={previewSeconds}/>
      <DailyWisdomSection dateISO={zoned.dateISO} dark={dark}/>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Güncel zaman durumu ve kerahet açıklamasını oku"
        onPress={()=>Alert.alert(
          restriction?'Yaklaşık kerahet aralığı':phase.next.label+' vaktine kalan',
          restriction
            ? restriction.description+'\n\nBu aralıklar genel Diyanet açıklamasından türetilmiş yaklaşık değerlendirmelerdir. Farklı namaz türleri için hükümler ve istisnalar bulunmaktadır. Gerçek ibadet için kullanılmamalıdır.'
            : 'Vakit zaman çizelgesinin yaklaşık %'+Math.round(phase.progress*100)+' kısmı geçti. Sonraki vakte '+remainingText+' var. Saatler seçilen takvim kaynağından alınmıştır.',
        )}
        style={[styles.kerahetNote,{
          borderColor:restriction ? (dark?'#B96364':'#D59A98') : colors.border,
          backgroundColor:restriction
            ? (dark?'rgba(165,56,61,.22)':'#FCF0ED')
            : (dark?'rgba(13,59,54,.72)':'rgba(255,255,255,.67)'),
          borderWidth:1,borderRadius:14,padding:10,
        }]}>
        <View style={{height:31,width:31,borderRadius:11,alignItems:'center',justifyContent:'center',
          backgroundColor:restriction?(dark?'#5B3032':'#F4D6D0'):(dark?'#234C69':'#D9E9E1')}}>
          <Feather name={restriction?'alert-triangle':nafileOnly?'book-open':phase.urgency==='normal'?'clock':'sun'}
            size={15} color={accented}/>
        </View>
        <View style={{flex:1,gap:3}}>
          <Text style={{fontSize:10,letterSpacing:.85,fontWeight:'800',color:accented}}>{stateTitle}</Text>
          <Text style={{fontSize:11,color:colors.text,lineHeight:16}}>{stateDescription}</Text>
        </View>
        <Feather name="chevron-right" size={14} color={colors.muted}/>
      </Pressable>
      {phase.current.key==='ikindi' && !restriction
        ?<Text style={{fontSize:10,color:colors.muted,paddingHorizontal:10}}>
          İkindi farzı kılındıktan sonra nafile namazlar konusunda ayrıca kısıtlamalar vardır.
        </Text>
        :null}
      <View style={{height:7,marginBottom:4}}/>
    </ScrollView>
    <LocationPicker visible={pickerOpen} onClose={()=>setPickerOpen(false)}
      onSelect={async p=>{
        await official.selectPlace(p);
        setPickerOpen(false);
      }}/>
  </SafeAreaView>;
}

// The full home screen stays visible even while a live provider is loading.
// No made-up hours, countdowns, or kerahet alerts can appear in this mode.
const NO_DATA_TIMES:readonly PrayerTime[]=PRAYER_KEYS.map((key,i)=>({
  key,label:['İmsak','Güneş','Öğle','İkindi','Akşam','Yatsı'][i],time:'00:00',
}));
function CalendarLoadingHome({official,now}:{
  official:ReturnType<typeof usePrayerSource>;now:Date;
}){
  const {colors}=useAppTheme();
  const {width}=useWindowDimensions();
  const dark=colors.isDark;
  const [pickerOpen,setPickerOpen]=useState(false);
  const [selectedIndex,setSelectedIndex]=useState(0);
  const [focusRequest,setFocusRequest]=useState(0);
  const label=official.status==='loading'?'Takvim yükleniyor'
    :official.status==='choose-location'?'Takvim konumunu seç'
    :'Takvim kaynağına erişilemedi';
  const info=official.status==='loading'
    ?'İnternet üzerinden ilçe takvimi kontrol ediliyor.'
    :official.status==='choose-location'
      ?'İl ve ilçeni seçerek vakitleri görüntüleyebilirsin.'
      :'Takvim verisi henüz doğrulanamadı. Bağlantını kontrol edebilir veya tekrar deneyebilirsin.';
  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <Atmosphere dark={dark}/>
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content,{paddingTop:12,paddingBottom:30}]}>
      <HomeBrandHeader place={official.place} now={now}
        onOpenLocation={()=>setPickerOpen(true)}
        locationMode={official.locationMode}
        autoLocationStatus={official.autoLocationStatus}
        onEnableAutoLocation={official.enableAutoLocation}/>
      <DateDivider now={now} timezone="Europe/Istanbul" hijriDate={null}/>
      <View style={{flexDirection:'row',alignItems:'center',
        alignSelf:'center',gap:8,minHeight:35,
        paddingHorizontal:10,paddingVertical:6,borderRadius:13,
        backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border}}>
        <Feather name={official.status==='unavailable'?'alert-circle':'clock'}
          size={14} color={colors.gold}/>
        <Text style={{fontSize:11,color:colors.text,flexShrink:1}}>
          {official.status==='unavailable'
            ?official.failureReason==='calendar_missing_dates'
              ?'Seçilen ilçenin güncel vakitleri kaynaklarda bulunamadı'
              :official.failureReason==='calendar_invalid_response'
                ?'Gelen takvim doğrulanamadı'
                :official.failureReason==='calendar_rate_limited'
                  ?'Takvim kaynakları yoğun, yeniden dene'
                  :'Takvim bağlantısına erişilemedi'
            :official.status==='choose-location'
              ?'İl ve ilçeni seç':'Seçilen ilçenin takvimi yükleniyor'}
        </Text>
        {official.status==='unavailable'?<Pressable
          accessibilityRole="button" accessibilityLabel="Takvimi yeniden dene"
          onPress={official.retry} hitSlop={9}
          style={{padding:5}}>
          <Feather name="refresh-cw" size={17} color={colors.emerald}/>
        </Pressable>:null}
      </View>
      <View style={styles.wheelStage}>
        <View style={[styles.halo,{backgroundColor:dark?'rgba(2,75,70,.18)':'rgba(203,168,100,.12)'}]}/>
        <PrayerWheel preview times={NO_DATA_TIMES}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex} focusRequest={focusRequest}
          nowSeconds={0} colors={colors}
          size={Math.min(width-10,366)} countdown=""
          isManualSelection={false}
          urgency="normal" nextKey="imsak"
          restriction={null} indicativeWindows={[]}
          locationName={official.place?.name??'Konum seçilmedi'}/>
      </View>
      <View style={[styles.chipsContainer,{
        borderColor:colors.border,backgroundColor:colors.surface,
      }]}>
        <View style={styles.chipsRow}>
          {NO_DATA_TIMES.map((item,index)=><Pill key={item.key}
            title={item.label} clock="" icon={ICONS[item.key]}
            active={selectedIndex===index} accent={PRAYER_COLORS[item.key]}
            width={Math.max(49,(width-36)/6)}
            dark={dark} onPress={()=>{
              setSelectedIndex(index);setFocusRequest(x=>x+1);
            }}/>)}
        </View>
      </View>
      <DailyWisdomSection dateISO={zonedClock(now,'Europe/Istanbul').dateISO} dark={dark}/>
      <View style={[styles.kerahetNote,{
        backgroundColor:colors.surface,borderColor:colors.border,
        borderWidth:1,borderRadius:16,paddingVertical:14,paddingHorizontal:13,
        flexDirection:'row',alignItems:'center',gap:10,
      }]}>
        <Feather name={official.status==='loading'?'clock':'wifi-off'}
          size={19} color={colors.gold}/>
        <View style={{flex:1,gap:4}}>
          <Text style={{fontSize:13,fontWeight:'800',color:colors.text}}>{label}</Text>
          <Text style={{fontSize:11,lineHeight:17,color:colors.muted}}>{info}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Takvimi yeniden kontrol et"
          onPress={official.retry} hitSlop={12}>
          <Feather name="refresh-cw" size={19} color={colors.emerald}/>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={()=>setPickerOpen(true)}
        style={{alignSelf:'center',padding:12,flexDirection:'row',gap:8,alignItems:'center'}}>
        <Feather name="map-pin" size={16} color={colors.gold}/>
        <Text style={{fontSize:13,color:colors.text,fontWeight:'700'}}>Başka il veya ilçe seç</Text>
      </Pressable>
    </ScrollView>
    <LocationPicker visible={pickerOpen} onClose={()=>setPickerOpen(false)}
      onSelect={async place=>{
        await official.selectPlace(place);
        setPickerOpen(false);
      }}/>
  </SafeAreaView>;
}
export default function HomeScreen(){
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const timer=setInterval(()=>setNow(new Date()),1000);
    return ()=>clearInterval(timer);
  },[]);
  const official=useSharedPrayerSource();
  const usable=official.days&&(
    official.days.source!==MIRROR_SOURCE||
    now.getTime()-Date.parse(official.days.today.fetchedAt)<=
      (official.status==='mirror-cached'
        ?MIRROR_OFFLINE_CACHE_MS:MIRROR_CACHE_MS)
  );
  return usable
    ?<ConfiguredHome key={official.place?.id??0} official={official} now={now}/>
    :<CalendarLoadingHome official={official} now={now}/>;
}
const styles=StyleSheet.create({
  content:{paddingHorizontal:11,paddingBottom:14,gap:8},
  dateSection:{alignItems:'center',justifyContent:'center',alignSelf:'stretch',flexDirection:'row',paddingHorizontal:4,marginTop:1,minHeight:24},
  dateLine:{width:27,height:1,opacity:.65},
  dateText:{fontFamily:'serif',fontSize:12.6,fontWeight:'600',flex:1,minWidth:0,lineHeight:21,textAlign:'center'},
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
