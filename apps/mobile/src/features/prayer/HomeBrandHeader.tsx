import {memo} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {CamideyizBrandLogo} from '@/components/CamideyizBrandLogo';
import {useAppTheme} from '@/theme/ThemeProvider';
import type {PrayerPlaceSelection} from './prayerApi';

/** The logo is the FIRST visual row. Location and system actions are beneath
 * it, rather than competing with the mark in a three-column header.
 */
export const HomeBrandHeader=memo(function HomeBrandHeader({
  place,onOpenLocation,compact=false,
}:{
  place:PrayerPlaceSelection|null;
  onOpenLocation:()=>void;
  compact?:boolean;
}){
  const {colors,setMode}=useAppTheme();
  const dark=colors.isDark;
  const district=place
    ?place.name.toLocaleLowerCase('tr-TR')===place.stateName.toLocaleLowerCase('tr-TR')
      ?'İl merkezi takvimi':place.name
    :'İl ve ilçe seç';
  return <View style={{gap:compact?6:8,paddingTop:compact?1:4,marginBottom:3}}>
    <View style={{alignItems:'center',justifyContent:'center',minHeight:compact?96:115}}>
      <CamideyizBrandLogo compact={compact}/>
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <Pressable accessibilityRole="button"
        accessibilityLabel={place
          ?place.stateName+' ilinin '+place.name+' takvimi. İl veya ilçeyi değiştir.'
          :'Namaz vakitleri için il ve ilçe seç'}
        onPress={onOpenLocation}
        style={{flex:1,minWidth:0,height:49,borderRadius:16,borderWidth:1,
          borderColor:colors.border,
          backgroundColor:dark?'rgba(7,48,43,.89)':'rgba(255,255,255,.85)',
          paddingHorizontal:11,alignItems:'center',flexDirection:'row',gap:9}}>
        <View style={{width:31,height:31,borderRadius:11,alignItems:'center',
          justifyContent:'center',backgroundColor:colors.soft}}>
          <Feather name="map-pin" size={16} color={colors.emerald}/>
        </View>
        <View style={{flex:1,minWidth:0,gap:2}}>
          <Text style={{fontSize:9.5,color:colors.muted,fontWeight:'700'}}>
            {place?place.stateName:'Konum'}
          </Text>
          <Text style={{fontSize:13,fontWeight:'800',color:colors.text}}
            numberOfLines={1} adjustsFontSizeToFit>
            {district}
          </Text>
        </View>
        <Feather name="chevron-down" size={15} color={colors.gold}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={dark?'Açık temaya geç':'Koyu temaya geç'}
        onPress={()=>setMode(dark?'light':'dark')}
        style={{width:43,height:43,borderRadius:15,borderWidth:1,
          backgroundColor:colors.surface,borderColor:colors.border,
          alignItems:'center',justifyContent:'center'}}>
        <Feather name={dark?'sun':'moon'} size={19} color={colors.gold}/>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Widget ve bildirim ayarları"
        onPress={()=>router.push('/companion')}
        style={{width:43,height:43,borderRadius:15,borderWidth:1,
          backgroundColor:colors.surface,borderColor:colors.border,
          alignItems:'center',justifyContent:'center'}}>
        <Feather name="bell" size={19} color={colors.text}/>
      </Pressable>
    </View>
  </View>;
});
