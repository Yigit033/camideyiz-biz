import {useEffect, useMemo, useState} from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather, MaterialCommunityIcons} from '@expo/vector-icons';
import Svg, {Circle, Defs, LinearGradient, Path, Stop} from 'react-native-svg';
import {DEMO_SCHEDULE, formatCountdown, nextPrayerAtSeconds, zonedClock} from '@camideyiz/core';
import {PrayerWheel, PRAYER_COLORS} from '@/features/prayer/PrayerWheel';
import {useAppTheme} from '@/theme/ThemeProvider';

const SCHEDULE = DEMO_SCHEDULE;

function SectionHeading({title, subtitle}: {title: string; subtitle?: string}) {
  const {colors} = useAppTheme();
  return <View style={styles.sectionHeading}>
    <Text style={[styles.sectionTitle, {color: colors.text}]}>{title}</Text>
    {subtitle ? <Text style={{color: colors.muted, fontSize: 11}}>{subtitle}</Text> : null}
  </View>;
}

function DailyCard({kind}: {kind: 'ayet' | 'hadis'}) {
  const {colors} = useAppTheme();
  const isAyet = kind === 'ayet';
  const foreground = isAyet ? '#FBF7ED' : colors.text;
  const background = isAyet ? '#183B33' : colors.surface;
  const title = isAyet ? 'Günün Ayeti' : 'Günün Hadisi';
  return <View style={[styles.dailyCard, {
    backgroundColor: background,
    borderColor: isAyet ? '#446A59' : colors.border,
  }]}>
    <View style={[styles.dailyAdornment, {borderColor: isAyet ? '#A3A57C' : colors.gold}]} pointerEvents="none"/>
    <View style={[styles.dailyIcon, {backgroundColor: isAyet ? '#34594A' : colors.soft}]}>
      <MaterialCommunityIcons
        name={isAyet ? 'book-open-page-variant-outline' : 'script-text-outline'}
        size={22} color={isAyet ? '#DFC48B' : colors.gold}/>
    </View>
    <Text style={[styles.dailyTitle, {color: foreground}]}>{title}</Text>
    <Text style={[styles.dailyBody, {color: isAyet ? '#DDE7DE' : colors.muted}]}>
      Kaynağı doğrulanmış içerikler burada yer alacak.
    </Text>
    <View style={styles.dailyFooter}>
      <Text style={{fontSize: 10, color: isAyet ? '#D6BE8E' : colors.gold}}>
        YAKINDA
      </Text>
      <Feather name="arrow-up-right" size={14} color={isAyet ? '#D6BE8E' : colors.gold}/>
    </View>
  </View>;
}

