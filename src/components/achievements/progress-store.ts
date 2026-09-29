// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Progress Store
// Durable counters behind multi-step achievements and XP rewards
// (quizzes completed, terminal commands, shortcuts, study minutes)
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

/** Days of per-day study minutes kept; older days are pruned. */
export const STUDY_HISTORY_DAYS = 120;
/** Study-action days kept for the study streak (enough for a 365-day streak). */
export const ACTIVITY_DAYS_KEPT = 400;

/** App ids renamed after progress was first saved → their current id. */
const RENAMED_APP_IDS: ReadonlyMap<string, string> = new Map([['gate-prep', 'training-grounds']]);

function renameAppIds(ids: readonly unknown[]): string[] {
  const out = new Set<string>();
  for (const id of ids) if (typeof id === 'string') out.add(RENAMED_APP_IDS.get(id) ?? id);
  return [...out];
}

/** Ids rewarded on one UTC day ('YYYY-MM-DD'). */
export interface DailyIds {
  day: string;
  ids: string[];
}

/** A counter that resets every UTC day. */
export interface DailyCount {
  day: string;
  count: number;
}

interface AchievementProgressState {
  /** Training Grounds quizzes + mock tests completed. null until back-filled from quiz history. */
  quizzesCompleted: number | null;
  /** Subjects with at least one completed subject quiz (never pruned, unlike quiz history). */
  subjectsQuizzed: string[];
  /** Recognised commands executed in the Terminal. */
  terminalCommands: number;
  /** Terminal easter eggs discovered — each pays XP only once. */
  eggsFound: string[];
  /** Distinct global shortcuts used, as combos such as 'ctrl+k'. */
  shortcutsUsed: string[];
  /** App ids opened at least once. */
  appsOpened: string[];
  /** Distinct settings the user has changed. */
  settingsChanged: string[];
  /** Minutes of active study, keyed by UTC day. */
  studyMinutesByDay: Record<string, number>;
  /**
   * UTC days with a study action whose own storage keeps no per-day
   * history: completed quizzes / mock tests, revisions, planner check-offs.
   */
  activityDays: string[];
  /** UTC day the daily-login XP was last paid. */
  lastLoginDay: string | null;
  /** Habits whose completion XP has been paid today. */
  habitXp: DailyIds;
  /** UTC day the study-streak bonus was last paid. */
  streakBonusDay: string | null;
  /** Notes that paid creation XP today (daily cap). */
  noteXp: DailyCount;

  // Actions
  setQuizzesCompleted: (count: number) => void;
  addQuizSubject: (subject: string) => void;
  incrementTerminalCommands: () => number;
  /** Returns true when the egg had not been found before. */
  addEggFound: (eggId: string) => boolean;
  /** Returns true when the combo had not been used before. */
  addShortcutUsed: (combo: string) => boolean;
  /** Returns true when the app had not been opened before. */
  addAppOpened: (appId: string) => boolean;
  /** Returns true when the setting had not been changed before. */
  addSettingChanged: (key: string) => boolean;
  /** Adds one study minute to `day`; returns that day's new total. */
  addStudyMinute: (day: string) => number;
  /** Records a day with a study action. */
  markActiveDay: (day: string) => void;
  setLastLoginDay: (day: string) => void;
  /** Claims the completion XP for a habit on `day`; false if already paid. */
  claimHabitXp: (day: string, habitId: string) => boolean;
  setStreakBonusDay: (day: string) => void;
  /** Claims one note-creation XP payout on `day`; false once `dailyCap` is reached. */
  claimNoteXp: (day: string, dailyCap: number) => boolean;

  // Queries
  getStudyMinutes: (day: string) => number;
}

type PersistedProgress = Pick<
  AchievementProgressState,
  | 'quizzesCompleted'
  | 'subjectsQuizzed'
  | 'terminalCommands'
  | 'eggsFound'
  | 'shortcutsUsed'
  | 'appsOpened'
  | 'settingsChanged'
  | 'studyMinutesByDay'
  | 'activityDays'
  | 'lastLoginDay'
  | 'habitXp'
  | 'streakBonusDay'
  | 'noteXp'
>;

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : undefined;
}

/**
 * Type-check each saved field; a missing or malformed one is left out so
 * the store default is used instead (a null map or list would otherwise
 * throw inside every reader).
 */
function sanitizePersisted(raw: unknown): Partial<PersistedProgress> {
  if (!raw || typeof raw !== 'object') return {};
  const p = raw as Record<string, unknown>;
  const out: Partial<PersistedProgress> = {};
  if (p.quizzesCompleted === null || isCount(p.quizzesCompleted)) out.quizzesCompleted = p.quizzesCompleted;
  if (isCount(p.terminalCommands)) out.terminalCommands = p.terminalCommands;
  for (const key of ['subjectsQuizzed', 'eggsFound', 'shortcutsUsed', 'appsOpened', 'settingsChanged', 'activityDays'] as const) {
    const list = stringList(p[key]);
    if (list) out[key] = list;
  }
  if (p.studyMinutesByDay && typeof p.studyMinutesByDay === 'object' && !Array.isArray(p.studyMinutesByDay)) {
    const minutes: Record<string, number> = {};
    for (const [day, value] of Object.entries(p.studyMinutesByDay as Record<string, unknown>)) {
      if (isCount(value)) minutes[day] = value;
    }
    out.studyMinutesByDay = minutes;
  }
  for (const key of ['lastLoginDay', 'streakBonusDay'] as const) {
    if (p[key] === null || typeof p[key] === 'string') out[key] = p[key] as string | null;
  }
  const habitXp = p.habitXp as Partial<DailyIds> | null | undefined;
  if (habitXp && typeof habitXp === 'object' && typeof habitXp.day === 'string') {
    out.habitXp = { day: habitXp.day, ids: stringList(habitXp.ids) ?? [] };
  }
  const noteXp = p.noteXp as Partial<DailyCount> | null | undefined;
  if (noteXp && typeof noteXp === 'object' && typeof noteXp.day === 'string' && isCount(noteXp.count)) {
    out.noteXp = { day: noteXp.day, count: noteXp.count };
  }
  return out;
}

