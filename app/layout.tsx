import './globals.css';
export const metadata = { title: 'aria2 Batch Lab', description: 'Batch HTTP / BitTorrent downloader on Vercel Sandbox' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}