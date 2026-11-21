import {memo,useEffect,useMemo,useState} from 'react';
import {FlatList,Pressable,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {shiftCalendarDate,zonedClock,type Calendar30Day} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useCalendar30} from '@/features/calendar/useCalendar30';

const MONTHS=new Intl.DateTimeFormat('tr-TR',{month:'short',timeZone:'UTC'});
const WEEKDAY=new Intl.DateTimeFormat('tr-TR',{weekday:'long',timeZone:'UTC'});
function readable(dateISO:string){const day=new Date(dateISO+'T12:00:00Z');
  return dateISO.slice(8,10)+' '+MONTHS.format(day)+' · '+WEEKDAY.format(day);
}
const DayCard=memo(function DayCard({dateISO,day,today,open,onToggle}:{
  dateISO:string;day:Calendar30Day|null;today:boolean;open:boolean;onToggle:()=>void;
}){
  const {colors}=useAppTheme();
  const dark=colors.isDark;
  const bg=dark?'#102B40':colors.surface;
  return <Pressable onPress={onToggle}
    accessibilityRole="button" accessibilityState={{expanded:open}}
    accessibilityLabel={readable(dateISO)+(day?', yayımlanmış namaz vakitleri':', takvim henüz yayımlanmadı')}
    style={{borderRadius:17,borderWidth:1.1,padding:13,marginBottom:9,
      borderColor:today?colors.gold:colors.border,
      backgroundColor:bg,gap:11}}>
    <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
      <View style={{flex:1}}>
        <Text style={{fontSize:14,fontWeight:'800',color:colors.text}}>{readable(dateISO)}</Text>
        <Text numberOfLines={1} style={{fontSize:10,marginTop:3,color:colors.muted}}>
          {today?'Bugün · ':''}{day?(day.hijriDate??'Yayımlanmış takvim'):'Yayımlanmış veri bekleniyor'}
        </Text>
      </View>
      {today?<Text style={{color:colors.gold,fontWeight:'700',fontSize:10}}>BUGÜN</Text>:null}
      <Feather name={open?'chevron-up':'chevron-down'} size={17} color={colors.gold}/>
    </View>
    {day?<View style={{flexDirection:'row',justifyContent:'space-between',gap:4}}>
      {[0,2,4].map(i=><View key={i} style={{flex:1,alignItems:'center',
        borderRadius:10,paddingVertical:8,backgroundColor:dark?'#1A3A51':'#F3F4EF'}}>
        <Text style={{fontSize:10,color:colors.muted}}>{day.times[i].label}</Text>
        <Text style={{fontSize:13,fontWeight:'800',color:colors.text,marginTop:3}}>
          {day.times[i].time}
        </Text>
      </View>)}
    </View>:<Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>
      Bu günün vakitleri mevcut kaynaklarda bulunamadı. Tahmini saat gösterilmiyor.
    </Text>}
    {open&&day?<View style={{gap:11,paddingTop:8,borderTopWidth:1,borderTopColor:colors.border}}>
      <View style={{flexDirection:'row',flexWrap:'wrap',rowGap:13}}>
        {day.times.map(item=><View key={item.key} style={{width:'33.333%',alignItems:'center',gap:5}}>
          <Text style={{fontSize:11,color:colors.muted}}>{item.label}</Text>
          <Text style={{fontSize:17,fontWeight:'800',color:colors.text,
            fontVariant:['tabular-nums']}}>{item.time}</Text>
        </View>)}
      </View>
      <Text style={{fontSize:9.5,color:colors.muted}}>
        {day.provider==='diyanet-awqat-salah'?'Diyanet resmî API önbelleği':
          'Diyanet vakitlerinin bağımsız aktarımı · '+day.provider}
      </Text>
    </View>:null}
  </Pressable>;
});
export default function Calendar30Screen(){
  const [dateISO,setDateISO]=useState(()=>zonedClock(new Date(),'Europe/Istanbul').dateISO);
  const {colors}=useAppTheme();
  const {place,snapshot,coverage,status,loading,error,retry}=useCalendar30(dateISO);
  const [expanded,setExpanded]=useState<string|null>(dateISO);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const next=zonedClock(new Date(),'Europe/Istanbul').dateISO;
      setDateISO(old=>old===next?old:next);
    },60_000);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>setExpanded(dateISO),[dateISO,place?.id]);
  const dates=useMemo(()=>Array.from({length:30},(_,i)=>shiftCalendarDate(dateISO,i)),[dateISO]);
  const data=useMemo(()=>dates.map((iso,index)=>({
    iso,day:snapshot?.startISO===dateISO?snapshot.days[index]??null:null,
  })),[snapshot,dates,dateISO]);
  return <SafeAreaView edges={['top','bottom']}
    style={{flex:1,backgroundColor:colors.canvas}}>
    <View style={{paddingHorizontal:16,paddingTop:12,paddingBottom:12,
      borderBottomWidth:1,borderBottomColor:colors.border,
      flexDirection:'row',alignItems:'center',gap:12}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()}
        style={{height:43,width:43,borderRadius:14,borderWidth:1,borderColor:colors.border,
          backgroundColor:colors.surface,justifyContent:'center',alignItems:'center'}}>
        <Feather name="arrow-left" size={20} color={colors.text}/>
      </Pressable>
      <View style={{flex:1,gap:3}}>
        <Text style={{fontSize:20,fontFamily:'serif',fontWeight:'800',color:colors.text}}>
          30 Günlük Namaz Takvimi
        </Text>
        <Text style={{fontSize:11,color:colors.muted}} numberOfLines={1}>
          {place?place.name+' · '+place.stateName:'İlçe seçilmedi'} · {dateISO.slice(8,10)}.{dateISO.slice(5,7)}.{dateISO.slice(0,4)}
        </Text>
      </View>
      <Feather name="calendar" size={19} color={colors.gold}/>
    </View>
    <FlatList data={data} keyExtractor={item=>item.iso}
      initialNumToRender={7} maxToRenderPerBatch={8} windowSize={7}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{padding:14,paddingBottom:40}}
      ListHeaderComponent={<View style={{gap:10,marginBottom:14}}>
        <View style={{padding:12,borderRadius:14,backgroundColor:colors.surface,
          borderWidth:1,borderColor:colors.border,gap:6}}>
          <Text style={{color:colors.text,fontSize:12.5,fontWeight:'700'}}>
            {status==='choose-location'?'Önce ana sayfadan il veya ilçe seç':
              loading&&!snapshot?'Yayımlanmış takvim yükleniyor…':
              status==='unavailable'?'Yayımlanmış namaz takvimi alınamadı':
              coverage===30?'30 günün tamamı doğrulandı':
              coverage+' / 30 günün vakitleri yayımlanmış'}
          </Text>
          <Text style={{color:colors.muted,fontSize:11,lineHeight:17}}>
            Eksik günlere saat uydurulmaz. Her satır, seçili ilçenin yayımlanmış verisinden gelir.
          </Text>
          {(error||status==='partial'||status==='unavailable')&&status!=='choose-location'?
            <Pressable accessibilityRole="button" accessibilityLabel="Takvim verilerini yeniden yükle"
              onPress={retry} disabled={loading}
              style={{flexDirection:'row',gap:7,alignItems:'center',paddingVertical:7}}>
              <Feather name="refresh-cw" size={15} color={colors.gold}/>
              <Text style={{color:colors.gold,fontSize:12,fontWeight:'700'}}>
                {loading?'Yükleniyor…':'Yeniden dene'}
              </Text>
            </Pressable>:null}
          {status==='unavailable'&&error?<Text style={{fontSize:10,color:colors.muted}}>
            Ağ bağlantısı veya takvim kaynağı kullanılamıyor.
          </Text>:null}
        </View>
      </View>}
      renderItem={({item})=><DayCard dateISO={item.iso} day={item.day}
        today={item.iso===dateISO} open={expanded===item.iso}
        onToggle={()=>setExpanded(curr=>curr===item.iso?null:item.iso)}/>}
      ListFooterComponent={<Text style={{fontSize:10.5,color:colors.muted,lineHeight:17,
        marginTop:8,textAlign:'center'}}>
        Resmî API yapılandırılmışsa doğrulanmış Diyanet verileri; aksi hâlde Diyanet vakitlerini
        yeniden yayımlayan bağımsız sağlayıcılar kullanılır. Uygulama namaz vakti hesaplamaz.
      </Text>}
    />
  </SafeAreaView>;
}
