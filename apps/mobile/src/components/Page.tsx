import {type PropsWithChildren} from 'react';
import {ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useAppTheme} from '@/theme/ThemeProvider';
export function Page({title,subtitle,children}:PropsWithChildren<{title:string;subtitle?:string}>){
  const {colors}=useAppTheme();
  return <SafeAreaView edges={['top']} style={[styles.safe,{backgroundColor:colors.canvas}]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title,{color:colors.text}]}>{title}</Text>
      {subtitle?<Text style={[styles.subtitle,{color:colors.muted}]}>{subtitle}</Text>:null}
      <View style={{gap:16,marginTop:20}}>{children}</View>
    </ScrollView>
  </SafeAreaView>;
}
export function Panel({children}:PropsWithChildren){
  const {colors}=useAppTheme();
  return <View style={[styles.panel,{backgroundColor:colors.surface,borderColor:colors.border}]}>{children}</View>;
}
const styles=StyleSheet.create({
  safe:{flex:1},content:{paddingHorizontal:22,paddingTop:22,paddingBottom:48},
  title:{fontSize:30,fontWeight:'700',letterSpacing:-.7},
  subtitle:{fontSize:14,marginTop:8,lineHeight:21},
  panel:{borderRadius:22,borderWidth:1,padding:20,gap:12}
});
