// ═══════════════════════════════════════════════════════════
// WARRIOR OS — OS Phase Store
// Manages the boot → lock → desktop state machine
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { OSPhase } from '@/lib/constants';

interface OSStore {
  phase: OSPhase;
  bootProgress: number; // 0-100
  isTransitioning: boolean;

  // Actions
  setPhase: (phase: OSPhase) => void;
  setBootProgress: (progress: number) => void;
  setTransitioning: (transitioning: boolean) => void;
  nextPhase: () => void;
}

const PHASE_ORDER: OSPhase[] = ['dream', 'boot', 'lock', 'desktop'];

export const useOSStore = create<OSStore>()((set, get) => ({
  phase: 'boot',
  bootProgress: 0,
  isTransitioning: false,

  setPhase: (phase) => set({ phase, isTransitioning: false }),

  setBootProgress: (progress) => set({ bootProgress: progress }),

  setTransitioning: (transitioning) => set({ isTransitioning: transitioning }),

  nextPhase: () => {
    const current = get().phase;
    const idx = PHASE_ORDER.indexOf(current);
    if (idx < PHASE_ORDER.length - 1) {
      set({ phase: PHASE_ORDER[idx + 1], isTransitioning: true });
    }
  },
}));
