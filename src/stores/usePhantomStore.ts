// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Store
// Ghosts of recently-closed windows (max 5, 8 s each). Phantoms are
// transient; only lifetime counters persist. Every snapshot object
// URL is revoked the moment its phantom leaves the store, so no
// image blob outlives its ghost.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import type {
  PhantomConfig,
  PhantomLifecycle,
  PhantomSnapshotStatus,
  PhantomSpawn,
  PhantomStats,
  PhantomWindow,
  PhantomWindowData,
} from '@/types/phantom';

/** How long a phantom drifts before auto-dissolving (ms) */
export const PHANTOM_LIFETIME_MS = 8000;
/** Max simultaneous phantoms — oldest auto-expires */
export const MAX_PHANTOMS = 5;
/** Pixel-particle dissolve duration (ms) */
export const PHANTOM_FADE_MS = 2200;
/** Upward drift speed (px per second) */
export const PHANTOM_DRIFT_PX_PER_S = 2;

export const PHANTOM_CONFIG: PhantomConfig = {
  lifetimeMs: PHANTOM_LIFETIME_MS,
  fadeDuration: PHANTOM_FADE_MS,
  maxPhantoms: MAX_PHANTOMS,
};

const DEFAULT_ACCENT = '#00f0ff';
const EMPTY_WINDOW_DATA: PhantomWindowData = { scroll: [], fields: [], wasMaximized: false };
const EMPTY_STATS: PhantomStats = { spawned: 0, resurrected: 0, dissolved: 0 };

/** Release a snapshot object URL (no-op for null / non-blob URLs). */
export function revokePhantomSnapshot(url: string | null | undefined): void {
  if (!url || !url.startsWith('blob:') || typeof URL === 'undefined') return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* already revoked */
  }
}

interface PhantomStore {
  phantoms: PhantomWindow[];
  stats: PhantomStats;

  // Actions
  spawnPhantom: (config: PhantomSpawn) => string;
  /** Spec alias of spawnPhantom. */
  addPhantom: (config: PhantomSpawn) => string;
  setSnapshot: (id: string, url: string | null, status: PhantomSnapshotStatus) => void;
  setPhantomState: (id: string, state: PhantomLifecycle) => void;
  /** @deprecated alias of setPhantomState */
  setStatus: (id: string, state: PhantomLifecycle) => void;
  /** Mark a drifting phantom as resurrecting; returns a copy, or null if it can't be. */
  resurrectPhantom: (id: string) => PhantomWindow | null;
  removePhantom: (id: string) => void;
  clearPhantoms: () => void;
  /** Lifetime counters; each returns the new total. */
  recordResurrection: () => number;
  recordDissolve: () => number;

  // Queries
  getPhantom: (id: string) => PhantomWindow | undefined;
  /** Phantoms still drifting (clickable). */
  getActivePhantoms: () => PhantomWindow[];
}

export const usePhantomStore = create<PhantomStore>()(
  persist(
    immer((set, get) => ({
      phantoms: [],
      stats: { ...EMPTY_STATS },

      spawnPhantom: (config) => {
        const id = generateId('phantom');
        const phantom: PhantomWindow = {
          id,
          snapshot: null,
          snapshotStatus: config.snapshotPending ? 'pending' : 'unavailable',
          appId: config.appId,
          workspaceId: config.workspaceId,
          title: config.title,
          icon: config.icon,
          position: { ...config.position },
          size: { ...config.size },
          accent: config.accent ?? DEFAULT_ACCENT,
          createdAt: Date.now(),
          state: 'drifting',
          windowData: config.windowData ?? EMPTY_WINDOW_DATA,
        };
        const current = get().phantoms;
        const overflow = Math.max(0, current.length + 1 - MAX_PHANTOMS);
        const evicted = current.slice(0, overflow);
        set((state) => {
          if (overflow > 0) state.phantoms.splice(0, overflow);
          state.phantoms.push(phantom);
          state.stats.spawned += 1;
        });
        evicted.forEach((p) => revokePhantomSnapshot(p.snapshot));
        return id;
      },

      addPhantom: (config) => get().spawnPhantom(config),

      setSnapshot: (id, url, status) => {
        const exists = get().phantoms.some((p) => p.id === id);
        if (!exists) {
          // The phantom already left (resurrected / evicted) — drop the image.
          revokePhantomSnapshot(url);
          return;
        }
        set((state) => {
          const p = state.phantoms.find((ph) => ph.id === id);
          if (!p) return;
          if (p.snapshot && p.snapshot !== url) revokePhantomSnapshot(p.snapshot);
          p.snapshot = url;
          p.snapshotStatus = status;
        });
      },

      setPhantomState: (id, next) =>
        set((state) => {
          const p = state.phantoms.find((ph) => ph.id === id);
          if (p) p.state = next;
        }),

      setStatus: (id, next) => get().setPhantomState(id, next),

      resurrectPhantom: (id) => {
        const p = get().phantoms.find((ph) => ph.id === id);
        if (!p || p.state !== 'drifting') return null;
        set((state) => {
          const draft = state.phantoms.find((ph) => ph.id === id);
          if (draft) draft.state = 'resurrecting';
        });
        return {
          ...p,
          position: { ...p.position },
          size: { ...p.size },
          state: 'resurrecting',
        };
      },

      removePhantom: (id) => {
        const target = get().phantoms.find((p) => p.id === id);
        if (!target) return;
        set((state) => {
          state.phantoms = state.phantoms.filter((p) => p.id !== id);
        });
        revokePhantomSnapshot(target.snapshot);
      },

      clearPhantoms: () => {
        const all = get().phantoms;
        set((state) => {
          state.phantoms = [];
        });
        all.forEach((p) => revokePhantomSnapshot(p.snapshot));
      },

      recordResurrection: () => {
        set((state) => {
          state.stats.resurrected += 1;
        });
        return get().stats.resurrected;
      },

      recordDissolve: () => {
        set((state) => {
          state.stats.dissolved += 1;
        });
        return get().stats.dissolved;
      },

      getPhantom: (id) => get().phantoms.find((p) => p.id === id),

      getActivePhantoms: () => get().phantoms.filter((p) => p.state === 'drifting'),
    })),
    {
      name: 'warrior-os-phantom',
      // Phantoms (and their blob URLs) are session-only; counters persist.
      partialize: (state) => ({ stats: state.stats }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { stats?: Partial<PhantomStats> };
        return { ...current, stats: { ...EMPTY_STATS, ...(p.stats ?? {}) } };
      },
    }
  )
);
