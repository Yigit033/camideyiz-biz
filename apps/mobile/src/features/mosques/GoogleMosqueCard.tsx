import {memo} from 'react';
import {Pressable,Text,View,StyleSheet} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {type GoogleMosque,formatMosqueDistance} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {MosqueCrest} from '@/components/LuxuryArtwork';
export const GoogleMosqueCard=memo(function GoogleMosqueCard({place,favorite,open,toggle}:{
  place:GoogleMosque;favorite:boolean;open:()=>void;toggle:()=>void;
}){
  const {colors}=useAppTheme();
  return <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={place.name+' detayları'}
    style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <View style={[styles.art,{backgroundColor:colors.soft}]}>
      <MosqueCrest width={90} dark={colors.isDark}/>
    </View>
    <View style={{flex:1,gap:8}}>
      <Text numberOfLines={2} style={{color:colors.text,fontFamily:'serif',fontWeight:'700',fontSize:16,lineHeight:22}}>
        {place.name}
      </Text>
      <Text numberOfLines={1} style={{color:colors.muted,fontSize:11}}>
        {place.address??'Google Maps konum kaydı'}
      </Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
        <MaterialCommunityIcons name="google-maps" size={15} color={colors.gold}/>
        <Text style={{color:colors.emerald,fontSize:12,fontWeight:'800'}}>
          {formatMosqueDistance(place.distanceMeters)}
        </Text>
      </View>
    </View>
    <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={favorite?'Favoriden çıkar':'Favorilere ekle'}
      hitSlop={8} style={{padding:7,alignSelf:'flex-start'}}>
      <Feather name="heart" color={favorite?'#DC7474':colors.muted} size={20}/>
    </Pressable>
  </Pressable>;
});
const styles=StyleSheet.create({
  card:{minHeight:107,borderWidth:1,borderRadius:20,padding:10,flexDirection:'row',alignItems:'center',gap:13},
  art:{width:84,height:84,borderRadius:16,alignItems:'center',justifyContent:'center',overflow:'hidden'},
});