export const useAchievementProgressStore = create<AchievementProgressState>()(
  persist(
    immer((set, get) => ({
      quizzesCompleted: null,
      subjectsQuizzed: [],
      terminalCommands: 0,
      eggsFound: [],
      shortcutsUsed: [],
      appsOpened: [],
      settingsChanged: [],
      studyMinutesByDay: {},
      activityDays: [],
      lastLoginDay: null,
      habitXp: { day: '', ids: [] },
      streakBonusDay: null,
      noteXp: { day: '', count: 0 },

      setQuizzesCompleted: (count) =>
        set((s) => {
          s.quizzesCompleted = Math.max(0, Math.round(count));
        }),

      addQuizSubject: (subject) =>
        set((s) => {
          if (!s.subjectsQuizzed.includes(subject)) s.subjectsQuizzed.push(subject);
        }),

      incrementTerminalCommands: () => {
        set((s) => {
          s.terminalCommands += 1;
        });
        return get().terminalCommands;
      },

      addEggFound: (eggId) => {
        if (get().eggsFound.includes(eggId)) return false;
        set((s) => {
          s.eggsFound.push(eggId);
        });
        return true;
      },

      addShortcutUsed: (combo) => {
        if (get().shortcutsUsed.includes(combo)) return false;
        set((s) => {
          s.shortcutsUsed.push(combo);
        });
        return true;
      },

      addAppOpened: (appId) => {
        if (get().appsOpened.includes(appId)) return false;
        set((s) => {
          s.appsOpened.push(appId);
        });
        return true;
      },

      addSettingChanged: (key) => {
        if (get().settingsChanged.includes(key)) return false;
        set((s) => {
          s.settingsChanged.push(key);
        });
        return true;
      },

      addStudyMinute: (day) => {
        set((s) => {
          s.studyMinutesByDay[day] = (s.studyMinutesByDay[day] ?? 0) + 1;
          const days = Object.keys(s.studyMinutesByDay);
          if (days.length > STUDY_HISTORY_DAYS) {
            days.sort();
            for (const old of days.slice(0, days.length - STUDY_HISTORY_DAYS)) {
              delete s.studyMinutesByDay[old];
            }
          }
        });
        return get().studyMinutesByDay[day] ?? 0;
      },

      markActiveDay: (day) => {
        if (get().activityDays.includes(day)) return;
        set((s) => {
          s.activityDays.push(day);
          if (s.activityDays.length > ACTIVITY_DAYS_KEPT) {
            s.activityDays.sort();
            s.activityDays.splice(0, s.activityDays.length - ACTIVITY_DAYS_KEPT);
          }
        });
      },

      setLastLoginDay: (day) =>
        set((s) => {
          s.lastLoginDay = day;
        }),

      claimHabitXp: (day, habitId) => {
        const { habitXp } = get();
        if (habitXp.day === day && habitXp.ids.includes(habitId)) return false;
        set((s) => {
          if (s.habitXp.day !== day) s.habitXp = { day, ids: [] };
          s.habitXp.ids.push(habitId);
        });
        return true;
      },

      setStreakBonusDay: (day) =>
        set((s) => {
          s.streakBonusDay = day;
        }),

      claimNoteXp: (day, dailyCap) => {
        const { noteXp } = get();
        const usedToday = noteXp.day === day ? noteXp.count : 0;
        if (usedToday >= dailyCap) return false;
        set((s) => {
          s.noteXp = { day, count: usedToday + 1 };
        });
        return true;
      },

      getStudyMinutes: (day) => get().studyMinutesByDay[day] ?? 0,
    })),
    {
      name: 'warrior-os-achievement-progress',
      version: 1,
      // v0 → v1: "App Explorer" progress follows renamed app ids.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<AchievementProgressState>;
        if (version < 1 && Array.isArray(state.appsOpened)) {
          return { ...state, appsOpened: renameAppIds(state.appsOpened) };
        }
        return state;
      },
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
      partialize: (state) => ({
        quizzesCompleted: state.quizzesCompleted,
        subjectsQuizzed: state.subjectsQuizzed,
        terminalCommands: state.terminalCommands,
        eggsFound: state.eggsFound,
        shortcutsUsed: state.shortcutsUsed,
        appsOpened: state.appsOpened,
        settingsChanged: state.settingsChanged,
        studyMinutesByDay: state.studyMinutesByDay,
        activityDays: state.activityDays,
        lastLoginDay: state.lastLoginDay,
        habitXp: state.habitXp,
        streakBonusDay: state.streakBonusDay,
        noteXp: state.noteXp,
      }),
    }
  )
);
