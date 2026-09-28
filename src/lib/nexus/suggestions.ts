// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Suggestion Rules
// Contextual nudges from time of day, streak risk, last activity,
// open apps, continuous study time and typing biometrics (6.62).
// `collectSuggestionSnapshot` reads live data; `pickSuggestion` is
// pure: highest-priority eligible rule, never the previous one,
// each rule with its own cooldown.
// ═══════════════════════════════════════════════════════════

import { useAppStore } from '@/stores/useAppStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNexusStore, nexusDayKey } from '@/stores/useNexusStore';
import { NEXUS_GATE_SUBJECTS } from '@/lib/nexus-intent';
import {
  computeHabitStreak,
  formatHour,
  getBiometricInsights,
  getQuizInsights,
  habitsDoneToday,
  loadHabitsLite,
  loadNotesLite,
  type BiometricInsights,
  type QuizInsights,
} from './context';
import type { NexusActionButton, NexusCommand, NexusTone } from '@/types/nexus';

/** Minimum gap between any two suggestions. */
export const NEXUS_SUGGESTION_COOLDOWN_MS = 10 * 60_000;

const MIN = 60_000;
const HOUR = 60 * MIN;

export interface SuggestionSnapshot {
  now: number;
  /** Local hour 0-23 */
  hour: number;
  /** Minutes since the desktop session (NEXUS layer) started */
  sessionMinutes: number;
  streak: number;
  habitsCount: number;
  habitsDoneToday: number;
  quiz: QuizInsights;
  notesCount: number;
  lastNoteUpdateAt: number | null;
  windowCount: number;
  /** Minutes the desktop has had zero windows (0 when windows are open) */
  desktopEmptyMinutes: number;
  decay: { enabled: boolean; minutes: number; onBreak: boolean; breakDuration: number };
  /** null when typing biometrics are disabled in Settings */
  bio: BiometricInsights | null;
  pomodoroRunning: boolean;
  focusMinutesToday: number;
  apps: ReadonlyArray<{ id: string; name: string }>;
}

export interface SuggestionCandidate {
  id: string;
  text: string;
  tone: NexusTone;
  priority: number;
  cooldownMs: number;
  action?: NexusActionButton;
}

export interface SuggestionRuntime {
  sessionStart: number;
  emptySince: number | null;
}

// ─── Snapshot ───

export function collectSuggestionSnapshot(now: number, runtime: SuggestionRuntime): SuggestionSnapshot {
  const habits = loadHabitsLite();
  const notes = loadNotesLite();
  let lastNoteUpdateAt: number | null = null;
  for (const n of notes) {
    const t = Date.parse(n.updatedAt);
    if (Number.isFinite(t) && (lastNoteUpdateAt === null || t > lastNoteUpdateAt)) lastNoteUpdateAt = t;
  }
  const decay = useDecayStore.getState();
  const pomodoro = useNexusStore.getState().pomodoro;
  const windowCount = useWindowStore.getState().windows.length;
  return {
    now,
    hour: new Date(now).getHours(),
    sessionMinutes: Math.floor((now - runtime.sessionStart) / MIN),
    streak: computeHabitStreak(habits, now),
    habitsCount: habits.length,
    habitsDoneToday: habitsDoneToday(habits, now),
    quiz: getQuizInsights(),
    notesCount: notes.length,
    lastNoteUpdateAt,
    windowCount,
    desktopEmptyMinutes:
      windowCount === 0 && runtime.emptySince !== null ? Math.floor((now - runtime.emptySince) / MIN) : 0,
    decay: {
      enabled: decay.enabled,
      minutes: decay.continuousStudyMinutes,
      onBreak: decay.isOnBreak,
      breakDuration: decay.breakDuration,
    },
    bio: useSettingsStore.getState().biometricsEnabled ? getBiometricInsights(now) : null,
    pomodoroRunning: pomodoro.phase !== 'idle',
    focusMinutesToday: pomodoro.dayKey === nexusDayKey(now) ? pomodoro.focusMinutesToday : 0,
    apps: useAppStore.getState().registeredApps,
  };
}

// ─── Rule helpers ───

function commandButton(label: string, command: NexusCommand): NexusActionButton {
  return { kind: 'command', label, command };
}

function openAppButton(s: SuggestionSnapshot, appId: string, label: string): NexusActionButton | undefined {
  const app = s.apps.find((a) => a.id === appId);
  return app ? commandButton(label, { type: 'open_app', appId: app.id, appName: app.name }) : undefined;
}

