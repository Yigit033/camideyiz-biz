import {useEffect,useMemo,useRef,useState,type ComponentRef} from 'react';
import {
  ActivityIndicator,Alert,KeyboardAvoidingView,Platform,Pressable,
  ScrollView,StyleSheet,Text,TextInput,View,useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router,useLocalSearchParams} from 'expo-router';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {captureRef} from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library/legacy';
import {
  GALLERY_PRESETS,GALLERY_TEXT_MAX_LENGTH,DEFAULT_GALLERY_DRAFT,
  cleanGalleryText,canExportGalleryDesign,parseGalleryDraft,
  galleryFormatDimensions,type GalleryDraft,type GalleryFont,
  type GalleryFormat,type GalleryTextTone,type GalleryTextPosition,
  type GalleryTextSize,type GalleryShade,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {
  gallerySlot,galleryPhoto,
} from '@/features/gallery/galleryCatalog';
import {GalleryCanvas} from '@/features/gallery/GalleryCanvas';

const FONT_OPTIONS:readonly {id:GalleryFont;name:string;sample:string;family:string}[]=[
  {id:'serif',name:'Klasik',sample:'Aa',family:Platform.OS==='ios'?'Georgia':'serif'},
  {id:'modern',name:'Modern',sample:'Aa',family:Platform.OS==='ios'?'AvenirNext-DemiBold':'sans-serif'},
  {id:'handwriting',name:'El Yazısı',sample:'Aa',family:Platform.OS==='ios'?'Snell Roundhand':'cursive'},
  {id:'condensed',name:'Vurgu',sample:'Aa',family:Platform.OS==='ios'?'HelveticaNeue-CondensedBold':'sans-serif-condensed'},
];
const TONES:readonly {id:GalleryTextTone;name:string;color:string}[]=[
  {id:'ivory',name:'Krem',color:'#FFF7E9'},
  {id:'white',name:'Beyaz',color:'#FFFFFF'},
  {id:'gold',name:'Altın',color:'#F7D99B'},
  {id:'dark',name:'Koyu',color:'#152C29'},
];
const POSITIONS:readonly {id:GalleryTextPosition;name:string}[]=[
  {id:'top',name:'Üst'},{id:'center',name:'Orta'},{id:'bottom',name:'Alt'},
];
const SIZES:readonly {id:GalleryTextSize;name:string}[]=[
  {id:'small',name:'Küçük'},{id:'normal',name:'Orta'},{id:'large',name:'Büyük'},
];
const SHADES:readonly {id:GalleryShade;name:string}[]=[
  {id:'light',name:'Hafif'},{id:'medium',name:'Dengeli'},{id:'deep',name:'Güçlü'},
];
const DRAFT_PREFIX='@camideyiz/gallery-draft/v2/';

export default function GalleryEditor(){
  const {colors}=useAppTheme();
  const {width}=useWindowDimensions();
  const {slot:id}=useLocalSearchParams<{slot?:string}>();
  const asset=gallerySlot(typeof id==='string'?id:'');
  const photo=asset?galleryPhoto(asset.id):null;
  const canvasRef=useRef<ComponentRef<typeof View>>(null);
  const scrollRef=useRef<ComponentRef<typeof ScrollView>>(null);
  const [draft,setDraft]=useState<GalleryDraft>({
    ...DEFAULT_GALLERY_DRAFT,text:asset?.recommendedText??DEFAULT_GALLERY_DRAFT.text,
  });
  const [draftReady,setDraftReady]=useState(false);
  const [imageLoaded,setImageLoaded]=useState(false);
  const [busy,setBusy]=useState<'share'|'save'|null>(null);
  const [editing,setEditing]=useState(false);
  useEffect(()=>{
    let active=true;
    setDraftReady(false);
    setImageLoaded(false);
    const recommended=asset?.recommendedText??DEFAULT_GALLERY_DRAFT.text;
    (async()=>{
      let saved:GalleryDraft|null=null;
      if(asset){
        try{
          const raw=await AsyncStorage.getItem(DRAFT_PREFIX+asset.id);
          saved=raw?parseGalleryDraft(JSON.parse(raw) as unknown):null;
        }catch{/* corrupted local draft does not break editor */}
      }
      if(active){
        setDraft(saved??{...DEFAULT_GALLERY_DRAFT,text:recommended});
        setDraftReady(true);
      }
    })();
    return ()=>{active=false;};
  },[asset?.id]);

  useEffect(()=>{
    if(!asset||!draftReady)return;
    const timer=setTimeout(()=>{
      AsyncStorage.setItem(DRAFT_PREFIX+asset.id,JSON.stringify(draft))
        .catch(()=>undefined);
    },400);
    return ()=>clearTimeout(timer);
  },[asset?.id,draft,draftReady]);

  const presets=useMemo(()=>asset
    ?[...GALLERY_PRESETS.filter(p=>p.category===asset.category),
      ...GALLERY_PRESETS.filter(p=>p.category!==asset.category)]
    :GALLERY_PRESETS,[asset?.category]);
  // Render near the device's full logical width: ViewShot captures at native
  // screen density before final 1080px PNG resize. Artificially shrinking the
  // preview to half the screen height would needlessly pixelate export text.
  const canvasWidth=Math.min(Math.max(200,width-42),360);
  const canExport=canExportGalleryDesign(Boolean(photo)&&imageLoaded,draft.text)
    &&draftReady&&!busy;
  const update=<K extends keyof GalleryDraft>(key:K,value:GalleryDraft[K])=>
    setDraft(d=>({...d,[key]:value}));

  const imageForExport=async():Promise<string>=>{
    if(!photo||!imageLoaded||!canvasRef.current||
      !canExportGalleryDesign(true,draft.text)){
      throw new Error('Onaylı fotoğraf ve mesaj hazır olmalı.');
    }
    // The preview must be mounted and laid out for native view capture.
    // Scroll to the preview before capture so Android draws its image layer.
    scrollRef.current?.scrollTo({y:0,animated:false});
    await new Promise<void>(resolve=>setTimeout(resolve,100));
    const dims=galleryFormatDimensions(draft.format);
    const uri=await captureRef(canvasRef,{
      result:'tmpfile',format:'png',quality:1,
      width:dims.width,height:dims.height,
    });
    if(!uri)throw new Error('Görsel dosyası üretilemedi.');
    return uri.startsWith('file://')?uri:'file://'+uri;
  };
  const share=async()=>{
    if(busy)return;
    if(!canExport){
      Alert.alert('Fotoğraf henüz hazır değil',
        'Paylaşabilmek için önce ürün sahibinin onaylı fotoğrafı eklenmeli.');
      return;
    }
    setBusy('share');
    try{
      const available=await Sharing.isAvailableAsync();
      if(!available)throw new Error('Bu cihazda sistem paylaşım menüsü kullanılamıyor.');
      const uri=await imageForExport();
      await Sharing.shareAsync(uri,{
        mimeType:'image/png',UTI:'public.png',
        dialogTitle:'WhatsApp veya uygun bir uygulamada paylaş',
      });
      // Returning from the system sheet does NOT prove the user sent a message.
    }catch(error){
      Alert.alert('Paylaşım açılamadı',
        error instanceof Error?error.message:'Görsel paylaşımı başlatılamadı.');
    }finally{setBusy(null);}
  };
  const save=async()=>{
    if(busy)return;
    if(!canExport){
      Alert.alert('Fotoğraf henüz hazır değil',
        'Onaylı bir fotoğraf eklendiğinde galeriye kaydedebilirsin.');
      return;
    }
    setBusy('save');
    try{
      const permission=await MediaLibrary.requestPermissionsAsync(true,['photo']);
      if(!permission.granted)throw new Error('Fotoğraf kaydetme izni verilmedi.');
      const uri=await imageForExport();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Görsel kaydedildi',
        'Hazırladığın görsel telefon galerisine kaydedildi. WhatsApp > Güncellemeler > Durum bölümünden seçerek paylaşabilirsin.');
    }catch(error){
      Alert.alert('Kaydetme başarısız',
        error instanceof Error?error.message:'Görsel galeriye kaydedilemedi.');
    }finally{setBusy(null);}
  };
  if(!asset)return <SafeAreaView edges={['top','bottom']}
    style={{flex:1,backgroundColor:colors.canvas,alignItems:'center',
      justifyContent:'center',padding:30,gap:12}}>
    <Feather name="alert-circle" size={30} color={colors.gold}/>
    <Text style={{color:colors.text,textAlign:'center'}}>Tasarım bulunamadı.</Text>
    <Pressable onPress={()=>router.back()}>
      <Text style={{color:colors.emerald,fontWeight:'800'}}>Galeriye dön</Text>
    </Pressable>
  </SafeAreaView>;

  return <SafeAreaView edges={['top','bottom']}
    style={{flex:1,backgroundColor:colors.canvas}}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined}
      style={{flex:1}}>
      <View style={[styles.top,{borderBottomColor:colors.border}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Galeriye dön"
          onPress={()=>router.back()}
          style={[styles.round,{borderColor:colors.border,
            backgroundColor:colors.surface}]}>
          <Feather name="arrow-left" color={colors.text} size={19}/>
        </Pressable>
        <View style={{flex:1,gap:3}}>
          <Text style={{fontFamily:'serif',fontSize:20,fontWeight:'800',
            color:colors.text}}>Tasarım Atölyesi</Text>
          <Text numberOfLines={1} style={{fontSize:11,color:colors.muted}}>
            {asset.title} · Mesajını fotoğrafa yerleştir
          </Text>
        </View>
        <View style={{paddingHorizontal:10,paddingVertical:7,borderRadius:11,
          backgroundColor:colors.soft}}>
          <Text style={{fontSize:10,fontWeight:'800',color:colors.emerald}}>
            {draft.format==='story'?'9:16':'4:5'}
          </Text>
        </View>
      </View>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={{alignItems:'center',gap:9}}>
          <View style={{borderRadius:16,borderWidth:1.5,borderColor:colors.border,
            padding:5,backgroundColor:colors.surface}}>
            <GalleryCanvas key={asset.id} ref={canvasRef}
              source={photo} slot={asset} draft={draft}
              width={canvasWidth} onImageLoaded={setImageLoaded}/>
          </View>
          {!photo?<View style={[styles.note,{backgroundColor:colors.soft}]}>
            <Feather name="info" size={15} color={colors.gold}/>
            <Text style={{flex:1,fontSize:10.5,color:colors.muted,lineHeight:17}}>
              Bu görsel yakında eklenecek. Görsel hazır olduğunda
              paylaşabilir veya telefonuna kaydedebilirsin.
            </Text>
          </View>:null}
          <Text style={{fontSize:10,color:colors.muted,textAlign:'center'}}>
            {draft.format==='story'
              ?'WhatsApp Durumu · 1080 × 1920 PNG'
              :'Gönderi · 1080 × 1350 PNG'}
          </Text>
        </View>

        <View style={[styles.panel,{borderColor:colors.border,
          backgroundColor:colors.surface}]}>
          <View style={styles.panelHeader}>
            <Feather name="maximize" size={17} color={colors.gold}/>
            <Text style={[styles.panelTitle,{color:colors.text}]}>Görsel Oranı</Text>
          </View>
          <View style={styles.options}>
            {([['story','Durum · 9:16'],['post','Gönderi · 4:5']] as const)
              .map(([format,label])=><Pressable key={format}
                accessibilityRole="button" accessibilityState={{selected:draft.format===format}}
                onPress={()=>update('format',format)}
                style={[styles.pill,{borderColor:draft.format===format
                  ?colors.emerald:colors.border,
                  backgroundColor:draft.format===format?colors.soft:colors.canvas}]}>
                <Text style={{color:colors.text,fontWeight:'800',fontSize:11.5}}>
                  {label}
                </Text>
              </Pressable>)}
          </View>
          <Text style={{fontSize:11.5,fontWeight:'800',color:colors.text}}>
            Fotoğraf Kadrajı
          </Text>
          <View style={styles.options}>
            {([['contain','Tam Fotoğraf'],['cover','Çerçeveyi Doldur']] as const)
              .map(([fit,label])=><Pressable key={fit}
                accessibilityRole="button"
                accessibilityState={{selected:draft.photoFit===fit}}
                accessibilityLabel={label+(fit==='cover'?' (fotoğraf kırpılabilir)':'')}
                onPress={()=>update('photoFit',fit)}
                style={[styles.pill,{
                  borderColor:draft.photoFit===fit?colors.emerald:colors.border,
                  backgroundColor:draft.photoFit===fit?colors.soft:colors.canvas,
                  flexDirection:'row',alignItems:'center',gap:7,
                }]}>
                <Feather name={fit==='contain'?'minimize-2':'maximize-2'} size={14}
                  color={draft.photoFit===fit?colors.emerald:colors.gold}/>
                <Text style={{color:colors.text,fontSize:11.5,fontWeight:'800'}}>{label}</Text>
              </Pressable>)}
          </View>
          <Text style={{fontSize:10.5,lineHeight:17,color:colors.muted}}>
            {draft.photoFit==='contain'
              ?'Fotoğrafın tümü korunur; kalan alan aynı fotoğrafın yumuşak fonuyla tamamlanır.'
              :'Fotoğraf çerçeveyi doldurur; kenarlarının bir bölümü kırpılabilir.'}
          </Text>
        </View>

        <View style={[styles.panel,{borderColor:colors.border,
          backgroundColor:colors.surface}]}>
          <View style={styles.panelHeader}>
            <Feather name="type" size={17} color={colors.gold}/>
            <Text style={[styles.panelTitle,{color:colors.text}]}>Mesajın</Text>
            <Text style={{fontSize:10,color:colors.muted,marginLeft:'auto'}}>
              {draft.text.length}/{GALLERY_TEXT_MAX_LENGTH}
            </Text>
          </View>
          <TextInput value={draft.text} maxLength={GALLERY_TEXT_MAX_LENGTH}
            multiline numberOfLines={3}
            accessibilityLabel="Fotoğraf üzerine yazılacak mesaj"
            onChangeText={text=>update('text',cleanGalleryText(text))}
            onFocus={()=>setEditing(true)}
            onBlur={()=>setEditing(false)}
            placeholder="Fotoğraf üzerine mesajını yaz"
            placeholderTextColor={colors.muted}
            style={[styles.input,{backgroundColor:colors.canvas,
              borderColor:editing?colors.emerald:colors.border,color:colors.text}]}/>
          <Text style={{fontSize:11.5,fontWeight:'800',color:colors.text}}>
            Hazır Mesajlar
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always" contentContainerStyle={{gap:8}}>
            {presets.map(p=><Pressable key={p.id}
              accessibilityRole="button" onPress={()=>update('text',p.text)}
              style={[styles.preset,{borderColor:colors.border,
                backgroundColor:colors.soft}]}>
              <Text style={{fontSize:11.5,color:colors.text,maxWidth:170}}
                numberOfLines={2}>{p.text}</Text>
            </Pressable>)}
          </ScrollView>
        </View>

        <View style={[styles.panel,{borderColor:colors.border,
          backgroundColor:colors.surface}]}>
          <View style={styles.panelHeader}>
            <MaterialCommunityIcons name="format-font" size={19} color={colors.gold}/>
            <Text style={[styles.panelTitle,{color:colors.text}]}>Yazı Tipi</Text>
          </View>
          <View style={styles.fonts}>
            {FONT_OPTIONS.map(f=><Pressable key={f.id}
              accessibilityRole="button" accessibilityState={{selected:draft.font===f.id}}
              onPress={()=>update('font',f.id)}
              style={[styles.fontChoice,{borderColor:draft.font===f.id
                ?colors.emerald:colors.border,
                backgroundColor:draft.font===f.id?colors.soft:colors.canvas}]}>
              <Text style={{fontFamily:f.family,fontSize:23,color:colors.text}}>
                {f.sample}
              </Text>
              <Text style={{fontSize:10,fontWeight:'700',color:colors.muted}}>
                {f.name}
              </Text>
            </Pressable>)}
          </View>
          <Text style={{fontSize:11.5,fontWeight:'800',color:colors.text}}>
            Yazı Boyutu
          </Text>
          <View style={styles.options}>
            {SIZES.map(x=><Pressable key={x.id} onPress={()=>update('textSize',x.id)}
              accessibilityRole="button" accessibilityState={{selected:draft.textSize===x.id}}
              style={[styles.smallChip,{backgroundColor:draft.textSize===x.id
                ?colors.emerald:colors.soft}]}>
              <Text style={{fontSize:11,color:draft.textSize===x.id?'#FFF':colors.text,
                fontWeight:'800'}}>{x.name}</Text>
            </Pressable>)}
          </View>
        </View>

        <View style={[styles.panel,{borderColor:colors.border,
          backgroundColor:colors.surface}]}>
          <View style={styles.panelHeader}>
            <Feather name="sliders" size={17} color={colors.gold}/>
            <Text style={[styles.panelTitle,{color:colors.text}]}>
              Görünüm ve Konum
            </Text>
          </View>
          <Text style={{fontSize:11,fontWeight:'700',color:colors.text}}>
            Yazının Yeri
          </Text>
          <View style={styles.options}>
            {POSITIONS.map(x=><Pressable key={x.id}
              accessibilityRole="button" accessibilityState={{selected:draft.position===x.id}}
              onPress={()=>update('position',x.id)}
              style={[styles.smallChip,{backgroundColor:draft.position===x.id
                ?colors.emerald:colors.soft}]}>
              <Text style={{fontSize:11,color:draft.position===x.id?'#FFF':colors.text,
                fontWeight:'800'}}>{x.name}</Text>
            </Pressable>)}
          </View>
          <Text style={{fontSize:11,fontWeight:'700',color:colors.text}}>
            Yazı Rengi
          </Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
            {TONES.map(x=><Pressable key={x.id}
              accessibilityRole="button" accessibilityLabel={'Yazı rengi: '+x.name}
              accessibilityState={{selected:draft.tone===x.id}}
              onPress={()=>update('tone',x.id)}
              style={{flexDirection:'row',alignItems:'center',gap:6,padding:7,
                borderRadius:12,borderWidth:1.5,
                borderColor:draft.tone===x.id?colors.emerald:colors.border}}>
              <View style={{width:19,height:19,borderRadius:10,
                backgroundColor:x.color,borderWidth:1,borderColor:colors.border}}/>
              <Text style={{fontSize:10.5,fontWeight:'700',color:colors.text}}>
                {x.name}
              </Text>
            </Pressable>)}
          </View>
          <Text style={{fontSize:11,fontWeight:'700',color:colors.text}}>
            Fotoğraf Üzeri Karartma
          </Text>
          <View style={styles.options}>
            {SHADES.map(x=><Pressable key={x.id}
              accessibilityRole="button" accessibilityState={{selected:draft.shade===x.id}}
              onPress={()=>update('shade',x.id)}
              style={[styles.smallChip,{backgroundColor:draft.shade===x.id
                ?colors.emerald:colors.soft}]}>
              <Text style={{fontSize:11,color:draft.shade===x.id?'#FFF':colors.text,
                fontWeight:'800'}}>{x.name}</Text>
            </Pressable>)}
          </View>
        </View>

        <View style={{flexDirection:'row',gap:9,alignItems:'flex-start'}}>
          <Feather name="lock" size={15} color={colors.gold}/>
          <Text style={{flex:1,fontSize:10.5,lineHeight:18,color:colors.muted}}>
            Yazdığın mesaj yalnızca telefonunda taslak olarak saklanır.
            Herhangi bir hesaba veya sunucuya gönderilmez. Paylaşılacak
            görseli telefonunun sistem paylaşım ekranında sen seçersin.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer,{borderTopColor:colors.border,
        backgroundColor:colors.surface}]}>
        <Pressable accessibilityRole="button"
          accessibilityLabel="Görseli galeriye kaydet"
          onPress={()=>void save()} disabled={!canExport}
          style={[styles.secondary,{borderColor:colors.emerald,
            opacity:canExport?1:.44}]}>
          {busy==='save'?<ActivityIndicator size="small" color={colors.emerald}/>
            :<Feather name="download" size={17} color={colors.emerald}/>}
          <Text style={{fontSize:12,fontWeight:'800',color:colors.emerald}}>Kaydet</Text>
        </Pressable>
        <Pressable accessibilityRole="button"
          accessibilityLabel="Hazırladığın görseli WhatsApp veya diğer uygulamalarla paylaş"
          onPress={()=>void share()} disabled={!canExport}
          style={[styles.primary,{backgroundColor:colors.emerald,
            opacity:canExport?1:.44}]}>
          {busy==='share'?<ActivityIndicator size="small" color="#FFF"/>
            :<Feather name="share-2" size={18} color="#FFF"/>}
          <Text style={{fontSize:13,fontWeight:'800',color:'#FFF'}}>
            Paylaş
          </Text>
        </Pressable>
      </View>
      <Text style={{fontSize:9.5,color:colors.muted,
        backgroundColor:colors.surface,textAlign:'center',paddingBottom:5}}>
        WhatsApp'ta kişi veya Durum hedefi, telefonun paylaşım menüsüne bağlıdır.
      </Text>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  top:{minHeight:63,borderBottomWidth:1,paddingHorizontal:16,
    flexDirection:'row',gap:12,alignItems:'center'},
  round:{width:42,height:42,borderRadius:14,borderWidth:1,
    alignItems:'center',justifyContent:'center'},
  content:{padding:17,paddingBottom:36,gap:15},
  panel:{borderWidth:1,borderRadius:19,padding:14,gap:12},
  panelHeader:{flexDirection:'row',alignItems:'center',gap:8},
  panelTitle:{fontFamily:'serif',fontSize:17,fontWeight:'800'},
  options:{flexDirection:'row',gap:8,flexWrap:'wrap'},
  pill:{borderWidth:1,borderRadius:13,paddingHorizontal:15,
    paddingVertical:11,minHeight:41,justifyContent:'center'},
  input:{minHeight:96,borderWidth:1,borderRadius:13,padding:12,
    textAlignVertical:'top',fontSize:15,lineHeight:22},
  preset:{maxWidth:210,minHeight:40,borderRadius:12,borderWidth:1,
    justifyContent:'center',paddingHorizontal:11,paddingVertical:7},
  fonts:{flexDirection:'row',gap:7},
  fontChoice:{flex:1,minWidth:0,borderWidth:1.5,borderRadius:14,
    alignItems:'center',justifyContent:'center',gap:5,
    minHeight:77,paddingHorizontal:3},
  smallChip:{minHeight:36,borderRadius:11,paddingHorizontal:13,
    alignItems:'center',justifyContent:'center'},
  note:{borderRadius:13,padding:12,flexDirection:'row',gap:9,
    alignItems:'flex-start'},
  footer:{borderTopWidth:1,paddingHorizontal:15,paddingVertical:12,
    flexDirection:'row',gap:9},
  secondary:{flex:1,minHeight:49,borderWidth:1.5,borderRadius:14,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  primary:{flex:1.4,minHeight:49,borderRadius:14,
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
});
