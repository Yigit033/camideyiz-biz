import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {
  formatWindowClock,kerahatWindowLabel,kerahatRingWindows,
  type KerahatKind,type KerahatView,type KerahatSettings,
} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';

const WINDOWS:{
  key:KerahatKind;
  icon:'weather-sunset-up'|'white-balance-sunny'|'weather-sunset-down';
  title:string;
}[]=[
  {key:'sunrise',icon:'weather-sunset-up',title:'Güneş doğuşu'},
  {key:'zenith',icon:'white-balance-sunny',title:'Öğle öncesi'},
  {key:'sunset',icon:'weather-sunset-down',title:'Gün batımı'},
];

/** The three bands are adjustable *approximate* guides, NOT an assertion
 * about whether an individual prayer is permissible. Detail stays in the
 * Heavy/Light guides; three compact range cards show individual states.
 * The redundant 'Bugünün aralıkları' status card is intentionally removed.
 */
export function KerahatPanel({view,settings,locationName,secondsOfDay}:{
  view:KerahatView;settings:KerahatSettings;
  locationName:string;secondsOfDay:number;
}){
  const {colors}=useAppTheme();
  const dark=colors.isDark;
  const enabled=settings.mode!=='hidden';
  const bands=kerahatRingWindows(view.windows,secondsOfDay);
  const active=bands.find(w=>w.state==='active')??null;
  const approaching=bands.find(w=>w.state==='approaching')??null;
  const showBands=enabled&&bands.length>0;
  const openGuide=(tab:'heavy'|'light')=>router.push({
    pathname:'/kerahat-guide',params:{tab},
  });

  return <View style={[styles.panel,{
    backgroundColor:dark?'rgba(16,48,71,.94)':'rgba(255,252,244,.97)',
    borderColor:active?'#9C4354':approaching?'#B59460':colors.border,
  }]}>
    <View style={styles.heading}>
      <View style={[styles.symbol,{
        backgroundColor:active?(dark?'#65363C':'#F3E0DC')
          :dark?'#463C2E':'#F4E8D3',
      }]}>
        <MaterialCommunityIcons name="weather-sunset" size={21}
          color={active?'#DC8E90':dark?'#E8C18A':'#A2733C'}/>
      </View>
      <View style={{flex:1,gap:3}}>
        <Text style={[styles.title,{color:colors.text}]}>Kerahat Vakitleri</Text>
        <Text style={[styles.subtitle,{color:colors.muted}]}>
          {locationName} · Yaklaşık zaman aralıkları
        </Text>
      </View>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Kerahat vakitleri rehberini aç"
        onPress={()=>openGuide('heavy')} hitSlop={10}
        style={[styles.infoIcon,{
          borderColor:colors.border,backgroundColor:colors.soft,
        }]}>
        <Feather name="book-open" color={colors.gold} size={17}/>
      </Pressable>
    </View>

    {showBands?<View style={styles.cards}>
      {WINDOWS.map(entry=>{
        const band=bands.find(w=>w.kind===entry.key);
        if(!band)return null;
        const isActive=band.state==='active';
        const isNear=band.state==='approaching';
        const accent=isActive?(dark?'#F0A4A3':'#A1394B')
          :isNear?(dark?'#EBC183':'#986B31'):colors.gold;
        const background=isActive
          ?dark?'rgba(133,49,68,.31)':'#F9EBE5'
          :isNear?dark?'rgba(163,113,50,.21)':'#FAF1DF'
            :colors.soft;
        return <Pressable key={entry.key} accessibilityRole="button"
          accessibilityLabel={kerahatWindowLabel(entry.key)+' · yaklaşık '+
            formatWindowClock(band.startSeconds)+' ile '+
            formatWindowClock(band.endSeconds)+
            (isActive?' · şu an bu aralıkta':isNear?' · yaklaşıyor':'')}
          onPress={()=>openGuide('heavy')}
          style={[styles.card,{
            backgroundColor:background,
            borderColor:isActive||isNear?accent:colors.border,
            borderWidth:isActive?1.6:1,
          }]}>
          <View style={[styles.iconHalo,{
            backgroundColor:isActive?'rgba(193,85,93,.17)':
              isNear?'rgba(204,155,79,.18)':'rgba(192,156,93,.13)',
          }]}>
            <MaterialCommunityIcons name={entry.icon} size={18} color={accent}/>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={[styles.caption,{color:colors.text}]}>
            {entry.title}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit
            style={[styles.hours,{color:isActive||isNear?accent:colors.text}]}>
            {formatWindowClock(band.startSeconds)}–{formatWindowClock(band.endSeconds)}
          </Text>
          <View style={[styles.bandFoot,{
            backgroundColor:isActive?'#9B3546':isNear?'#C9904B':colors.gold,
            opacity:isActive||isNear?1:.32,
          }]}/>
        </Pressable>;
      })}
    </View>:<View style={[styles.empty,{backgroundColor:colors.soft}]}>
      <Feather name={enabled?'clock':'eye-off'} size={17} color={colors.gold}/>
      <Text style={{flex:1,fontSize:11,lineHeight:18,color:colors.muted}}>
        {enabled?'İlçenin güncel takvimi alındığında aralıklar gösterilir.'
          :'Kerahat halkası ayarlardan gizlenmiş.'}
      </Text>
    </View>}

    <View style={styles.guideRow}>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Ağır kerahat vakitleri rehberini aç"
        onPress={()=>openGuide('heavy')}
        style={[styles.guideButton,{
          borderColor:colors.border,
          backgroundColor:dark?'#493334':'#F9ECE7',
        }]}>
        <MaterialCommunityIcons name="weather-sunset" size={19}
          color={dark?'#EEC1AC':'#9B564C'}/>
        <Text style={[styles.guideText,{color:colors.text}]}>
          Ağır Kerahat
        </Text>
        <Feather name="chevron-right" size={15} color={colors.gold}/>
      </Pressable>
      <Pressable accessibilityRole="button"
        accessibilityLabel="Hafif kerahat vakitleri rehberini aç"
        onPress={()=>openGuide('light')}
        style={[styles.guideButton,{
          borderColor:colors.border,
          backgroundColor:dark?'#17415C':'#E7F5F1',
        }]}>
        <MaterialCommunityIcons name="information-outline" size={19}
          color={dark?'#6CCCF7':'#168D8B'}/>
        <Text style={[styles.guideText,{color:colors.text}]}>
          Hafif Kerahat
        </Text>
        <Feather name="chevron-right" size={15} color={colors.gold}/>
      </Pressable>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  panel:{borderWidth:1.1,borderRadius:22,padding:13,gap:11,width:'100%'},
  heading:{flexDirection:'row',alignItems:'center',gap:10},
  symbol:{width:41,height:41,borderRadius:14,alignItems:'center',justifyContent:'center'},
  title:{fontFamily:'serif',fontSize:18,fontWeight:'800'},
  subtitle:{fontSize:10.5,lineHeight:16},
  infoIcon:{width:36,height:36,borderRadius:13,borderWidth:1,alignItems:'center',justifyContent:'center'},
  cards:{flexDirection:'row',gap:7},
  card:{flex:1,minWidth:0,borderRadius:14,
    alignItems:'center',justifyContent:'center',paddingHorizontal:3,
    paddingTop:9,paddingBottom:8,gap:7},
  iconHalo:{height:31,width:31,borderRadius:11,alignItems:'center',justifyContent:'center'},
  caption:{fontSize:11,fontWeight:'700',textAlign:'center'},
  hours:{fontSize:10.8,fontWeight:'800',fontVariant:['tabular-nums'],textAlign:'center'},
  bandFoot:{height:3,width:'67%',borderRadius:6,marginTop:1},
  empty:{flexDirection:'row',alignItems:'center',gap:9,padding:12,borderRadius:13},
  guideRow:{flexDirection:'row',gap:8},
  guideButton:{flex:1,minWidth:0,alignItems:'center',flexDirection:'row',
    gap:6,minHeight:48,paddingHorizontal:9,borderWidth:1,borderRadius:13},
  guideText:{flex:1,fontSize:11.5,fontWeight:'800'},
});
