import {memo,useCallback,useEffect,useMemo,useRef,useState,type ComponentRef} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Text,View,useWindowDimensions,
  type LayoutChangeEvent,type NativeScrollEvent,type NativeSyntheticEvent} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import Animated,{FadeIn,FadeOut,LinearTransition} from 'react-native-reanimated';
import {prayerBadgeForeground,shiftCalendarDate,splitHijriDate,timeToMinutes,zonedClock,
  type Calendar30Day} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import type {ColorTokens} from '@/theme/tokens';
import {useCalendar30} from '@/features/calendar/useCalendar30';
import {PRAYER_COLORS,PRAYER_ICONS} from '@/features/prayer/PrayerWheel';

const MONTH_LONG=new Intl.DateTimeFormat('tr-TR',{month:'long',timeZone:'UTC'});
const WEEKDAY=new Intl.DateTimeFormat('tr-TR',{weekday:'long',timeZone:'UTC'});
const DAYS=30;
/** Calendar 3.0 (owner, 26.11.2026): thirty date cells in three columns on
 * one page; a tapped date opens its six clocks right under its row. */
const PER_ROW=3;
const ROWS=DAYS/PER_ROW;
const GAP=6;
const EDGE=1.5;
/** Text grows with the system font up to 130%, as ONE size per role across
 * all thirty cells (never cell-by-cell shrinking), capped by what the
 * longest Turkish name fits: "29 Cemaziyelevvel", "28 Ağustos 2026",
 * "Cumartesi" (widths in em of the system bold face, with a margin). */
const TEXT_MAX_SCALE=1.3;
const TYPE={hijri:11,date:12.5,weekday:10.5,label:10.5,time:16} as const;
const WIDEST_EM={hijri:9,date:8.2,weekday:5.2,time:3} as const;
const LINE=1.25;
const CELL_PAD=5;
/** Panel: inner padding, and a 24pt prayer badge with a 7pt gap per tile. */
const PANEL_PAD=GAP+2;
const TILE_PAD=7;
const BADGE=24;
const CELL_MAX=62;

const noon=(iso:string)=>new Date(iso+'T12:00:00Z');
function gregorian(iso:string){
  const day=noon(iso);
  return {
    date:Number(iso.slice(8,10))+' '+MONTH_LONG.format(day)+' '+iso.slice(0,4),
    weekday:WEEKDAY.format(day),friday:day.getUTCDay()===5,
  };
}
type Sizes={hijri:number;date:number;weekday:number;label:number;time:number;
  cell:number;tile:number};

/** One date: Hijri day and month (gold), Gregorian date, weekday. */
const DateCell=memo(function DateCell({iso,day,today,open,pending,sizes,onToggle}:{
  iso:string;day:Calendar30Day|null;today:boolean;open:boolean;pending:boolean;
  sizes:Sizes;onToggle:(iso:string)=>void;
}){
  const {colors}=useAppTheme();
  const look=palette(colors);
  const {date,weekday,friday}=gregorian(iso);
  const hijri=splitHijriDate(day?.hijriDate);
  return <Pressable onPress={()=>onToggle(iso)}
    accessibilityRole="button" accessibilityState={{expanded:open}}
    accessibilityLabel={(today?'Bugün, ':'')+date+' '+weekday+
      (day?.hijriDate?', '+day.hijriDate:'')+
      (day?'':pending?', takvim yükleniyor':', Yayımlanmış veri bekleniyor')+
      (open?'. Vakitleri kapat':'. Vakitleri göster')}
    style={({pressed})=>({
      flex:1,height:sizes.cell,borderWidth:EDGE,borderRadius:13,
      paddingHorizontal:5,alignItems:'center',justifyContent:'center',
      backgroundColor:open?look.openFill:today?look.todayFill:colors.surface,
      borderColor:open?look.openEdge:today?colors.gold:colors.border,
      // An open date becomes the tab of its panel: square foot, no bottom edge.
      ...(open?{borderBottomColor:'transparent',
        borderBottomLeftRadius:0,borderBottomRightRadius:0}:null),
      opacity:pressed?.86:1,
    })}>
    {hijri.dayMonth
      ?<Text allowFontScaling={false} numberOfLines={1} style={{
        fontSize:sizes.hijri,lineHeight:sizes.hijri*LINE,fontWeight:'700',
        color:colors.gold,textAlign:'center'}}>{hijri.dayMonth}</Text>
      :<View style={{height:sizes.hijri*LINE,justifyContent:'center'}}>
        <View style={{width:44,height:5,borderRadius:3,
          backgroundColor:colors.border,opacity:pending?1:.55}}/>
      </View>}
    <Text allowFontScaling={false} numberOfLines={1} style={{
      fontSize:sizes.date,lineHeight:sizes.date*LINE,fontWeight:'800',
      fontVariant:['tabular-nums'],color:today?colors.gold:colors.text,
      textAlign:'center'}}>{date}</Text>
    <Text allowFontScaling={false} numberOfLines={1} style={{
      fontSize:sizes.weekday,lineHeight:sizes.weekday*LINE,
      fontWeight:friday||today?'800':'600',
      color:friday?colors.gold:colors.muted,textAlign:'center'}}>
      {weekday}
    </Text>
  </Pressable>;
});

