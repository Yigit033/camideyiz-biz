import {memo} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {upcomingReligiousDay,type PrayerSchedule} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';

const MONTH_SHORT=new Intl.DateTimeFormat('tr-TR',{month:'short',timeZone:'UTC'});

const abbrev=['İmsak','Öğle','Akşam'] as const;
const indices=[0,2,4] as const;
/** Cheap home footer: no network, cache or timers. Only the already published
 * today and bundled Diyanet dates. All thirty rows load after navigation.
 */
export const HomeCalendarSection=memo(function HomeCalendarSection({
  today,dateISO,placeName,
}:{
  today:PrayerSchedule|null;dateISO:string;placeName:string|null;
}){
  const {colors}=useAppTheme();
  const dark=colors.isDark;
  const next=upcomingReligiousDay(dateISO);
  const border=dark?'#456278':colors.border;
  const card=dark?'#102B40':'#FFFFFF';
  return <View style={{marginTop:12,gap:11,marginHorizontal:2}}>
    <View style={{flexDirection:'row',gap:8,alignItems:'center',paddingHorizontal:4}}>
      <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.gold}/>
      <View style={{flex:1,gap:2}}>
        <Text style={{fontSize:19,fontWeight:'700',fontFamily:'serif',color:colors.text}}>
          Takvim Merkezi
        </Text>
        <Text style={{fontSize:10.5,color:colors.muted}}>
          Namaz vakitleri ve önemli dini günler
        </Text>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="30 günlük namaz vakitlerini aç"
      onPress={()=>router.push('/calendar30')}
      style={{padding:14,borderRadius:20,borderWidth:1,borderColor:border,
        backgroundColor:card,gap:12,shadowColor:'#071725',shadowOpacity:.11,
        shadowRadius:9,elevation:2}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
        <View style={{width:38,height:38,borderRadius:13,backgroundColor:dark?'#203E52':'#F1E8D8',
          justifyContent:'center',alignItems:'center'}}>
          <Feather name="calendar" size={19} color={colors.gold}/>
        </View>
        <View style={{flex:1,minWidth:0,gap:3}}>
          <Text style={{fontSize:15.5,fontWeight:'800',color:colors.text}}>30 Günlük Namaz Vakitleri</Text>
          <Text numberOfLines={1} style={{fontSize:11,color:colors.muted}}>
            {placeName??'Konum seçilmedi'} · Yayımlanmış ilçe takvimi
          </Text>
        </View>
        <Feather name="arrow-up-right" size={18} color={colors.gold}/>
      </View>
      <View style={{flexDirection:'row',gap:7}}>
        {indices.map((idx,i)=><View key={idx} style={{flex:1,minWidth:0,alignItems:'center',
          paddingVertical:10,paddingHorizontal:3,borderRadius:12,
          backgroundColor:dark?'#193A52':'#F2F4EF'}}>
          <Text style={{fontSize:11,color:colors.muted,marginBottom:5}}>{abbrev[i]}</Text>
          <Text style={{fontSize:15,fontWeight:'800',color:colors.text,fontVariant:['tabular-nums']}}>
            {today?.times[idx]?.time??'--:--'}
          </Text>
        </View>)}
      </View>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <Text style={{fontSize:10.5,color:colors.muted}}>
          {today?'Bugünün vakitleri':'Vakitler ilçe seçildikten sonra görünür'}
        </Text>
        <Text style={{fontSize:11.5,fontWeight:'700',color:colors.gold}}>Takvimi aç  ›</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Dini günler ve geceler takvimini aç"
      onPress={()=>router.push('/religious-days')}
      style={{padding:14,borderRadius:20,borderWidth:1,borderColor:border,
        backgroundColor:card,gap:12,shadowColor:'#071725',shadowOpacity:.08,
        shadowRadius:7,elevation:2}}>
      <View style={{flexDirection:'row',gap:9,alignItems:'center'}}>
        <View style={{width:38,height:38,borderRadius:13,backgroundColor:dark?'#203E52':'#F1E8D8',
          justifyContent:'center',alignItems:'center'}}>
          <MaterialCommunityIcons name="moon-waning-crescent" size={23} color={colors.gold}/>
        </View>
        <View style={{flex:1,gap:3}}>
          <Text style={{fontSize:15.5,color:colors.text,fontWeight:'800'}}>Dini Günler ve Geceler</Text>
          <Text style={{fontSize:11,color:colors.muted}}>Diyanet · 2026 ve 2027</Text>
        </View>
        <Feather name="arrow-up-right" size={18} color={colors.gold}/>
      </View>
      {next?<View style={{flexDirection:'row',alignItems:'center',gap:12,padding:11,
        borderRadius:13,backgroundColor:dark?'#193A52':'#F2F4EF'}}>
        <View style={{width:53,alignItems:'center'}}>
          <Text style={{fontSize:21,fontWeight:'800',color:colors.gold}}>
            {next.dateISO.slice(8,10)}
          </Text>
          <Text style={{fontSize:10,fontWeight:'800',color:colors.muted}}>
            {MONTH_SHORT.format(
              new Date(next.dateISO+'T12:00:00Z')).toLocaleUpperCase('tr-TR')}
          </Text>
        </View>
        <View style={{width:1,height:41,backgroundColor:colors.border}}/>
        <View style={{flex:1,gap:4}}>
          <Text style={{fontSize:13,fontWeight:'700',color:colors.text}}>{next.title}</Text>
          <Text style={{fontSize:10.5,color:colors.muted}}>
            {next.night?'Takvimdeki günün akşamı idrak edilir':'Sıradaki dini gün'}
          </Text>
        </View>
      </View>:<Text style={{color:colors.muted,fontSize:11}}>
        Yeni yılın dini günleri yakında eklenecek.
      </Text>}
      <Text style={{fontSize:11.5,fontWeight:'700',color:colors.gold,textAlign:'right'}}>
        Tüm dini günler  ›
      </Text>
    </Pressable>
  </View>;
});
