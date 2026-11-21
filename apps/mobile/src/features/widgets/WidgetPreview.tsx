import {memo,useEffect,useMemo,useState} from 'react';
import {Image,ScrollView,StyleSheet,Text,View} from 'react-native';
import {buildPrayerWidgetSnapshot,type PrayerSchedule} from '@camideyiz/core';

/**
 * In-app preview that mirrors the real Android RemoteViews widgets
 * (plugins/widget-native): same day/night palette, same brand marks, same
 * countdown-first hierarchy. Ticks every second on its own, so the parent
 * settings screen never re-renders for the countdown.
 */
const PALETTE={
  dark:{card:'#0C2438',border:'#2B536B',ink:'#F1F7F8',muted:'#AFC5D4',
    gold:'#F4D392',chip:'#173D58',selected:'#223B50',selectedBorder:'#B99D69',
    rule:'#31566D'},
  light:{card:'#FFFFFF',border:'#DEE4DB',ink:'#163045',muted:'#607481',
    gold:'#91652D',chip:'#E5EEE6',selected:'#F3E9D8',selectedBorder:'#B99D69',
    rule:'#DAE3E6'},
} as const;
const MARK={
  dark:require('../../../assets/widget-mark-dark.png'),
  light:require('../../../assets/widget-mark-light.png'),
};

function countdown(ms:number):string{
  if(!(ms>0))return '--:--';
  const total=Math.floor(ms/1000);
  const h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;
  const two=(n:number)=>String(n).padStart(2,'0');
  return h>0?h+':'+two(m)+':'+two(s):two(m)+':'+two(s);
}

export const WidgetPreview=memo(function WidgetPreview({days,dark}:{
  days:readonly PrayerSchedule[];dark:boolean;
}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    const id=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(id);
  },[]);
  // Prayer times are minute-precise: rebuild the snapshot once per minute.
  const minuteStart=Math.floor(now/60_000)*60_000;
  const snapshot=useMemo(()=>buildPrayerWidgetSnapshot(days,minuteStart),[days,minuteStart]);
  const c=dark?PALETTE.dark:PALETTE.light;
  const mark=dark?MARK.dark:MARK.light;
  const ready=snapshot.status==='ready';
  const remaining=countdown(snapshot.nextAt-now);
  const nextIndex=snapshot.times.findIndex(t=>t.label===snapshot.nextName);

  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{gap:12,paddingRight:12}}>
    {/* 2×2 Sıradaki Vakit */}
    <View accessible accessibilityLabel={ready
        ?'Sıradaki vakit önizlemesi: '+snapshot.nextName+' '+snapshot.nextTime+', kalan '+remaining
        :'Sıradaki vakit önizlemesi'}
      style={[styles.square,{backgroundColor:c.card,borderColor:c.border}]}>
      <View style={styles.header}>
        <Image source={mark} style={styles.mark} resizeMode="contain"/>
        <Text numberOfLines={1} style={[styles.city,{color:c.muted}]}>
          {ready?snapshot.city:'Konum'}
        </Text>
      </View>
      <Text style={[styles.label,{color:c.muted}]}>SIRADAKİ VAKİT</Text>
      <View style={styles.prayerLine}>
        <Text numberOfLines={1} style={[styles.prayerName,{color:c.ink}]}>
          {ready?snapshot.nextName:'—'}
        </Text>
        <Text style={[styles.prayerTime,{color:c.muted}]}>{ready?snapshot.nextTime:'--:--'}</Text>
      </View>
      <View style={[styles.chip,{backgroundColor:c.chip}]}>
        <Text style={[styles.chipLabel,{color:c.muted}]}>KALAN</Text>
        <Text adjustsFontSizeToFit numberOfLines={1}
          style={[styles.countdown,{color:c.gold}]}>{ready?remaining:'--:--'}</Text>
      </View>
      <Text style={[styles.caption,{color:c.muted}]}>Sıradaki Vakit · 2×2</Text>
    </View>

    {/* 4×2 Altı Vakit Şeridi */}
    <View accessible accessibilityLabel="Altı vakit şeridi önizlemesi"
      style={[styles.wide,{backgroundColor:c.card,borderColor:c.border}]}>
      <View style={styles.header}>
        <Image source={mark} style={styles.mark} resizeMode="contain"/>
        <Text numberOfLines={1} style={[styles.city,{color:c.muted}]}>
          {ready?snapshot.city:'Konum'}
        </Text>
      </View>
      <View style={[styles.rule,{backgroundColor:c.rule}]}/>
      <View style={styles.cells}>
        {(ready?snapshot.times:[]).map((item,index)=>{
          const selected=index===nextIndex;
          return <View key={item.key} style={[styles.cell,selected&&{
            backgroundColor:c.selected,borderColor:c.selectedBorder}]}>
            <Text numberOfLines={1} style={[styles.cellLabel,{color:selected?c.gold:c.muted}]}>
              {item.label}
            </Text>
            <Text numberOfLines={1} style={[styles.cellTime,{color:selected?c.gold:c.ink}]}>
              {item.time}
            </Text>
          </View>;
        })}
      </View>
      <View style={[styles.chip,{backgroundColor:c.chip,justifyContent:'space-between'}]}>
        <Text numberOfLines={1} style={[styles.chipLabel,{color:c.muted,flexShrink:1}]}>
          {ready?snapshot.nextName+' vaktine kalan':'Vakitler bekleniyor'}
        </Text>
        <Text numberOfLines={1} style={[styles.countdown,{color:c.gold}]}>
          {ready?remaining:'--:--'}
        </Text>
      </View>
      <Text style={[styles.caption,{color:c.muted}]}>Altı Vakit Şeridi · 4×2</Text>
    </View>
  </ScrollView>;
});

const styles=StyleSheet.create({
  square:{width:198,height:206,borderRadius:22,borderWidth:1,padding:12,gap:6},
  wide:{width:300,height:206,borderRadius:22,borderWidth:1,padding:12,gap:6},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,height:26},
  mark:{width:30,height:26},
  city:{fontSize:11,flexShrink:1,textAlign:'right'},
  label:{fontSize:9,letterSpacing:.6,textAlign:'center',marginTop:2},
  prayerLine:{flexDirection:'row',alignItems:'baseline',justifyContent:'center',gap:8},
  prayerName:{fontSize:22,fontWeight:'800',flexShrink:1},
  prayerTime:{fontSize:20,fontWeight:'700',fontVariant:['tabular-nums']},
  chip:{flex:1,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',
    gap:8,paddingHorizontal:10},
  chipLabel:{fontSize:9.5,letterSpacing:.4},
  countdown:{fontSize:28,fontWeight:'800',fontVariant:['tabular-nums']},
  caption:{fontSize:9,textAlign:'center',opacity:.85},
  rule:{height:1,marginVertical:2},
  cells:{flexDirection:'row',gap:3,height:50},
  cell:{flex:1,borderRadius:11,borderWidth:1,borderColor:'transparent',
    alignItems:'center',justifyContent:'center',gap:3},
  cellLabel:{fontSize:9.5},
  cellTime:{fontSize:12.5,fontWeight:'800',fontVariant:['tabular-nums']},
});
