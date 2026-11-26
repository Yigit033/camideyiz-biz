import {memo,useMemo} from 'react';
import {Alert,Linking,Pressable,Text,View,useWindowDimensions} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {CamideyizBrandLogo} from '@/components/CamideyizBrandLogo';
import {useAppTheme} from '@/theme/ThemeProvider';
import type {PrayerPlaceSelection} from './prayerApi';
import type {PrayerPlaceMode} from './usePrayerSource';
import type {DevicePlaceStatus} from './useDevicePrayerLocation';

/** One HH:MM formatter per zone; building one each minute costs a JS frame on Hermes. */
const clockFormats=new Map<string,Intl.DateTimeFormat>();
function clockFormat(zone:string):Intl.DateTimeFormat{
  let format=clockFormats.get(zone);
  if(!format){
    format=new Intl.DateTimeFormat('tr-TR',{
      hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone,
    });
    clockFormats.set(zone,format);
  }
  return format;
}

/**
 * Premium home header: brand, independent city/district selector and a
 * dedicated non-interactive local clock. The GPS control stays distinct
 * from the manually selected city; notification/theme actions are preserved.
 */
export const HomeBrandHeader=memo(function HomeBrandHeader({
  place,onOpenLocation,onEnableAutoLocation,locationMode,autoLocationStatus,
  compact=false,now,timezone='Europe/Istanbul',
}:{
  place:PrayerPlaceSelection|null;
  onOpenLocation:()=>void;
  onEnableAutoLocation:()=>Promise<void>|void;
  locationMode:PrayerPlaceMode|'booting';
  autoLocationStatus:DevicePlaceStatus;
  compact?:boolean;
  now:Date;
  timezone?:string;
}){
  const {colors,setMode}=useAppTheme();
  const {width:screenWidth}=useWindowDimensions();
  const small=screenWidth<355;
  const dark=colors.isDark;
  const minute=Math.floor(now.getTime()/60000);
  const localClock=useMemo(()=>{
    const format=(zone:string)=>clockFormat(zone).format(now);
    try{return format(timezone);}
    catch{return format('Europe/Istanbul');}
  },[minute,timezone]);

  const district=place
    ?place.name.toLocaleLowerCase('tr-TR')===place.stateName.toLocaleLowerCase('tr-TR')
      ?'İl merkezi':place.name
    :'İl / ilçe seç';
  // Short, whole messages: the line never ends in "…" on any phone.
  const autoIssue=locationMode==='auto'&&autoLocationStatus!=='active'&&
    autoLocationStatus!=='locating';
  const region=locationMode==='auto'
    ?autoLocationStatus==='active'
      ?'Otomatik · '+(place?.stateName??'Konum')
      :autoLocationStatus==='locating'
        ?'Konum bulunuyor…'
        :autoLocationStatus==='permission-denied'
          ?'Konum izni gerekli'
          :autoLocationStatus==='unlisted'
            ?'İlçeni listeden seç'
            :autoLocationStatus==='location-off'
              ?'Konum kapalı'
              :autoLocationStatus==='precise-needed'
                ?'Hassas konum gerekli'
                :'Konum alınamadı'
    :place?.stateName??'Konum';

  // One tile for the whole row: location, local time, theme and alerts share
  // the same height, corner, border and surface, and sit on one baseline.
  const tile={height:small?54:58,borderRadius:16,borderWidth:1} as const;
  const tileSurface=dark?'rgba(13,47,72,.93)':'rgba(255,255,255,.88)';
  const actionWidth=small?42:46;
  const timeWidth=small?67:76;
  return <View style={{gap:compact?6:7,paddingTop:compact?0:2,marginBottom:2}}>
    {/* The mark's three heads reach the top of its image, so their room is
        explicit padding (not a centred fixed-height box) and nothing clips:
        heads ~22pt under the status bar (14 compact), wordmark ~12pt (10)
        above the location row. */}
    <View style={{alignItems:'center',overflow:'visible',
      paddingTop:compact?5:7,paddingBottom:compact?3:4}}>
      <CamideyizBrandLogo compact={compact}/>
    </View>

    <View style={{flexDirection:'row',alignItems:'center',gap:small?5:7}}>
      <View style={{
        ...tile,flex:1,minWidth:0,
        borderColor:colors.border,backgroundColor:tileSurface,
        paddingHorizontal:small?6:8,alignItems:'center',flexDirection:'row',
        gap:small?5:7,
      }}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={locationMode==='auto'
            ?autoLocationStatus==='unlisted'?'İlçeni listeden seç'
              :autoLocationStatus==='location-off'?'Konumu aç'
              :autoLocationStatus==='precise-needed'?'Hassas konuma izin ver'
              :'Otomatik konumu yeniden bul'
            :'GPS ile konumumu otomatik bul'}
          onPress={()=>{
            // GPS found a district without a calendar of its own: pick one.
            if(locationMode==='auto'&&autoLocationStatus==='unlisted'){
              onOpenLocation();return;
            }
            if(locationMode==='auto'&&autoLocationStatus==='permission-denied'){
              Alert.alert('Konum izni gerekli',
                'İlçeni otomatik bulabilmek için telefonun konum iznine ihtiyacımız var.',
                [{text:'İlçeyi elle seç',onPress:onOpenLocation},
                 {text:'Ayarları aç',onPress:()=>{
                   void Linking.openSettings().catch(()=>undefined);
                 }}]);
              return;
            }
            if(locationMode==='auto'&&autoLocationStatus==='precise-needed'){
              Alert.alert('Hassas konum gerekli',
                'İlçeni doğru bulabilmek için konum izninde hassas konumu aç.',
                [{text:'İlçeyi elle seç',onPress:onOpenLocation},
                 {text:'Ayarları aç',onPress:()=>{
                   void Linking.openSettings().catch(()=>undefined);
                 }},
                 {text:'İzin ver',onPress:()=>{
                   void Promise.resolve(onEnableAutoLocation()).catch(()=>undefined);
                 }}]);
              return;
            }
            // Location off: the tap restarts auto-location, which shows the
            // system "turn on location" sheet.
            void Promise.resolve(onEnableAutoLocation()).catch(()=>{
              Alert.alert('Konum başlatılamadı',
                'Tekrar deneyebilir veya il ve ilçeyi elle seçebilirsin.');
            });
          }}
          hitSlop={6}
          style={{width:small?32:36,height:small?38:40,borderRadius:12,
            alignItems:'center',justifyContent:'center',
            backgroundColor:locationMode==='auto'
              ?(dark?'rgba(28,103,145,.75)':'#E1F4E9'):colors.soft}}>
          <Feather name={locationMode==='auto'?'crosshair':'map-pin'}
            size={17} color={colors.emerald}/>
        </Pressable>
        <Pressable accessibilityRole="button"
          accessibilityLabel={place
            ?place.stateName+' ilinin '+place.name+
              ' namaz vakitleri. İl veya ilçeyi değiştirmek için dokun.'
            :'Namaz vakitleri için il veya ilçe seç'}
          onPress={onOpenLocation}
          hitSlop={{top:7,bottom:7,right:4}}
          style={{flex:1,minWidth:0,flexDirection:'row',
            alignItems:'center',alignSelf:'stretch',gap:3}}>
          <View style={{flex:1,minWidth:0,gap:3}}>
            <Text style={{fontSize:small?10:10.5,lineHeight:small?12.5:13,
              fontWeight:'800',letterSpacing:.1,
              color:autoIssue?colors.gold:colors.muted}}
              numberOfLines={2} adjustsFontSizeToFit minimumFontScale={.85}>{region}</Text>
            <Text style={{fontSize:small?12.5:14,fontWeight:'800',
              color:colors.text}} numberOfLines={1}
              adjustsFontSizeToFit minimumFontScale={.78}>{district}</Text>
          </View>
          <Feather name="chevron-down" size={small?13:15} color={colors.gold}/>
        </Pressable>
      </View>

      <View accessible accessibilityLabel={'Yerel saat '+localClock}
        style={{
          ...tile,width:timeWidth,
          borderColor:dark?'rgba(212,185,126,.46)':'#D6B97E',
          backgroundColor:dark?'rgba(16,48,71,.94)':'#FBF2DE',
          alignItems:'center',justifyContent:'center',gap:4,
          paddingHorizontal:4,
        }}>
        <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
          <Feather name="clock" size={10} color={dark?'#D8BE85':'#88652C'}/>
          <Text numberOfLines={1} style={{
            color:dark?'#DBCBA5':'#88652C',fontSize:small?7:7.7,
            fontWeight:'800',letterSpacing:.35,
          }}>YEREL SAAT</Text>
        </View>
        <Text numberOfLines={1} style={{
          fontVariant:['tabular-nums'],fontSize:small?14:16,
          lineHeight:small?19:21,fontWeight:'900',letterSpacing:.45,
          color:dark?'#FFF0CC':'#64461F',
        }}>{localClock}</Text>
      </View>

      <Pressable accessibilityRole="button"
        accessibilityLabel={dark?'Açık temaya geç':'Koyu temaya geç'}
        onPress={()=>setMode(dark?'light':'dark')}
        style={{...tile,width:actionWidth,
          backgroundColor:tileSurface,borderColor:colors.border,
          alignItems:'center',justifyContent:'center'}}>
        <Feather name={dark?'sun':'moon'} size={19} color={colors.gold}/>
      </Pressable>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Widget ve bildirim ayarları"
        onPress={()=>router.push('/companion')}
        style={{...tile,width:actionWidth,
          backgroundColor:tileSurface,borderColor:colors.border,
          alignItems:'center',justifyContent:'center'}}>
        <Feather name="bell" size={19} color={colors.text}/>
      </Pressable>
    </View>
  </View>;
});
