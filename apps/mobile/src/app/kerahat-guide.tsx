import {useMemo,useState} from 'react';
import {
  Alert,Linking,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router,useLocalSearchParams} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import Svg,{Circle,Path,Line,Text as SvgText} from 'react-native-svg';
import {
  KERAHAT_SOURCE_URL,formatWindowClock,getKerahatView,timeToMinutes,zonedClock,
  type PrayerSchedule,type KerahatKind,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {useSharedPrayerSource} from '@/features/prayer/PrayerSourceProvider';
import {useKerahatSettings} from '@/features/prayer/KerahatSettingsProvider';

type GuideTab='heavy'|'light';
type DetailId=KerahatKind|'fajr'|'asr'|'maghrib'|'friday'|'eid';
type Detail={
  id:DetailId;title:string;subtitle:string;description:string;icon:
    'sunrise'|'sun'|'sunset'|'moon'|'clock'|'users'|'calendar';
  conditional?:boolean;
};
type Band={id:DetailId;from:number;to:number;color:string;conditional?:boolean};

const HEAVY:readonly Detail[]=[
  {id:'sunrise',title:'Güneşin doğuşu',subtitle:'Doğuştan sonraki yaklaşık 40–50 dakika',
    description:'Güneş doğarken ve yeterince yükselinceye kadar olan dönemdir. Diyanet\'in mutedil bölgeler için verdiği yaklaşık süre 40–50 dakikadır.',
    icon:'sunrise'},
  {id:'zenith',title:'Zeval · öğle öncesi',subtitle:'Öğle vaktinden yaklaşık 10 dakika önce',
    description:'Güneşin tepe noktasına yakın olduğu bu aralık, öğle vaktinin girmesinden yaklaşık 10 dakika önce başlar. Bu süre tam bir astronomik ölçüm değildir.',
    icon:'sun'},
  {id:'sunset',title:'Güneşin batışı',subtitle:'Akşama yaklaşık 40–50 dakika kala',
    description:'Güneşin batışa yaklaştığı dönemdir. Diyanet açıklamasında o günün ikindi namazının farzına ilişkin istisna vardır; bu vakte mazeretsiz geciktirmek mekruhtur.',
    icon:'sunset'},
] as const;

const LIGHT:readonly Detail[]=[
  {id:'fajr',title:'İmsak sonrası',subtitle:'Sabahın sünneti dışında nâfile kısıtlaması',
    description:'İmsak vakti girdikten sonra güneş doğuncaya kadar sabah namazının sünneti dışındaki nâfile namazlar kılınmaz. Kaza namazıyla ilgili hükümler aynı değildir.',
    icon:'moon'},
  {id:'asr',title:'İkindi farzından sonra',subtitle:'Farzın kılındığı zamana bağlıdır',
    description:'İkindi namazının farzı kılındıktan sonra güneş batıncaya kadar nâfile namaz kılınmaz. Çemberdeki renk, ikindi ezanından itibaren olası dönemi gösterir; farzı kıldığınız saati uygulama bilemez. Güneşin batışına yakın son bölüm ayrıca ağır kerahat aralığıdır.',
    icon:'sunset',conditional:true},
  {id:'maghrib',title:'Akşam farzından önce',subtitle:'Ezandan farz namazına kadar',
    description:'Akşam namazının vakti girdikten sonra farzı kılmadan önce nâfile namaz kılmakla ilgili kısıtlama bulunur. Farzın ne zaman kılındığı bilinmediğinden çemberde kesin bir süre gösterilmez.',
    icon:'clock',conditional:true},
  {id:'friday',title:'Cuma hutbesi',subtitle:'Hatip minbere çıktığında',
    description:'Cuma günü hatibin minbere çıkmasından cuma namazının farzı tamamlanıncaya kadar nâfile namazla meşgul olunmaması ve hutbenin dinlenmesi gerektiği açıklanır. Hutbe başlangıcı normal öğle takviminden çıkarılamaz.',
    icon:'users',conditional:true},
  {id:'eid',title:'Bayram namazı',subtitle:'Bayramın özel ibadet düzeni',
    description:'Diyanet ilmihallerinde bayram namazından önce evde ve camide; bayram namazından sonra ise camide nâfile namaz kılmanın mekruh olduğu belirtilir. Bayram namazından sonra eve dönüldüğünde kılınabilir. Bu durum günlük ezan saatlerinden hesaplanamaz.',
    icon:'calendar',conditional:true},
] as const;

function localSeconds(clock:string):number{return timeToMinutes(clock)*60;}
function point(deg:number,r:number){
  const a=deg*Math.PI/180;
  return {x:160+r*Math.sin(a),y:160-r*Math.cos(a)};
}
function timeArc(startSeconds:number,endSeconds:number,radius:number):string{
  const from=startSeconds/86400*360;
  const to=endSeconds/86400*360;
  const a=point(from,radius),b=point(to,radius);
  return 'M '+a.x.toFixed(3)+' '+a.y.toFixed(3)+
    ' A '+radius+' '+radius+' 0 '+(to-from>180?1:0)+
    ' 1 '+b.x.toFixed(3)+' '+b.y.toFixed(3);
}

function DailyRing({bands,selected,kind,nowSeconds,hasCalendar,size}:{
  bands:readonly Band[];selected:DetailId;kind:GuideTab;
  nowSeconds:number;hasCalendar:boolean;size:number;
}){
  const dark=useAppTheme().colors.isDark;
  const gold=dark?'#E9CA8C':'#B28B4D';
  const backdrop=dark?'#0B302E':'#FFF9EE';
  const accent=kind==='heavy'?'#E77762':'#26AAA9';
  const now=point(nowSeconds/86400*360,113);
  return <View accessible accessibilityLabel={
    hasCalendar
      ?'Yayımlanmış namaz saatlerine göre oluşturulmuş 24 saatlik kerahat şeması'
      :'Güncel namaz takvimi bekleniyor; saat içermeyen kerahat şeması'
  } style={{alignSelf:'center',width:size,height:size,alignItems:'center',justifyContent:'center'}}>
    <Svg width={size} height={size} viewBox="0 0 320 320">
      <Circle cx="160" cy="160" r="148" fill="none" stroke={gold}
        strokeOpacity=".35" strokeWidth=".8"/>
      <Circle cx="160" cy="160" r="137" fill="none" stroke={gold}
        strokeOpacity=".22" strokeWidth="1"/>
      <Circle cx="160" cy="160" r="113" fill="none"
        stroke={dark?'#234C46':'#E6E1D6'} strokeWidth="32"/>
      {Array.from({length:24},(_,i)=>{
        const inner=point(i*15,i%3===0?137:139);
        const outer=point(i*15,144);
        return <Line key={i} x1={inner.x} y1={inner.y}
          x2={outer.x} y2={outer.y}
          stroke={gold} strokeOpacity={i%3===0?.85:.4}
          strokeWidth={i%3===0?1.7:.8}/>;
      })}
      {hasCalendar?bands.filter(b=>b.to>b.from).map(b=><Path key={b.id}
        d={timeArc(b.from,b.to,113)}
        stroke={b.color} strokeWidth={selected===b.id?35:29}
        strokeOpacity={selected===b.id?1:.75}
        strokeLinecap="butt" strokeDasharray={b.conditional?'5,3':undefined}
        fill="none"/>):null}
      {hasCalendar?<Circle cx={now.x} cy={now.y} r="6"
        fill={accent} stroke={backdrop} strokeWidth="2.1"/>:null}
      <SvgText x="160" y="9" textAnchor="middle" fill={gold}
        fontSize="10" fontWeight="700">00</SvgText>
      <SvgText x="300" y="163" textAnchor="middle" fill={gold}
        fontSize="10" fontWeight="700">06</SvgText>
      <SvgText x="160" y="318" textAnchor="middle" fill={gold}
        fontSize="10" fontWeight="700">12</SvgText>
      <SvgText x="20" y="163" textAnchor="middle" fill={gold}
        fontSize="10" fontWeight="700">18</SvgText>
      <Circle cx="160" cy="160" r="88" fill={backdrop}
        stroke={gold} strokeOpacity=".45" strokeWidth="1.3"/>
      <Circle cx="160" cy="160" r="83" fill="none" stroke={gold}
        strokeOpacity=".2" strokeWidth="1"/>
      <SvgText x="160" y="128" textAnchor="middle" fill={gold}
        fontSize="22">☪</SvgText>
      <SvgText x="160" y="154" textAnchor="middle"
        fill={dark?'#F5ECDD':'#1D4540'} fontSize="16"
        fontWeight="bold">{kind==='heavy'?'Ağır Kerahat':'Hafif Kerahat'}</SvgText>
      <SvgText x="160" y="174" textAnchor="middle" fill={gold}
        fontSize="10">{hasCalendar?'24 saatlik görünüm':'Takvim bekleniyor'}</SvgText>
      <SvgText x="160" y="191" textAnchor="middle"
        fill={dark?'#A6C4B9':'#66877B'} fontSize="8.5">
        {kind==='heavy'?'3 temel zaman':'Nâfile kısıtları'}
      </SvgText>
    </Svg>
  </View>;
}

const DIyanetILMIHAL_URL=
  'https://namaz.diyanet.gov.tr/namaz/html/kutuphane/HTML/NamazIlmihali/assets/common/downloads/publication.pdf';
const pad=(n:number)=>String(n).padStart(2,'0');
function clock(seconds:number):string{
  return pad(Math.floor(seconds/3600))+':'+pad(Math.floor((seconds%3600)/60));
}

export default function KerahatGuideScreen(){
  const params=useLocalSearchParams<{tab?:string}>();
  const initial:GuideTab=params.tab==='light'?'light':'heavy';
  const [tab,setTab]=useState<GuideTab>(initial);
  const [expanded,setExpanded]=useState<DetailId|null>(null);
  const {colors}=useAppTheme();
  const {width}=useWindowDimensions();
  const prayer=useSharedPrayerSource();
  const {settings}=useKerahatSettings();
  const now=new Date();
  const local=zonedClock(now,'Europe/Istanbul');
  const scheduled=prayer.days?.today??null;
  // No example, demo, previous district or mismatched-date prayer times.
  const day:PrayerSchedule|null=scheduled&&!scheduled.isDemo&&
    scheduled.dateISO===local.dateISO&&
    (!prayer.place||scheduled.locationName===prayer.place.name)
    ?scheduled:null;
  const view=useMemo(()=>day?getKerahatView(
    day,local.dateISO,local.secondsOfDay,{...settings,mode:'custom'}
  ):null,[day,local.dateISO,Math.floor(local.secondsOfDay/60),
      settings.sunriseMinutes,settings.preNoonMinutes,settings.preSunsetMinutes]);
  const heavyBands:Band[]=(view?.windows??[]).map(w=>({
    id:w.kind,from:w.startSeconds,to:w.endSeconds,
    color:w.kind==='zenith'?'#ECA95D':'#D86F64',
  }));
  const lightBands:Band[]=day
    ?[
      {id:'fajr',from:localSeconds(day.times[0].time),
        to:localSeconds(day.times[1].time),color:'#159CCE'},
      {id:'asr',from:localSeconds(day.times[3].time),
        to:localSeconds(day.times[4].time),color:'#2FC8C3',conditional:true},
    ]:[];
  const entries=tab==='heavy'?HEAVY:LIGHT;
  const bands=tab==='heavy'?heavyBands:lightBands;
  const selected=expanded??entries[0].id;
  const activeColor=tab==='heavy'?'#D97662':'#18A8A6';
  const dateLabel=new Intl.DateTimeFormat('tr-TR',{
    day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul',
  }).format(now);
  const getTimes=(entry:Detail):string|null=>{
    if(!day)return null;
    if(tab==='heavy'){
      const w=view?.windows.find(x=>x.kind===entry.id);
      return w?clock(w.startSeconds)+' – '+clock(w.endSeconds):null;
    }
    if(entry.id==='fajr')
      return day.times[0].time+' – '+day.times[1].time;
    if(entry.id==='asr')
      return day.times[3].time+' – '+day.times[4].time+' · koşullu';
    return null;
  };
  const openSource=(url:string)=>void Linking.openURL(url)
    .catch(()=>Alert.alert('Bağlantı açılamadı',
      'Diyanet kaynağına erişilemiyor. İnternet bağlantını kontrol et.'));

  return <SafeAreaView edges={['top']} style={{flex:1,backgroundColor:colors.canvas}}>
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.page}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Geri dön"
          onPress={()=>router.back()}
          style={[styles.back,{borderColor:colors.border,backgroundColor:colors.surface}]}>
          <Feather name="arrow-left" size={21} color={colors.text}/>
        </Pressable>
        <View style={{flex:1,alignItems:'center'}}>
          <Text style={{fontFamily:'serif',fontSize:18,fontWeight:'800',color:colors.text}}>
            Kerahat Vakitleri
          </Text>
          <Text style={{fontSize:10,color:colors.muted,marginTop:3}}>
            Kaynaklı bilgi rehberi
          </Text>
        </View>
        <Pressable accessibilityRole="button"
          accessibilityLabel="Kerahat halkası ayarlarını aç"
          onPress={()=>router.push('/kerahat-settings')}
          style={[styles.back,{borderColor:colors.border,backgroundColor:colors.surface}]}>
          <Feather name="sliders" size={18} color={colors.gold}/>
        </Pressable>
      </View>

      <View style={[styles.switcher,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        {([['heavy','Ağır Kerahat'],['light','Hafif Kerahat']] as const)
          .map(([id,label])=><Pressable key={id} accessibilityRole="tab"
            accessibilityState={{selected:tab===id}}
            onPress={()=>{setTab(id);setExpanded(null);}}
            style={[styles.tab,{
              backgroundColor:tab===id
                ?id==='heavy'?'#98443D':'#096E70':'transparent',
            }]}>
            <Feather name={id==='heavy'?'alert-circle':'info'} size={15}
              color={tab===id?'#FFF7E7':colors.gold}/>
            <Text style={{fontSize:12,fontWeight:'800',
              color:tab===id?'#FFF7E7':colors.text}}>{label}</Text>
          </Pressable>)}
      </View>

      <View style={[styles.hero,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={{alignSelf:'flex-start',flexDirection:'row',
          alignItems:'center',gap:7}}>
          <View style={{height:7,width:7,borderRadius:4,backgroundColor:activeColor}}/>
          <Text style={{fontSize:10.5,fontWeight:'800',letterSpacing:1.2,
            color:activeColor}}>{tab==='heavy'?'ÜÇ TEMEL ARALIK':'KOŞULA BAĞLI KISITLAR'}</Text>
        </View>
        <Text style={{fontFamily:'serif',fontSize:23,fontWeight:'800',
          color:colors.text,marginTop:5}}>
          {tab==='heavy'?'Namaz kılınmayan vakitler':'Nâfile namazla ilgili vakitler'}
        </Text>
        <Text style={{fontSize:11.5,lineHeight:19,color:colors.muted,marginTop:3}}>
          {tab==='heavy'
            ?'Güneşin doğuşu, tam tepe noktası ve batışı çevresindeki temel aralıklar.'
            :'Bu sınırlamaların bir kısmı namazın kılınmasına, cuma hutbesine veya bayrama bağlıdır.'}
        </Text>
        <DailyRing bands={bands} selected={selected} kind={tab}
          nowSeconds={local.secondsOfDay} hasCalendar={Boolean(day)}
          size={Math.min(width-42,320)}/>
        <View style={{flexDirection:'row',alignItems:'center',
          justifyContent:'space-between',gap:12}}>
          <View style={{flex:1}}>
            <Text style={{fontSize:12,fontWeight:'800',color:colors.text}}>
              {day?.locationName??'Güncel konum takvimi bekleniyor'}
            </Text>
            <Text style={{fontSize:10.5,marginTop:3,color:colors.muted}}>
              {day?dateLabel+' · yayımlanmış saatler':
                'Doğrulanmış takvim olmadan saat gösterilmez'}
            </Text>
          </View>
          <View style={[styles.legend,{backgroundColor:colors.soft}]}>
            <View style={{height:9,width:9,borderRadius:5,backgroundColor:activeColor}}/>
            <Text style={{fontSize:10,color:colors.muted}}>
              {tab==='heavy'?'Yaklaşık':'Koşullu'}
            </Text>
          </View>
        </View>
        {tab==='light'?<Text style={{fontSize:10.5,lineHeight:17,
          color:colors.muted}}>
          Kesikli bölüm, ikindi farzının ne zaman kılındığı bilinmediği için
          yalnızca olası aralığı gösterir. Cuma ve bayram koşulları saati
          bilinmediğinden halkada yer almaz.
        </Text>:null}
      </View>

      <View style={{gap:5,marginTop:2}}>
        <Text style={{fontFamily:'serif',fontSize:21,fontWeight:'800',color:colors.text}}>
          {tab==='heavy'?'Ağır Kerahat Vakitleri':'Hafif Kerahat Vakitleri'}
        </Text>
        <Text style={{fontSize:11.5,color:colors.muted,lineHeight:18}}>
          Ayrıntısını okumak için bir aralığa dokun.
        </Text>
      </View>
      {entries.map((entry,i)=>{
        const opened=expanded===entry.id;
        const time=getTimes(entry);
        return <Pressable key={entry.id} accessibilityRole="button"
          accessibilityState={{expanded:opened}}
          accessibilityLabel={entry.title+' açıklamasını '+(opened?'kapat':'aç')}
          onPress={()=>setExpanded(opened?null:entry.id)}
          style={[styles.entry,{
            backgroundColor:colors.surface,
            borderColor:opened?activeColor:colors.border,
          }]}>
          <View style={styles.entryHead}>
            <View style={[styles.entryIcon,{backgroundColor:colors.soft}]}>
              <Feather name={entry.icon} size={19} color={activeColor}/>
            </View>
            <View style={{flex:1,gap:3}}>
              <Text style={{fontSize:13.5,fontWeight:'800',color:colors.text}}>
                {i+1}. {entry.title}
              </Text>
              <Text style={{fontSize:10.5,lineHeight:16,color:colors.muted}}>
                {time??entry.subtitle}
              </Text>
            </View>
            <Feather name={opened?'chevron-up':'chevron-down'} size={18}
              color={colors.gold}/>
          </View>
          {opened?<View style={[styles.entryDetail,{borderTopColor:colors.border}]}>
            <Text style={{fontSize:12,lineHeight:20,color:colors.text}}>
              {entry.description}
            </Text>
            {entry.conditional?<View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <Feather name="info" size={13} color={colors.gold}/>
              <Text style={{fontSize:10.5,color:colors.muted,flex:1}}>
                Bu koşul takvim saatinden otomatik belirlenemez.
              </Text>
            </View>:null}
          </View>:null}
        </Pressable>;
      })}

      <View style={[styles.notice,{backgroundColor:colors.soft,borderColor:colors.border}]}>
        <MaterialCommunityIcons name="shield-check-outline" size={21} color={colors.gold}/>
        <View style={{flex:1,gap:5}}>
          <Text style={{fontSize:13,fontWeight:'800',color:colors.text}}>
            Kaynak ve önemli açıklama
          </Text>
          <Text style={{fontSize:11,lineHeight:19,color:colors.muted}}>
            Buradaki “ağır / hafif” ayrımı, anlatımı kolaylaştırmak için
            kullanılmıştır. Dinî hükümler namazın türüne ve mezhebe
            göre değişebilir. Uygulamadaki renkli halkalar yaklaşık
            eğitim görselleridir; kesin fetva veya güneş yüksekliği
            hesabı değildir.
          </Text>
          <Pressable accessibilityRole="link"
            onPress={()=>openSource(KERAHAT_SOURCE_URL)}
            style={[styles.source,{borderColor:colors.border}]}>
            <Feather name="external-link" size={15} color={colors.emerald}/>
            <Text style={{fontSize:11.5,color:colors.emerald,fontWeight:'800'}}>
              Din İşleri Yüksek Kurulu açıklaması
            </Text>
          </Pressable>
          {tab==='light'?<Pressable accessibilityRole="link"
            onPress={()=>openSource(DIyanetILMIHAL_URL)}
            style={[styles.source,{borderColor:colors.border}]}>
            <Feather name="book-open" size={15} color={colors.emerald}/>
            <Text style={{fontSize:11.5,color:colors.emerald,fontWeight:'800'}}>
              Diyanet Namaz İlmihali · PDF
            </Text>
          </Pressable>:null}
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  page:{paddingHorizontal:16,paddingTop:13,paddingBottom:40,gap:13},
  top:{flexDirection:'row',alignItems:'center',gap:10,minHeight:44},
  back:{width:42,height:42,borderRadius:15,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  switcher:{borderRadius:19,borderWidth:1,padding:5,flexDirection:'row',gap:6},
  tab:{flex:1,minHeight:43,borderRadius:14,flexDirection:'row',
    alignItems:'center',justifyContent:'center',gap:6},
  hero:{borderRadius:24,borderWidth:1,padding:15,gap:5,
    shadowColor:'#133D36',shadowOpacity:.09,shadowRadius:13,elevation:3},
  legend:{flexDirection:'row',gap:5,alignItems:'center',
    paddingHorizontal:9,paddingVertical:7,borderRadius:12},
  entry:{borderWidth:1,borderRadius:18,padding:13},
  entryHead:{flexDirection:'row',gap:11,alignItems:'center'},
  entryIcon:{width:43,height:43,borderRadius:13,
    alignItems:'center',justifyContent:'center'},
  entryDetail:{marginTop:12,paddingTop:12,borderTopWidth:1,gap:12},
  notice:{borderWidth:1,borderRadius:19,padding:14,flexDirection:'row',gap:11},
  source:{minHeight:39,marginTop:4,borderWidth:1,borderRadius:12,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
});
