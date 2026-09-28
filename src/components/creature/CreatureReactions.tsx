// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Reactions
// Bridges OS signals → creature moods. Renders nothing. Every signal is
// observed from existing stores, so no other feature has to change:
//   • quiz history grows          → quiz complete: happy + jump
//                                   100% quiz: victory dance + flames
//   • activity streak broke       → sad + dim + shiver (sticky until fed)
//   • 2 days without XP           → sad (neglect warning)
//   • a window opens              → curious look
//   • an achievement unlocks      → excited spin
//   • XP gained                   → eating "nom"
//   • 5h focus (CreatureEngine)   → golden aura for the rest of the day
// Other features may also fire reactions directly:
//   dispatchCreatureEvent({ type: 'quiz-perfect' })
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useQuizHistoryStore, type QuizAttempt } from '@/stores/useQuizHistoryStore';
import { useCreatureStore } from '@/stores/useCreatureStore';
import type { CreatureMood } from '@/types/creature';
import {
  collectActivityDays,
  computeActivityStreak,
  shiftDayKey,
  utcDayKey,
} from '@/components/dream/activityHistory';
import { sayViaNexus } from './osBridge';

/** Detail payload accepted by the 'warrior:creature' custom event. */
export interface CreatureEventDetail {
  type:
    | 'quiz-complete'
    | 'quiz-perfect'
    | 'streak-break'
    | 'window-open'
    | 'study-milestone'
    | 'activity';
  kind?: 'study' | 'code';
  amount?: number;
}

export const CREATURE_EVENT = 'warrior:creature';

/** Apply one reaction to the creature. */
export function applyCreatureReaction(detail: CreatureEventDetail): void {
  const c = useCreatureStore.getState();
  switch (detail.type) {
    case 'quiz-complete':
      c.setMood('happy', 2600);
      break;
    case 'quiz-perfect':
      c.setMood('dance', 4500);
      break;
    case 'streak-break':
      c.setMood('sad'); // sticky until the next positive event
      break;
    case 'window-open':
      if (c.mood === 'idle' || c.mood === 'sleeping') c.setMood('curious', 1800);
      break;
    case 'study-milestone':
      c.grantGoldenAura();
      c.setMood('dance', 4500);
      break;
    case 'activity':
      if (detail.kind) c.registerActivity(detail.kind, detail.amount ?? 1);
      break;
  }
}

function latestTimestamp(attempts: QuizAttempt[]): number {
  let max = 0;
  for (const a of attempts) if (typeof a.timestamp === 'number' && a.timestamp > max) max = a.timestamp;
  return max;
}

/** Once per day: detect a broken streak or a neglected creature. */
function runDailyMoodCheck(): void {
  const c = useCreatureStore.getState();
  if (!c.hasHatched) return;
  const today = utcDayKey();
  if (c.lastStreakCheck?.day === today) return;
  const streak = computeActivityStreak(collectActivityDays().active, today);
  c.setStreakCheck(today, streak.current);

  if (streak.brokenYesterday && streak.brokenLength >= 2) {
    applyCreatureReaction({ type: 'streak-break' });
    sayViaNexus(
      `Your ${streak.brokenLength}-day streak broke yesterday. ${c.name} is sad. Study today to relight it.`,
      'warning'
    );
    return;
  }

  // Neglect: no XP fed yesterday or the day before (creature older than 3 days).
  const log = c.activityLog;
  const fed = [1, 2].some((i) => (log[shiftDayKey(today, -i)]?.xp ?? 0) > 0);
  if (!fed && c.getDaysAlive() >= 3) {
    c.setMood('sad');
    sayViaNexus(`${c.name} has not been fed in two days. Earn some XP to cheer it up.`, 'warning');
  }
}

export function CreatureReactions() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const creature = () => useCreatureStore.getState();

    // ─── XP gains + achievement unlocks ───
    const unsubXP = useXPStore.subscribe((s, prev) => {
      const unlockId = s.recentUnlock?.id ?? null;
      if (unlockId && unlockId !== (prev.recentUnlock?.id ?? null)) {
        creature().setMood('excited', 4000);
        return;
      }
      if (s.xp > prev.xp) {
        const mood: CreatureMood = creature().mood;
        if (mood === 'idle' || mood === 'sleeping' || mood === 'sad') creature().setMood('eating', 2200);
      }
    });

    // ─── Quiz completions (QuizEngine writes one row per topic; batch them) ───
    let lastQuizTs = latestTimestamp(useQuizHistoryStore.getState().attempts);
    let pending: QuizAttempt[] = [];
    let quizTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubQuiz = useQuizHistoryStore.subscribe((s) => {
      const fresh = s.attempts.filter((a) => typeof a.timestamp === 'number' && a.timestamp > lastQuizTs);
      if (fresh.length === 0) return;
      lastQuizTs = latestTimestamp(fresh);
      pending = pending.concat(fresh);
      if (quizTimer) clearTimeout(quizTimer);
      quizTimer = setTimeout(() => {
        quizTimer = null;
        const batch = pending;
        pending = [];
        const total = batch.reduce((n, a) => n + a.totalQuestions, 0);
        const correct = batch.reduce((n, a) => n + a.correctAnswers, 0);
        applyCreatureReaction({ type: total > 0 && correct === total ? 'quiz-perfect' : 'quiz-complete' });
      }, 400);
    });

    // ─── Window opens → curious look ───
    const unsubWindows = useWindowStore.subscribe((s, prev) => {
      if (s.windows.length <= prev.windows.length) return;
      const opened = s.windows.some((w) => !prev.windows.some((p) => p.id === w.id));
      if (opened) applyCreatureReaction({ type: 'window-open' });
    });

    // ─── Custom events from other features ───
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<CreatureEventDetail>).detail;
      if (detail && typeof detail.type === 'string') applyCreatureReaction(detail);
    };
    window.addEventListener(CREATURE_EVENT, onEvent);

    // ─── Streak / neglect: on mount, then hourly (catches day rollover) ───
    runDailyMoodCheck();
    const daily = setInterval(runDailyMoodCheck, 60 * 60 * 1000);

    return () => {
      unsubXP();
      unsubQuiz();
      unsubWindows();
      if (quizTimer) clearTimeout(quizTimer);
      window.removeEventListener(CREATURE_EVENT, onEvent);
      clearInterval(daily);
    };
  }, []);

  return null;
}

/** Small typed helper other features can import to fire a reaction. */
export function dispatchCreatureEvent(detail: CreatureEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CreatureEventDetail>(CREATURE_EVENT, { detail }));
}

// Keep the mood type referenced for consumers importing from this module.
export type { CreatureMood };
