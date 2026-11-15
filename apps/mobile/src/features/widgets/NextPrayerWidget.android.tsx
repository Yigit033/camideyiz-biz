import {Column,Text} from '@expo/ui/jetpack-compose';
import {background,cornerRadius,fillMaxSize,paddingAll}
  from '@expo/ui/jetpack-compose/modifiers';
import {createWidget} from 'expo-widgets';

type Props={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;
  times:{key:string;label:string;time:string}[];
};

/** Android widget renderer runs in a separate JS runtime.
 * Keep all values inline and render ONLY supported Expo Compose elements.
 * The clock time is static until the native app refreshes the snapshot.
 */
const NextPrayerWidget=(props:Props)=>{
  'widget';
  return <Column verticalArrangement={{spacedBy:7}}
    modifiers={[fillMaxSize(),background('#073930'),cornerRadius(21),paddingAll(15)]}>
    <Text color="#EACB87" maxLines={1}
      style={{fontSize:15,fontWeight:'bold',fontFamily:'serif'}}>
      ☪  Camideyiz Biz
    </Text>
    <Text color="#A6D6C1" maxLines={1}
      style={{fontSize:12,fontWeight:'normal'}}>
      {props.ready?props.city:'Takvim yüklenmedi'}
    </Text>
    {props.ready
      ?<Column verticalArrangement={{spacedBy:3}}>
        <Text color="#F7F4E7" maxLines={1}
          style={{fontSize:12,fontWeight:'normal'}}>
          Sıradaki vakit · {props.nextName}
        </Text>
        <Text color="#F1D091" maxLines={1}
          style={{fontSize:38,fontWeight:'bold'}}>
          {props.nextTime}
        </Text>
      </Column>
      :<Column verticalArrangement={{spacedBy:7}}>
        <Text color="#F7F0DC" maxLines={2}
          style={{fontSize:21,fontWeight:'bold',fontFamily:'serif'}}>
          Vakitleri yükle
        </Text>
        <Text color="#B6D8C9" maxLines={2} style={{fontSize:11}}>
          Uygulamayı açıp takvimi eşitle
        </Text>
      </Column>}
    {props.ready?<Text color="#9FC6B6" maxLines={1} style={{fontSize:10}}>
      Saat bilgisi · uygulamayı açarak yenile
    </Text>:null}
  </Column>;
};
export default createWidget<Props>('NextPrayerWidget',NextPrayerWidget,{
  ready:false,city:'',dateISO:'',nextName:'',nextTime:'',
  nextAt:0,updatedAt:0,remainingMinutes:0,times:[],
});