/** Weakest attempted subject, or a day-rotating subject when there is no history. */
function focusSubject(s: SuggestionSnapshot): string {
  if (s.quiz.weakest) return s.quiz.weakest.subject;
  const dayIndex = Math.floor(s.now / (24 * HOUR));
  return NEXUS_GATE_SUBJECTS[dayIndex % NEXUS_GATE_SUBJECTS.length];
}

function breakButton(s: SuggestionSnapshot, label: string): NexusActionButton | undefined {
  return s.decay.enabled && !s.decay.onBreak ? commandButton(label, { type: 'take_break' }) : undefined;
}

type Rule = (s: SuggestionSnapshot) => SuggestionCandidate | null;

// ─── Rules (highest priority first) ───

const RULES: Rule[] = [
  // Streak at risk: evening, streak alive, nothing ticked today.
  (s) =>
    s.hour >= 20 && s.streak >= 1 && s.habitsCount > 0 && s.habitsDoneToday === 0
      ? {
          id: 'streak-risk',
          text: `${s.streak}-day streak khatre mein hai. Aaj ki ek habit tick kar de — 2 minute ka kaam.`,
          tone: 'warning',
          priority: 100,
          cooldownMs: 3 * HOUR,
          action: openAppButton(s, 'study-planner', 'Open Habit Forge'),
        }
      : null,

  // Biometrics: stress high.
  (s) =>
    s.bio?.current && s.bio.current.stress >= 70
      ? {
          id: 'bio-stress',
          text: `High stress detected (${Math.round(s.bio.current.stress)}%). 4-7-8 breathing kar — ek minute, fir wapas.`,
          tone: 'danger',
          priority: 95,
          cooldownMs: 45 * MIN,
          action: breakButton(s, 'Breathing break'),
        }
      : null,

  // Biometrics: fatigue rising.
  (s) => {
    const c = s.bio?.current;
    if (!c || c.fatigue < 65) return null;
    const earlier = s.bio?.earlierFatigue ?? null;
    const rising = earlier === null ? c.fatigue >= 75 : c.fatigue - earlier >= 8;
    if (!rising) return null;
    return {
      id: 'bio-fatigue',
      text: `Fatigue rising (${Math.round(c.fatigue)}%) — typing errors badh rahe hain. ${s.decay.breakDuration} min ka break le.`,
      tone: 'warning',
      priority: 90,
      cooldownMs: 45 * MIN,
      action: breakButton(s, 'Take a break'),
    };
  },

  // Long continuous study session.
  (s) =>
    s.decay.enabled && !s.decay.onBreak && s.decay.minutes >= 90
      ? {
          id: 'break-time',
          text: `${s.decay.minutes} min se lagatar laga hai. ${s.decay.breakDuration} min ka break le — focus wapas tez hoga.`,
          tone: 'info',
          priority: 85,
          cooldownMs: HOUR,
          action: breakButton(s, `${s.decay.breakDuration} min break`),
        }
      : null,

  // Biometrics: in the zone.
  (s) =>
    s.bio?.current && s.bio.current.focus >= 90 && s.bio.current.energy >= 50
      ? {
          id: 'bio-zone',
          text: `You're in the zone — focus ${Math.round(s.bio.current.focus)}%. Keep going, flow mat tod.`,
          tone: 'success',
          priority: 80,
          cooldownMs: HOUR,
          action: s.pomodoroRunning
            ? undefined
            : commandButton('Lock in: pomodoro', { type: 'start_pomodoro' }),
        }
      : null,

  // Biometrics history: focus peak hour is now (or next hour).
  (s) => {
    const peak = s.bio?.focusPeakHour;
    const value = s.bio?.focusPeakValue ?? 0;
    if (peak === null || peak === undefined || value < 55) return null;
    if (s.hour !== peak && (s.hour + 1) % 24 !== peak) return null;
    const subject = focusSubject(s);
    return {
      id: 'bio-focus-peak',
      text: `Tera focus ${formatHour(peak)} ke aas-paas peak karta hai. Hard topics isi window mein — ${subject} abhi utha.`,
      tone: 'info',
      priority: 70,
      cooldownMs: 20 * HOUR,
      action: commandButton(`${subject} quiz`, { type: 'start_quiz', mode: 'quiz', subject }),
    };
  },

  // Late night.
  (s) =>
    s.hour >= 1 && s.hour < 5 && s.sessionMinutes >= 5
      ? {
          id: 'late-night',
          text: `Raat ke ${s.hour} baj gaye. Sleep is a weapon too — kal fresh dimaag se jeetenge.`,
          tone: 'warning',
          priority: 65,
          cooldownMs: 3 * HOUR,
        }
      : null,

  // Bad recent quiz → revise formulas for that subject.
  (s) => {
    const last = s.quiz.last;
    if (!last || last.totalQuestions < 3 || last.pct >= 50 || s.now - last.timestamp > 30 * MIN) return null;
    return {
      id: 'weak-subject',
      text: `${last.subject} mein ${last.pct}% — tough round. Formulas revise kar, fir dobara try.`,
      tone: 'info',
      priority: 60,
      cooldownMs: 2 * HOUR,
      action: commandButton(`${last.subject} flashcards`, {
        type: 'start_quiz',
        mode: 'flashcards',
        subject: last.subject,
      }),
    };
  },

  // Morning: nothing done yet.
  (s) => {
    if (s.hour < 5 || s.hour >= 11 || s.sessionMinutes > 30 || s.focusMinutesToday > 0 || s.pomodoroRunning) {
      return null;
    }
    return {
      id: 'morning-plan',
      text: `Subah ka dimaag sabse tez hota hai. Hard topic pehle — ${focusSubject(s)} se shuru, 25 min pomodoro ke saath.`,
      tone: 'info',
      priority: 55,
      cooldownMs: 20 * HOUR,
      action: commandButton('Start pomodoro', { type: 'start_pomodoro' }),
    };
  },

  // No quiz in a day (or never).
  (s) => {
    const subject = focusSubject(s);
    const action = commandButton(`${subject} quiz`, { type: 'start_quiz', mode: 'quiz', subject });
    if (s.quiz.last) {
      const hours = Math.floor((s.now - s.quiz.last.timestamp) / HOUR);
      if (hours < 24) return null;
      return {
        id: 'quiz-stale',
        text: `${hours}h se koi quiz nahi hua. 10 min ka ${subject} quiz — chal.`,
        tone: 'info',
        priority: 50,
        cooldownMs: 6 * HOUR,
        action,
      };
    }
    if (s.sessionMinutes < 15) return null;
    return {
      id: 'quiz-stale',
      text: `Abhi tak ek bhi quiz nahi diya. ${subject} se shuru kar — pehla step sabse bhaari hota hai.`,
      tone: 'info',
      priority: 50,
      cooldownMs: 6 * HOUR,
      action,
    };
  },

  // Desktop idle with nothing open.
  (s) =>
    s.windowCount === 0 && s.desktopEmptyMinutes >= 5
      ? {
          id: 'idle-desktop',
          text: 'Desktop khaali hai. Study mode on karun? GATE + Notes side by side, pomodoro ready.',
          tone: 'info',
          priority: 40,
          cooldownMs: 2 * HOUR,
          action: commandButton('Study mode', { type: 'study_mode' }),
        }
      : null,

  // Too many windows.
  (s) =>
    s.windowCount >= 6
      ? {
          id: 'too-many-windows',
          text: `${s.windowCount} windows khule hain — focus bikhar raha hai. Study mode se clean setup kar.`,
          tone: 'info',
          priority: 35,
          cooldownMs: 2 * HOUR,
          action: commandButton('Study mode', { type: 'study_mode' }),
        }
      : null,

  // Notes untouched for days.
  (s) => {
    if (s.notesCount === 0 || s.lastNoteUpdateAt === null) return null;
    const days = Math.floor((s.now - s.lastNoteUpdateAt) / (24 * HOUR));
    if (days < 3) return null;
    return {
      id: 'notes-stale',
      text: `${days} din se notes untouched. Aaj ka ek concept likh de — 5 min lagenge.`,
      tone: 'info',
      priority: 30,
      cooldownMs: 24 * HOUR,
      action: openAppButton(s, 'notes', 'Open Notes'),
    };
  },
];

/** Pure selection: best eligible rule that is not the previous suggestion. */
export function pickSuggestion(
  snapshot: SuggestionSnapshot,
  history: { lastId: string | null; ruleLastFired: Record<string, number> }
): SuggestionCandidate | null {
  const candidates: SuggestionCandidate[] = [];
  for (const rule of RULES) {
    const candidate = rule(snapshot);
    if (!candidate) continue;
    if (candidate.id === history.lastId) continue;
    const last = history.ruleLastFired[candidate.id];
    if (last !== undefined && snapshot.now - last < candidate.cooldownMs) continue;
    candidates.push(candidate);
  }
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates[0] ?? null;
}
