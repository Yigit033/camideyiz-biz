import {memo} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {type MosqueRecord,formatMosqueDistance} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
import {MosqueCrest} from '@/components/LuxuryArtwork';

export const MosqueCard=memo(function MosqueCard({place,favorite,onOpen,onFavorite}:{
  place:MosqueRecord;favorite:boolean;onOpen:()=>void;onFavorite:()=>void;
}){
  const {colors}=useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={place.name+' cami detayları'}
    onPress={onOpen} style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <View style={[styles.art,{backgroundColor:colors.isDark?'#20473F':'#E3EBE2'}]}>
      <MosqueCrest width={94} dark={colors.isDark}/>
    </View>
    <View style={styles.info}>
      <Text numberOfLines={2} style={{fontFamily:'serif',fontSize:16,fontWeight:'700',
        color:colors.text,lineHeight:21}}>{place.name}</Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
        <Feather name="map-pin" color={colors.gold} size={12}/>
        <Text numberOfLines={1} style={{fontSize:11,color:colors.muted,flex:1}}>
          {place.address??'Konum haritada kayıtlı'}
        </Text>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
        <Text style={{color:colors.emerald,fontWeight:'800',fontSize:12}}>
          {formatMosqueDistance(place.distanceMeters)}
        </Text>
        {place.wheelchair==='yes'||place.wheelchair==='limited'?
          <MaterialCommunityIcons name="wheelchair-accessibility" size={15} color={colors.gold}/>:null}
        {place.commonsFile?<Feather name="image" size={13} color={colors.gold}/>:null}
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={favorite?'Favorilerden kaldır':'Favorilere ekle'}
      onPress={onFavorite} hitSlop={9} style={{padding:5,alignSelf:'flex-start'}}>
      <Feather name="heart" size={20} color={favorite?'#DD7472':colors.muted}/>
    </Pressable>
  </Pressable>;
});
const styles=StyleSheet.create({
  card:{minHeight:112,borderRadius:21,borderWidth:1,padding:10,
    flexDirection:'row',alignItems:'center',gap:12},
  art:{height:86,width:92,borderRadius:16,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  info:{flex:1,gap:7},
});
