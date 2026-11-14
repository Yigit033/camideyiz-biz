import {HStack,Image,Spacer,Text,VStack,ZStack} from '@expo/ui/swift-ui';
import {clipShape,containerBackground,font,foregroundStyle,frame,lineLimit,
  padding,widgetURL} from '@expo/ui/swift-ui/modifiers';
import {createWidget,type WidgetEnvironment} from 'expo-widgets';

type Props={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;
  times:{key:string;label:string;time:string}[];
};

const PrayerDayWidget=(props:Props,env:WidgetEnvironment)=>{
  'widget';
  const gold='#F2CC87',white='#FFF7E7',pale='#ABDCC9';
  const large=env.widgetFamily==='systemLarge';
  return <ZStack modifiers={[
    containerBackground('#07372F','widget'),
    clipShape('containerRelativeShape'),widgetURL('camideyizbiz:///'),
  ]}>
    <VStack alignment="leading" spacing={large?13:7}
      modifiers={[frame({maxWidth:Infinity,maxHeight:Infinity,alignment:'leading'}),
        padding({all:large?20:15})]}>
      <HStack spacing={6}>
        <Image systemName="moon.stars.fill" size={17} color={gold}/>
        <Text modifiers={[font({size:large?17:14,weight:'bold',design:'serif'}),
          foregroundStyle(gold)]}>Camideyiz Biz</Text>
        <Spacer/>
        <Text modifiers={[font({size:11}),foregroundStyle(pale),lineLimit(1)]}>
          {props.city}
        </Text>
      </HStack>
      <Text modifiers={[font({size:large?13:11,weight:'semibold'}),foregroundStyle(white)]}>
        {props.ready?'Bugünün vakitleri':'Takvim bekleniyor'}
      </Text>
      {props.ready?<VStack alignment="leading" spacing={large?11:5}>
        {props.times.map(item=><HStack key={item.key} spacing={10}>
          <Text modifiers={[font({size:large?14:12}),foregroundStyle(pale),frame({maxWidth:Infinity,alignment:'leading'})]}>
            {item.label}
          </Text>
          <Text modifiers={[font({size:large?15:12,weight:'semibold'}),
            foregroundStyle(white)]}>{item.time}</Text>
        </HStack>)}
      </VStack>:<Text modifiers={[font({size:12}),foregroundStyle(pale)]}>
        Namaz vakitlerini görüntülemek için uygulamayı aç.
      </Text>}
      <Spacer/>
      <HStack>
        <Text modifiers={[font({size:10}),foregroundStyle(gold)]}>
          {props.ready?'Sıradaki: '+props.nextName+' · '+props.nextTime:'Kaynak bağlantısını kontrol et'}
        </Text>
        <Spacer/>
      </HStack>
    </VStack>
  </ZStack>;
};
export default createWidget<Props>('PrayerDayWidget',PrayerDayWidget,{
  ready:false,city:'Konum seç',dateISO:'',nextName:'',nextTime:'',
  nextAt:0,updatedAt:0,remainingMinutes:0,times:[],
});
