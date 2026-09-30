// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Suggestion Rules
// Contextual nudges from time of day, streak risk, cards due for
// review, last activity, open apps, continuous study time and typing
// biometrics (6.62). Visitors get a welcome instead of owner nags.
// `collectSuggestionSnapshot` reads live data; `pickSuggestion` is
// pure: highest-priority eligible rule, never the previous one,
// each rule with its own cooldown.
// ═══════════════════════════════════════════════════════════

import { useAppStore } from '@/stores/useAppStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNexusStore, nexusDayKey } from '@/stores/useNexusStore';
import {
  computeHabitStreak,
  formatHour,
  getBiometricInsights,
  getLearningInsights,
  getQuizInsights,
  habitsDoneToday,
  loadHabitsLite,
  loadNotesLite,
  type BiometricInsights,
  type QuizInsights,
} from './context';
import { getVisitorMode, type VisitorMode } from '@/lib/visitor';
import { morningBriefingRanToday } from './briefing';
import { OWNER } from '@/config/owner';
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
  /** Cards due for spaced-repetition review now, over all decks */
  dueCards: number;
  /** Deck to work on next (most due, else weakest), null without decks */
  focusDeck: string | null;
  /** Owner, guest, or null when the lock screen never asked */
  visitor: VisitorMode | null;
  notesCount: number;
  lastNoteUpdateAt: number | null;
  windowCount: number;
  /** Minutes the desktop has had zero windows (0 when windows are open) */
  desktopEmptyMinutes: number;
  decay: { enabled: boolean; minutes: number; onBreak: boolean; breakDuration: number };
  /** The daily briefing already ran this morning (skip the morning-plan nudge). */
  briefedToday?: boolean;
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
  const learning = getLearningInsights(now);
  return {
    now,
    hour: new Date(now).getHours(),
    sessionMinutes: Math.floor((now - runtime.sessionStart) / MIN),
    streak: computeHabitStreak(habits, now),
    habitsCount: habits.length,
    habitsDoneToday: habitsDoneToday(habits, now),
    quiz: getQuizInsights(),
    dueCards: learning.dueCards,
    focusDeck: learning.focus?.name ?? null,
    visitor: getVisitorMode(),
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
    briefedToday: morningBriefingRanToday(now),
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

/** Deck to push next: weakest by quiz accuracy, else the learning focus deck. */
function focusSubject(s: SuggestionSnapshot): string | null {
  return s.quiz.weakest?.subject ?? s.focusDeck;
}

function reviewButton(label: string): NexusActionButton {
  return commandButton(label, { type: 'start_quiz', mode: 'flashcards' });
}

/** Nags about the user's own streaks, quizzes and notes are for the owner, not visitors. */
function ownerOnly(s: SuggestionSnapshot): boolean {
  return s.visitor !== 'guest';
}

/** Quiz on a deck, or a quick quiz when there is none to point at. */
function quizButton(subject: string | null): NexusActionButton {
  return subject
    ? commandButton(`${subject} quiz`, { type: 'start_quiz', mode: 'quiz', subject })
    : commandButton('Quick quiz', { type: 'start_quiz', mode: 'quiz' });
}

function breakButton(s: SuggestionSnapshot, label: string): NexusActionButton | undefined {
  return s.decay.enabled && !s.decay.onBreak ? commandButton(label, { type: 'take_break' }) : undefined;
}

type Rule = (s: SuggestionSnapshot) => SuggestionCandidate | null;

// ─── Rules (highest priority first) ───

const RULES: Rule[] = [
  // Streak at risk: evening, streak alive, nothing ticked today.
  (s) =>
    ownerOnly(s) && s.hour >= 20 && s.streak >= 1 && s.habitsCount > 0 && s.habitsDoneToday === 0
      ? {
          id: 'streak-risk',
          text: `${s.streak}-day streak khatre mein hai. Aaj ki ek habit tick kar de — 2 minute ka kaam.`,
          tone: 'warning',
          priority: 100,
          cooldownMs: 3 * HOUR,
          action: openAppButton(s, 'study-planner', 'Open Habit Forge'),
        }
      : null,

  // Visitor: a pointer to what NEXUS can do, once they have looked around a bit.
  (s) =>
    s.visitor === 'guest' && s.sessionMinutes >= 3
      ? {
          id: 'guest-welcome',
          text: `Exploring ${OWNER.shortName}'s OS? Press Ctrl+K and just type — "study mode", "quiz me", "who built this".`,
          tone: 'info',
          priority: 75,
          cooldownMs: 24 * HOUR,
          action: { kind: 'ask', label: 'Tour the OS', prompt: 'What can this OS do?' },
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
      text: `Tera focus ${formatHour(peak)} ke aas-paas peak karta hai. Hard topics isi window mein — ${subject ?? 'sabse tough deck'} abhi utha.`,
      tone: 'info',
      priority: 70,
      cooldownMs: 20 * HOUR,
      action: quizButton(subject),
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

  // Bad recent quiz → flashcards for that deck.
  (s) => {
    const last = s.quiz.last;
    if (!last || last.totalQuestions < 3 || last.pct >= 50 || s.now - last.timestamp > 30 * MIN) return null;
    return {
      id: 'weak-subject',
      text: `${last.subject} mein ${last.pct}% — tough round. Flashcards se revise kar, fir dobara try.`,
      tone: 'info',
      priority: 60,
      cooldownMs: 2 * HOUR,
      action: commandButton(`Review ${last.subject}`, {
        type: 'start_quiz',
        mode: 'flashcards',
        subject: last.subject,
      }),
    };
  },

  // Cards piling up for review.
  (s) =>
    ownerOnly(s) && s.dueCards >= 10 && !s.pomodoroRunning
      ? {
          id: 'cards-due',
          text: `${s.dueCards} cards review ke liye due hain${s.focusDeck ? ` (${s.focusDeck} sabse aage)` : ''}. 10 minute ka review — memory fresh rahegi.`,
          tone: 'info',
          priority: 58,
          cooldownMs: 4 * HOUR,
          action: reviewButton('Review due cards'),
        }
      : null,

  // Morning: nothing done yet.
  (s) => {
    if (
      !ownerOnly(s) ||
      s.briefedToday ||
      s.hour < 5 ||
      s.hour >= 11 ||
      s.sessionMinutes > 30 ||
      s.focusMinutesToday > 0 ||
      s.pomodoroRunning
    ) {
      return null;
    }
    return {
      id: 'morning-plan',
      text: `Subah ka dimaag sabse tez hota hai. Hard topic pehle — ${focusSubject(s) ?? 'sabse tough deck'} se shuru, 25 min pomodoro ke saath.`,
      tone: 'info',
      priority: 55,
      cooldownMs: 20 * HOUR,
      action: commandButton('Start pomodoro', { type: 'start_pomodoro' }),
    };
  },

  // No quiz in a day (or never).
  (s) => {
    if (!ownerOnly(s)) return null;
    const subject = focusSubject(s);
    const action = quizButton(subject);
    if (s.quiz.last) {
      const hours = Math.floor((s.now - s.quiz.last.timestamp) / HOUR);
      if (hours < 24) return null;
      return {
        id: 'quiz-stale',
        text: `${hours}h se koi quiz nahi hua. 10 min ka ${subject ? `${subject} ` : ''}quiz — chal.`,
        tone: 'info',
        priority: 50,
        cooldownMs: 6 * HOUR,
        action,
      };
    }
    if (s.sessionMinutes < 15) return null;
    return {
      id: 'quiz-stale',
      text: `Abhi tak ek bhi quiz nahi diya. ${subject ?? 'Kisi bhi deck'} se shuru kar — pehla step sabse bhaari hota hai.`,
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
          text: 'Desktop khaali hai. Study mode on karun? Training Grounds + Notes side by side, pomodoro ready.',
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
    if (!ownerOnly(s) || s.notesCount === 0 || s.lastNoteUpdateAt === null) return null;
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
