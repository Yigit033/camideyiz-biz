import {useMemo,useState} from 'react';
import {FlatList,Pressable,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {religiousDaysFrom,RELIGIOUS_DAYS,zonedClock,type ReligiousDay,
  type ReligiousDayKind} from '@camideyiz/core';
import {useAppTheme} from '@/theme/ThemeProvider';
type Filter='yaklasan'|'2026'|'2027';
type Kind='hepsi'|'kandil'|'bayram'|'diger';
const months=new Intl.DateTimeFormat('tr-TR',{month:'short',timeZone:'UTC'});
const weekday=new Intl.DateTimeFormat('tr-TR',{weekday:'long',timeZone:'UTC'});
function format(iso:string){return new Date(iso+'T12:00:00Z');}
function kindName(kind:ReligiousDayKind){
 return kind==='kandil'?'Kandil / Gece':kind==='bayram'?'Bayram':
   kind==='arefe'?'Arefe':kind==='baslangic'?'Başlangıç':'Özel Gün';
}
export default function ReligiousDaysScreen(){
 const {colors}=useAppTheme();
 const current=zonedClock(new Date(),'Europe/Istanbul').dateISO;
 const [filter,setFilter]=useState<Filter>('yaklasan');
 const [kind,setKind]=useState<Kind>('hepsi');
 const [selected,setSelected]=useState<string|null>(null);
 const events=useMemo(()=>{
   const group=filter==='yaklasan'
     ?religiousDaysFrom(current)
     :RELIGIOUS_DAYS.filter(e=>e.dateISO.startsWith(filter+'-'));
   return group.filter(e=>kind==='hepsi'||(kind==='diger'
     ?e.kind!=='bayram'&&e.kind!=='kandil':e.kind===kind));
 },[filter,kind,current]);
 return <SafeAreaView edges={['top','bottom']}
   style={{flex:1,backgroundColor:colors.canvas}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,
     paddingTop:12,paddingBottom:12,borderBottomWidth:1,borderBottomColor:colors.border}}>
     <Pressable accessibilityRole="button" accessibilityLabel="Geri dön"
       onPress={()=>router.back()} style={{height:43,width:43,borderRadius:14,
         borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,
         alignItems:'center',justifyContent:'center'}}>
       <Feather name="arrow-left" size={20} color={colors.text}/>
     </Pressable>
     <View style={{flex:1,gap:3}}>
       <Text style={{fontSize:21,fontFamily:'serif',fontWeight:'800',color:colors.text}}>
         Dini Günler ve Geceler
       </Text>
       <Text style={{fontSize:11,color:colors.muted}}>Diyanet Vakit Hesaplama · 2026–2027</Text>
     </View>
     <MaterialCommunityIcons name="moon-waning-crescent" size={24} color={colors.gold}/>
   </View>
   <FlatList data={events} keyExtractor={e=>e.id}
     initialNumToRender={9} maxToRenderPerBatch={10}
     contentContainerStyle={{padding:14,paddingBottom:42}}
     ListHeaderComponent={<View style={{gap:11,marginBottom:14}}>
       <View style={{flexDirection:'row',gap:7}}>
         {([['yaklasan','Yaklaşan'],['2026','2026'],['2027','2027']] as const)
           .map(([id,label])=><Pressable key={id} accessibilityRole="button"
             accessibilityState={{selected:filter===id}}
             onPress={()=>{setFilter(id);setSelected(null);}}
             style={{flex:1,minHeight:42,justifyContent:'center',alignItems:'center',
               borderRadius:13,borderWidth:1,borderColor:filter===id?colors.gold:colors.border,
               backgroundColor:filter===id?colors.soft:colors.surface}}>
             <Text style={{fontWeight:'800',fontSize:12,
               color:filter===id?colors.gold:colors.text}}>{label}</Text>
           </Pressable>)}
       </View>
       <View style={{flexDirection:'row',gap:5,flexWrap:'wrap'}}>
         {([['hepsi','Tümü'],['kandil','Kandiller'],['bayram','Bayramlar'],['diger','Diğer']] as const)
           .map(([id,label])=><Pressable key={id}
             accessibilityRole="button" accessibilityState={{selected:kind===id}}
             onPress={()=>setKind(id)}
             style={{paddingHorizontal:11,paddingVertical:8,borderRadius:22,
               backgroundColor:kind===id?colors.accentStrong:colors.surface,
               borderWidth:1,borderColor:kind===id?colors.accentStrong:colors.border}}>
             <Text style={{fontSize:11,fontWeight:'700',
               color:kind===id?'#FFFFFF':colors.text}}>{label}</Text>
           </Pressable>)}
       </View>
       <Text style={{fontSize:11,color:colors.muted,lineHeight:17}}>
         Kandil geceleri, takvimde belirtilen günün akşamında idrak edilir.
       </Text>
     </View>}
     ListEmptyComponent={<View style={{padding:22,alignItems:'center',gap:9}}>
       <Feather name="calendar" size={27} color={colors.gold}/>
       <Text style={{fontSize:13,color:colors.text,textAlign:'center'}}>
         Bu filtrede dini gün bulunmuyor.
       </Text>
     </View>}
     renderItem={({item})=>{
       const active=selected===item.id;
       const day=format(item.dateISO);
       const future=item.dateISO>=current;
       return <View style={{borderRadius:17,backgroundColor:colors.surface,
         borderWidth:1,borderColor:active?colors.gold:colors.border,
         padding:12,marginBottom:9,gap:10}}>
         <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
           <Pressable accessibilityRole="button"
             accessibilityState={{expanded:active}}
             accessibilityLabel={item.title+', '+item.dateISO}
             onPress={()=>setSelected(old=>old===item.id?null:item.id)}
             style={{flex:1,flexDirection:'row',alignItems:'center',gap:12}}>
             <View style={{width:58,minHeight:66,borderRadius:13,alignItems:'center',
               justifyContent:'center',backgroundColor:colors.soft,gap:2}}>
               <Text style={{fontSize:23,fontWeight:'800',color:colors.gold}}>
                 {item.dateISO.slice(8,10)}
               </Text>
               <Text style={{fontSize:10,fontWeight:'800',color:colors.muted}}>
                 {months.format(day).toLocaleUpperCase('tr-TR')}
               </Text>
             </View>
             <View style={{flex:1,gap:5}}>
               <Text style={{fontSize:14.5,fontWeight:'800',color:colors.text}}>{item.title}</Text>
               <Text style={{fontSize:11,color:colors.muted}}>
                 {weekday.format(day)} · {item.dateISO.slice(0,4)} · {kindName(item.kind)}
               </Text>
               <Text style={{fontSize:10.5,color:future?colors.gold:colors.muted}}>
                 {item.night?'Akşam idrak edilir':item.hijri}
               </Text>
             </View>
             <Feather name={active?'chevron-up':'chevron-down'} color={colors.gold} size={17}/>
           </Pressable>
           {/* Sibling, not nested: TalkBack reaches it as its own button. */}
           <Pressable accessibilityRole="button"
             accessibilityLabel={item.title+' için paylaşım kartı hazırla'}
             hitSlop={4}
             onPress={()=>router.push({pathname:'/religious-day-share',params:{id:item.id}})}
             style={({pressed})=>({width:42,height:42,borderRadius:13,borderWidth:1,
               borderColor:colors.border,backgroundColor:pressed?colors.elevated:colors.soft,
               alignItems:'center',justifyContent:'center'})}>
             <Feather name="share-2" size={17} color={colors.gold}/>
           </Pressable>
         </View>
         {active?<View style={{gap:10,borderTopColor:colors.border,borderTopWidth:1,paddingTop:12}}>
           <Text style={{fontSize:12,color:colors.text,lineHeight:19}}>{item.note}</Text>
           <Text style={{fontSize:11,color:colors.muted}}>{item.hijri}</Text>
         </View>:null}
       </View>;
     }}
   />
 </SafeAreaView>;
}
