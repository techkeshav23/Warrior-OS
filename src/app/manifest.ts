// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Web App Manifest
// Next.js metadata file convention: served at /manifest.webmanifest
// and linked from <head> automatically (no next-pwa needed).
// Icons are generated PNGs in public/icons/.
// ═══════════════════════════════════════════════════════════

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Warrior OS — Sci-Fi Command Center',
    short_name: 'Warrior OS',
    description:
      'A personal sci-fi OS in the browser: command center, discipline machine and creative playground. Works offline.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#050508',
    theme_color: '#050508',
    lang: 'en-IN',
    dir: 'ltr',
    categories: ['productivity', 'personalization', 'education'],
    prefer_related_applications: false,
    // Re-launching the installed app focuses the open window instead of
    // starting a second OS session.
    launch_handler: { client_mode: ['focus-existing', 'auto'] },
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
