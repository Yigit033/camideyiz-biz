import {memo} from 'react';
import {View} from 'react-native';
import {BlurMask, Canvas, Circle, Group, RadialGradient, vec} from '@shopify/react-native-skia';

/** All Skia nodes are static while the UI-thread dial rotates above them. */
export const DialLighting = memo(function DialLighting({size, dark}: {size:number;dark:boolean}) {
  const center=size/2;
  return <View pointerEvents="none" style={{position:'absolute',width:size,height:size}}>
    <Canvas style={{width:size,height:size}}>
      <Group>
        <Circle cx={center} cy={center} r={center*.94}>
          <RadialGradient
            c={vec(center,center)} r={center*.94}
            colors={dark ? ['rgba(30,161,139,0.14)','rgba(19,86,79,0.08)','rgba(0,0,0,0)']
              : ['rgba(210,182,121,0.14)','rgba(109,178,157,0.07)','rgba(255,255,255,0)']}/>
          <BlurMask blur={14} style="normal"/>
        </Circle>
        <Circle cx={center*.75} cy={center*.64} r={center*.42}>
          <RadialGradient c={vec(center*.75,center*.64)} r={center*.42}
            colors={dark ? ['rgba(207,177,111,0.14)','rgba(17,31,29,0)']
              : ['rgba(217,182,118,0.12)','rgba(255,255,255,0)']}/>
          <BlurMask blur={18} style="normal"/>
        </Circle>
      </Group>
    </Canvas>
  </View>;
});
