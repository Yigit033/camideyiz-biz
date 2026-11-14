import {useMemo,useState} from 'react';
import {Alert,Linking,Modal,Pressable,ScrollView,Share,StyleSheet,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import Svg,{Circle,Defs,LinearGradient,Path,Stop} from 'react-native-svg';
import {ArabesqueCorner,GoldenLantern} from '@/components/LuxuryArtwork';
import {useAppTheme} from '@/theme/ThemeProvider';
import {dailyWisdom,WISDOM_LIBRARY,type WisdomItem} from '@camideyiz/core';
import {useWisdomFavorites} from './useWisdomFavorites';

function WisdomCard({item,isDark,onOpen,isFavorite,onToggle}:{
  item:WisdomItem;isDark:boolean;onOpen:()=>void;isFavorite:boolean;onToggle:()=>void;
}){
  const {colors}=useAppTheme();
  const verse=item.kind==='verse';
  const paperColor=verse?(isDark?'#083B34':'#0A6E55'):(isDark?'#152A28':'#FFF9EE');
  const foreground=verse?'#FFF9EA':colors.text;
  return <View style={[styles.card,{
      backgroundColor:paperColor,
      borderColor:verse?(isDark?'#63836D':'#D1B979'):(isDark?'#806B4D':'#E1C79B'),
    }]}>
    {verse?<Svg width="100%" height="100%" viewBox="0 0 230 170"
      preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="wisdomGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#116F5E"/>
          <Stop offset="100%" stopColor="#063529"/>
        </LinearGradient>
      </Defs>
      <Path d="M0 0H230V170H0Z" fill="url(#wisdomGreen)"/>
      <Circle cx="16" cy="140" r="100" fill="none" stroke="#DBC189" strokeWidth=".6" strokeOpacity=".23"/>
      <Circle cx="16" cy="140" r="83" fill="none" stroke="#DBC189" strokeWidth=".6" strokeOpacity=".18"/>
      </Svg>:null}
    <ArabesqueCorner dark width={78}/>
    <Pressable accessibilityRole="button" accessibilityLabel={(verse?'Günün ayeti: ':'Günün hadisi: ')+item.reference+'. Detayları aç'}
      onPress={onOpen} style={{flex:1,gap:9,justifyContent:'space-between'}}>
      <View style={styles.cardTop}>
        {verse?<MaterialCommunityIcons name="book-open-page-variant-outline" size={21} color="#F1D292"/>
          :<GoldenLantern size={22}/>}
        <Text style={{fontSize:13.5,fontFamily:'serif',fontWeight:'700',
          color:verse?'#F3D69D':foreground,flex:1}}>
          {verse?'Günün Ayeti':'Günün Hadisi'}
        </Text>
        <Feather name="arrow-up-right" size={15} color={verse?'#F3D69D':colors.gold}/>
      </View>
      <Text numberOfLines={4} style={{fontFamily:'serif',fontSize:15.5,fontStyle:'italic',
        fontWeight:'500',lineHeight:22,color:foreground,flexShrink:1}}>
        “{item.excerpt}”
      </Text>
      <View style={{gap:5}}>
        <Text numberOfLines={1} style={{color:verse?'#C2DFCD':colors.muted,fontSize:11}}>
          {item.reference}
        </Text>
        <Text style={{fontSize:9.5,color:verse?'#A9D7C5':colors.muted}}>Kısa alıntı · Kaynağı görüntüle</Text>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={isFavorite?'Favorilerden çıkar':'Favorilere kaydet'}
      onPress={onToggle} style={[styles.bookmark,{backgroundColor:verse?'rgba(255,255,255,.11)':colors.soft}]}>
      <Feather name="bookmark" size={16} color={isFavorite?'#EDC77B':verse?'#F0DCAB':colors.gold}/>
      {isFavorite?<View style={styles.savedDot}/>:null}
    </Pressable>
  </View>;
}
export function DailyWisdomSection({dateISO,dark}: {dateISO:string;dark:boolean}){
  const {colors}=useAppTheme();
  const selections=useMemo(()=>dailyWisdom(dateISO),[dateISO]);
  const {saved,ready,toggle}=useWisdomFavorites();
  const [detail,setDetail]=useState<WisdomItem|null>(null);
  const [savedOpen,setSavedOpen]=useState(false);
  const list=useMemo(()=>saved.map(id=>WISDOM_LIBRARY.find(x=>x.id===id)).filter(
    (x):x is WisdomItem=>x!==undefined),[saved]);
  const close=()=>{setDetail(null);setSavedOpen(false);};
  const openSource=async(item:WisdomItem)=>{
    try{await Linking.openURL(item.sourceUrl);}
    catch{Alert.alert('Kaynak açılamadı','İnternet bağlantısını veya tarayıcını kontrol et.');}
  };
  const shareItem=async(item:WisdomItem)=>{
    try{await Share.share({message:
      (item.kind==='verse'?'Günün Ayeti':'Günün Hadisi')+'\n\n“'+item.excerpt+
      '”\n\n'+item.reference+'\nKısa alıntı · Tam metin: '+item.sourceUrl+
      '\n\nCamideyiz Biz'});}
    catch{/* dismissed or OS share failure */}
  };
  return <View style={{gap:10,width:'100%'}}>
    <View style={styles.heading}>
      <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:7}}>
        <MaterialCommunityIcons name="star-four-points-outline" size={15} color={colors.gold}/>
        <Text style={{fontFamily:'serif',fontWeight:'700',fontSize:17,color:colors.text}}>Günün Seçkisi</Text>
        <Text style={{fontSize:10,color:colors.muted}}>· her gün yenilenir</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Kaydedilen ayet ve hadisleri göster"
        onPress={()=>{setDetail(null);setSavedOpen(true);}}
        style={[styles.savedButton,{backgroundColor:colors.soft,borderColor:colors.border}]}>
        <Feather name="bookmark" size={14} color={colors.gold}/>
        <Text style={{fontSize:11,color:colors.text,fontWeight:'700'}}>
          Kaydedilenler{saved.length?' · '+saved.length:''}
        </Text>
      </Pressable>
    </View>
    <View style={styles.row}>
      <WisdomCard item={selections.verse} isDark={dark}
        onOpen={()=>setDetail(selections.verse)}
        isFavorite={saved.includes(selections.verse.id)}
        onToggle={()=>toggle(selections.verse.id)}/>
      <WisdomCard item={selections.hadith} isDark={dark}
        onOpen={()=>setDetail(selections.hadith)}
        isFavorite={saved.includes(selections.hadith.id)}
        onToggle={()=>toggle(selections.hadith.id)}/>
    </View>
    <Text style={{fontSize:10,lineHeight:16,color:colors.muted,paddingHorizontal:3}}>
      Ayet meali ve hadislerden kısa alıntılar · Tam metin ve bağlam için kaynak bağlantısını açın.
    </Text>
    <Modal visible={!!detail||savedOpen} transparent animationType="slide"
      onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}/>
        <View style={[styles.sheet,{backgroundColor:colors.canvas,borderColor:colors.border}]}>
          <View style={styles.sheetHead}>
            <View style={{flex:1,gap:4}}>
              <Text style={{fontFamily:'serif',fontSize:24,fontWeight:'700',color:colors.text}}>
                {savedOpen?'Kaydedilen Seçkiler':detail?.kind==='verse'?'Günün Ayeti':'Günün Hadisi'}
              </Text>
              <Text style={{fontSize:12,color:colors.muted}}>
                {savedOpen?'İnternet olmadan kaydedilen kısa alıntıları okuyabilirsiniz.':
                  detail?.category+' · Kaynaklı kısa alıntı'}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Kapat"
              onPress={close} hitSlop={10}>
              <Feather name="x" size={24} color={colors.text}/>
            </Pressable>
          </View>
          {savedOpen?<ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{gap:9,paddingBottom:8}}>
            {!ready?<Text style={{color:colors.muted}}>Kaydedilenler yükleniyor…</Text>
              :!list.length?<View style={styles.empty}>
                <Feather name="bookmark" size={29} color={colors.gold}/>
                <Text style={{color:colors.text,fontSize:15,fontWeight:'700'}}>
                  Henüz kaydettiğin bir içerik yok
                </Text>
                <Text style={{color:colors.muted,fontSize:12,textAlign:'center'}}>
                  Günün ayeti veya hadisinin yer imine dokunarak burada biriktirebilirsin.
                </Text>
              </View>:list.map(item=><Pressable key={item.id} accessibilityRole="button"
                onPress={()=>{setSavedOpen(false);setDetail(item);}}
                style={[styles.savedItem,{borderColor:colors.border,backgroundColor:colors.surface}]}>
                <MaterialCommunityIcons name={item.kind==='verse'?'book-open-outline':'book-heart-outline'}
                  size={20} color={colors.gold}/>
                <View style={{flex:1,gap:4}}>
                  <Text style={{fontSize:12,fontWeight:'800',color:colors.text}}>{item.reference}</Text>
                  <Text numberOfLines={2} style={{fontSize:11.5,lineHeight:18,color:colors.muted}}>{item.excerpt}</Text>
                </View>
                <Feather name="chevron-right" size={17} color={colors.gold}/>
              </Pressable>)}
          </ScrollView>:detail?<ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{gap:16,paddingBottom:8}}>
            <View style={[styles.quote,{backgroundColor:colors.soft,borderColor:colors.border}]}>
              <MaterialCommunityIcons name={detail.kind==='verse'?'book-open-page-variant-outline':'book-heart-outline'}
                size={25} color={colors.gold}/>
              <Text style={{fontSize:21,fontFamily:'serif',fontStyle:'italic',
                fontWeight:'600',lineHeight:31,color:colors.text}}>
                “{detail.excerpt}”
              </Text>
              <Text style={{fontSize:14,fontWeight:'800',color:colors.emerald}}>
                {detail.reference}
              </Text>
              <Text style={{fontSize:10.5,color:colors.muted}}>
                {detail.sourceEdition} · kısa alıntı
              </Text>
            </View>
            <Text style={{fontSize:12.5,lineHeight:21,color:colors.text}}>
              {detail.note}
            </Text>
            <View style={[styles.notice,{borderColor:colors.border}]}>
              <Feather name="info" size={17} color={colors.gold}/>
              <Text style={{flex:1,fontSize:11,lineHeight:19,color:colors.muted}}>
                Bu kart tam ayet/hadis metni yerine geçmez. Orijinal ifade,
                bağlam, meal ve kaynak ayrıntıları için yayımlayan kurumun sayfasını okuyun.
              </Text>
            </View>
            <Pressable accessibilityRole="link" onPress={()=>void openSource(detail)}
              style={[styles.primary,{backgroundColor:colors.emerald}]}>
              <Feather name="external-link" color="#FFFFFF" size={17}/>
              <Text style={{fontWeight:'800',color:'#FFFFFF'}}>Tam metni kaynağında oku</Text>
            </Pressable>
            <View style={{flexDirection:'row',gap:10}}>
              <Pressable accessibilityRole="button" disabled={!ready}
                onPress={()=>toggle(detail.id)}
                style={[styles.secondary,{borderColor:colors.border,flex:1}]}>
                <Feather name="bookmark" size={18} color={colors.gold}/>
                <Text style={{color:colors.text,fontWeight:'700'}}>
                  {saved.includes(detail.id)?'Kaydı kaldır':'Kaydet'}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={()=>void shareItem(detail)}
                style={[styles.secondary,{borderColor:colors.border,flex:1}]}>
                <Feather name="share-2" size={18} color={colors.gold}/>
                <Text style={{color:colors.text,fontWeight:'700'}}>Paylaş</Text>
              </Pressable>
            </View>
          </ScrollView>:null}
        </View>
      </View>
    </Modal>
  </View>;
}
const styles=StyleSheet.create({
  heading:{flexDirection:'row',alignItems:'center',gap:7,justifyContent:'space-between'},
  savedButton:{minHeight:32,paddingHorizontal:8,borderRadius:12,borderWidth:1,
    flexDirection:'row',alignItems:'center',gap:6},
  row:{flexDirection:'row',gap:9,alignItems:'stretch',width:'100%'},
  card:{flex:1,minWidth:0,minHeight:204,borderWidth:1,borderRadius:19,padding:13,overflow:'hidden',
    shadowColor:'#06261F',shadowOpacity:.09,shadowRadius:7,elevation:2},
  cardTop:{flexDirection:'row',gap:6,alignItems:'center',paddingRight:11},
  bookmark:{position:'absolute',right:8,top:8,width:30,height:30,borderRadius:11,
    justifyContent:'center',alignItems:'center'},
  savedDot:{width:4,height:4,borderRadius:2,backgroundColor:'#EDC77B',position:'absolute',bottom:4},
  backdrop:{flex:1,backgroundColor:'rgba(0,15,13,.66)',justifyContent:'flex-end'},
  sheet:{padding:19,paddingBottom:29,borderTopLeftRadius:25,borderTopRightRadius:25,
    borderWidth:1,maxHeight:'88%'},
  sheetHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:19},
  quote:{borderRadius:18,borderWidth:1,padding:20,gap:13},
  notice:{borderWidth:1,borderRadius:14,padding:12,flexDirection:'row',gap:9},
  primary:{height:50,borderRadius:14,flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center'},
  secondary:{height:46,borderRadius:13,borderWidth:1,flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center'},
  savedItem:{borderWidth:1,borderRadius:13,padding:11,flexDirection:'row',gap:12,alignItems:'center'},
  empty:{alignItems:'center',justifyContent:'center',gap:13,minHeight:175},
});