/** The six clocks of the open date, joined to it by a tab. */
function DayPanel({iso,day,column,cellWidth,pending,today,nowMinutes,sizes,onLayout}:{
  iso:string;day:Calendar30Day|null;column:number;cellWidth:number;pending:boolean;
  today:boolean;nowMinutes:number;sizes:Sizes;onLayout:(e:LayoutChangeEvent)=>void;
}){
  const {colors}=useAppTheme();
  const look=palette(colors);
  const {date,weekday}=gregorian(iso);
  const next=today&&day?day.times.findIndex(t=>timeToMinutes(t.time)>nowMinutes):-1;
  return <Animated.View entering={FadeIn.duration(190)} exiting={FadeOut.duration(110)}
    layout={LinearTransition.duration(220)} onLayout={onLayout}
    accessibilityLiveRegion="polite"
    style={{borderWidth:EDGE,borderColor:look.openEdge,backgroundColor:look.openFill,
      borderRadius:16,
      borderTopLeftRadius:column===0?0:16,borderTopRightRadius:column===PER_ROW-1?0:16,
      padding:PANEL_PAD,gap:GAP+1}}>
    {/* The tab: continues the date's sides down through the row gap and
        covers this panel's top edge under it, so date and panel are one shape. */}
    <View pointerEvents="none" style={{position:'absolute',top:-(GAP+EDGE)-1,
      left:column*(cellWidth+GAP)-EDGE,width:cellWidth,height:GAP+EDGE*2+1,
      backgroundColor:look.openFill,borderLeftWidth:EDGE,borderRightWidth:EDGE,
      borderColor:look.openEdge}}/>
    <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'baseline',
      justifyContent:'space-between',columnGap:8,rowGap:1,paddingHorizontal:2}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
        {today?<Text allowFontScaling={false} style={{fontSize:sizes.label-1,
          fontWeight:'800',letterSpacing:.6,color:colors.gold}}>BUGÜN</Text>:null}
        <Text allowFontScaling={false} style={{fontSize:sizes.date+1,fontWeight:'800',
          color:colors.text}}>{date+' '+weekday}</Text>
      </View>
      <Text allowFontScaling={false} style={{fontSize:sizes.hijri,fontWeight:'700',
        color:colors.gold}}>{day?.hijriDate??''}</Text>
    </View>
    {day?<View style={{flexDirection:'row',flexWrap:'wrap',gap:GAP}}>
      {day.times.map((t,i)=>{
        const accent=PRAYER_COLORS[t.key];
        const isNext=i===next;
        return <View key={t.key} accessible
          accessibilityLabel={t.label+' '+t.time+(isNext?', sıradaki vakit':'')}
          style={{width:sizes.tile,
            flexDirection:'row',alignItems:'center',gap:7,
            paddingVertical:TILE_PAD,paddingHorizontal:TILE_PAD,borderRadius:12,
            borderWidth:isNext?EDGE:1,borderColor:isNext?accent:colors.border,
            backgroundColor:look.tile}}>
          <View style={{width:BADGE,height:BADGE,borderRadius:BADGE/2,backgroundColor:accent,
            alignItems:'center',justifyContent:'center'}}>
            <MaterialCommunityIcons name={PRAYER_ICONS[t.key]} size={14}
              color={prayerBadgeForeground(accent)}/>
          </View>
          <View style={{flex:1,minWidth:0}}>
            <Text allowFontScaling={false} numberOfLines={1} style={{
              fontSize:sizes.label,lineHeight:sizes.label*LINE,fontWeight:'700',
              color:isNext?colors.text:colors.muted}}>{t.label}</Text>
            <Text allowFontScaling={false} numberOfLines={1} style={{
              fontSize:sizes.time,lineHeight:sizes.time*LINE,fontWeight:'800',
              fontVariant:['tabular-nums'],color:colors.text}}>{t.time}</Text>
          </View>
        </View>;
      })}
    </View>
    :<View style={{minHeight:64,alignItems:'center',justifyContent:'center',gap:6}}>
      {pending
        ?<ActivityIndicator size="small" color={colors.gold}/>
        :<Text allowFontScaling={false} style={{fontSize:sizes.label+1,fontWeight:'700',
          color:colors.muted,textAlign:'center'}}>Bu günün vakitleri henüz yayımlanmadı.</Text>}
    </View>}
  </Animated.View>;
}

/** Open date and its panel share one warm surface; tiles sit a step apart. */
function palette(colors:ColorTokens){
  return colors.isDark
    ?{openFill:colors.elevated,openEdge:'rgba(216,191,141,.72)',
      todayFill:'#14385A',tile:colors.surface}
    :{openFill:'#FBF2DE',openEdge:'#D6B97E',todayFill:'#F5ECDC',tile:'#FFFFFF'};
}

