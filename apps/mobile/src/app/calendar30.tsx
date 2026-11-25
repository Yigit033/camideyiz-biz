import {memo,useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {shiftCalendarDate,zonedClock,type Calendar30Day} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useCalendar30} from '@/features/calendar/useCalendar30';

const MONTH=new Intl.DateTimeFormat('tr-TR',{month:'short',timeZone:'UTC'});
const MONTH_LONG=new Intl.DateTimeFormat('tr-TR',{month:'long',timeZone:'UTC'});
const WEEKDAY=new Intl.DateTimeFormat('tr-TR',{weekday:'long',timeZone:'UTC'});
const WEEKDAY_SHORT=new Intl.DateTimeFormat('tr-TR',{weekday:'short',timeZone:'UTC'});
const COLUMNS=['İmsak','Güneş','Öğle','İkindi','Akşam','Yatsı'] as const;
const DAYS=30;
/** Dense numbers scale with the system font up to 130%, then shrink to fit:
 * thirty rows of six clocks stay one table, never clipped. */
const TABLE_MAX_SCALE=1.3;
const TIME_SIZE=12.5;
const MAX_ROW=30;
const HEADER_ROW=26;

const noon=(iso:string)=>new Date(iso+'T12:00:00Z');
function readable(iso:string){const day=noon(iso);
  return Number(iso.slice(8,10))+' '+MONTH_LONG.format(day)+' '+WEEKDAY.format(day);
}

/** One calendar day as a single table row: date, then the six clocks. */
const DayRow=memo(function DayRow({dateISO,day,today,selected,stripe,height,dateWidth,
  stacked,pending,onSelect}:{
  dateISO:string;day:Calendar30Day|null;today:boolean;selected:boolean;stripe:boolean;
  height:number;dateWidth:number;stacked:boolean;pending:boolean;onSelect:(iso:string)=>void;
}){
  const {colors}=useAppTheme();
  const dark=colors.isDark;
  const date=noon(dateISO);
  const friday=date.getUTCDay()===5;
  return <Pressable onPress={()=>onSelect(dateISO)}
    accessibilityRole="button" accessibilityState={{selected}}
    accessibilityLabel={(today?'Bugün, ':'')+readable(dateISO)+(day
      ?', '+day.times.map(t=>t.label+' '+t.time).join(', ')
      :', Yayımlanmış veri bekleniyor')}
    style={{height,flexDirection:stacked?'column':'row',alignItems:stacked?'stretch':'center',
      justifyContent:'center',gap:stacked?2:0,paddingRight:6,
      paddingLeft:today?3:6,borderLeftWidth:today?3:0,borderLeftColor:colors.gold,
      backgroundColor:today?(dark?'#14385A':'#F5ECDC'):selected?colors.soft:
        stripe?(dark?'#0E2840':'#F8F8F3'):'transparent'}}>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.75}
      maxFontSizeMultiplier={TABLE_MAX_SCALE}
      style={{width:stacked?undefined:dateWidth,fontSize:12,fontVariant:['tabular-nums'],
        fontWeight:'800',color:today?colors.gold:colors.text}}>
      {dateISO.slice(8,10)+' '+MONTH.format(date)}
      <Text style={{fontSize:10.5,fontWeight:friday?'800':'600',
        color:friday?colors.gold:colors.muted}}>{' '+WEEKDAY_SHORT.format(date)}</Text>
    </Text>
    <View style={{flex:stacked?0:1,flexDirection:'row',alignItems:'center'}}>
    {day?day.times.map(t=><Text key={t.key} numberOfLines={1} adjustsFontSizeToFit
      minimumFontScale={.75} maxFontSizeMultiplier={TABLE_MAX_SCALE}
      style={{flex:1,textAlign:'center',fontSize:TIME_SIZE,fontVariant:['tabular-nums'],
        fontWeight:today||selected?'800':'600',color:colors.text}}>{t.time}</Text>)
      :pending?COLUMNS.map(c=><View key={c} style={{flex:1,alignItems:'center'}}>
        <View style={{width:'62%',height:6,borderRadius:3,backgroundColor:colors.border}}/>
      </View>)
      :<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.75}
        maxFontSizeMultiplier={TABLE_MAX_SCALE}
        style={{flex:6,textAlign:'center',fontSize:11,fontStyle:'italic',color:colors.muted}}>
        Yayımlanmış veri bekleniyor
      </Text>}
    </View>
  </Pressable>;
});

