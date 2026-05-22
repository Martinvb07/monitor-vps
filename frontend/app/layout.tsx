import type { Metadata } from 'next';
import { Space_Grotesk, Newsreader, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const serif = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['italic'],
  variable: '--font-serif',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MARTIN.HQ — Monitor',
  description: 'Panel de monitoreo de servidores y VPS',
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f0eb' },
    { media: '(prefers-color-scheme: dark)',  color: '#111110' },
  ],
  appleWebApp: {
    capable: true,
    title: 'MARTIN.HQ',
    statusBarStyle: 'black-translucent',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

const themeBootstrap = `try{var d=localStorage.getItem('mhq_dark')==='1';if(d)document.body.classList.add('dark');}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