export default function Calendar30Screen(){
  const [dateISO,setDateISO]=useState(()=>zonedClock(new Date(),'Europe/Istanbul').dateISO);
  const [nowMinutes,setNowMinutes]=useState(()=>
    Math.floor(zonedClock(new Date(),'Europe/Istanbul').secondsOfDay/60));
  const {colors}=useAppTheme();
  const {width,fontScale}=useWindowDimensions();
  const {place,snapshot,coverage,status,loading,error,retry}=useCalendar30(dateISO);
  const [open,setOpen]=useState<string|null>(null);
  const [room,setRoom]=useState(0);
  const [gridWidth,setGridWidth]=useState(width-16);
  const scroll=useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY=useRef(0);
  const reveal=useRef(false);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const clock=zonedClock(new Date(),'Europe/Istanbul');
      setDateISO(old=>old===clock.dateISO?old:clock.dateISO);
      setNowMinutes(Math.floor(clock.secondsOfDay/60));
    },30_000);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>setOpen(null),[dateISO,place?.id]);
  const dates=useMemo(()=>Array.from({length:DAYS},(_,i)=>shiftCalendarDate(dateISO,i)),[dateISO]);
  const data=useMemo(()=>dates.map((iso,index)=>({
    iso,day:snapshot?.startISO===dateISO?snapshot.days[index]??null:null,
  })),[snapshot,dates,dateISO]);
  const rows=useMemo(()=>Array.from({length:ROWS},(_,r)=>
    data.slice(r*PER_ROW,r*PER_ROW+PER_ROW)),[data]);
  const onToggle=useCallback((iso:string)=>{
    setOpen(current=>{
      reveal.current=current!==iso;
      return current===iso?null:iso;
    });
  },[]);

  // One size per role for all cells, from the cell width and system font.
  const cellWidth=(gridWidth-GAP*(PER_ROW-1))/PER_ROW;
  const sizes=useMemo<Sizes>(()=>{
    const scale=Math.min(Math.max(fontScale,1),TEXT_MAX_SCALE);
    const inner=cellWidth-2*EDGE-10;
    const hijri=Math.min(TYPE.hijri*scale,inner/WIDEST_EM.hijri);
    const date=Math.min(TYPE.date*scale,inner/WIDEST_EM.date);
    const weekday=Math.min(TYPE.weekday*scale,inner/WIDEST_EM.weekday);
    // Three tiles per panel row: the panel spans the grid inside its edge.
    const tile=Math.floor((gridWidth-2*EDGE-2*PANEL_PAD-GAP*(PER_ROW-1))/PER_ROW*10)/10;
    const tileText=tile-2*TILE_PAD-2-BADGE-7;
    const time=Math.min(TYPE.time*scale,tileText/WIDEST_EM.time);
    // Thirty cells fill the page when they can, never below their text.
    const least=Math.ceil((hijri+date+weekday)*LINE+CELL_PAD*2+EDGE*2);
    const fit=room>0?(room-GAP*(ROWS-1))/ROWS:least;
    return {hijri,date,weekday,label:TYPE.label*Math.min(scale,1.15),time,
      cell:Math.max(least,Math.min(CELL_MAX,Math.floor(fit))),tile};
  },[cellWidth,gridWidth,fontScale,room]);

  const onScroll=useCallback((e:NativeSyntheticEvent<NativeScrollEvent>)=>{
    scrollY.current=e.nativeEvent.contentOffset.y;
  },[]);
  // An opened panel near the bottom slides into view, its date still visible.
  const onPanelLayout=useCallback((e:LayoutChangeEvent)=>{
    if(!reveal.current)return;
    reveal.current=false;
    const {y,height}=e.nativeEvent.layout;
    const bottom=y+height+GAP;
    const top=y-sizes.cell-GAP;
    if(bottom>scrollY.current+room)
      scroll.current?.scrollTo({y:Math.min(top,bottom-room),animated:true});
    else if(top<scrollY.current)scroll.current?.scrollTo({y:Math.max(0,top),animated:true});
  },[room,sizes.cell]);

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
        <ScrollView ref={scroll} onScroll={onScroll} scrollEventThrottle={32}
          showsVerticalScrollIndicator={false} overScrollMode="never"
          contentContainerStyle={{gap:GAP}}
          onLayout={e=>setGridWidth(e.nativeEvent.layout.width)}>
          {rows.map((row,r)=>{
            const column=row.findIndex(item=>item.iso===open);
            const openItem=column>=0?row[column]:null;
            return [
              <Animated.View key={'row-'+r} layout={LinearTransition.duration(220)}
                style={{flexDirection:'row',gap:GAP}}>
                {row.map(item=><DateCell key={item.iso} iso={item.iso} day={item.day}
                  today={item.iso===dateISO} open={item.iso===open}
                  pending={pending&&!item.day} sizes={sizes} onToggle={onToggle}/>)}
              </Animated.View>,
              openItem?<DayPanel key={'panel-'+openItem.iso} iso={openItem.iso}
                day={openItem.day} column={column} cellWidth={cellWidth}
                pending={pending&&!openItem.day} today={openItem.iso===dateISO}
                nowMinutes={nowMinutes} sizes={sizes} onLayout={onPanelLayout}/>:null,
            ];
          })}
        </ScrollView>
      </View>
    </View>
  </SafeAreaView>;
}