export default function Calendar30Screen(){
  const [dateISO,setDateISO]=useState(()=>zonedClock(new Date(),'Europe/Istanbul').dateISO);
  const {colors}=useAppTheme();
  const {width,fontScale}=useWindowDimensions();
  const {place,snapshot,coverage,status,loading,error,retry}=useCalendar30(dateISO);
  const [selected,setSelected]=useState(dateISO);
  const [room,setRoom]=useState(0);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const next=zonedClock(new Date(),'Europe/Istanbul').dateISO;
      setDateISO(old=>old===next?old:next);
    },60_000);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>setSelected(dateISO),[dateISO,place?.id]);
  const dates=useMemo(()=>Array.from({length:DAYS},(_,i)=>shiftCalendarDate(dateISO,i)),[dateISO]);
  const data=useMemo(()=>dates.map((iso,index)=>({
    iso,day:snapshot?.startISO===dateISO?snapshot.days[index]??null:null,
  })),[snapshot,dates,dateISO]);
  const onSelect=useCallback((iso:string)=>setSelected(iso),[]);

  // Fit: all 30 rows share the measured height, so the month reads as one
  // page with no expanding cards. Larger system fonts raise the minimum row
  // height; only then does the table scroll.
  const textScale=Math.min(fontScale,TABLE_MAX_SCALE);
  const dateWidth=Math.round(Math.min(96,Math.max(70,(width-28)*.22))*Math.max(1,textScale*.92));
  // Each clock needs its digits plus a visible gap; if the date column leaves
  // too little room (large fonts, narrow phones), the date moves above them.
  const clocksRoom=width-16-2-12;
  const stacked=clocksRoom-dateWidth<6*(TIME_SIZE*textScale*2.55+6);
  const minRow=Math.ceil(TIME_SIZE*textScale*(stacked?2.3:1.2)+(stacked?8:2));
  const body=Math.max(0,room-HEADER_ROW*textScale-2);
  const rowHeight=body>0?Math.max(minRow,Math.min(stacked?54:MAX_ROW,body/DAYS)):minRow+4;
  const fits=rowHeight*DAYS<=body+.5;

  const chosen=data.find(d=>d.iso===selected)??data[0];
  const pending=status==='loading';
  const banner=status==='choose-location'?'Önce ana sayfadan il veya ilçe seç':
    pending?'Takvim yükleniyor…':
    status==='unavailable'?'Namaz takvimi alınamadı':
    status==='partial'?coverage+' / 30 günün vakitleri hazır':null;
  const canRetry=(Boolean(error)||status==='partial'||status==='unavailable')&&
    status!=='choose-location';

  return <SafeAreaView edges={['top','bottom']}
    style={{flex:1,backgroundColor:colors.canvas}}>
    <View style={{paddingHorizontal:14,paddingVertical:8,
      borderBottomWidth:1,borderBottomColor:colors.border,
      flexDirection:'row',alignItems:'center',gap:10}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()}
        style={{height:42,width:42,borderRadius:14,borderWidth:1,borderColor:colors.border,
          backgroundColor:colors.surface,justifyContent:'center',alignItems:'center'}}>
        <Feather name="arrow-left" size={20} color={colors.text}/>
      </Pressable>
      <View style={{flex:1,gap:3}}>
        <Text numberOfLines={2} style={{fontSize:17,fontFamily:'serif',fontWeight:'800',
          color:colors.text}}>
          30 Günlük Namaz Takvimi
        </Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',columnGap:8,rowGap:3}}>
          <Text style={{flexShrink:1,fontSize:11,color:colors.muted}} numberOfLines={1}>
            {place?place.name+' · '+place.stateName:'İlçe seçilmedi'} · {dateISO.slice(8,10)}.{dateISO.slice(5,7)}.{dateISO.slice(0,4)}
          </Text>
          {status==='available'?<View accessible accessibilityLabel="30 günlük takvim hazır"
            style={{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,
              paddingVertical:1,borderRadius:8,backgroundColor:colors.soft}}>
            <Feather name="check" size={11} color={colors.gold}/>
            <Text style={{fontSize:10.5,fontWeight:'800',color:colors.gold,
              fontVariant:['tabular-nums']}}>30/30 hazır</Text>
          </View>:null}
        </View>
      </View>
      <Feather name="calendar" size={19} color={colors.gold}/>
    </View>

    <View style={{flex:1,paddingHorizontal:8,paddingTop:8,paddingBottom:6,gap:7}}>
      {/* Selected day in full: long date, Hijri date. Today by default. */}
      <View accessible accessibilityLiveRegion="polite"
        style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',columnGap:8,rowGap:2,
          paddingHorizontal:10,paddingVertical:7,borderRadius:13,borderWidth:1,
          borderColor:chosen.iso===dateISO?colors.gold:colors.border,
          backgroundColor:colors.surface}}>
        {chosen.iso===dateISO?<Text style={{fontSize:10,fontWeight:'800',
          color:colors.gold,letterSpacing:.6}}>BUGÜN</Text>:null}
        <Text style={{fontSize:12.5,fontWeight:'800',color:colors.text}}>
          {readable(chosen.iso)}
        </Text>
        <Text style={{flexGrow:1,textAlign:'right',fontSize:11.5,fontWeight:'700',
          color:chosen.day?colors.gold:colors.muted}}>
          {chosen.day?(chosen.day.hijriDate??'Yayımlanmış takvim')
            :pending?'':'Bu günün vakitleri henüz yayımlanmadı.'}
        </Text>
      </View>

      {banner?<View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',
        columnGap:10,rowGap:4,paddingHorizontal:10,paddingVertical:6,borderRadius:12,
        backgroundColor:colors.soft}}>
        {pending?<ActivityIndicator size="small" color={colors.gold}/>:null}
        <Text style={{flexShrink:1,color:colors.text,fontSize:12,fontWeight:'700'}}>{banner}</Text>
        {canRetry?<Pressable accessibilityRole="button"
          accessibilityLabel="Takvim verilerini yeniden yükle"
          onPress={retry} disabled={loading} hitSlop={6}
          style={{flexDirection:'row',gap:6,alignItems:'center',minHeight:32,marginLeft:'auto'}}>
          <Feather name="refresh-cw" size={14} color={colors.gold}/>
          <Text style={{color:colors.gold,fontSize:12,fontWeight:'800'}}>
            {loading?'Yükleniyor…':'Yeniden dene'}
          </Text>
        </Pressable>:null}
        {status==='unavailable'&&error?<Text style={{width:'100%',fontSize:10.5,color:colors.muted}}>
          İnternet bağlantını kontrol edip yeniden dene.
        </Text>:null}
      </View>:null}

      <View style={{flex:1}} onLayout={e=>setRoom(e.nativeEvent.layout.height)}>
        <View style={{height:fits?HEADER_ROW*textScale+2+rowHeight*DAYS:'100%',
          borderRadius:14,borderWidth:1,borderColor:colors.border,overflow:'hidden',
          backgroundColor:colors.surface}}>
          <View style={{height:HEADER_ROW*textScale,flexDirection:'row',alignItems:'center',
            paddingHorizontal:6,backgroundColor:colors.elevated,
            borderBottomWidth:1,borderBottomColor:colors.border}}>
            {stacked?null:<Text numberOfLines={1} maxFontSizeMultiplier={TABLE_MAX_SCALE}
              style={{width:dateWidth,fontSize:10.5,fontWeight:'800',color:colors.muted}}>
              Tarih
            </Text>}
            {COLUMNS.map(c=><Text key={c} numberOfLines={1} adjustsFontSizeToFit
              minimumFontScale={.75} maxFontSizeMultiplier={TABLE_MAX_SCALE}
              style={{flex:1,textAlign:'center',fontSize:10.5,fontWeight:'800',
                color:colors.gold}}>{c}</Text>)}
          </View>
          <ScrollView scrollEnabled={!fits} showsVerticalScrollIndicator={!fits}
            bounces={false} overScrollMode="never">
            {data.map((item,index)=><DayRow key={item.iso} dateISO={item.iso} day={item.day}
              today={item.iso===dateISO} selected={item.iso===selected&&item.iso!==dateISO}
              stripe={index%2===1} height={rowHeight} dateWidth={dateWidth} stacked={stacked}
              pending={pending&&!item.day} onSelect={onSelect}/>)}
          </ScrollView>
        </View>
      </View>
    </View>
  </SafeAreaView>;
}
