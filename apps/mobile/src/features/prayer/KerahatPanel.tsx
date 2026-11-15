import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {
  formatWindowClock,kerahatWindowLabel,
  type KerahatKind,type KerahatView,type KerahatSettings,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';

const WINDOWS:{key:KerahatKind;icon:'weather-sunset-up'|'white-balance-sunny'|'weather-sunset-down';caption:string}[]=[
  {key:'sunrise',icon:'weather-sunset-up',caption:'Güneş doğuşu'},
  {key:'zenith',icon:'white-balance-sunny',caption:'Öğle öncesi'},
  {key:'sunset',icon:'weather-sunset-down',caption:'Gün batımı'},
];

/** Informational panel only. Editing is deliberately located under
 * Diğer > Ayarlar > Kerahat vakitleri, not on the Home page. */
export function KerahatPanel({view,settings,locationName}:{
  view:KerahatView;settings:KerahatSettings;locationName:string;
}){
  const {colors}=useAppTheme();
  const dark=colors.isDark;
  const enabled=settings.mode!=='hidden';
  const current=view.active;
  const next=view.next;
  const openGuide=(tab:'heavy'|'light')=>router.push({
    pathname:'/kerahat-guide',params:{tab},
  });
  return <View style={[styles.panel,{
    backgroundColor:dark?'rgba(8,52,46,.89)':'rgba(255,252,241,.94)',
    borderColor:current?'#E2AA67':colors.border,
  }]}>
    <View style={styles.heading}>
      <View style={[styles.symbol,{backgroundColor:dark?'#56402D':'#F7E4C5'}]}>
        <MaterialCommunityIcons name="weather-sunset" size={21}
          color={dark?'#F3C385':'#9C6632'}/>
      </View>
      <View style={{flex:1,gap:3}}>
        <Text style={{fontFamily:'serif',color:colors.text,fontSize:17,fontWeight:'700'}}>
          Kerahat Vakitleri
        </Text>
        <Text style={{fontSize:10.5,color:colors.muted,lineHeight:16}}>
          {locationName} · Yayımlanmış namaz vakitlerinden türetilen yaklaşık aralıklar
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Kerahat vakitleri hakkında bilgi"
        onPress={()=>openGuide('heavy')} hitSlop={9}
        style={[styles.infoIcon,{borderColor:colors.border,backgroundColor:colors.soft}]}>
        <Feather name="info" color={colors.gold} size={17}/>
      </Pressable>
    </View>
    {enabled&&view.windows.length>0
      ?<View style={styles.cards}>
        {WINDOWS.map(entry=>{
          const window=view.windows.find(item=>item.kind===entry.key);
          if(!window)return null;
          const active=current?.kind===entry.key;
          return <Pressable key={entry.key} accessibilityRole="button"
            accessibilityLabel={kerahatWindowLabel(entry.key)+' · '+
              formatWindowClock(window.startSeconds)+' ile '+
              formatWindowClock(window.endSeconds)}
            onPress={()=>openGuide('heavy')}
            style={[styles.card,{
              borderColor:active?'#EAAB83':colors.border,
              backgroundColor:active?(dark?'#5A3330':'#FAE6D5'):colors.soft,
            }]}>
            <View style={[styles.iconHalo,{
              backgroundColor:active?'rgba(215,105,87,.22)':'rgba(203,161,90,.14)',
            }]}>
              <MaterialCommunityIcons name={entry.icon} size={19}
                color={active?'#E79073':colors.gold}/>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit
              style={{fontSize:10,fontWeight:'700',color:colors.text}}>
              {entry.caption}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit
              style={{fontSize:11,fontWeight:'800',color:active?(dark?'#FFCFAC':'#A75A42'):colors.text}}>
              {formatWindowClock(window.startSeconds)}
            </Text>
            <View style={{height:1,width:'60%',backgroundColor:colors.gold,opacity:.4}}/>
            <Text numberOfLines={1} adjustsFontSizeToFit
              style={{fontSize:11,fontWeight:'700',color:colors.muted}}>
              {formatWindowClock(window.endSeconds)}
            </Text>
          </Pressable>;
        })}
      </View>
      :<View style={[styles.empty,{backgroundColor:colors.soft}]}>
        <Feather name={enabled?'clock':'eye-off'} size={17} color={colors.gold}/>
        <Text style={{flex:1,fontSize:11,lineHeight:18,color:colors.muted}}>
          {enabled?'Güncel ilçe takvimi doğrulanınca yaklaşık aralıklar gösterilir.'
            :'Kerahat halkası ayarlardan gizlenmiş. Namaz saatleri etkilenmez.'}
        </Text>
      </View>}
    {enabled&&view.windows.length>0?<View style={styles.status}>
      <Feather name={current?'alert-triangle':next?'clock':'check-circle'}
        size={14} color={current?'#DA8379':colors.emerald}/>
      <Text style={{fontSize:10.5,color:colors.muted,flex:1,lineHeight:16}}>
        {current?'Şu an yaklaşık '+kerahatWindowLabel(current.kind)+' aralığı'
          :next?'Sıradaki yaklaşık aralık: '+kerahatWindowLabel(next.kind)
            :'Bugünün yaklaşık aralıkları tamamlandı'}
      </Text>
    </View>:null}
    <View style={styles.guideRow}>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Ağır kerahat vakitleri rehberini aç"
        onPress={()=>openGuide('heavy')}
        style={[styles.guideButton,{borderColor:colors.border,
          backgroundColor:dark?'#57352F':'#FBE9E1'}]}>
        <MaterialCommunityIcons name="weather-sunset" size={19}
          color={dark?'#F3B59D':'#A75743'}/>
        <View style={{flex:1,gap:2}}>
          <Text style={{fontSize:12,fontWeight:'800',color:colors.text}}>
            Ağır Kerahat
          </Text>
          <Text style={{fontSize:10,color:colors.muted}}>3 temel zaman</Text>
        </View>
        <Feather name="chevron-right" size={15} color={colors.gold}/>
      </Pressable>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Hafif kerahat vakitleri rehberini aç"
        onPress={()=>openGuide('light')}
        style={[styles.guideButton,{borderColor:colors.border,
          backgroundColor:dark?'#123F41':'#E7F5F1'}]}>
        <MaterialCommunityIcons name="information-outline" size={20}
          color={dark?'#68D4CC':'#168D8B'}/>
        <View style={{flex:1,gap:2}}>
          <Text style={{fontSize:12,fontWeight:'800',color:colors.text}}>
            Hafif Kerahat
          </Text>
          <Text style={{fontSize:10,color:colors.muted}}>Nâfile kısıtları</Text>
        </View>
        <Feather name="chevron-right" size={15} color={colors.gold}/>
      </Pressable>
    </View>

  </View>;
}
const styles=StyleSheet.create({
  panel:{borderWidth:1,borderRadius:20,padding:13,gap:11,width:'100%'},
  heading:{flexDirection:'row',alignItems:'center',gap:10},
  symbol:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center'},
  infoIcon:{width:34,height:34,borderRadius:12,borderWidth:1,alignItems:'center',justifyContent:'center'},
  cards:{flexDirection:'row',gap:7},
  card:{flex:1,minWidth:0,borderWidth:1,borderRadius:14,
    alignItems:'center',justifyContent:'center',paddingHorizontal:5,
    paddingVertical:10,gap:5},
  iconHalo:{height:32,width:32,borderRadius:12,alignItems:'center',justifyContent:'center'},
  empty:{flexDirection:'row',alignItems:'center',gap:9,padding:12,borderRadius:13},
  status:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:3},
  guideRow:{flexDirection:'row',gap:8},
  guideButton:{flex:1,minWidth:0,alignItems:'center',flexDirection:'row',
    gap:7,minHeight:69,paddingHorizontal:9,borderWidth:1,borderRadius:14},
});
