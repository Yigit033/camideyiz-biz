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
  return <Column verticalArrangement={{spacedBy:4}}
    modifiers={[fillMaxSize(),background('#063930'),cornerRadius(18),paddingAll(10)]}>
    <Row horizontalArrangement="spaceBetween" modifiers={[fillMaxWidth()]}>
      <Text color="#E9C987" style={{fontSize:13,fontWeight:'bold',fontFamily:'serif'}}>
        ☪  Camideyiz Biz
      </Text>
      <Text color="#B9DCCB" maxLines={1} style={{fontSize:11}}>{props.city}</Text>
    </Row>
    <Text color="#FFFFFF" style={{fontSize:12,fontWeight:'bold'}}>
      {props.ready?'Bugünün namaz vakitleri':'Takvim bekleniyor'}
    </Text>
    {props.ready?<Column verticalArrangement={{spacedBy:4}}>
      {[0,1,2].map(index=><Row key={index}
        horizontalArrangement="spaceBetween" modifiers={[fillMaxWidth()]}>
        <Text color="#B3D8C8" style={{fontSize:10}}>
          {props.times[index]?.label} {props.times[index]?.time}
        </Text>
        <Text color="#FBF1DB" style={{fontSize:10,fontWeight:'bold'}}>
          {props.times[index+3]?.label} {props.times[index+3]?.time}
        </Text>
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
