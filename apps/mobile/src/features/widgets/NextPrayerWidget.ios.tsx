import {HStack,Image,Spacer,Text,VStack,ZStack} from '@expo/ui/swift-ui';
import {clipShape,containerBackground,font,foregroundStyle,frame,lineLimit,
  monospacedDigit,padding,widgetURL} from '@expo/ui/swift-ui/modifiers';
import {createWidget,type WidgetEnvironment} from 'expo-widgets';

type Props={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;
  times:{key:string;label:string;time:string}[];
};


const NextPrayerWidget=(props:Props,env:WidgetEnvironment)=>{
  'widget';
  const gold='#F2CE87',ivory='#FFF8E7',mint='#94CFB6';
  const compact=env.widgetFamily==='systemSmall';
  return <ZStack modifiers={[
    containerBackground('#07352E','widget'),
    clipShape('containerRelativeShape'),widgetURL('camideyizbiz:///'),
  ]}>
    <VStack alignment="leading" spacing={compact?3:10}
      modifiers={[frame({maxWidth:Infinity,maxHeight:Infinity,alignment:'leading'}),
        padding({all:compact?11:18})]}>
      <HStack spacing={6}>
        <Image systemName="moon.stars.fill" size={15} color={gold}/>
        <Text modifiers={[font({size:11,weight:'semibold',design:'serif'}),
          foregroundStyle(gold),lineLimit(1)]}>Camideyiz Biz</Text>
        <Spacer/>
      </HStack>
      <Text modifiers={[font({size:12,weight:'medium'}),foregroundStyle(mint),lineLimit(1)]}>
        {props.ready?props.city:'Konum seç'}
      </Text>
      {props.ready?<VStack alignment="leading" spacing={compact?1:5}>
        <Text modifiers={[font({size:12,weight:'medium'}),foregroundStyle(ivory)]}>
          Sıradaki · {props.nextName}
        </Text>
        <Text modifiers={[font({size:compact?27:36,weight:'bold',design:'rounded'}),
          foregroundStyle(gold),monospacedDigit()]}>
          {props.nextTime}
        </Text>
        {!compact?<Text modifiers={[font({size:10}),foregroundStyle(mint)]}>Vakte kalan</Text>:null}
        <Text
          timerInterval={{lower:new Date(props.updatedAt),upper:new Date(props.nextAt)}}
          countsDown
          modifiers={[font({size:compact?15:22,weight:'semibold',design:'rounded'}),
            monospacedDigit(),foregroundStyle(ivory)]}/>
      </VStack>:<VStack alignment="leading" spacing={6}>
        <Text modifiers={[font({size:20,weight:'bold',design:'serif'}),
          foregroundStyle(ivory)]}>Takvim hazır değil</Text>
        <Text modifiers={[font({size:11}),foregroundStyle(mint)]}>
          Güncel namaz vakitleri için uygulamayı aç
        </Text>
      </VStack>}
      {!compact?<Spacer/>:null}
      {!compact?<Text modifiers={[font({size:9}),foregroundStyle('#BDD3CA'),lineLimit(1)]}>
        {props.ready?'Türkiye takvimi · Uygulamayı aç':'Uygulamayı aç'}
      </Text>:null}
    </VStack>
  </ZStack>;
};
export default createWidget<Props>('NextPrayerWidget',NextPrayerWidget,{
  ready:false,city:'Konum seç',dateISO:'',nextName:'',nextTime:'',
  nextAt:0,updatedAt:0,remainingMinutes:0,times:[],
});
