import {useMemo,useState} from 'react';
import {
  Image,Pressable,ScrollView,StyleSheet,Text,TextInput,View,
  useWindowDimensions,
} from 'react-native';
import {router} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {Page} from '@/components/Page';
import {useAppTheme} from '@/theme/ThemeProvider';
import {
  GALLERY_CATEGORIES,type GalleryCategory,
} from '@camideyiz/core';
import {
  GALLERY_SLOTS,READY_GALLERY_COUNT,galleryPhoto,
  type GallerySlot,
} from '@/features/gallery/galleryCatalog';

const CATEGORY_NAME:Record<GalleryCategory,string>={
  cuma:'Cuma',dua:'Dua',kandil:'Kandil',ramazan:'Ramazan',
  bayram:'Bayram',gunaydin:'Günlük',genel:'Diğer',
};

/** Every photo window uses the SAME portrait frame for a true aligned grid.
 * Android WebP images must receive explicit pixel dimensions; using
 * absoluteFill + resizeMethod=resize led to top-left enlargement on devices.
 * "contain" preserves every original pixel's composition without cropping.
 */
const TILE_PHOTO_RATIO=2/3;
const TILE_META_HEIGHT=63;
const TILE_SPACING=12;

function GalleryTile({item,width}:{
  item:GallerySlot;width:number;
}){
  const {colors}=useAppTheme();
  const photo=galleryPhoto(item.id);
  const imageHeight=Math.round((width-2)/TILE_PHOTO_RATIO);
  return <Pressable accessibilityRole="button"
    accessibilityLabel={item.title+' tasarımını aç'+(!photo?' (fotoğraf henüz eklenmedi)':'')}
    onPress={()=>router.push({pathname:'/gallery-editor',params:{slot:item.id}})}
    style={[styles.tile,{width,backgroundColor:colors.surface,borderColor:colors.border}]}>
    <View style={[styles.thumb,{
      height:imageHeight,
      backgroundColor:colors.isDark?'#183346':'#EEECE7',
    }]}>
      {photo?<Image source={photo}
        accessibilityLabel={item.title+' fotoğrafının tamamı'}
        resizeMode="contain" fadeDuration={0}
        style={{width:width-2,height:imageHeight}}
        />:<View style={styles.placeholder}>
        <MaterialCommunityIcons name="image-filter-hdr" color={item.accent} size={43}/>
        <View style={{height:1,width:42,backgroundColor:item.accent,opacity:.7}}/>
        <Text style={{fontSize:9,fontWeight:'800',letterSpacing:1.5,
          color:'#C5D3C7'}}>GÖRSEL {String(item.index).padStart(2,'0')}</Text>
        <Text style={{fontSize:9,color:'#A4BEB7'}}>Yakında eklenecek</Text>
      </View>}
    </View>
    <View style={{height:TILE_META_HEIGHT,paddingHorizontal:9,paddingVertical:8,
      gap:5,justifyContent:'center'}}>
      <Text numberOfLines={1} style={{fontSize:12.5,fontWeight:'800',color:colors.text}}>
        {item.title}
      </Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
        <Text numberOfLines={1} style={{fontSize:10.5,color:colors.muted,flex:1}}>
          {CATEGORY_NAME[item.category]}
        </Text>
        <View style={[styles.formatBadge,{backgroundColor:colors.soft}]}>
          <Feather name="edit-3" color={colors.emerald} size={11}/>
          <Text style={{fontSize:9,color:colors.text,fontWeight:'800'}}>
            {photo?'Düzenle':'Önizle'}
          </Text>
        </View>
      </View>
    </View>
  </Pressable>;
}

