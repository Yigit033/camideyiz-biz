import {HStack,Image,Spacer,Text,VStack,ZStack} from '@expo/ui/swift-ui';
import {clipShape,containerBackground,font,foregroundStyle,frame,lineLimit,
  monospacedDigit,padding,widgetURL} from '@expo/ui/swift-ui/modifiers';
import {createWidget,type WidgetEnvironment} from 'expo-widgets';

type Props={
  ready:boolean;city:string;dateISO:string;nextName:string;nextTime:string;
  nextAt:number;updatedAt:number;remainingMinutes:number;updatedClock:string;
  times:{key:string;label:string;time:string}[];
};


const NextPrayerWidget=(props:Props,env:WidgetEnvironment)=>{
  'widget';
  // Same midnight-blue / gold system as the Android RemoteViews widgets.
  const gold='#F4D392',ink='#F1F7F8',muted='#AFC5D4';
  const compact=env.widgetFamily==='systemSmall';
  return <ZStack modifiers={[
    containerBackground('#0C2438','widget'),
    clipShape('containerRelativeShape'),widgetURL('camideyizbiz:///'),
  ]}>
    <VStack alignment="leading" spacing={compact?3:8}
      modifiers={[frame({maxWidth:Infinity,maxHeight:Infinity,alignment:'leading'}),
        padding({all:compact?12:18})]}>
      <HStack spacing={6}>
        <Image systemName="moon.stars.fill" size={14} color={gold}/>
        <Text modifiers={[font({size:11,weight:'semibold'}),foregroundStyle(muted),lineLimit(1)]}>
          {props.ready?props.city:'Camideyiz Biz'}
        </Text>
        <Spacer/>
      </HStack>
      {props.ready?<VStack alignment="leading" spacing={compact?2:4}>
        <Text modifiers={[font({size:compact?13:15,weight:'semibold'}),foregroundStyle(ink),lineLimit(1)]}>
          {props.nextName}  {props.nextTime}
        </Text>
        <Text modifiers={[font({size:10,weight:'medium'}),foregroundStyle(muted)]}>KALAN</Text>
        <Text
          timerInterval={{lower:new Date(props.updatedAt),upper:new Date(props.nextAt)}}
          countsDown
          modifiers={[font({size:compact?28:40,weight:'bold',design:'rounded'}),
            monospacedDigit(),foregroundStyle(gold),lineLimit(1)]}/>
      </VStack>:<VStack alignment="leading" spacing={6}>
        <Text modifiers={[font({size:18,weight:'bold'}),foregroundStyle(ink)]}>Vakitler bekleniyor</Text>
        <Text modifiers={[font({size:11}),foregroundStyle(muted)]}>Uygulamayı aç</Text>
      </VStack>}
    </VStack>
  </ZStack>;
};
export default createWidget<Props>('NextPrayerWidget',NextPrayerWidget,{
  ready:false,city:'Konum seç',dateISO:'',nextName:'',nextTime:'',
  nextAt:0,updatedAt:0,remainingMinutes:0,updatedClock:'',times:[],
});
