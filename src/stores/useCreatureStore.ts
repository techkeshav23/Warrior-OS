// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Creature Store
// Persists the digital pet: identity, XP, stage, form, mood and the
// per-day activity it observed. Every user XP gain feeds the creature.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { FG, PLASMA, STATUS, VIZ } from '@/styles/tokens';
import type {
  CreatureActivityKind,
  CreatureDayLog,
  CreatureForm,
  CreatureFormInfo,
  CreatureMood,
  CreatureStage,
  CreatureStageInfo,
  CreatureState,
  CreatureStore,
} from '@/types/creature';

// ─── Stage thresholds (by creature XP) ───
export const CREATURE_STAGES: CreatureStageInfo[] = [
  { stage: 'egg', minXP: 0, label: 'Egg', scale: 0.85 },
  { stage: 'baby', minXP: 100, label: 'Baby', scale: 1.0 },
  { stage: 'teen', minXP: 500, label: 'Teen', scale: 1.15 },
  { stage: 'adult', minXP: 2000, label: 'Adult', scale: 1.3 },
  { stage: 'legendary', minXP: 10000, label: 'Legendary', scale: 1.5 },
  { stage: 'mythic', minXP: 50000, label: 'Mythic', scale: 1.7 },
];

// ─── Evolution forms ───
export const CREATURE_FORMS: Record<CreatureForm, CreatureFormInfo> = {
  phoenix: {
    form: 'phoenix',
    name: 'Scholar Phoenix',
    blurb: 'Blue-fire bird with book wings, trailing floating formulas.',
    accent: '#00d8ff',
    detail: '#e3f7ff',
  },
  serpent: {
    form: 'serpent',
    name: 'Code Serpent',
    blurb: 'Circuit-scaled serpent that sheds binary rain.',
    accent: '#00e676',
    detail: '#b9f6ca',
  },
  dragon: {
    form: 'dragon',
    name: 'Warrior Dragon',
    blurb: 'Red and gold armored dragon with flame breath.',
    accent: '#ff3d57',
    detail: '#ffd740',
  },
};

/** Days (UTC day boundaries) the egg incubates before it may hatch — hatches on day 3. */
export const EGG_INCUBATION_DAYS = 2;
/** Creature XP needed before the egg can hatch. */
export const BABY_MIN_XP = 100;
/** Activity log retention. */
export const ACTIVITY_LOG_DAYS = 45;
/** Focused minutes in one day that earn the golden aura (5 hours). */
export const GOLDEN_AURA_MINUTES = 300;

// ─── Day helpers (UTC keys, same convention as habits/routines) ───

function utcDayKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function shiftDayKey(key: string, days: number): string {
  return utcDayKey(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000);
}

function daysBetweenKeys(later: string, earlier: string): number {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000
  );
}

// ─── Pure progression helpers ───

/** Resolve the growth stage for a given creature XP total. */
export function getStageForXP(xp: number): CreatureStage {
  let current: CreatureStage = 'egg';
  for (const s of CREATURE_STAGES) {
    if (xp >= s.minXP) current = s.stage;
  }
  return current;
}

/** StageInfo lookup helper. */
export function getStageInfo(stage: CreatureStage): CreatureStageInfo {
  return CREATURE_STAGES.find((s) => s.stage === stage) ?? CREATURE_STAGES[0];
}

/** Next stage info (or null if already mythic). */
export function getNextStageInfo(stage: CreatureStage): CreatureStageInfo | null {
  const idx = CREATURE_STAGES.findIndex((s) => s.stage === stage);
  if (idx < 0 || idx >= CREATURE_STAGES.length - 1) return null;
  return CREATURE_STAGES[idx + 1];
}

/** Index of a stage in the growth order (egg = 0). */
export function stageIndex(stage: CreatureStage): number {
  return CREATURE_STAGES.findIndex((s) => s.stage === stage);
}

/** Progress 0-100 toward the next stage, given current xp + stage. */
export function getStageProgress(xp: number, stage: CreatureStage): number {
  const info = getStageInfo(stage);
  const next = getNextStageInfo(stage);
  if (!next) return 100;
  const range = next.minXP - info.minXP;
  if (range <= 0) return 100;
  return Math.max(0, Math.min(Math.round(((xp - info.minXP) / range) * 100), 100));
}

