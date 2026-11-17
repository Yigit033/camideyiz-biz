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
  GALLERY_SLOTS,READY_GALLERY_COUNT,galleryPhoto,galleryThumbnail,
  type GallerySlot,
} from '@/features/gallery/galleryCatalog';

const CATEGORY_NAME:Record<GalleryCategory,string>={
  cuma:'Cuma',dua:'Dua',kandil:'Kandil',ramazan:'Ramazan',
  bayram:'Bayram',gunaydin:'Günlük',genel:'Diğer',
};

/** Each uploaded thumbnail has its own aspect ratio (0.56–0.82 in
 * the owner's current collection). Respect its original width and height:
 * fixed-height cards always add dead space or crop a photo.
 */
function previewAspectRatio(slot:GallerySlot):number{
  const image=galleryThumbnail(slot.id);
  if(!image)return 2/3;
  const metadata=Image.resolveAssetSource(image);
  if(!metadata||typeof metadata.width!=='number'||typeof metadata.height!=='number'
    ||!Number.isFinite(metadata.width)||!Number.isFinite(metadata.height)
    ||metadata.width<=0||metadata.height<=0)return 2/3;
  return metadata.width/metadata.height;
}

function GalleryTile({item,width}:{
  item:GallerySlot;width:number;
}){
  const {colors}=useAppTheme();
  const photo=galleryThumbnail(item.id);
  const aspectRatio=previewAspectRatio(item);
  return <Pressable accessibilityRole="button"
    accessibilityLabel={item.title+' tasarımını aç'+(!photo?' (fotoğraf henüz eklenmedi)':'')}
    onPress={()=>router.push({pathname:'/gallery-editor',params:{slot:item.id}})}
    style={[styles.tile,{width,backgroundColor:colors.surface,borderColor:colors.border}]}>
    <View style={[styles.thumb,{
      backgroundColor:colors.isDark?'#143A54':'#E8EEF2',
      aspectRatio,
    }]}>
      {photo?<Image source={photo} resizeMode="contain"
        style={StyleSheet.absoluteFill}/>:<View style={styles.placeholder}>
        <MaterialCommunityIcons name="image-filter-hdr" color={item.accent} size={43}/>
        <View style={{height:1,width:42,backgroundColor:item.accent,opacity:.7}}/>
        <Text style={{fontSize:9,fontWeight:'800',letterSpacing:1.5,
          color:'#C5D3C7'}}>GÖRSEL {String(item.index).padStart(2,'0')}</Text>
        <Text style={{fontSize:9,color:'#A4BEB7'}}>Yakında eklenecek</Text>
      </View>}
    </View>
    <View style={{padding:10,gap:6}}>
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
  const tileWidth=Math.max(120,(width-44-12)/2);
  // Two balanced columns instead of flexWrap rows with dead gaps under tall
  // natural-aspect photos. The original catalog order stays deterministic.
  const columns=useMemo(()=>{
    const result:[GallerySlot[],GallerySlot[]]=[[],[]];
    const heights=[0,0];
    for(const slot of tiles){
      const column=heights[0]<=heights[1]?0:1;
      result[column].push(slot);
      heights[column]+=tileWidth/previewAspectRatio(slot)+73+12;
    }
    return result;
  },[tiles,tileWidth]);
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
            Görsel telefonunuzda oluşturulur.
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
    <View style={styles.grid}>
      {tiles.length>0?columns.map((column,index)=>
        <View key={'col-'+index} style={{width:tileWidth,gap:12}}>
          {column.map(slot=><GalleryTile key={slot.id} item={slot} width={tileWidth}/>)}
        </View>)
      :<View style={{paddingVertical:30,width:'100%',alignItems:'center',gap:7}}>
        <Feather name="search" size={25} color={colors.gold}/>
        <Text style={{color:colors.muted,fontSize:12}}>Bu aramada tasarım bulunamadı.</Text>
      </View>}
    </View>
    <View style={{flexDirection:'row',gap:8,alignItems:'flex-start',marginTop:4}}>
      <Feather name="shield" size={16} color={colors.gold}/>
      <Text style={{flex:1,fontSize:10.5,color:colors.muted,lineHeight:18}}>
        Ürün içinde gönderi paylaşma, sosyal akış veya mesajların sunucuya
        yüklenmesi bulunmaz. Hazırlanan fotoğraf, telefonunuzun paylaşım menüsüyle
        WhatsApp ve diğer uygun uygulamalara aktarılır.
      </Text>
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
  grid:{flexDirection:'row',alignItems:'flex-start',gap:12},
  tile:{borderRadius:17,overflow:'hidden',borderWidth:1},
  thumb:{width:'100%',overflow:'hidden',position:'relative'},
  placeholder:{flex:1,justifyContent:'center',alignItems:'center',gap:8},
  formatBadge:{paddingHorizontal:7,paddingVertical:4,borderRadius:9,
    flexDirection:'row',alignItems:'center',gap:4},
});
