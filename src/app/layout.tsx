// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Root Layout
// Fonts, metadata, global styles
// ═══════════════════════════════════════════════════════════

import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Orbitron } from 'next/font/google';
import { OWNER } from '@/config/owner';
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
const SITE_NAME = 'Warrior OS';
const TITLE = 'Warrior OS — A Sci-Fi Command Center in Your Browser';
const DESCRIPTION = `${OWNER.name}'s personal sci-fi OS in the browser: a command center, discipline machine and creative playground with real windows, a terminal and 3D worlds.`;
/** Link previews use the app icon until a dedicated 1200×630 card exists. */
const PREVIEW_IMAGE = { url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Warrior OS emblem' };

/**
 * Public origin for absolute link-preview URLs: NEXT_PUBLIC_SITE_URL, else
 * the Vercel production domain. Unset (local builds) → Next's own default.
 */
function siteOrigin(): URL | null {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : '');
  try {
    return raw ? new URL(raw) : null;
  } catch {
    return null;
  }
}

const SITE_ORIGIN = siteOrigin();

export const metadata: Metadata = {
  metadataBase: SITE_ORIGIN,
  title: { default: TITLE, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Warrior OS',
    'web OS',
    'browser OS',
    'sci-fi desktop',
    'personal OS',
    'command center',
    'portfolio',
    'Next.js',
    'React Three Fiber',
    OWNER.name,
  ],
  authors: [{ name: OWNER.name, url: OWNER.github || undefined }],
  creator: OWNER.name,
  category: 'technology',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_IN',
    ...(SITE_ORIGIN ? { url: '/' } : {}),
    images: [PREVIEW_IMAGE],
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: [PREVIEW_IMAGE],
  },
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
