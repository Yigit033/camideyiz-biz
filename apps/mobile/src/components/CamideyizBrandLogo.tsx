import {memo} from 'react';
import {Image} from 'react-native';
import {useAppTheme} from '@/theme/ThemeProvider';

/**
 * Home header brand: the glossy stacked mark (symbol + camideyiz.biz
 * wordmark) cut from the OWNER-APPROVED launcher icon, never redrawn.
 *   dark : splash-mark.png, the transparent glowing cyan mark of the splash
 *          (scripts/build-splash-mark.mjs).
 *   light: widget-mark-light.png, the same silhouette tone-mapped to deep
 *          azure so the wordmark keeps ~4:1 contrast on ivory; the bright
 *          cyan mark and its glow wash out there (build-widget-marks.mjs).
 * Both are pixel derivations of the same artwork with one aspect ratio.
 */
const HOME_MARK={
  dark:require('../../assets/splash-mark.png') as number,
  light:require('../../assets/widget-mark-light.png') as number,
};
const MARK_ASPECT=824/724;

export const CamideyizBrandLogo=memo(function CamideyizBrandLogo({
  compact=false,
}:{compact?:boolean}){
  const {colors}=useAppTheme();
  const height=compact?72:86;
  return <Image source={colors.isDark?HOME_MARK.dark:HOME_MARK.light}
    accessible accessibilityRole="image" accessibilityLabel="camideyiz.biz"
    accessibilityIgnoresInvertColors resizeMode="contain"
    style={{height,width:Math.round(height*MARK_ASPECT)}}/>;
});
