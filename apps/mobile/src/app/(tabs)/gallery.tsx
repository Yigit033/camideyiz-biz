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
  GALLERY_SLOTS,GALLERY_SLOT_COUNT,READY_GALLERY_COUNT,galleryPhoto,
  type GallerySlot,
} from '@/features/gallery/galleryCatalog';

const CATEGORY_NAME:Record<GalleryCategory,string>={
  cuma:'Cuma',dua:'Dua',kandil:'Kandil',ramazan:'Ramazan',
  bayram:'Bayram',gunaydin:'Günlük',genel:'Diğer',
};

function GalleryTile({item,width}:{
  item:GallerySlot;width:number;
}){
  const {colors}=useAppTheme();
  const photo=galleryPhoto(item.id);
  return <Pressable accessibilityRole="button"
    accessibilityLabel={item.title+' tasarımını aç'+(!photo?' (fotoğraf henüz eklenmedi)':'')}
    onPress={()=>router.push({pathname:'/gallery-editor',params:{slot:item.id}})}
    style={[styles.tile,{width,backgroundColor:colors.surface,borderColor:colors.border}]}>
    <View style={[styles.thumb,{backgroundColor:'#0D403F',height:width*1.12}]}>
      {photo?<Image source={photo} resizeMode="cover"
        style={StyleSheet.absoluteFill}/>:<View style={styles.placeholder}>
        <MaterialCommunityIcons name="image-filter-hdr" color={item.accent} size={43}/>
        <View style={{height:1,width:42,backgroundColor:item.accent,opacity:.7}}/>
        <Text style={{fontSize:9,fontWeight:'800',letterSpacing:1.5,
          color:'#C5D3C7'}}>GÖRSEL {String(item.index).padStart(2,'0')}</Text>
        <Text style={{fontSize:9,color:'#A4BEB7'}}>Yakında eklenecek</Text>
      </View>}
      <View style={styles.formatBadge}>
        <Feather name="edit-3" color="#F8EED8" size={12}/>
        <Text style={{fontSize:9,color:'#F8EED8',fontWeight:'800'}}>
          {photo?'Düzenle':'Önizle'}
        </Text>
      </View>
    </View>
    <View style={{padding:10,gap:4}}>
      <Text numberOfLines={1} style={{fontSize:12.5,fontWeight:'800',color:colors.text}}>
        {item.title}
      </Text>
      <Text numberOfLines={1} style={{fontSize:10.5,color:colors.muted}}>
        {CATEGORY_NAME[item.category]} · {photo?'Paylaşmaya hazır':'Fotoğraf bekleniyor'}
      </Text>
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
    return GALLERY_SLOTS.filter(slot=>
      (category==='all'||slot.category===category)&&
      (!text||[slot.title,slot.recommendedText,CATEGORY_NAME[slot.category]]
        .some(value=>value.toLocaleLowerCase('tr-TR').includes(text)))
    );
  },[category,query]);
  const tileWidth=Math.max(120,(width-44-12)/2);
  return <Page title="Paylaşım Galerisi"
    subtitle="Bir fotoğraf seç, kendi mesajını tasarla ve WhatsApp'ta paylaş.">
    <View style={[styles.intro,{
      backgroundColor:colors.isDark?'#0A403D':'#E8EFE5',borderColor:colors.border,
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
      <View style={{height:1,backgroundColor:colors.border,opacity:.65}}/>
      <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
        <Feather name="image" size={16} color={colors.gold}/>
        <Text style={{flex:1,fontSize:11,color:colors.text,fontWeight:'700'}}>
          {READY_GALLERY_COUNT} / {GALLERY_SLOT_COUNT} onaylı fotoğraf eklendi
        </Text>
        <Text style={{fontSize:10,color:colors.muted}}>24 şablon alanı</Text>
      </View>
      {READY_GALLERY_COUNT===0?<Text style={{fontSize:11,color:colors.muted,lineHeight:18}}>
        Fotoğraflar henüz teslim edilmedi. Tasarım editörünü inceleyebilirsiniz;
        gerçek fotoğraf eklenene kadar dışa aktarma kapalıdır.
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
          backgroundColor:category===c.id?colors.emerald:colors.surface,
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
      {tiles.map(slot=><GalleryTile key={slot.id} item={slot} width={tileWidth}/>)}
      {tiles.length===0?<View style={{paddingVertical:30,width:'100%',alignItems:'center',gap:7}}>
        <Feather name="search" size={25} color={colors.gold}/>
        <Text style={{color:colors.muted,fontSize:12}}>Bu aramada tasarım bulunamadı.</Text>
      </View>:null}
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
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12},
  tile:{borderRadius:17,overflow:'hidden',borderWidth:1},
  thumb:{width:'100%',overflow:'hidden',position:'relative'},
  placeholder:{flex:1,justifyContent:'center',alignItems:'center',gap:8},
  formatBadge:{position:'absolute',right:9,top:9,
    paddingHorizontal:8,paddingVertical:5,borderRadius:10,
    flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(4,33,32,.77)'},
});
