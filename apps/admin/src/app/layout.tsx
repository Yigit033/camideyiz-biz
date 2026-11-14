import type {Metadata} from 'next';
import './styles.css';
export const metadata:Metadata={
  title:'Camideyiz Biz — Yönetim Altyapısı',
  description:'Henüz üretime hazır olmayan yönetim paneli altyapısı.',
  robots:{index:false,follow:false}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="tr"><body>{children}</body></html>;
}
