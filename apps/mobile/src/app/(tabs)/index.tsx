import {useEffect,useMemo,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {DEMO_SCHEDULE,formatCountdown,nextPrayerAtSeconds,zonedClock} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {PrayerWheel,PRAYER_COLORS} from '@/features/prayer/PrayerWheel';

const SCHEDULE=DEMO_SCHEDULE;
export default function HomeScreen(){
  const {colors}=useAppTheme();
  const {width}=useWindowDimensions();
  const wheelSize=Math.min(width-24,398);
  const [now,setNow]=useState(()=>new Date());
  const [manualIndex,setManualIndex]=useState<number|null>(null);
  useEffect(()=>{
    const id=setInterval(()=>setNow(new Date()),1000);
    return ()=>clearInterval(id);
  },[]);
  const zoned=useMemo(()=>zonedClock(now,SCHEDULE.timezone),[now]);
  const next=nextPrayerAtSeconds(SCHEDULE,zoned.secondsOfDay);
  const upcomingIndex=SCHEDULE.times.findIndex(x=>x.key===next.prayer.key);
  const selectedIndex=manualIndex??upcomingIndex;
  const dateText=new Intl.DateTimeFormat('tr-TR',{
    timeZone:SCHEDULE.timezone,day:'numeric',month:'long',year:'numeric',weekday:'long'
  }).format(now);
  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <View>
          <Text style={[styles.brandSmall,{color:colors.gold}]}>CAMİDEYİZ BİZ</Text>
          <Text style={[styles.header,{color:colors.text}]}>Selâmün aleyküm</Text>
        </View>
        <View style={[styles.logo,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <MaterialCommunityIcons name="mosque" color={colors.gold} size={25}/>
        </View>
      </View>
      <View style={styles.locationRow}>
        <View style={[styles.locationPill,{borderColor:colors.border,backgroundColor:colors.surface}]}>
          <Feather name="map-pin" size={14} color={colors.emerald}/>
          <Text style={{color:colors.text,fontSize:13,fontWeight:'600'}}>{SCHEDULE.locationName}</Text>
          <Feather name="chevron-down" size={13} color={colors.muted}/>
        </View>
        <Text style={{color:colors.muted,fontSize:11,flex:1,textAlign:'right'}} numberOfLines={2}>{dateText}</Text>
      </View>
      <View style={[styles.notice,{backgroundColor:colors.soft,borderColor:colors.border}]}>
        <Feather name="info" size={14} color={colors.emerald}/>
        <Text style={[styles.noticeText,{color:colors.text}]}>TASARIM DEMOSU · Saatler temsili, ibadet için kullanmayın.</Text>
      </View>
      <View style={styles.wheelContainer}>
        <PrayerWheel times={SCHEDULE.times} colors={colors} size={wheelSize}
          selectedIndex={selectedIndex} onSelect={setManualIndex}
          countdown={formatCountdown(next.secondsRemaining)} isManualSelection={manualIndex!==null}/>
      </View>
      <View style={styles.legendRow}>
        <Feather name="move" size={14} color={colors.gold}/>
        <Text style={[styles.legendText,{color:colors.muted}]}>Çemberin üzerinde parmağını gezdirerek vakitleri keşfet</Text>
      </View>
      {manualIndex!==null?<Pressable onPress={()=>setManualIndex(null)} style={styles.reset} accessibilityRole="button">
        <Feather name="rotate-ccw" size={13} color={colors.emerald}/>
        <Text style={{color:colors.emerald,fontWeight:'700',fontSize:12}}>Canlı geri sayıma dön</Text>
      </Pressable>:null}
      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle,{color:colors.text}]}>Günün vakitleri</Text>
        <Text style={{fontSize:11,color:colors.muted}}>Örnek takvim</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:7}}>
        {SCHEDULE.times.map((x,index)=><Pressable key={x.key} onPress={()=>setManualIndex(index)}
          accessibilityRole="button" accessibilityState={{selected:selectedIndex===index}}
          accessibilityLabel={x.label+', '+x.time+', seçmek için dokun'}
          style={[styles.prayerChip,{
            backgroundColor:selectedIndex===index?colors.soft:colors.surface,
            borderColor:selectedIndex===index?PRAYER_COLORS[x.key]:colors.border
          }]}>
          <View style={{width:6,height:6,borderRadius:3,backgroundColor:PRAYER_COLORS[x.key]}}/>
          <Text style={{fontSize:12,color:colors.muted,marginTop:5}}>{x.label}</Text>
          <Text style={{fontSize:17,color:colors.text,fontWeight:'700',marginTop:5}}>{x.time}</Text>
        </Pressable>)}
      </ScrollView>
      <View style={[styles.kerahet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={[styles.kerahetIcon,{backgroundColor:colors.warning+'20'}]}>
          <Feather name="alert-circle" color={colors.warning} size={17}/>
        </View>
        <View style={{flex:1,gap:3}}>
          <Text style={{color:colors.text,fontWeight:'700',fontSize:13}}>Kerahet vakitleri</Text>
          <Text style={{color:colors.muted,fontSize:12,lineHeight:18}}>Kaynak ve hesaplama doğrulandıktan sonra çemberde ayrı uyarı aralıkları gösterilecek.</Text>
        </View>
      </View>
      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle,{color:colors.text}]}>Günlük ilham</Text>
        <Feather name="book-open" color={colors.gold} size={18}/>
      </View>
      <View style={styles.dailyRow}>
        <View style={[styles.dailyCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <MaterialCommunityIcons name="book-open-page-variant-outline" size={23} color={colors.gold}/>
          <Text style={[styles.dailyTitle,{color:colors.text}]}>Günün Ayeti</Text>
          <Text style={[styles.dailyBody,{color:colors.muted}]}>Kaynağı doğrulanmış ayet ve meali, yönetim panelinden buraya gelecek.</Text>
        </View>
        <View style={[styles.dailyCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <MaterialCommunityIcons name="text-box-outline" size={23} color={colors.gold}/>
          <Text style={[styles.dailyTitle,{color:colors.text}]}>Günün Hadisi</Text>
          <Text style={[styles.dailyBody,{color:colors.muted}]}>Kaynağı doğrulanmış hadisler günlük olarak gösterilecek.</Text>
        </View>
      </View>
      <Text style={{color:colors.muted,textAlign:'center',fontSize:11,lineHeight:17}}>Camideyiz Biz · Huzurlu bir günlük ibadet deneyimi</Text>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  content:{paddingHorizontal:20,paddingTop:14,paddingBottom:44,gap:12},
  top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brandSmall:{fontSize:10,letterSpacing:2,fontWeight:'800',marginBottom:5},
  header:{fontSize:27,fontWeight:'700',letterSpacing:-.9},
  logo:{width:48,height:48,borderRadius:16,alignItems:'center',justifyContent:'center',borderWidth:1},
  locationRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:2},
  locationPill:{borderRadius:99,borderWidth:1,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:12,paddingVertical:9},
  notice:{borderWidth:1,borderRadius:12,padding:9,flexDirection:'row',alignItems:'center',gap:8},
  noticeText:{fontSize:10.5,fontWeight:'600',flexShrink:1},
  wheelContainer:{alignItems:'center',marginVertical:-4,marginHorizontal:-8},
  legendRow:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6},
  legendText:{fontSize:11,textAlign:'center',flexShrink:1},
  reset:{flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',minHeight:44},
  sectionHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8},
  sectionTitle:{fontSize:18,letterSpacing:-.2,fontWeight:'700'},
  prayerChip:{minWidth:82,borderRadius:16,borderWidth:1.5,paddingHorizontal:13,paddingVertical:12},
  kerahet:{borderRadius:18,borderWidth:1,flexDirection:'row',alignItems:'center',gap:10,padding:14,marginTop:2},
  kerahetIcon:{height:34,width:34,borderRadius:12,alignItems:'center',justifyContent:'center'},
  dailyRow:{flexDirection:'row',gap:10},
  dailyCard:{flex:1,borderWidth:1,borderRadius:19,padding:15,minHeight:167,gap:8},
  dailyTitle:{fontSize:15,fontWeight:'700'},
  dailyBody:{fontSize:11,lineHeight:17}
});
