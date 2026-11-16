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
/** The blue logo defines the dark visual identity: midnight blue canvases,
 * deep ocean surfaces and luminous cyan actions. "emerald" is retained as
 * the semantic API key so existing components inherit the new accent without
 * disturbing the separately defined original light theme.
 */
export const darkTokens: ColorTokens = {
  canvas:'#071725',surface:'#102B40',elevated:'#173D58',text:'#F2F7FB',
  muted:'#B2C6D6',border:'#2B536B',emerald:'#20B6EB',gold:'#D8BF8D',
  warning:'#F08F9A',soft:'#16344C',isDark:true
};
