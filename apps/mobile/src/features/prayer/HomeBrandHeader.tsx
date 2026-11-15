import {memo,useMemo} from 'react';
import {Alert,Linking,Pressable,Text,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {CamideyizBrandLogo} from '@/components/CamideyizBrandLogo';
import {useAppTheme} from '@/theme/ThemeProvider';
import type {PrayerPlaceSelection} from './prayerApi';
import type {PrayerPlaceMode} from './usePrayerSource';
import type {DevicePlaceStatus} from './useDevicePrayerLocation';

/** The logo is the FIRST visual row. Location and system actions are beneath
 * it, rather than competing with the mark in a three-column header.
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
  const dark=colors.isDark;
  const minute=Math.floor(now.getTime()/60000);
  const localClock=useMemo(()=>{
    try{return new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit',
      hour12:false,timeZone:timezone}).format(now);}
    catch{return new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit',
      hour12:false,timeZone:'Europe/Istanbul'}).format(now);}
  },[minute,timezone]);
  const district=place
    ?place.name.toLocaleLowerCase('tr-TR')===place.stateName.toLocaleLowerCase('tr-TR')
      ?'İl merkezi takvimi':place.name
    :'İl ve ilçe seç';
  return <View style={{gap:compact?6:7,paddingTop:compact?0:2,marginBottom:2}}>
    <View style={{alignItems:'center',justifyContent:'center',minHeight:compact?74:90}}>
      <CamideyizBrandLogo compact={compact}/>
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <View style={{flex:1,minWidth:0,minHeight:61,borderRadius:18,borderWidth:1,
        borderColor:colors.border,
        backgroundColor:dark?'rgba(7,48,43,.89)':'rgba(255,255,255,.85)',
        paddingHorizontal:8,alignItems:'center',flexDirection:'row',gap:8}}>
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
          style={{width:39,height:42,borderRadius:13,
            alignItems:'center',justifyContent:'center',
            backgroundColor:locationMode==='auto'?
              (dark?'rgba(35,107,85,.7)':'#E1F4E9'):colors.soft}}>
          <Feather name={locationMode==='auto'?'crosshair':'map-pin'}
            size={17} color={colors.emerald}/>
        </Pressable>
        <Pressable accessibilityRole="button"
          accessibilityLabel={place
            ?place.stateName+' ilinin '+place.name+
              ' takvimi. Yerel saat '+localClock+'. İl ve ilçeyi elle değiştirmek için dokun.'
            :'Namaz vakitleri için il ve ilçeyi elle seç'}
          onPress={onOpenLocation}
          style={{flex:1,minWidth:0,flexDirection:'row',
            alignItems:'center',height:'100%',gap:5}}>
          <View style={{flex:1,minWidth:0,gap:4}}>
            <Text style={{fontSize:10,color:colors.muted,fontWeight:'700'}}
              numberOfLines={1}>
              {locationMode==='auto'
                ?autoLocationStatus==='active'
                  ?'Otomatik · '+(place?.stateName??'Konum')
                  :autoLocationStatus==='locating'
                    ?'Konumun bulunuyor…'
                    :autoLocationStatus==='permission-denied'
                      ?'Konum izni gerekli'
                      :'Otomatik konum alınamadı'
                :place?.stateName??'Konum'}
            </Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
              <Text style={{fontSize:14,fontWeight:'800',color:colors.text,
                flex:1,minWidth:0}} numberOfLines={1} adjustsFontSizeToFit>
                {district}
              </Text>
              <Text accessibilityLabel={'Yerel saat '+localClock}
                style={{fontVariant:['tabular-nums'],fontSize:12.5,
                  fontWeight:'800',color:colors.gold,
                  paddingHorizontal:7,paddingVertical:4,borderRadius:8,
                  backgroundColor:colors.soft}}>
                {localClock}
              </Text>
            </View>
          </View>
          <Feather name="chevron-down" size={15} color={colors.gold}/>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={dark?'Açık temaya geç':'Koyu temaya geç'}
        onPress={()=>setMode(dark?'light':'dark')}
        style={{width:46,height:46,borderRadius:15,borderWidth:1,
          backgroundColor:colors.surface,borderColor:colors.border,
          alignItems:'center',justifyContent:'center'}}>
        <Feather name={dark?'sun':'moon'} size={19} color={colors.gold}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Widget ve bildirim ayarları"
        onPress={()=>router.push('/companion')}
        style={{width:46,height:46,borderRadius:15,borderWidth:1,
          backgroundColor:colors.surface,borderColor:colors.border,
          alignItems:'center',justifyContent:'center'}}>
        <Feather name="bell" size={19} color={colors.text}/>
      </Pressable>
    </View>
  </View>;
});
