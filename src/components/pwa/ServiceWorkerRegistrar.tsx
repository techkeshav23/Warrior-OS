// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Service Worker Registrar
// Renders nothing. In production (and only where service workers
// exist) it registers /sw.js after page load. In development it
// removes a leftover production worker so stale bundles are never
// served. It also captures the install prompt for the taskbar and
// unlocks the "Native Warrior" achievement when the OS runs as an
// installed app. Mount once at the page root (all phases), so the
// early `beforeinstallprompt` event is not missed.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect } from 'react';
import { unlockAchievementWhenReady } from '@/components/widgets/os-events';
import { usePwaInstallStore, type BeforeInstallPromptEvent } from './usePwaInstallStore';

export const PWA_ACHIEVEMENT_ID = 'pwa-installed';
const SW_URL = '/sw.js';

function runningStandalone(): boolean {
  const displayMode = (mode: string) =>
    typeof window.matchMedia === 'function' && window.matchMedia(`(display-mode: ${mode})`).matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayMode('standalone') || displayMode('window-controls-overlay') || iosStandalone;
}

function ServiceWorkerRegistrarInner() {
  // ── Register (prod) / clean up (dev) ──
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            const script =
              registration.active?.scriptURL ??
              registration.waiting?.scriptURL ??
              registration.installing?.scriptURL ??
              '';
            if (script.endsWith(SW_URL)) void registration.unregister();
          }
        })
        .catch(() => undefined);
      return;
    }

    const register = () => {
      navigator.serviceWorker.register(SW_URL, { scope: '/' }).catch(() => {
        /* offline support is an enhancement; the OS works without it */
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  // ── Install prompt + installed-app achievement ──
  useEffect(() => {
    const { setDeferredPrompt, markInstalled } = usePwaInstallStore.getState();
    let cancelUnlock: (() => void) | null = null;
    const unlockInstalled = () => {
      if (!cancelUnlock) cancelUnlock = unlockAchievementWhenReady(PWA_ACHIEVEMENT_ID);
    };

    if (runningStandalone()) {
      markInstalled();
      unlockInstalled();
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // we offer install from the taskbar instead of the mini-infobar
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      markInstalled();
      unlockInstalled();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      cancelUnlock?.();
    };
  }, []);

  return null;
}

export const ServiceWorkerRegistrar = memo(ServiceWorkerRegistrarInner);
