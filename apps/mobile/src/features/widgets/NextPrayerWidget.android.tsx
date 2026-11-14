import {Column,Text} from '@expo/ui/jetpack-compose';
import {background,cornerRadius,fillMaxSize,paddingAll} from '@expo/ui/jetpack-compose/modifiers';
import {createWidget} from 'expo-widgets';

type Props={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;
  times:{key:string;label:string;time:string}[];
};

const NextPrayerWidget=(props:Props)=>{
  'widget';
  return <Column
    verticalArrangement={{spacedBy:2}}
    modifiers={[fillMaxSize(),background('#07372F'),cornerRadius(17),paddingAll(9)]}>
    <Text color="#F1CD89" style={{fontSize:12,fontWeight:'bold',fontFamily:'serif'}}>
      ☪  Camideyiz Biz
    </Text>
    <Text color="#B2E0C9" maxLines={1}
      style={{fontSize:11}}>{props.ready?props.city:'Konum seç'}</Text>
    <Text color="#F7F0DE" style={{fontSize:12,fontWeight:'bold'}}>
      {props.ready?'Sıradaki · '+props.nextName:'Takvim verisi bekleniyor'}
    </Text>
    <Text color="#F3CB83" style={{fontSize:25,fontWeight:'bold'}}>
      {props.ready?props.nextTime:'—'}
    </Text>
    <Text color="#B5D9CC" maxLines={2} style={{fontSize:9}}>
      {props.ready
        ?'Son yenileme: '+props.remainingMinutes+' dk kalmıştı'
        :'Gerçek saatler için uygulamayı aç'}
    </Text>
  </Column>;
};
export default createWidget<Props>('NextPrayerWidget',NextPrayerWidget,{
  ready:false,city:'Konum seç',dateISO:'',nextName:'',nextTime:'',
  nextAt:0,updatedAt:0,remainingMinutes:0,times:[],
});
