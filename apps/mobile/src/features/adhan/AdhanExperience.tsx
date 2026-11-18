import {useState} from 'react';
import {
  Modal,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions,
} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {useAdhanPlayback} from '@/features/adhan/AdhanPlaybackProvider';
import {useAppTheme} from '@/theme/ThemeProvider';
import {ArabesqueCorner} from '@/components/LuxuryArtwork';

const DUA={
  arabic:'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ الْمَقَامَ الْمَحْمُودَ الَّذِي وَعَدْتَهُ',
  reading:'Allâhümme rabbe hâzihi’d-da‘veti’t-tâmmeti ve’s-salâti’l-kâimeti, âti Muhammedeni’l-vesîlete ve’l-fazîlete, ve’b‘ashü makâmen mahmûdeni’llezî veadteh.',
  meaning:'Allah’ım! Ey eksiksiz tevhid çağrısının ve kılınacak namazın Rabbi! Muhammed’e (s.a.s.) vesileyi ve fazileti ihsan eyle. Onu kendisine vadettiğin Makâm-ı Mahmûd’a ulaştır.',
  reference:'Buhârî, Ezan, 8 · Diyanet İşleri Başkanlığı, Alanya Müftülüğü',
};

function timeLabel(seconds:number){
  if(!Number.isFinite(seconds)||seconds<0)return '0:00';
  const total=Math.floor(seconds);
  return Math.floor(total/60)+':'+String(total%60).padStart(2,'0');
}
export function AdhanExperience(){
  const {colors}=useAppTheme();
  const {width}=useWindowDimensions();
  const [duaOpen,setDuaOpen]=useState(false);
  const [barWidth,setBarWidth]=useState(0);
  const {playing,currentTime:position,duration,error,toggle,seek}=useAdhanPlayback();
  const dark=colors.isDark;
  const progress=duration?position/duration:0;

  const compact=width<360;
  const surface=dark?'#0D2E43':'#FFFDF7';
  return <View style={styles.section}>
    <View style={styles.sectionHeading}>
      <View style={{width:27,height:27,borderRadius:9,backgroundColor:colors.soft,
        alignItems:'center',justifyContent:'center'}}>
        <MaterialCommunityIcons name="mosque" size={17} color={colors.gold}/>
      </View>
      <View style={{flex:1}}>
        <Text style={{fontSize:17,fontFamily:'serif',fontWeight:'700',color:colors.text}}>
          Ezan ve Dua
        </Text>
        <Text style={{fontSize:10.5,color:colors.muted}}>
          Dilediğiniz zaman dinleyin, duayı okuyun
        </Text>
      </View>
      <View style={[styles.offlineBadge,{backgroundColor:colors.soft,borderColor:colors.border}]}>
        <Feather name="download" size={11} color={colors.emerald}/>
        <Text style={{fontSize:9,color:colors.text,fontWeight:'700'}}>Çevrimdışı</Text>
      </View>
    </View>
    <View style={[styles.cards,{flexDirection:compact?'column':'row'}]}>
      <View style={[styles.playerCard,{
        flex:compact?undefined:1.2,backgroundColor:dark?'#0D344A':'#0A6755',
        borderColor:dark?'#5E7A8B':'#C3AC78',
      }]}>
        <View pointerEvents="none" style={[styles.glow,{backgroundColor:'rgba(226,191,132,.08)'}]}/>
        <ArabesqueCorner dark width={82}/>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="waveform" size={19} color="#ECD39C"/>
          <Text style={styles.playerTitle}>Ezanı Dinle</Text>
        </View>
        <Text style={styles.playerSub}>Huzurlu bir dinleme anı</Text>
        <View style={styles.playRow}>
          <Pressable accessibilityRole="button"
            accessibilityLabel={playing?'Ezanı duraklat':'Ezanı dinlemeye başla'}
            accessibilityHint="Çevrimdışı ezan kaydını oynatır veya duraklatır"
            onPress={()=>void toggle()}
            style={styles.playButton}>
            <Feather name={playing?'pause':'play'} size={24} color="#11382F"/>
          </Pressable>
          <View style={{flex:1,gap:5}}>
            <Text numberOfLines={1} style={{fontSize:13,fontWeight:'700',color:'#FFF7E8'}}>
              {playing?'Ezan okunuyor':duration&&position>=duration-.4?'Yeniden dinle':'Dinlemeye başla'}
            </Text>
            <Text style={{fontSize:10,color:'#C8DBDA'}}>Arka planda ve kilit ekranında dinle</Text>
          </View>
        </View>
        <Pressable accessible accessibilityRole="adjustable"
          accessibilityLabel="Ezan kaydında ilerle"
          accessibilityValue={{min:0,max:Math.max(1,Math.floor(duration)),now:Math.floor(position)}}
          onLayout={event=>setBarWidth(event.nativeEvent.layout.width)}
          onPress={event=>{
            if(barWidth>0&&duration>0){
              void seek(duration*Math.max(0,Math.min(1,event.nativeEvent.locationX/barWidth)));
            }
          }}
          style={styles.progressHit}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill,{width:(progress*100)+'%'}]}/>
          </View>
        </Pressable>
        <View style={styles.bottomRow}>
          <Text style={styles.time}>{timeLabel(position)} / {duration?timeLabel(duration):'--:--'}</Text>
          <View style={{flexDirection:'row',gap:10}}>
            <Pressable accessibilityRole="button" accessibilityLabel="10 saniye geri al"
              onPress={()=>void seek(position-10)} style={styles.miniControl}>
              <Feather name="rotate-ccw" size={15} color="#F3E0B6"/>
              <Text style={styles.miniText}>10</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="10 saniye ileri al"
              onPress={()=>void seek(position+10)} style={styles.miniControl}>
              <Feather name="rotate-cw" size={15} color="#F3E0B6"/>
              <Text style={styles.miniText}>10</Text>
            </Pressable>
          </View>
        </View>
        <Text style={{fontSize:10.5,color:'#D5E7D9',marginTop:4}}>
          Seçilen ezan kaydı · 3:17 · Çevrimdışı
        </Text>
        {error?<Text accessibilityRole="alert" style={{color:'#FFD4CB',fontSize:10}}>
          {error}
        </Text>:null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Ezan duasını aç"
        accessibilityHint="Duayı Arapça, Türkçe okunuş ve anlamıyla büyüterek gösterir"
        onPress={()=>setDuaOpen(true)}
        style={[styles.duaCard,{
          flex:compact?undefined:1,
          backgroundColor:surface,borderColor:dark?'#75674D':'#E3D1AA',
        }]}>
        <ArabesqueCorner dark={dark} width={85}/>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="hands-pray" size={21} color={colors.gold}/>
          <Text style={{fontSize:15.5,fontFamily:'serif',fontWeight:'700',color:colors.text}}>
            Ezan Duası
          </Text>
        </View>
        <Text numberOfLines={3} style={{fontSize:13.5,lineHeight:21,fontFamily:'serif',
          color:colors.text,marginTop:12,fontStyle:'italic'}}>
          Allâhümme rabbe hâzihi’d-da‘veti’t-tâmmeti…
        </Text>
        <View style={{flex:1,minHeight:8}}/>
        <View style={{flexDirection:'row',gap:5,alignItems:'center'}}>
          <Text style={{fontSize:10.5,fontWeight:'700',color:colors.emerald,flex:1}}>
            Arapça · Okunuş · Anlam
          </Text>
          <Feather name="maximize-2" size={16} color={colors.gold}/>
        </View>
        <Text style={{fontSize:10,marginTop:6,color:colors.muted}}>
          Tam metin için dokunun
        </Text>
      </Pressable>
    </View>
    <Modal visible={duaOpen} transparent animationType="slide"
      statusBarTranslucent onRequestClose={()=>setDuaOpen(false)}>
      <View style={[styles.backdrop,{backgroundColor:dark?'rgba(3,13,22,.79)':'rgba(2,19,14,.63)'}]}>
        <Pressable accessibilityLabel="Kapat" style={StyleSheet.absoluteFill}
          onPress={()=>setDuaOpen(false)}/>
        <View style={[styles.sheet,{backgroundColor:colors.canvas,borderColor:colors.border}]}>
          <View style={styles.sheetHead}>
            <View style={{flex:1,gap:4}}>
              <Text style={{fontFamily:'serif',fontSize:25,fontWeight:'700',color:colors.text}}>
                Ezan Duası
              </Text>
              <Text style={{fontSize:12,color:colors.muted}}>Ezanın ardından okunan dua</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Dua penceresini kapat"
              hitSlop={12} onPress={()=>setDuaOpen(false)}>
              <Feather name="x" size={24} color={colors.text}/>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{gap:14,paddingBottom:18}}>
            <View style={[styles.duaBlock,{backgroundColor:colors.soft,borderColor:colors.border}]}>
              <Text style={[styles.blockLabel,{color:colors.emerald}]}>ARAPÇA METİN</Text>
              <Text selectable style={{fontSize:27,lineHeight:48,textAlign:'right',
                writingDirection:'rtl',color:colors.text}}>
                {DUA.arabic}
              </Text>
            </View>
            <View style={[styles.duaBlock,{backgroundColor:colors.surface,borderColor:colors.border}]}>
              <Text style={[styles.blockLabel,{color:colors.emerald}]}>TÜRKÇE OKUNUŞ</Text>
              <Text selectable style={{fontSize:17,fontFamily:'serif',lineHeight:28,color:colors.text}}>
                {DUA.reading}
              </Text>
            </View>
            <View style={[styles.duaBlock,{backgroundColor:colors.surface,borderColor:colors.border}]}>
              <Text style={[styles.blockLabel,{color:colors.emerald}]}>TÜRKÇE ANLAM</Text>
              <Text selectable style={{fontSize:16,fontFamily:'serif',lineHeight:27,color:colors.text}}>
                {DUA.meaning}
              </Text>
            </View>
            <Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>{DUA.reference}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  section:{gap:10,width:'100%'},
  sectionHeading:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:2},
  offlineBadge:{height:26,borderRadius:10,borderWidth:1,flexDirection:'row',
    alignItems:'center',gap:4,paddingHorizontal:7},
  cards:{flexDirection:'row',gap:9,alignItems:'stretch'},
  playerCard:{minHeight:215,borderRadius:20,borderWidth:1.1,overflow:'hidden',
    padding:14,justifyContent:'space-between',gap:6,shadowColor:'#082B2B',
    shadowOpacity:.16,shadowRadius:10,elevation:3},
  glow:{position:'absolute',top:-55,right:-45,width:185,height:185,borderRadius:93},
  cardTitleRow:{flexDirection:'row',alignItems:'center',gap:7},
  playerTitle:{fontSize:15.5,fontFamily:'serif',fontWeight:'700',color:'#F9E4BA'},
  playerSub:{fontSize:10.5,color:'#C6D7D4',marginTop:2},
  playRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:4},
  playButton:{width:47,height:47,borderRadius:16,backgroundColor:'#EDD7A5',
    alignItems:'center',justifyContent:'center'},
  progressHit:{height:23,justifyContent:'center',marginTop:3},
  progressTrack:{width:'100%',height:5,borderRadius:8,
    backgroundColor:'rgba(255,255,255,.25)',overflow:'hidden'},
  progressFill:{height:5,borderRadius:8,backgroundColor:'#E8CB8F'},
  bottomRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  time:{fontSize:10,color:'#E0ECE6',fontVariant:['tabular-nums']},
  miniControl:{minWidth:30,minHeight:31,flexDirection:'row',alignItems:'center',
    justifyContent:'center',gap:2},
  miniText:{color:'#F3E0B6',fontSize:9,fontWeight:'700'},
  duaCard:{minHeight:215,borderWidth:1,borderRadius:20,padding:14,overflow:'hidden',
    shadowColor:'#7B6243',shadowOpacity:.09,shadowRadius:8,elevation:2},
  backdrop:{flex:1,justifyContent:'flex-end'},
  sheet:{maxHeight:'88%',borderWidth:1,borderTopLeftRadius:27,borderTopRightRadius:27,
    padding:19,paddingBottom:29},
  sheetHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:17},
  duaBlock:{borderWidth:1,borderRadius:17,padding:17,gap:12},
  blockLabel:{fontWeight:'800',fontSize:10,letterSpacing:1.2},
});
