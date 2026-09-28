// ═══════════════════════════════════════════════════════════
// WARRIOR OS — XP & Achievement Store
// Handles leveling, XP, and achievement unlocks
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { Achievement } from '@/types/achievement';
import { LEVEL_THRESHOLDS } from '@/lib/constants';

interface XPStore {
  xp: number;
  level: number;
  achievements: Achievement[];
  recentUnlock: Achievement | null;

  // Queries
  getLevelTitle: () => string;
  getLevelProgress: () => number; // 0-100
  getXPForNextLevel: () => number;

  // Actions
  addXP: (amount: number, source?: string) => void;
  unlockAchievement: (id: string) => void;
  setAchievements: (achievements: Achievement[]) => void;
  clearRecentUnlock: () => void;
}

function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].minXP) {
      return LEVEL_THRESHOLDS[i].level;
    }
  }
  return 1;
}

export const useXPStore = create<XPStore>()(
  persist(
    immer((set, get) => ({
      xp: 0,
      level: 1,
      achievements: [],
      recentUnlock: null,

      getLevelTitle: () => {
        const level = get().level;
        const info = LEVEL_THRESHOLDS.find((l) => l.level === level);
        return info?.title ?? 'Recruit';
      },

      getLevelProgress: () => {
        const { xp, level } = get();
        const current = LEVEL_THRESHOLDS.find((l) => l.level === level);
        if (!current) return 0;
        if (current.maxXP === Infinity) return 100;
        const range = current.maxXP - current.minXP;
        const progress = xp - current.minXP;
        return Math.min(Math.round((progress / range) * 100), 100);
      },

      getXPForNextLevel: () => {
        const { xp, level } = get();
        const current = LEVEL_THRESHOLDS.find((l) => l.level === level);
        if (!current || current.maxXP === Infinity) return 0;
        return current.maxXP - xp;
      },

      addXP: (amount) => {
        set((state) => {
          state.xp += amount;
          const newLevel = calculateLevel(state.xp);
          if (newLevel > state.level) {
            // Level up event can be handled by subscribers
          }
          state.level = newLevel;
        });
      },

      unlockAchievement: (id) =>
        set((state) => {
          const achievement = state.achievements.find((a) => a.id === id);
          if (achievement && !achievement.unlockedAt) {
            achievement.unlockedAt = new Date().toISOString();
            state.xp += achievement.xpReward;
            state.level = calculateLevel(state.xp);
            state.recentUnlock = { ...achievement };
          }
        }),

      setAchievements: (achievements) =>
        set((state) => {
          state.achievements = achievements;
        }),

      clearRecentUnlock: () =>
        set((state) => {
          state.recentUnlock = null;
        }),
    })),
    {
      name: 'warrior-os-xp',
      partialize: (state) => ({
        xp: state.xp,
        level: state.level,
        achievements: state.achievements,
      }),
    }
  )
);
