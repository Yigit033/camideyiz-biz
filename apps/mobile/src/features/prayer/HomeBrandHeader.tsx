import {memo,useMemo} from 'react';
import {Alert,Linking,Pressable,Text,View,useWindowDimensions} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {CamideyizBrandLogo} from '@/components/CamideyizBrandLogo';
import {useAppTheme} from '@/theme/ThemeProvider';
import type {PrayerPlaceSelection} from './prayerApi';
import type {PrayerPlaceMode} from './usePrayerSource';
import type {DevicePlaceStatus} from './useDevicePrayerLocation';

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
    const format=(zone:string)=>new Intl.DateTimeFormat('tr-TR',{
      hour:'2-digit',minute:'2-digit',hour12:false,timeZone:zone,
    }).format(now);
    try{return format(timezone);}
    catch{return format('Europe/Istanbul');}
  },[minute,timezone]);

  const district=place
    ?place.name.toLocaleLowerCase('tr-TR')===place.stateName.toLocaleLowerCase('tr-TR')
      ?'İl merkezi':place.name
    :'İl / ilçe seç';
  const region=locationMode==='auto'
    ?autoLocationStatus==='active'
      ?'Otomatik · '+(place?.stateName??'Konum')
      :autoLocationStatus==='locating'
        ?'Konumun bulunuyor…'
        :autoLocationStatus==='permission-denied'
          ?'Konum izni gerekli'
          :'Otomatik konum alınamadı'
    :place?.stateName??'Konum';

  const actionSize=small?42:45;
  const timeSize=small?67:76;
  return <View style={{gap:compact?6:7,paddingTop:compact?0:2,marginBottom:2}}>
    <View style={{alignItems:'center',justifyContent:'center',minHeight:compact?55:63}}>
      <CamideyizBrandLogo compact={compact} horizontal/>
    </View>

    <View style={{flexDirection:'row',alignItems:'center',gap:small?5:7}}>
      <View style={{
        flex:1,minWidth:0,minHeight:61,borderRadius:18,borderWidth:1,
        borderColor:colors.border,
        backgroundColor:dark?'rgba(13,47,72,.93)':'rgba(255,255,255,.88)',
        paddingHorizontal:small?6:8,alignItems:'center',flexDirection:'row',
        gap:small?5:7,
      }}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={locationMode==='auto'
            ?'Otomatik konumu yeniden bul':'GPS ile konumumu otomatik bul'}
          onPress={()=>{
            if(locationMode==='auto'&&autoLocationStatus==='permission-denied'){
              Alert.alert('Konum izni gerekli',
                'İlçeni otomatik bulabilmek için telefonun konum iznine ihtiyacımız var.',
                [{text:'İlçeyi elle seç',onPress:onOpenLocation},
                 {text:'Ayarları aç',onPress:()=>{
                   void Linking.openSettings().catch(()=>undefined);
                 }}]);
              return;
            }
            void Promise.resolve(onEnableAutoLocation()).catch(()=>{
              Alert.alert('Konum başlatılamadı',
                'Tekrar deneyebilir veya il ve ilçeyi elle seçebilirsin.');
            });
          }}
          hitSlop={6}
          style={{width:small?32:36,height:40,borderRadius:12,
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
            alignItems:'center',minHeight:58,gap:3}}>
          <View style={{flex:1,minWidth:0,gap:4}}>
            <Text style={{fontSize:small?9:9.5,color:colors.muted,fontWeight:'700'}}
              numberOfLines={1}>{region}</Text>
            <Text style={{fontSize:small?12.5:14,fontWeight:'800',
              color:colors.text}} numberOfLines={1}
              adjustsFontSizeToFit minimumFontScale={.78}>{district}</Text>
          </View>
          <Feather name="chevron-down" size={small?13:15} color={colors.gold}/>
        </Pressable>
      </View>

      <View accessible accessibilityLabel={'Yerel saat '+localClock}
        style={{
          width:timeSize,minHeight:61,borderRadius:17,borderWidth:1,
          borderColor:dark?'rgba(212,185,126,.46)':'#D6B97E',
          backgroundColor:dark?'rgba(44,50,37,.93)':'#FBF2DE',
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
        style={{width:actionSize,height:actionSize,borderRadius:15,
          borderWidth:1,backgroundColor:colors.surface,borderColor:colors.border,
          alignItems:'center',justifyContent:'center'}}>
        <Feather name={dark?'sun':'moon'} size={19} color={colors.gold}/>
      </Pressable>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Widget ve bildirim ayarları"
        onPress={()=>router.push('/companion')}
        style={{width:actionSize,height:actionSize,borderRadius:15,
          borderWidth:1,backgroundColor:colors.surface,borderColor:colors.border,
          alignItems:'center',justifyContent:'center'}}>
        <Feather name="bell" size={19} color={colors.text}/>
      </Pressable>
    </View>
  </View>;
});
