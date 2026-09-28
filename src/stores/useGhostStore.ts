// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Warriors Store
// Anonymous multiplayer presence + war cries (local simulation)
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { GhostWarrior, WarCry, CampfireState } from '@/types/ghost';

const MAX_VISIBLE_WARCRIES = 3;
const WARCRY_HISTORY_LIMIT = 30;
export const WARCRY_RATE_LIMIT_MS = 2 * 60 * 1000; // 1 per 2 minutes

/** Derive campfire flame intensity (0..1) from the online count. */
export function deriveCampfire(onlineCount: number): CampfireState {
  // 1 = tiny ember, 5 = small fire, 10 = bonfire, 20+ = inferno
  const intensity = Math.min(onlineCount / 20, 1);
  return { onlineCount, fireIntensity: intensity };
}

interface GhostStore {
  // State
  selfId: string | null;
  onlineWarriors: GhostWarrior[];
  campfireState: CampfireState;
  warCries: WarCry[];       // full recent history (capped)
  lastWarCryAt: number | null; // epoch ms of last war cry sent by self

  // Queries
  getOnlineCount: () => number;
  getLeaderboard: (limit?: number) => GhostWarrior[];
  getVisibleWarCries: () => WarCry[];
  getSelf: () => GhostWarrior | undefined;
  canSendWarCry: () => boolean;
  getWarCryCooldownRemaining: () => number; // ms

  // Actions
  setSelfId: (id: string) => void;
  updatePresence: (warriors: GhostWarrior[]) => void;
  updateSelfStats: (stats: Partial<Pick<GhostWarrior, 'studyHoursToday' | 'quizzesToday' | 'streak'>>) => void;
  addWarCry: (cry: WarCry) => void;
  dismissWarCry: (id: string) => void;
  reset: () => void;
}

export const useGhostStore = create<GhostStore>()(
  persist(
    immer((set, get) => ({
      selfId: null,
      onlineWarriors: [],
      campfireState: deriveCampfire(0),
      warCries: [],
      lastWarCryAt: null,

      getOnlineCount: () => get().onlineWarriors.filter((w) => w.isOnline).length,

      getLeaderboard: (limit = 10) =>
        [...get().onlineWarriors]
          .filter((w) => w.isOnline)
          .sort((a, b) => {
            if (b.studyHoursToday !== a.studyHoursToday) {
              return b.studyHoursToday - a.studyHoursToday;
            }
            return b.quizzesToday - a.quizzesToday;
          })
          .slice(0, limit),

      getVisibleWarCries: () => get().warCries.slice(0, MAX_VISIBLE_WARCRIES),

      getSelf: () => {
        const { selfId, onlineWarriors } = get();
        if (!selfId) return undefined;
        return onlineWarriors.find((w) => w.anonymousId === selfId);
      },

      canSendWarCry: () => {
        const last = get().lastWarCryAt;
        if (last === null) return true;
        return Date.now() - last >= WARCRY_RATE_LIMIT_MS;
      },

      getWarCryCooldownRemaining: () => {
        const last = get().lastWarCryAt;
        if (last === null) return 0;
        return Math.max(0, WARCRY_RATE_LIMIT_MS - (Date.now() - last));
      },

      setSelfId: (id) =>
        set((state) => {
          state.selfId = id;
        }),

      updatePresence: (warriors) =>
        set((state) => {
          state.onlineWarriors = warriors;
          const count = warriors.filter((w) => w.isOnline).length;
          state.campfireState = deriveCampfire(count);
        }),

      updateSelfStats: (stats) =>
        set((state) => {
          const self = state.onlineWarriors.find(
            (w) => w.anonymousId === state.selfId
          );
          if (self) {
            if (stats.studyHoursToday !== undefined) self.studyHoursToday = stats.studyHoursToday;
            if (stats.quizzesToday !== undefined) self.quizzesToday = stats.quizzesToday;
            if (stats.streak !== undefined) self.streak = stats.streak;
            self.lastSeen = new Date().toISOString();
          }
        }),

      addWarCry: (cry) =>
        set((state) => {
          state.warCries.unshift(cry);
          if (state.warCries.length > WARCRY_HISTORY_LIMIT) {
            state.warCries.length = WARCRY_HISTORY_LIMIT;
          }
          if (cry.isSelf) {
            state.lastWarCryAt = Date.now();
          }
        }),

      dismissWarCry: (id) =>
        set((state) => {
          state.warCries = state.warCries.filter((c) => c.id !== id);
        }),

      reset: () =>
        set((state) => {
          state.onlineWarriors = [];
          state.warCries = [];
          state.campfireState = deriveCampfire(0);
        }),
    })),
    {
      name: 'warrior-os-ghost',
      // Only persist self identity + war cry cooldown; presence is transient/simulated.
      partialize: (state) => ({
        selfId: state.selfId,
        lastWarCryAt: state.lastWarCryAt,
      }),
    }
  )
);
