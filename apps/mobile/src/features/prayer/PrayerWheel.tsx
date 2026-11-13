import {useEffect, useMemo, useRef} from 'react';
import {Animated, PanResponder, Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {
  Circle, Defs, G, Line, LinearGradient, Path,
  RadialGradient, Stop, Text as SvgText,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import type {PrayerTime} from '@camideyiz/core';
import {timeToMinutes} from '@camideyiz/core';
import {base, type ColorTokens} from '@/theme/tokens';

export const PRAYER_COLORS: Record<PrayerTime['key'], string> = {
  imsak: '#6BB5C9',
  gunes: '#E7B766',
  ogle: '#CEB27A',
  ikindi: '#36BDA0',
  aksam: '#D78C69',
  yatsi: '#8980C8',
};
const CENTER = 180;
const RING_RADIUS = 132;
const WHEEL_BAND = 48;

export type PrayerArc = PrayerTime & {from: number; to: number};

/** Clockwise arc for each distinct boundary. Day begins at imsak, not midnight. */
export function segmentAngles(times: readonly PrayerTime[]): PrayerArc[] {
  if (times.length === 0) return [];
  const minutes = times.map(item => timeToMinutes(item.time));
  if (minutes.some((minute, index) => index > 0 && minute <= minutes[index - 1])) {
    throw new RangeError('Prayer times must be in ascending local time order');
  }
  return times.map((time, index) => {
    const start = (minutes[index] - minutes[0] + 1440) % 1440;
    const end = index === times.length - 1
      ? 1440
      : (minutes[index + 1] - minutes[0] + 1440) % 1440;
    return {...time, from: start / 1440 * 360, to: end / 1440 * 360};
  });
}

const polar = (degrees: number, radius: number) => {
  const radians = degrees * Math.PI / 180;
  return {x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians)};
};
function arc(from: number, to: number, radius: number) {
  const start = polar(from, radius);
  const end = polar(to, radius);
  const span = to - from;
  return [
    'M', start.x.toFixed(2), start.y.toFixed(2),
    'A', radius, radius, 0, span > 180 ? 1 : 0, 1, end.x.toFixed(2), end.y.toFixed(2),
  ].join(' ');
}

type WheelProps = {
  times: readonly PrayerTime[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  size: number;
  colors: ColorTokens;
  countdown: string;
  isManualSelection: boolean;
  nowSeconds: number;
};
function SegmentLabel({segment, index, selected}: {segment: PrayerArc; index: number; selected: boolean}) {
  const centerAngle = (segment.from + segment.to) / 2;
  const point = polar(centerAngle, 132);
  const contrast = segment.key === 'yatsi' ? '#FAF8F4' : '#132A28';
  const font = segment.to - segment.from < 24 ? 10.2 : 11.3;
  return <G key={segment.key}>
    <SvgText
      x={point.x} y={point.y - 4} textAnchor="middle"
      fontSize={font} fontWeight={selected ? '800' : '700'}
      fill={contrast}>{segment.label}</SvgText>
    <SvgText
      x={point.x} y={point.y + 11} textAnchor="middle"
      fontSize={font - 0.5} fontWeight="600" fill={contrast}
    >{segment.time}</SvgText>
  </G>;
}

/** Interactive circular time-line. All displayed times are provided by the caller. */
export function PrayerWheel({
  times, selectedIndex, onSelect, size, colors,
  countdown, isManualSelection, nowSeconds,
}: WheelProps) {
  const segments = useMemo(() => segmentAngles(times), [times]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const selectedRef = useRef(selectedIndex);
  selectedRef.current = selectedIndex;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0.55);
    Animated.timing(fade, {toValue: 1, duration: 230, useNativeDriver: true}).start();
  }, [selectedIndex, fade]);

  const currentAngle = useMemo(() => {
    if (!times.length) return 0;
    const startSeconds = timeToMinutes(times[0].time) * 60;
    return ((nowSeconds - startSeconds + 86400) % 86400) / 86400 * 360;
  }, [nowSeconds, times]);

  const selected = segments[Math.max(0, Math.min(selectedIndex, segments.length - 1))];
  const selectedAngle = selected ? (selected.from + selected.to) / 2 : 0;
  const handle = polar(selectedAngle, 163);
  const liveMarker = polar(currentAngle, 174);

  const handlePoint = (x: number, y: number) => {
    const x1 = x * 360 / sizeRef.current;
    const y1 = y * 360 / sizeRef.current;
    const radius = Math.hypot(x1 - CENTER, y1 - CENTER);
    if (radius < 102 || radius > 179) return;
    const degrees = (Math.atan2(x1 - CENTER, CENTER - y1) * 180 / Math.PI + 360) % 360;
    const idx = segmentsRef.current.findIndex(item => degrees >= item.from && degrees < item.to);
    if (idx < 0 || idx === selectedRef.current) return;
    selectedRef.current = idx;
    onSelectRef.current(idx);
    Haptics.selectionAsync().catch(() => undefined);
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: ({nativeEvent}) => {
      const x = nativeEvent.locationX * 360 / sizeRef.current;
      const y = nativeEvent.locationY * 360 / sizeRef.current;
      const r = Math.hypot(x - CENTER, y - CENTER);
      return r >= 99 && r <= 180;
    },
    onMoveShouldSetPanResponder: ({nativeEvent}) => {
      const x = nativeEvent.locationX * 360 / sizeRef.current;
      const y = nativeEvent.locationY * 360 / sizeRef.current;
      const r = Math.hypot(x - CENTER, y - CENTER);
      return r >= 99 && r <= 180;
    },
    onPanResponderGrant: ({nativeEvent}) => handlePoint(nativeEvent.locationX, nativeEvent.locationY),
    onPanResponderMove: ({nativeEvent}) => handlePoint(nativeEvent.locationX, nativeEvent.locationY),
  }), []);

  const centerFill = colors.isDark ? '#142C29' : '#FFFFFF';
  const centerHighlight = colors.isDark ? '#23483F' : '#FCFAF3';
  const ringBack = colors.isDark ? '#18322E' : '#E8E9E0';
  const border = colors.isDark ? '#577268' : '#D3DAD0';

  return <View
    style={{width: size, height: size, alignSelf: 'center', justifyContent: 'center'}}
    accessibilityLabel="Namaz vakitleri çemberi; dokunarak ve kaydırarak vakit seçin"
  >
    <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
      <Svg width={size} height={size} viewBox="0 0 360 360" pointerEvents="none">
        <Defs>
          <RadialGradient id="inner" cx="50%" cy="43%" rx="70%" ry="70%">
            <Stop offset="0%" stopColor={centerHighlight}/>
            <Stop offset="100%" stopColor={centerFill}/>
          </RadialGradient>
          <LinearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.gold} stopOpacity="0.90"/>
            <Stop offset="48%" stopColor={colors.gold} stopOpacity="0.12"/>
            <Stop offset="100%" stopColor={colors.gold} stopOpacity="0.73"/>
          </LinearGradient>
          {segments.map((segment) => (
            <LinearGradient key={'gradient-' + segment.key} id={'arc-' + segment.key} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={PRAYER_COLORS[segment.key]} stopOpacity="0.90"/>
              <Stop offset="100%" stopColor={PRAYER_COLORS[segment.key]} stopOpacity="1"/>
            </LinearGradient>
          ))}
        </Defs>
        <Circle cx="180" cy="180" r="176" stroke={colors.gold} strokeWidth="0.8" strokeOpacity="0.21" fill="none"/>
        {Array.from({length: 72}, (_, i) => {
          const angle = i * 5;
          const major = i % 6 === 0;
          const from = polar(angle, major ? 179 : 181);
          const to = polar(angle, major ? 188 : 186);
          return <Line key={'tick-' + i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={colors.gold} strokeOpacity={major ? 0.82 : 0.29}
            strokeWidth={major ? 1.65 : 0.8}/>;
        })}
        <Circle cx="180" cy="180" r={RING_RADIUS} stroke={ringBack} strokeWidth={WHEEL_BAND + 3} fill="none"/>
        {segments.map((item, index) => {
          const from = item.from + 0.8;
          const to = item.to - 0.8;
          if (to <= from) return null;
          return <G key={item.key}>
            {selectedIndex === index && <Path d={arc(from, to, RING_RADIUS)}
              stroke={PRAYER_COLORS[item.key]} strokeOpacity="0.23" strokeWidth="59"
              strokeLinecap="butt" fill="none"/>}
            <Path d={arc(from, to, RING_RADIUS)} stroke={'url(#arc-' + item.key + ')'}
              strokeWidth={selectedIndex === index ? 49 : 45} fill="none"/>
          </G>;
        })}
        <Circle cx="180" cy="180" r="109" stroke="url(#rim)" strokeWidth="2" fill="url(#inner)"/>
        <Circle cx="180" cy="180" r="104" stroke={border} strokeWidth="0.7" strokeOpacity="0.45" fill="none"/>
        {segments.map((item, index) => <SegmentLabel key={item.key} segment={item} index={index} selected={index === selectedIndex}/>)}
        {segments.map(item => {
          const a = polar(item.from, 108);
          const b = polar(item.from, 158);
          return <Line key={'edge-' + item.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={colors.isDark ? '#213A36' : '#FAFAF7'} strokeWidth="2.5" opacity="0.90"/>;
        })}
        <Circle cx={handle.x} cy={handle.y} r="12" fill={colors.gold} fillOpacity="0.15"/>
        <Circle cx={handle.x} cy={handle.y} r="8.2" fill="#FAF7EE" stroke={colors.gold} strokeWidth="2.5"/>
        <Circle cx={handle.x} cy={handle.y} r="2.7" fill="#24594C"/>
        <Circle cx={liveMarker.x} cy={liveMarker.y} r="4.7"
          fill={colors.isDark ? '#E7C98C' : '#9B7944'} stroke={centerFill} strokeWidth="1.5"/>
        <Circle cx={liveMarker.x} cy={liveMarker.y} r="9"
          stroke={colors.gold} strokeWidth="0.9" strokeOpacity="0.58" fill="none"/>
      </Svg>
    </View>

    <Animated.View pointerEvents="none" style={[styles.center, {width: size * .56, opacity: fade}]}>
      <MaterialCommunityIcons name="mosque" size={26} color={colors.gold}/>
      <View style={[styles.goldenDivider, {backgroundColor: colors.gold}]}/>
      <Text style={[styles.caption, {color: colors.muted}]}>
        {isManualSelection ? 'SEÇİLEN VAKİT' : 'SIRADAKİ VAKİT'}
      </Text>
      <Text style={[styles.prayer, {color: colors.text}]} adjustsFontSizeToFit numberOfLines={1}>
        {selected?.label ?? 'Vakit'}
      </Text>
      <Text style={[styles.countdown, {color: colors.emerald}]} adjustsFontSizeToFit numberOfLines={1}>
        {isManualSelection ? selected?.time ?? '--:--' : countdown}
      </Text>
      <Text style={[styles.hint, {color: colors.muted}]}>
        {isManualSelection ? 'Örnek vakit saati' : 'Vakte kalan süre'}
      </Text>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  center: {position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 3},
  goldenDivider: {height: 1, width: 28, opacity: .85, marginTop: 1, marginBottom: 5},
  caption: {letterSpacing: 1.7, fontSize: 9, fontWeight: '800', marginTop: 1},
  prayer: {fontSize: 23, fontFamily: 'serif', fontWeight: '700', paddingTop: 2},
  countdown: {fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -.7, marginTop: 3},
  hint: {fontSize: 10, letterSpacing: .1, marginTop: 5},
});
