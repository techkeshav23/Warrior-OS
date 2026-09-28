// ═══════════════════════════════════════════════════════════
// WARRIOR OS — PWA Install Store
// Holds the browser's deferred `beforeinstallprompt` event so the
// taskbar can offer "Install Warrior OS" at a moment of our choosing.
// In-memory only (the event cannot be serialised).
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';

/** Chromium-only event; not in lib.dom yet. */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

interface PwaInstallStore {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;

  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
  markInstalled: () => void;
  promptInstall: () => Promise<InstallOutcome>;
}

export const usePwaInstallStore = create<PwaInstallStore>()((set, get) => ({
  deferredPrompt: null,
  installed: false,

  setDeferredPrompt: (event) => set({ deferredPrompt: event }),

  markInstalled: () => set({ installed: true, deferredPrompt: null }),

  promptInstall: async () => {
    const event = get().deferredPrompt;
    if (!event) return 'unavailable';
    // A prompt can only be shown once; drop it either way.
    set({ deferredPrompt: null });
    try {
      await event.prompt();
      const choice = await event.userChoice;
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  },
}));