export default function Gallery(){
  const {colors}=useAppTheme();
  const {width}=useWindowDimensions();
  const [category,setCategory]=useState<GalleryCategory|'all'>('all');
  const [query,setQuery]=useState('');
  const tiles=useMemo(()=>{
    const text=query.trim().toLocaleLowerCase('tr-TR');
    // During initial development all slots remain inspectable; as soon as
    // owner photography starts arriving, show ONLY approved photos. Avoid
    // shipping empty/placeholder cards next to real content.
    const showPlanningSlots=READY_GALLERY_COUNT===0;
    return GALLERY_SLOTS.filter(slot=>
      (showPlanningSlots||Boolean(galleryPhoto(slot.id)))&&
      (category==='all'||slot.category===category)&&
      (!text||[slot.title,slot.recommendedText,CATEGORY_NAME[slot.category]]
        .some(value=>value.toLocaleLowerCase('tr-TR').includes(text)))
    );
  },[category,query]);
  // Page supplies 22px horizontal padding on both edges.
  // Reserve one inter-card gap. All rows align at their tops and bottoms.
  const tileWidth=Math.min(224,Math.max(110,(width-44-TILE_SPACING)/2));
  return <Page title="Paylaşım Galerisi"
    subtitle="Bir fotoğraf seç, kendi mesajını tasarla ve WhatsApp'ta paylaş.">
    <View style={[styles.intro,{
      backgroundColor:colors.isDark?'#133850':'#E8EFE5',borderColor:colors.border,
    }]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
        <View style={[styles.introIcon,{backgroundColor:colors.soft}]}>
          <MaterialCommunityIcons name="image-edit-outline" size={24} color={colors.gold}/>
        </View>
        <View style={{flex:1,gap:5}}>
          <Text style={{fontSize:15,fontFamily:'serif',fontWeight:'800',color:colors.text}}>
            Sözünüz, seçtiğiniz fotoğrafla
          </Text>
          <Text style={{fontSize:11.5,lineHeight:18,color:colors.muted}}>
            Hazır mesajlar, farklı yazı tipleri, konum ve renk seçenekleri.
          </Text>
        </View>
      </View>
      {READY_GALLERY_COUNT===0
        ?<Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>
          Yeni görseller yakında. Hazır mesajları ve tasarımları keşfedebilirsin.
        </Text>:null}
    </View>

    <View style={[styles.search,{backgroundColor:colors.surface,borderColor:colors.border}]}>
      <Feather name="search" size={17} color={colors.gold}/>
      <TextInput placeholder="Tasarım veya mesaj ara" value={query}
        onChangeText={setQuery} autoCorrect={false}
        placeholderTextColor={colors.muted}
        style={{fontSize:13,color:colors.text,flex:1,paddingVertical:0}}/>
      {query?<Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle"
        onPress={()=>setQuery('')}>
        <Feather name="x" size={17} color={colors.muted}/>
      </Pressable>:null}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categories}>
      {GALLERY_CATEGORIES.map(c=><Pressable key={c.id}
        accessibilityRole="button" accessibilityState={{selected:category===c.id}}
        onPress={()=>setCategory(c.id)}
        style={[styles.chip,{
          backgroundColor:category===c.id?colors.accentStrong:colors.surface,
          borderColor:category===c.id?colors.emerald:colors.border,
        }]}>
        <Text style={{fontSize:11.5,fontWeight:'800',
          color:category===c.id?'#FFF7E9':colors.text}}>{c.label}</Text>
      </Pressable>)}
    </ScrollView>

    <View style={{flexDirection:'row',justifyContent:'space-between',
      alignItems:'center',gap:10}}>
      <Text style={{fontSize:15,fontWeight:'800',color:colors.text}}>Tasarım Koleksiyonu</Text>
      <Text style={{fontSize:11,color:colors.muted}}>{tiles.length} şablon</Text>
    </View>
    <View style={[styles.grid,{maxWidth:tileWidth*2+TILE_SPACING}]}>
      {tiles.length>0?tiles.map(slot=>
        <GalleryTile key={slot.id} item={slot} width={tileWidth}/>
      ):<View style={{paddingVertical:30,width:'100%',alignItems:'center',gap:7}}>
        <Feather name="search" size={25} color={colors.gold}/>
        <Text style={{color:colors.muted,fontSize:12}}>Bu aramada tasarım bulunamadı.</Text>
      </View>}
    </View>
  </Page>;
}
const styles=StyleSheet.create({
  intro:{borderRadius:22,borderWidth:1,padding:16,gap:13},
  introIcon:{width:46,height:46,borderRadius:15,alignItems:'center',justifyContent:'center'},
  search:{height:47,borderRadius:15,borderWidth:1,
    flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:13},
  categories:{gap:8,paddingVertical:2},
  chip:{borderWidth:1,paddingHorizontal:14,paddingVertical:10,borderRadius:22},
  grid:{flexDirection:'row',flexWrap:'wrap',alignSelf:'center',
    justifyContent:'flex-start',alignItems:'flex-start',width:'100%',
    columnGap:TILE_SPACING,rowGap:TILE_SPACING},
  tile:{borderRadius:17,overflow:'hidden',borderWidth:1},
  thumb:{width:'100%',overflow:'hidden',alignItems:'center',justifyContent:'center'},
  placeholder:{flex:1,justifyContent:'center',alignItems:'center',gap:8},
  formatBadge:{paddingHorizontal:7,paddingVertical:4,borderRadius:9,
    flexDirection:'row',alignItems:'center',gap:4},
});
