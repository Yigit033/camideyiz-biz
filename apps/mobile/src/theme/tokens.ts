export type ThemeMode = 'system' | 'light' | 'dark';
export type ColorTokens = {
  canvas: string; surface: string; elevated: string; text: string; muted: string;
  border: string; emerald: string; gold: string; warning: string; soft: string;
  isDark: boolean;
};
export const base = {
  emerald:'#152821',ivory:'#F7F4ED',gold:'#B69C70',navy:'#202A30',
  cyan:'#579EB6',sunrise:'#DDA95A',noon:'#CBB37B',afternoon:'#0FA97A',
  sunset:'#D77F5D',night:'#7770BB',warning:'#C45D62'
};
export const lightTokens: ColorTokens = {
  canvas:base.ivory,surface:'#FFFFFF',elevated:'#EBEEE8',text:'#152821',
  muted:'#65736C',border:'#DEE4DB',emerald:base.emerald,gold:'#A88A5C',
  warning:base.warning,soft:'#E5EEE6',isDark:false
};
export const darkTokens: ColorTokens = {
  canvas:'#0C1717',surface:base.emerald,elevated:base.navy,text:'#F8F4E9',
  muted:'#A7B9AF',border:'#29443F',emerald:'#43D1A8',gold:'#D2BB89',
  warning:'#E78B90',soft:'#1C3832',isDark:true
};
