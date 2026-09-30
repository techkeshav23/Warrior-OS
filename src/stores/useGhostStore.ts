// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost Warriors Store
// Anonymous multiplayer presence + war cries. The data source is the
// offline local campfire (other open tabs + SIM-labelled warriors; see `mode`).
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type {
  CampfireState,
  GhostLifetimeStats,
  GhostPresenceMode,
  GhostWarrior,
  WarCry,
} from '@/types/ghost';

/** War cries on screen at once; the rest wait in the queue. */
export const MAX_VISIBLE_WARCRIES = 3;
const WARCRY_QUEUE_LIMIT = 20;
/** One war cry per 2 minutes per warrior. */
export const WARCRY_RATE_LIMIT_MS = 2 * 60 * 1000;
export const WARCRY_MAX_LENGTH = 50;

/** Derive campfire flame intensity (0..1) from the online count. */
export function deriveCampfire(onlineCount: number): CampfireState {
  // 1 = tiny ember, 5 = small fire, 10 = bonfire, 20+ = inferno
  const intensity = Math.min(Math.max(onlineCount, 0) / 20, 1);
  return { onlineCount, fireIntensity: intensity };
}

/** Leaderboard order: study hours, then quizzes, then streak. */
export function rankWarriors(warriors: GhostWarrior[]): GhostWarrior[] {
  return warriors
    .filter((w) => w.isOnline)
    .sort(
      (a, b) =>
        b.studyHoursToday - a.studyHoursToday ||
        b.quizzesToday - a.quizzesToday ||
        b.streak - a.streak ||
        a.anonymousId.localeCompare(b.anonymousId)
    );
}

const EMPTY_LIFETIME: GhostLifetimeStats = { warCriesSent: 0, minutesWithOthers: 0, maxOnlineSeen: 0 };

interface GhostStore {
  // State
  selfId: string | null; // session identity (Warrior#XXXX), not persisted
  mode: GhostPresenceMode;
  lastError: string | null;
  onlineWarriors: GhostWarrior[];
  campfireState: CampfireState;
  warCries: WarCry[]; // arrival order; the first MAX_VISIBLE are on screen
  lastWarCryAt: number | null; // epoch ms of the last war cry sent by self
  leaderboardOpen: boolean;
  lifetime: GhostLifetimeStats;

  // Queries (return primitives or call from handlers / useMemo)
  getOnlineCount: () => number;
  getOthersOnlineCount: () => number;
  getLeaderboard: (limit?: number) => GhostWarrior[];
  getSelfRank: () => number | null;
  getVisibleWarCries: () => WarCry[];
  getSelf: () => GhostWarrior | undefined;
  canSendWarCry: () => boolean;
  getWarCryCooldownRemaining: () => number; // ms

  // Actions
  setSelfId: (id: string) => void;
  setMode: (mode: GhostPresenceMode, error?: string | null) => void;
  updatePresence: (warriors: GhostWarrior[]) => void;
  addWarCry: (cry: WarCry) => void;
  dismissWarCry: (id: string) => void;
  markWarCrySent: (broadcast: boolean) => void;
  setLeaderboardOpen: (open: boolean) => void;
  toggleLeaderboard: () => void;
  addMinutesWithOthers: (minutes: number) => void;
  noteOnlineCount: (count: number) => void;
  reset: () => void;
}

type PersistedGhost = Pick<GhostStore, 'lastWarCryAt' | 'lifetime'>;

export const useGhostStore = create<GhostStore>()(
  persist(
    immer((set, get) => ({
      selfId: null,
      mode: 'disabled' as GhostPresenceMode,
      lastError: null,
      onlineWarriors: [],
      campfireState: deriveCampfire(0),
      warCries: [],
      lastWarCryAt: null,
      leaderboardOpen: false,
      lifetime: { ...EMPTY_LIFETIME },

      getOnlineCount: () => get().onlineWarriors.filter((w) => w.isOnline).length,

      getOthersOnlineCount: () => get().onlineWarriors.filter((w) => w.isOnline && !w.isSelf).length,

      getLeaderboard: (limit = 10) => rankWarriors(get().onlineWarriors).slice(0, limit),

      getSelfRank: () => {
        const ranked = rankWarriors(get().onlineWarriors);
        const idx = ranked.findIndex((w) => w.isSelf);
        return idx >= 0 ? idx + 1 : null;
      },

      getVisibleWarCries: () => get().warCries.slice(0, MAX_VISIBLE_WARCRIES),

      getSelf: () => get().onlineWarriors.find((w) => w.isSelf),

      canSendWarCry: () => {
        const last = get().lastWarCryAt;
        return last === null || Date.now() - last >= WARCRY_RATE_LIMIT_MS;
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

      setMode: (mode, error = null) =>
        set((state) => {
          state.mode = mode;
          state.lastError = error;
        }),

      updatePresence: (warriors) =>
        set((state) => {
          state.onlineWarriors = warriors;
          state.campfireState = deriveCampfire(warriors.filter((w) => w.isOnline).length);
        }),

      addWarCry: (cry) =>
        set((state) => {
          if (state.warCries.some((c) => c.id === cry.id)) return;
          state.warCries.push(cry);
          // Drop the oldest queued (not yet visible) cries beyond the limit.
          while (state.warCries.length > WARCRY_QUEUE_LIMIT) {
            state.warCries.splice(MAX_VISIBLE_WARCRIES, 1);
          }
        }),

      dismissWarCry: (id) =>
        set((state) => {
          state.warCries = state.warCries.filter((c) => c.id !== id);
        }),

      markWarCrySent: (broadcast) =>
        set((state) => {
          state.lastWarCryAt = Date.now();
          if (broadcast) state.lifetime.warCriesSent += 1;
        }),

      setLeaderboardOpen: (open) =>
        set((state) => {
          state.leaderboardOpen = open;
        }),

      toggleLeaderboard: () =>
        set((state) => {
          state.leaderboardOpen = !state.leaderboardOpen;
        }),

      addMinutesWithOthers: (minutes) =>
        set((state) => {
          state.lifetime.minutesWithOthers += Math.max(0, minutes);
        }),

      noteOnlineCount: (count) =>
        set((state) => {
          if (count > state.lifetime.maxOnlineSeen) state.lifetime.maxOnlineSeen = count;
        }),

      reset: () =>
        set((state) => {
          state.onlineWarriors = [];
          state.warCries = [];
          state.campfireState = deriveCampfire(0);
          state.leaderboardOpen = false;
        }),
    })),
    {
      name: 'warrior-os-ghost',
      version: 1,
      // v0 persisted a device-wide selfId; identities are now per session.
      migrate: (persisted: unknown): PersistedGhost => {
        const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
        const lifetime = (p.lifetime && typeof p.lifetime === 'object' ? p.lifetime : {}) as Partial<GhostLifetimeStats>;
        return {
          lastWarCryAt: typeof p.lastWarCryAt === 'number' ? p.lastWarCryAt : null,
          lifetime: { ...EMPTY_LIFETIME, ...lifetime },
        };
      },
      // Only the cooldown + lifetime counters persist; presence is live data.
      partialize: (state): PersistedGhost => ({
        lastWarCryAt: state.lastWarCryAt,
        lifetime: state.lifetime,
      }),
    }
  )
);