/** Creature level curve: level n needs 40·(n-1)² XP (L2 = 40, L6 = 1000, L16 ≈ 9000). */
export function creatureLevelForXP(xp: number): number {
  return Math.min(99, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 40)));
}

/** Total creature XP needed to reach a level. */
export function xpForCreatureLevel(level: number): number {
  return 40 * Math.max(0, level - 1) ** 2;
}

/** Level progress for the stats popup. */
export function getCreatureLevelProgress(xp: number): {
  level: number;
  into: number;
  span: number;
  pct: number;
} {
  const level = creatureLevelForXP(xp);
  const floor = xpForCreatureLevel(level);
  const ceil = xpForCreatureLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = Math.max(0, xp - floor);
  return { level, into, span, pct: level >= 99 ? 100 : Math.min(100, Math.round((into / span) * 100)) };
}

/** Dominant activity from study/code points (needs 10+ points before leaning). */
export function dominantFromPoints(studyPoints: number, codePoints: number): CreatureActivityKind {
  const total = studyPoints + codePoints;
  if (total < 10) return 'balanced';
  const studyRatio = studyPoints / total;
  if (studyRatio >= 0.6) return 'study';
  if (studyRatio <= 0.4) return 'code';
  return 'balanced';
}

/** Evolution form for an activity mix (spec 6.18). */
export function determineEvolutionForm(studyPoints: number, codePoints: number): CreatureForm {
  const dominant = dominantFromPoints(studyPoints, codePoints);
  if (dominant === 'study') return 'phoenix';
  if (dominant === 'code') return 'serpent';
  return 'dragon';
}

function emptyDay(): CreatureDayLog {
  return { xp: 0, studyMinutes: 0, codeMinutes: 0, focusMinutes: 0, wasSad: false };
}

/** Get-or-create a day entry on an immer draft. */
function ensureDay(state: CreatureState, key: string): CreatureDayLog {
  if (!state.activityLog[key]) state.activityLog[key] = emptyDay();
  return state.activityLog[key];
}

// Module-scoped timer so a mood auto-revert survives re-renders (not reloads).
let moodRevertTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Persistence ───

type PersistedCreature = Pick<
  CreatureState,
  | 'id'
  | 'name'
  | 'birthDate'
  | 'stage'
  | 'form'
  | 'mood'
  | 'xp'
  | 'level'
  | 'dominantActivity'
  | 'hasHatched'
  | 'formChanges'
  | 'studyPoints'
  | 'codePoints'
  | 'activityLog'
  | 'interactions'
  | 'lastActiveAt'
  | 'goldenAuraDate'
  | 'lastSyncedUserXP'
  | 'lastStreakCheck'
>;

