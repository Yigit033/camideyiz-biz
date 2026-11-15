import {Column,Row,Text} from '@expo/ui/jetpack-compose';
import {background,cornerRadius,fillMaxSize,paddingAll,width}
  from '@expo/ui/jetpack-compose/modifiers';
import {createWidget} from 'expo-widgets';

type Props={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;updatedClock:string;
  times:{key:string;label:string;time:string}[];
};

/** Android widget layouts support only a subset of Compose.
 * Avoid spaceBetween on the header: some launchers collapse it,
 * causing the city and brand to overlap (observed on real phone).
 */
const PrayerDayWidget=(props:Props)=>{
  'widget';
  return <Column verticalArrangement={{spacedBy:6}}
    modifiers={[fillMaxSize(),background('#063930'),cornerRadius(21),paddingAll(15)]}>
    <Text color="#EFCF8B" maxLines={1}
      style={{fontSize:15,fontWeight:'bold',fontFamily:'serif'}}>
      ☪  Camideyiz Biz
    </Text>
    <Text color="#A6D6C1" maxLines={1} style={{fontSize:11}}>
      {props.ready?props.city+'  ·  Bugünün vakitleri':'Takvim henüz yüklenmedi'}
    </Text>
    {props.ready
      ?<Row horizontalArrangement={{spacedBy:12}}>
        <Column verticalArrangement={{spacedBy:7}}
          modifiers={[width(120)]}>
          <Text color="#F7F0DF" maxLines={1}
            style={{fontSize:12,fontWeight:'bold'}}>
            {props.times[0]?.label}  {props.times[0]?.time}
          </Text>
          <Text color="#F7F0DF" maxLines={1}
            style={{fontSize:12,fontWeight:'bold'}}>
            {props.times[1]?.label}  {props.times[1]?.time}
          </Text>
          <Text color="#F7F0DF" maxLines={1}
            style={{fontSize:12,fontWeight:'bold'}}>
            {props.times[2]?.label}  {props.times[2]?.time}
          </Text>
        </Column>
        <Column verticalArrangement={{spacedBy:7}}
          modifiers={[width(120)]}>
          <Text color="#F7F0DF" maxLines={1}
            style={{fontSize:12,fontWeight:'bold'}}>
            {props.times[3]?.label}  {props.times[3]?.time}
          </Text>
          <Text color="#F7F0DF" maxLines={1}
            style={{fontSize:12,fontWeight:'bold'}}>
            {props.times[4]?.label}  {props.times[4]?.time}
          </Text>
          <Text color="#F7F0DF" maxLines={1}
            style={{fontSize:12,fontWeight:'bold'}}>
            {props.times[5]?.label}  {props.times[5]?.time}
          </Text>
        </Column>
      </Row>
      :<Column verticalArrangement={{spacedBy:8}}>
        <Text color="#F8F1DF" maxLines={2}
          style={{fontSize:21,fontWeight:'bold',fontFamily:'serif'}}>
          Namaz vakitleri bekleniyor
        </Text>
        <Text color="#B7DACC" maxLines={2} style={{fontSize:12}}>
          Uygulamayı açıp ilçe takvimini güncelle
        </Text>
      </Column>}
    {props.ready
      ?<Text color="#EAC885" maxLines={1}
        style={{fontSize:11,fontWeight:'bold'}}>
        Sıradaki · {props.nextName} {props.nextTime}
      </Text>
      :<Text color="#EAC885" maxLines={1} style={{fontSize:11}}>
        Güncellemek için uygulamayı aç
      </Text>}
    {props.ready
      ?<Text color="#9BBFB1" maxLines={1} style={{fontSize:10}}>
        Son takvim eşitlemesi · {props.updatedClock}
      </Text>:null}
  </Column>;
};
export default createWidget<Props>('PrayerDayWidget',PrayerDayWidget,{
  ready:false,city:'',dateISO:'',nextName:'',nextTime:'',
  nextAt:0,updatedAt:0,remainingMinutes:0,updatedClock:'',times:[],
});
