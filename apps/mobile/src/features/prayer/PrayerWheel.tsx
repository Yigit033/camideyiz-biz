import {useMemo,useRef} from 'react';
import {PanResponder,StyleSheet,Text,View} from 'react-native';
import Svg,{Circle,Line,Path} from 'react-native-svg';
import type {PrayerTime} from '@camideyiz/core';
import {timeToMinutes} from '@camideyiz/core';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {base,type ColorTokens} from '@/theme/tokens';
export const PRAYER_COLORS:Record<PrayerTime['key'],string>={
  imsak:base.cyan,gunes:base.sunrise,ogle:base.noon,
  ikindi:base.afternoon,aksam:base.sunset,yatsi:base.night
};
/** Six actual time intervals, proportional to the 24-hour day, never six arbitrary equal parts. */
export function segmentAngles(times:readonly PrayerTime[]){
  const minutes=times.map(x=>timeToMinutes(x.time));
  return times.map((time,index)=>{
    const first=minutes[0],offset=(minutes[index]-first+1440)%1440;
    const nextOffset=index===times.length-1?1440:(minutes[index+1]-first+1440)%1440;
    return {...time,from:offset/1440*360,to:nextOffset/1440*360};
  });
}
function polar(angle:number,radius:number){
  const theta=angle*Math.PI/180;
  return {x:180+radius*Math.sin(theta),y:180-radius*Math.cos(theta)};
}
function arc(from:number,to:number,radius:number){
  const a=polar(from,radius),b=polar(to,radius);
  return 'M '+a.x.toFixed(3)+' '+a.y.toFixed(3)+' A '+radius+' '+radius+' 0 '+(to-from>180?1:0)+' 1 '+b.x.toFixed(3)+' '+b.y.toFixed(3);
}
type Props={
  times:readonly PrayerTime[];selectedIndex:number;onSelect:(index:number)=>void;
  size:number;colors:ColorTokens;countdown:string;isManualSelection:boolean;
};
export function PrayerWheel({times,selectedIndex,onSelect,size,colors,countdown,isManualSelection}:Props){
  const segments=useMemo(()=>segmentAngles(times),[times]);
  const selectRef=useRef(onSelect);selectRef.current=onSelect;
  const sizeRef=useRef(size);sizeRef.current=size;
  const segmentsRef=useRef(segments);segmentsRef.current=segments;
  const selectAtPoint=(x:number,y:number)=>{
    const scaledX=x*360/sizeRef.current,scaledY=y*360/sizeRef.current;
    const degrees=((Math.atan2(scaledX-180,180-scaledY)*180/Math.PI)+360)%360;
    const index=segmentsRef.current.findIndex(s=>degrees>=s.from&&degrees<s.to);
    if(index>=0) selectRef.current(index);
  };
  const responder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:({nativeEvent})=>{
      const x=nativeEvent.locationX,y=nativeEvent.locationY,mid=sizeRef.current/2;
      const distance=Math.hypot(x-mid,y-mid);
      return distance>=sizeRef.current*.27&&distance<=sizeRef.current*.5;
    },
    onMoveShouldSetPanResponder:({nativeEvent})=>{
      const mid=sizeRef.current/2,distance=Math.hypot(nativeEvent.locationX-mid,nativeEvent.locationY-mid);
      return distance>=sizeRef.current*.27&&distance<=sizeRef.current*.5;
    },
    onPanResponderGrant:({nativeEvent})=>selectAtPoint(nativeEvent.locationX,nativeEvent.locationY),
    onPanResponderMove:({nativeEvent})=>selectAtPoint(nativeEvent.locationX,nativeEvent.locationY)
  }),[]);
  const picked=segments[Math.max(0,Math.min(selectedIndex,segments.length-1))];
  const midAngle=picked?(picked.from+picked.to)/2:0,knob=polar(midAngle,139);
  return <View style={[styles.wrap,{width:size,height:size}]} {...responder.panHandlers} accessibilityLabel="Namaz vakitleri çemberi, vakit seçmek için çemberde sürükleyin.">
    <Svg width={size} height={size} viewBox="0 0 360 360" pointerEvents="none">
      <Circle cx={180} cy={180} r={160} stroke={colors.border} strokeWidth={1} fill="none"/>
      {Array.from({length:72},(_,i)=>{
        const deg=i*5,inner=polar(deg,i%6===0?164:166),outer=polar(deg,i%6===0?173:170);
        return <Line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={colors.gold} strokeOpacity={i%6===0?.75:.24} strokeWidth={i%6===0?1.6:.8}/>;
      })}
      <Circle cx={180} cy={180} r={139} stroke={colors.border} strokeWidth={34} fill="none"/>
      {segments.map((s,i)=>{
        const from=s.from+1.5,to=s.to-1.5;
        if(to<=from)return null;
        return <Path key={s.key} d={arc(from,to,139)} stroke={PRAYER_COLORS[s.key]} strokeWidth={selectedIndex===i?39:32} opacity={selectedIndex===i?1:.72} fill="none"/>;
      })}
      <Circle cx={180} cy={180} r={111} stroke={colors.border} strokeWidth={1.5} fill={colors.surface}/>
      <Circle cx={knob.x} cy={knob.y} r={11} fill={colors.text} stroke={colors.gold} strokeWidth={3}/>
      <Circle cx={knob.x} cy={knob.y} r={3} fill={PRAYER_COLORS[picked?.key??'imsak']}/>
    </Svg>
    <View pointerEvents="none" style={[styles.center,{width:size*.56}]}>
      <MaterialCommunityIcons name="mosque" size={27} color={colors.gold}/>
      <Text style={[styles.eyebrow,{color:colors.muted}]}>{isManualSelection?'SEÇİLEN VAKİT':'SIRADAKİ VAKİT'}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.prayer,{color:colors.text}]}>{picked?.label??'Vakit'}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.clock,{color:colors.emerald}]}>{isManualSelection?picked?.time:countdown}</Text>
      <Text style={[styles.footer,{color:colors.muted}]}>{isManualSelection?'Saat temsili':'Vakte kalan • demo'}</Text>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  wrap:{alignItems:'center',justifyContent:'center',position:'relative'},
  center:{position:'absolute',alignItems:'center',gap:5},
  eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:1.5,marginTop:2},
  prayer:{fontSize:22,fontWeight:'700'},
  clock:{fontSize:31,fontVariant:['tabular-nums'],fontWeight:'700',letterSpacing:-1.2},
  footer:{fontSize:10,textAlign:'center',marginTop:3}
});