function defaultPersisted(): PersistedCreature {
  const now = new Date().toISOString();
  return {
    id: `creature-${Date.now().toString(36)}`,
    name: 'Kai',
    birthDate: now,
    stage: 'egg',
    form: 'dragon',
    mood: 'idle',
    xp: 0,
    level: 1,
    dominantActivity: 'balanced',
    hasHatched: false,
    formChanges: 0,
    studyPoints: 0,
    codePoints: 0,
    activityLog: {},
    interactions: 0,
    lastActiveAt: now,
    goldenAuraDate: null,
    lastSyncedUserXP: null,
    lastStreakCheck: null,
  };
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function strOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

/**
 * v0 (earlier session) stored `bornAt`, no xp/stage/form. Map it onto v1
 * so existing pets keep their name, age, hatch state and activity mix.
 * Creature XP is seeded from the user's XP on the first engine sync
 * (lastSyncedUserXP === null).
 */
function migrateCreature(persisted: unknown, version: number): PersistedCreature {
  const base = defaultPersisted();
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  if (version >= 1) {
    return { ...base, ...(p as Partial<PersistedCreature>) };
  }
  const studyPoints = numOr(p.studyPoints, 0);
  const codePoints = numOr(p.codePoints, 0);
  return {
    ...base,
    name: strOr(p.name, base.name),
    birthDate: strOr(p.bornAt, base.birthDate),
    hasHatched: p.hasHatched === true,
    studyPoints,
    codePoints,
    interactions: numOr(p.interactions, 0),
    lastActiveAt: strOr(p.lastActiveAt, base.lastActiveAt),
    goldenAuraDate: typeof p.goldenAuraDate === 'string' ? p.goldenAuraDate : null,
    form: determineEvolutionForm(studyPoints, codePoints),
    dominantActivity: dominantFromPoints(studyPoints, codePoints),
  };
}

const initial = defaultPersisted();

export const useCreatureStore = create<CreatureStore>()(
  persist(
    immer((set, get) => ({
      ...initial,
      eggReady: false,
      lastEvolution: null,
      lastFormChange: null,

      // ─── Actions ───
      setName: (name) =>
        set((s) => {
          s.name = name.trim().slice(0, 20) || 'Kai';
        }),

      setMood: (mood, autoRevertMs) => {
        set((s) => {
          s.mood = mood;
          if (mood === 'sad') ensureDay(s, utcDayKey()).wasSad = true;
        });
        if (typeof window === 'undefined') return;
        if (moodRevertTimer) {
          clearTimeout(moodRevertTimer);
          moodRevertTimer = null;
        }
        if (autoRevertMs && mood !== 'idle' && mood !== 'sleeping' && mood !== 'sad') {
          moodRevertTimer = setTimeout(() => {
            moodRevertTimer = null;
            set((s) => {
              if (s.mood === mood) s.mood = 'idle';
            });
          }, autoRevertMs);
        }
      },

      feedXP: (amount, options) => {
        const gain = Math.floor(amount);
        if (!Number.isFinite(gain) || gain <= 0) return 0;
        const silent = Boolean(options?.silent);
        set((s) => {
          const prevLevel = s.level;
          s.xp += gain;
          s.level = creatureLevelForXP(s.xp);
          ensureDay(s, utcDayKey()).xp += gain;
          s.lastActiveAt = new Date().toISOString();
          s.dominantActivity = dominantFromPoints(s.studyPoints, s.codePoints);
          // Form determination runs on each level-up (spec 6.18), post-hatch only.
          if (s.level > prevLevel && s.hasHatched) {
            const next = determineEvolutionForm(s.studyPoints, s.codePoints);
            if (next !== s.form) {
              if (!silent) {
                s.lastFormChange = { from: s.form, to: next, at: Date.now() };
                s.formChanges += 1;
              }
              s.form = next;
            }
          }
        });
        get().checkEvolution(options);
        return gain;
      },

      syncUserXP: (userXP, options) => {
        if (!Number.isFinite(userXP)) return 0;
        const st = get();
        if (st.lastSyncedUserXP === null) {
          // First run: the creature grew up alongside you — adopt your XP
          // silently (no day log, no cinematics).
          set((s) => {
            s.lastSyncedUserXP = userXP;
            if (userXP > s.xp) {
              s.xp = userXP;
              s.level = creatureLevelForXP(s.xp);
            }
            if (s.hasHatched) s.form = determineEvolutionForm(s.studyPoints, s.codePoints);
            s.dominantActivity = dominantFromPoints(s.studyPoints, s.codePoints);
          });
          get().checkEvolution({ silent: true });
          return 0;
        }
        const delta = userXP - st.lastSyncedUserXP;
        if (delta !== 0) {
          set((s) => {
            s.lastSyncedUserXP = userXP;
          });
        }
        // Negative delta (XP reset) never starves the creature.
        return delta > 0 ? get().feedXP(delta, options) : 0;
      },

      evolve: (stage, options) =>
        set((s) => {
          if (s.stage === stage) return;
          s.lastEvolution = {
            from: s.stage,
            to: stage,
            at: Date.now(),
            silent: Boolean(options?.silent),
          };
          s.stage = stage;
        }),

      checkEvolution: (options) => {
        const s = get();
        const ready =
          !s.hasHatched && s.getDaysAlive() >= EGG_INCUBATION_DAYS && s.xp >= BABY_MIN_XP;
        if (ready !== s.eggReady) {
          set((d) => {
            d.eggReady = ready;
          });
        }
        let target: CreatureStage = 'egg';
        if (s.hasHatched) {
          const byXP = getStageForXP(s.xp);
          target = byXP === 'egg' ? 'baby' : byXP;
        }
        if (target !== s.stage) get().evolve(target, options);
        return target;
      },

      registerActivity: (kind, amount = 1) =>
        set((s) => {
          const pts = Math.max(0, Math.floor(amount));
          if (kind === 'study') s.studyPoints += pts;
          else s.codePoints += pts;
          s.dominantActivity = dominantFromPoints(s.studyPoints, s.codePoints);
          s.lastActiveAt = new Date().toISOString();
        }),

      logFocusMinute: (kind) =>
        set((s) => {
          const day = ensureDay(s, utcDayKey());
          day.focusMinutes += 1;
          if (kind === 'study') {
            day.studyMinutes += 1;
            s.studyPoints += 1;
          } else if (kind === 'code') {
            day.codeMinutes += 1;
            s.codePoints += 1;
          }
          s.dominantActivity = dominantFromPoints(s.studyPoints, s.codePoints);
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
          if (s.mood === 'sleeping') s.mood = 'idle';
        }),

      grantGoldenAura: () =>
        set((s) => {
          s.goldenAuraDate = utcDayKey();
        }),

      markHatched: () => {
        set((s) => {
          s.hasHatched = true;
          s.eggReady = false;
          s.form = determineEvolutionForm(s.studyPoints, s.codePoints);
          s.dominantActivity = dominantFromPoints(s.studyPoints, s.codePoints);
        });
        get().checkEvolution();
        get().setMood('happy', 4000);
      },

      touchToday: () =>
        set((s) => {
          const today = utcDayKey();
          ensureDay(s, today);
          const cutoff = shiftDayKey(today, -ACTIVITY_LOG_DAYS);
          for (const key of Object.keys(s.activityLog)) {
            if (key < cutoff) delete s.activityLog[key];
          }
        }),

      setStreakCheck: (day, streak) =>
        set((s) => {
          s.lastStreakCheck = { day, streak };
        }),

      // ─── Queries ───
      getDominantActivity: () => {
        const { studyPoints, codePoints } = get();
        return dominantFromPoints(studyPoints, codePoints);
      },

      getEvolutionForm: () => {
        const { studyPoints, codePoints } = get();
        return determineEvolutionForm(studyPoints, codePoints);
      },

      getForm: () => get().form,

      getDaysAlive: () => {
        const born = Date.parse(get().birthDate);
        if (Number.isNaN(born)) return 0;
        return Math.max(0, daysBetweenKeys(utcDayKey(), utcDayKey(born)));
      },

      hasGoldenAura: () => get().goldenAuraDate === utcDayKey(),

      getTodayLog: () => get().activityLog[utcDayKey()] ?? emptyDay(),

      getHappyStreak: () => {
        const log = get().activityLog;
        const today = utcDayKey();
        const todayLog = log[today];
        if (todayLog?.wasSad) return 0;
        let streak = todayLog && todayLog.xp > 0 ? 1 : 0;
        for (let i = 1; i <= ACTIVITY_LOG_DAYS; i++) {
          const day = log[shiftDayKey(today, -i)];
          if (day && day.xp > 0 && !day.wasSad) streak += 1;
          else break;
        }
        return streak;
      },
    })),
    {
      name: 'warrior-os-creature',
      version: 1,
      migrate: migrateCreature,
      partialize: (s): PersistedCreature => ({
        id: s.id,
        name: s.name,
        birthDate: s.birthDate,
        stage: s.stage,
        form: s.form,
        // Only the sticky sad mood survives a reload; animations do not.
        mood: s.mood === 'sad' ? 'sad' : 'idle',
        xp: s.xp,
        level: s.level,
        dominantActivity: s.dominantActivity,
        hasHatched: s.hasHatched,
        formChanges: s.formChanges,
        studyPoints: s.studyPoints,
        codePoints: s.codePoints,
        activityLog: s.activityLog,
        interactions: s.interactions,
        lastActiveAt: s.lastActiveAt,
        goldenAuraDate: s.goldenAuraDate,
        lastSyncedUserXP: s.lastSyncedUserXP,
        lastStreakCheck: s.lastStreakCheck,
      }),
    }
  )
);

/** Mood metadata shared by the popup, island badge and lock badge. */
export const CREATURE_MOOD_META: Record<CreatureMood, { label: string; color: string }> = {
  idle: { label: 'Content', color: FG.muted },
  happy: { label: 'Happy', color: STATUS.success },
  sad: { label: 'Sad', color: STATUS.warning },
  sleeping: { label: 'Sleeping', color: VIZ[2] },
  excited: { label: 'Excited', color: VIZ[4] },
  dance: { label: 'Ecstatic', color: VIZ[4] },
  eating: { label: 'Munching', color: PLASMA[400] },
  curious: { label: 'Curious', color: PLASMA[400] },
};
