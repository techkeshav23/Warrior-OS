// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Creature Store
// Persists the digital pet: identity, activity mix, mood, cinematics
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type {
  ActivityKind,
  CreatureForm,
  CreatureMood,
  CreatureState,
  CreatureStage,
  FormInfo,
  StageInfo,
} from '@/types/creature';

// ─── Stage thresholds (by user XP) ───
export const CREATURE_STAGES: StageInfo[] = [
  { stage: 'egg', minXP: 0, label: 'Egg', scale: 0.85 },
  { stage: 'baby', minXP: 100, label: 'Baby', scale: 1.0 },
  { stage: 'teen', minXP: 500, label: 'Teen', scale: 1.15 },
  { stage: 'adult', minXP: 2000, label: 'Adult', scale: 1.3 },
  { stage: 'legendary', minXP: 10000, label: 'Legendary', scale: 1.5 },
  { stage: 'mythic', minXP: 50000, label: 'Mythic', scale: 1.7 },
];

// ─── Evolution forms ───
export const CREATURE_FORMS: Record<CreatureForm, FormInfo> = {
  phoenix: {
    form: 'phoenix',
    name: 'Scholar Phoenix',
    blurb: 'Blue-fire bird forged from relentless study.',
    accent: '#00f0ff',
  },
  serpent: {
    form: 'serpent',
    name: 'Code Serpent',
    blurb: 'Circuit-scaled serpent born of endless building.',
    accent: '#00e676',
  },
  dragon: {
    form: 'dragon',
    name: 'Warrior Dragon',
    blurb: 'Balanced dragon of gold and flame.',
    accent: '#ff3d71',
  },
};

/** Resolve the growth stage for a given user XP total. */
export function getStageForXP(xp: number): CreatureStage {
  let current: CreatureStage = 'egg';
  for (const s of CREATURE_STAGES) {
    if (xp >= s.minXP) current = s.stage;
  }
  return current;
}

/** StageInfo lookup helper. */
export function getStageInfo(stage: CreatureStage): StageInfo {
  return CREATURE_STAGES.find((s) => s.stage === stage) ?? CREATURE_STAGES[0];
}

/** Next stage info (or null if already mythic). */
export function getNextStageInfo(stage: CreatureStage): StageInfo | null {
  const idx = CREATURE_STAGES.findIndex((s) => s.stage === stage);
  if (idx < 0 || idx >= CREATURE_STAGES.length - 1) return null;
  return CREATURE_STAGES[idx + 1];
}

/** Progress 0-100 toward the next stage, given current xp + stage. */
export function getStageProgress(xp: number, stage: CreatureStage): number {
  const info = getStageInfo(stage);
  const next = getNextStageInfo(stage);
  if (!next) return 100;
  const range = next.minXP - info.minXP;
  if (range <= 0) return 100;
  return Math.min(Math.round(((xp - info.minXP) / range) * 100), 100);
}

const todayISODate = (): string => new Date().toISOString().slice(0, 10);

// Module-scoped timer handle so mood auto-revert survives re-renders but not reloads.
let moodRevertTimer: ReturnType<typeof setTimeout> | null = null;

export const useCreatureStore = create<CreatureState>()(
  persist(
    immer((set, get) => ({
      // ─── Identity ───
      name: 'Kai',
      bornAt: new Date().toISOString(),

      // ─── Activity ───
      studyPoints: 0,
      codePoints: 0,

      // ─── Mood / interaction ───
      mood: 'idle' as CreatureMood,
      interactions: 0,
      lastActiveAt: new Date().toISOString(),
      goldenAuraDate: null,

      // ─── Cinematic ───
      hasHatched: false,

      // ─── Actions ───
      setName: (name) =>
        set((s) => {
          s.name = name.slice(0, 20) || 'Kai';
        }),

      setMood: (mood, autoRevertMs) => {
        set((s) => {
          s.mood = mood;
        });
        if (typeof window !== 'undefined') {
          if (moodRevertTimer) clearTimeout(moodRevertTimer);
          if (autoRevertMs && mood !== 'idle' && mood !== 'sleeping' && mood !== 'sad') {
            moodRevertTimer = setTimeout(() => {
              set((s) => {
                if (s.mood === mood) s.mood = 'idle';
              });
            }, autoRevertMs);
          }
        }
      },

      registerActivity: (kind, amount = 1) =>
        set((s) => {
          if (kind === 'study') s.studyPoints += amount;
          else s.codePoints += amount;
          s.lastActiveAt = new Date().toISOString();
        }),

      registerInteraction: () =>
        set((s) => {
          s.interactions += 1;
          s.lastActiveAt = new Date().toISOString();
        }),

      markActive: () =>
        set((s) => {
          s.lastActiveAt = new Date().toISOString();
          // waking up from sleep
          if (s.mood === 'sleeping') s.mood = 'idle';
        }),

      grantGoldenAura: () =>
        set((s) => {
          s.goldenAuraDate = todayISODate();
        }),

      markHatched: () =>
        set((s) => {
          s.hasHatched = true;
          if (s.mood === 'idle') s.mood = 'happy';
        }),

      // ─── Queries ───
      getDominantActivity: (): ActivityKind => {
        const { studyPoints, codePoints } = get();
        const total = studyPoints + codePoints;
        if (total === 0) return 'balanced';
        const studyRatio = studyPoints / total;
        if (studyRatio >= 0.6) return 'study';
        if (studyRatio <= 0.4) return 'code';
        return 'balanced';
      },

      getForm: (): CreatureForm => {
        const dominant = get().getDominantActivity();
        if (dominant === 'study') return 'phoenix';
        if (dominant === 'code') return 'serpent';
        return 'dragon';
      },

      getDaysAlive: () => {
        const born = new Date(get().bornAt).getTime();
        const diff = Date.now() - born;
        return Math.max(0, Math.floor(diff / 86_400_000));
      },

      hasGoldenAura: () => get().goldenAuraDate === todayISODate(),
    })),
    {
      name: 'warrior-os-creature',
      partialize: (state) => ({
        name: state.name,
        bornAt: state.bornAt,
        studyPoints: state.studyPoints,
        codePoints: state.codePoints,
        interactions: state.interactions,
        lastActiveAt: state.lastActiveAt,
        goldenAuraDate: state.goldenAuraDate,
        hasHatched: state.hasHatched,
      }),
    }
  )
);
