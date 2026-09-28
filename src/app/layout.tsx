// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Root Layout
// Fonts, metadata, global styles
// ═══════════════════════════════════════════════════════════

import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Orbitron } from 'next/font/google';
import './globals.css';
import '@/styles/animations.css';
import '@/styles/cursors.css';

// ─── Font Loading ───
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

// ─── Metadata ───
// The web app manifest comes from src/app/manifest.ts (file convention:
// served at /manifest.webmanifest and linked automatically).
export const metadata: Metadata = {
  title: 'WARRIOR OS v4.0 — The Living World',
  description:
    'An OS-in-browser for GATE exam preparation and project management. Built by Keshav Upadhyay.',
  applicationName: 'Warrior OS',
  keywords: ['GATE', 'exam prep', 'OS', 'portfolio', 'warrior', 'study'],
  authors: [{ name: 'Keshav Upadhyay' }],
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Warrior OS',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

// themeColor lives here (not in metadata) in this Next version; it also
// tints the installed app's title bar. Matches manifest theme_color.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#050508',
  colorScheme: 'dark',
};

// ─── Root Layout ───
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${orbitron.variable} antialiased`}
        style={{
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          background: '#050508',
          overflow: 'hidden',
          width: '100vw',
          height: '100vh',
        }}
      >
        {children}
      </body>
    </html>
  );
}
