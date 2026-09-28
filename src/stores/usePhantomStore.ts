// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Store
// Tracks ghosts of recently-closed windows (max 5, ephemeral)
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { generateId } from '@/lib/utils';
import type { Phantom, PhantomSpawn, PhantomStatus } from '@/types/phantom';

/** How long a phantom drifts before auto-dissolving (ms) */
export const PHANTOM_LIFETIME_MS = 8000;
/** Max simultaneous phantoms — oldest auto-expires */
export const MAX_PHANTOMS = 5;

const DEFAULT_ACCENT = '#00f0ff';

interface PhantomStore {
  phantoms: Phantom[];

  // Actions
  spawnPhantom: (config: PhantomSpawn) => string;
  setStatus: (id: string, status: PhantomStatus) => void;
  removePhantom: (id: string) => void;
  clearPhantoms: () => void;

  // Queries
  getPhantom: (id: string) => Phantom | undefined;
}

// Not persisted: phantoms are transient by design (8s lifetime).
export const usePhantomStore = create<PhantomStore>()(
  immer((set, get) => ({
    phantoms: [],

    spawnPhantom: (config) => {
      const id = generateId('phantom');
      set((state) => {
        const phantom: Phantom = {
          id,
          appId: config.appId,
          workspaceId: config.workspaceId,
          title: config.title,
          icon: config.icon,
          position: { ...config.position },
          size: { ...config.size },
          accent: config.accent ?? DEFAULT_ACCENT,
          createdAt: Date.now(),
          status: 'drifting',
        };
        state.phantoms.push(phantom);
        // Enforce max — drop the oldest overflow phantoms
        if (state.phantoms.length > MAX_PHANTOMS) {
          state.phantoms.splice(0, state.phantoms.length - MAX_PHANTOMS);
        }
      });
      return id;
    },

    setStatus: (id, status) =>
      set((state) => {
        const p = state.phantoms.find((ph) => ph.id === id);
        if (p) p.status = status;
      }),

    removePhantom: (id) =>
      set((state) => {
        state.phantoms = state.phantoms.filter((p) => p.id !== id);
      }),

    clearPhantoms: () =>
      set((state) => {
        state.phantoms = [];
      }),

    getPhantom: (id) => get().phantoms.find((p) => p.id === id),
  }))
);
