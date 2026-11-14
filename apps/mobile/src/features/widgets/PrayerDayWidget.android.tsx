import {Column,Row,Text} from '@expo/ui/jetpack-compose';
import {background,cornerRadius,fillMaxSize,fillMaxWidth,paddingAll}
  from '@expo/ui/jetpack-compose/modifiers';
import {createWidget} from 'expo-widgets';

type Props={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;
  times:{key:string;label:string;time:string}[];
};

const PrayerDayWidget=(props:Props)=>{
  'widget';
  return <Column verticalArrangement={{spacedBy:6}}
    modifiers={[fillMaxSize(),background('#063930'),cornerRadius(19),paddingAll(14)]}>
    <Row horizontalArrangement="spaceBetween" modifiers={[fillMaxWidth()]}>
      <Text color="#E9C987" style={{fontSize:13,fontWeight:'bold',fontFamily:'serif'}}>
        ☪  Camideyiz Biz
      </Text>
      <Text color="#B9DCCB" maxLines={1} style={{fontSize:11}}>{props.city}</Text>
    </Row>
    <Text color="#FFFFFF" style={{fontSize:12,fontWeight:'bold'}}>
      {props.ready?'Bugünün namaz vakitleri':'Takvim bekleniyor'}
    </Text>
    {props.ready?<Column verticalArrangement={{spacedBy:3}}>
      {props.times.map(item=><Row key={item.key} horizontalArrangement="spaceBetween"
        modifiers={[fillMaxWidth()]}>
        <Text color="#B3D8C8" style={{fontSize:11}}>{item.label}</Text>
        <Text color="#FBF1DB" style={{fontSize:11,fontWeight:'bold'}}>{item.time}</Text>
      </Row>)}
    </Column>:<Text color="#B3D8C8" style={{fontSize:11}}>
      Gerçek saatler için uygulamayı açın.
    </Text>}
    <Text color="#E9C987" style={{fontSize:10}}>
      {props.ready?'Sonraki: '+props.nextName+' · '+props.nextTime
        :'Güncellemek için dokunun'}
    </Text>
  </Column>;
};
export default createWidget<Props>('PrayerDayWidget',PrayerDayWidget,{
  ready:false,city:'Konum seç',dateISO:'',nextName:'',nextTime:'',
  nextAt:0,updatedAt:0,remainingMinutes:0,times:[],
});