export default function HomeScreen() {
  const {colors, setMode} = useAppTheme();
  const {width} = useWindowDimensions();
  const wheelSize = Math.min(Math.max(262, width - 54), 338);
  const [now, setNow] = useState(() => new Date());
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const zoned = useMemo(() => zonedClock(now, SCHEDULE.timezone), [now]);
  const next = nextPrayerAtSeconds(SCHEDULE, zoned.secondsOfDay);
  const upcomingIndex = SCHEDULE.times.findIndex(item => item.key === next.prayer.key);
  const selectedIndex = manualIndex ?? upcomingIndex;
  const dateText = new Intl.DateTimeFormat('tr-TR', {
    timeZone: SCHEDULE.timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now);
  const selectedPrayer = SCHEDULE.times[selectedIndex];
  const hero = colors.isDark ? '#102824' : '#FFFEFA';
  const heroBorder = colors.isDark ? '#426156' : '#E3DED3';
  const heroAccent = colors.isDark ? '#1D4137' : '#F1F0E7';

  return <SafeAreaView edges={['top']} style={{flex: 1, backgroundColor: colors.canvas}}>
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
    >
      <View style={styles.masthead}>
        <View style={styles.brand}>
          <View style={[styles.brandMark, {backgroundColor: colors.soft, borderColor: colors.border}]}>
            <MaterialCommunityIcons name="mosque" color={colors.gold} size={22}/>
          </View>
          <View>
            <Text style={[styles.brandName, {color: colors.text}]}>Camideyiz Biz</Text>
            <Text style={[styles.brandCaption, {color: colors.gold}]}>NAMAZ VAKİTLERİ</Text>
          </View>
        </View>
        <Pressable
          onPress={() => setMode(colors.isDark ? 'light' : 'dark')}
          accessibilityRole="button"
          accessibilityLabel={colors.isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
          style={[styles.themeButton, {borderColor: colors.border, backgroundColor: colors.surface}]}>
          <Feather name={colors.isDark ? 'sun' : 'moon'} color={colors.gold} size={19}/>
        </Pressable>
      </View>

      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="İstanbul demo konumu hakkında bilgi"
          onPress={() => Alert.alert('Demo konumu', 'İstanbul yalnızca örnek konumdur. Şehir seçimi ve resmî namaz vakitleri henüz bağlanmadı.')}
          style={[styles.location, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Feather name="map-pin" size={14} color={colors.emerald}/>
          <Text style={[styles.locationText, {color: colors.text}]}>{SCHEDULE.locationName}</Text>
          <Feather name="chevron-down" size={14} color={colors.muted}/>
        </Pressable>
        <Text style={[styles.date, {color: colors.muted}]} numberOfLines={1} adjustsFontSizeToFit>
          {dateText}
        </Text>
      </View>

      <View style={[styles.demoNotice, {backgroundColor: colors.soft, borderColor: colors.border}]}>
        <Feather name="info" color={colors.emerald} size={14}/>
        <Text style={[styles.demoText, {color: colors.text}]}>DEMO · Vakitler temsili, ibadet için kullanmayın.</Text>
      </View>

      <View style={[styles.hero, {
        backgroundColor: hero, borderColor: heroBorder,
        shadowColor: colors.isDark ? '#000' : '#857358',
      }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 380 430" preserveAspectRatio="xMidYMid slice">
            <Defs>
              <LinearGradient id="heroFade" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={heroAccent} stopOpacity=".76"/>
                <Stop offset="52%" stopColor={hero} stopOpacity="0"/>
                <Stop offset="100%" stopColor={heroAccent} stopOpacity=".32"/>
              </LinearGradient>
            </Defs>
            <Path d="M0 0 H380 V430 H0Z" fill="url(#heroFade)"/>
            <Circle cx="380" cy="-14" r="148" fill="none" stroke={colors.gold} strokeOpacity=".17" strokeWidth=".8"/>
            <Circle cx="380" cy="-14" r="171" fill="none" stroke={colors.gold} strokeOpacity=".09" strokeWidth=".8"/>
            <Circle cx="8" cy="405" r="112" fill="none" stroke={colors.gold} strokeOpacity=".13" strokeWidth=".7"/>
          </Svg>
        </View>

        <View style={styles.heroTop}>
          <View>
            <Text style={[styles.eyebrow, {color: colors.gold}]}>GÜNÜN RİTMİ</Text>
            <Text style={[styles.heroSubtitle, {color: colors.muted}]}>Vakit çemberi · 24 saat</Text>
          </View>
          <View style={[styles.livePill, {backgroundColor: colors.isDark ? '#1F493D' : '#E9F3ED'}]}>
            <View style={[styles.liveDot, {backgroundColor: '#32AF83'}]}/>
            <Text style={[styles.livePillText, {color: colors.isDark ? '#BEE7D3' : '#216349'}]}>
              {manualIndex === null ? 'ŞU AN' : 'İNCELEME'}
            </Text>
          </View>
        </View>

        <PrayerWheel
          times={SCHEDULE.times}
          selectedIndex={selectedIndex}
          onSelect={setManualIndex}
          nowSeconds={zoned.secondsOfDay}
          colors={colors}
          size={wheelSize}
          countdown={formatCountdown(next.secondsRemaining)}
          isManualSelection={manualIndex !== null}
        />

        <View style={styles.heroFooter}>
          {manualIndex === null ? <>
            <Feather name="rotate-cw" size={14} color={colors.gold}/>
            <Text style={[styles.heroHint, {color: colors.muted}]}>Parmağınla çevir, vakitleri keşfet</Text>
            <View style={styles.nowLegend}>
              <View style={[styles.nowDot, {backgroundColor: colors.gold}]}/>
              <Text style={[styles.heroHint, {color: colors.muted}]}>Şimdi</Text>
            </View>
          </> : <>
            <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <View style={[styles.nowDot, {backgroundColor: PRAYER_COLORS[selectedPrayer.key]}]}/>
              <Text style={[styles.heroHint, {color: colors.muted}]}>{selectedPrayer.label} · {selectedPrayer.time}</Text>
            </View>
            <Pressable onPress={() => setManualIndex(null)} accessibilityRole="button"
              style={styles.resetButton} accessibilityLabel="Canlı geri sayıma dön">
              <Feather name="rotate-ccw" size={13} color={colors.emerald}/>
              <Text style={{fontSize: 11, color: colors.emerald, fontWeight: '800'}}>Canlıya dön</Text>
            </Pressable>
          </>}
        </View>
      </View>

      <SectionHeading title="Bugünün Vakitleri" subtitle="6 vakit · Örnek"/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timesRow}>
        {SCHEDULE.times.map((item, index) => {
          const active = index === selectedIndex;
          return <Pressable key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label + ' ' + item.time}
            accessibilityState={{selected: active}}
            onPress={() => setManualIndex(index)}
            style={[styles.timeChip, {
              backgroundColor: active ? (colors.isDark ? '#1B3B35' : '#EAF3EA') : colors.surface,
              borderColor: active ? PRAYER_COLORS[item.key] : colors.border,
            }]}>
            <View style={[styles.chipColor, {backgroundColor: PRAYER_COLORS[item.key]}]}/>
            <Text style={[styles.chipLabel, {color: colors.muted}]}>{item.label}</Text>
            <Text style={[styles.chipTime, {color: colors.text}]}>{item.time}</Text>
          </Pressable>;
        })}
      </ScrollView>

      <View style={[styles.kerahetRow, {borderColor: colors.border, backgroundColor: colors.surface}]}>
        <View style={[styles.warningIcon, {backgroundColor: colors.warning + '15'}]}>
          <Feather name="alert-circle" size={17} color={colors.warning}/>
        </View>
        <View style={{flex: 1}}>
          <Text style={{color: colors.text, fontSize: 13, fontWeight: '700'}}>Kerahet vakitleri</Text>
          <Text style={{color: colors.muted, fontSize: 11, lineHeight: 17}}>
            Doğrulanmış hesaplama gelince çemberde işaretlenecek.
          </Text>
        </View>
      </View>

      <SectionHeading title="Günün İçerikleri" subtitle="Kaynaklarıyla"/>
      <View style={styles.dailyRow}>
        <DailyCard kind="ayet"/>
        <DailyCard kind="hadis"/>
      </View>
      <Text style={[styles.footnote, {color: colors.muted}]}>Camideyiz Biz · Özenle tasarlanmış bir ibadet deneyimi</Text>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: {paddingHorizontal: 17, paddingTop: 12, paddingBottom: 40, gap: 13},
  masthead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  brand: {flexDirection: 'row', alignItems: 'center', gap: 11},
  brandMark: {height: 45, width: 45, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center'},
  brandName: {fontFamily: 'serif', fontWeight: '700', fontSize: 23, letterSpacing: -.55},
  brandCaption: {fontSize: 9, fontWeight: '800', letterSpacing: 2.2, marginTop: 1},
  themeButton: {width: 43, height: 43, borderWidth: 1, borderRadius: 15, justifyContent: 'center', alignItems: 'center'},
  dateRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  location: {flexDirection: 'row', gap: 8, alignItems: 'center', height: 36, borderRadius: 19, paddingHorizontal: 12, borderWidth: 1},
  locationText: {fontSize: 13, fontWeight: '700'},
  date: {fontSize: 11, flex: 1, textAlign: 'right', textTransform: 'capitalize'},
  demoNotice: {paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderRadius: 13, flexDirection: 'row', gap: 7, alignItems: 'center'},
  demoText: {fontSize: 10.5, fontWeight: '700', flexShrink: 1},
  hero: {borderRadius: 28, borderWidth: 1, paddingTop: 18, paddingBottom: 12, paddingHorizontal: 9, alignItems: 'center', overflow: 'hidden', elevation: 2, shadowOpacity: 0.08, shadowRadius: 17, shadowOffset: {width: 0, height: 8}},
  heroTop: {width: '100%', paddingHorizontal: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  eyebrow: {fontSize: 10, letterSpacing: 1.8, fontWeight: '800'},
  heroSubtitle: {fontSize: 12, marginTop: 4},
  livePill: {flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7},
  liveDot: {height: 6, width: 6, borderRadius: 3},
  livePillText: {fontSize: 10, letterSpacing: 1.1, fontWeight: '800'},
  heroFooter: {width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginTop: 1, gap: 7, minHeight: 30},
  heroHint: {fontSize: 10.7},
  nowLegend: {flexDirection: 'row', marginLeft: 'auto', alignItems: 'center', gap: 5},
  nowDot: {height: 7, width: 7, borderRadius: 3.5},
  resetButton: {minHeight: 35, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6},
  sectionHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 3},
  sectionTitle: {fontSize: 17, fontWeight: '700', letterSpacing: -.25},
  timesRow: {gap: 9, paddingBottom: 3, paddingRight: 15},
  timeChip: {width: 92, height: 87, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingTop: 10},
  chipColor: {width: 6, height: 6, borderRadius: 3, marginBottom: 7},
  chipLabel: {fontSize: 11, marginBottom: 4},
  chipTime: {fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums']},
  kerahetRow: {borderRadius: 16, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10},
  warningIcon: {width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  dailyRow: {flexDirection: 'row', gap: 10},
  dailyCard: {flex: 1, minHeight: 182, borderWidth: 1, borderRadius: 19, padding: 14, overflow: 'hidden'},
  dailyAdornment: {width: 86, height: 86, position: 'absolute', top: -45, right: -32, borderWidth: 1, borderRadius: 43, opacity: .35},
  dailyIcon: {width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12},
  dailyTitle: {fontSize: 15, fontFamily: 'serif', fontWeight: '700', marginBottom: 7},
  dailyBody: {fontSize: 11, lineHeight: 17},
  dailyFooter: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 12},
  footnote: {fontSize: 10.5, textAlign: 'center', marginTop: 8},
});
