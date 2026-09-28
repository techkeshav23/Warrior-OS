// ═══════════════════════════════════════════════════════════
// WARRIOR OS — MoodShift
// Event-driven music modifications over whatever is playing:
//   achievement unlocked  → major chord swell + octave up for 3 s
//   streak broken         → minor chord shift + tempo slows for 5 s
//   level up              → triumphant brass-like FM chord + rising arpeggio
//   decay stage increase  → dissonant cluster + the pitch drops
//                           (20 cents per stage until the OS is repaired)
// Sources: useXPStore (level / recentUnlock), useDecayStore (stage),
// the 'warrior:creature' event with type 'streak-break', and a daily
// streak check (shared activity history) the first time music plays
// on a day after a 2+ day streak ended — so the shift is heard even
// though the break is detected at boot, before any music is playing.
// Listeners attach once however many <MoodShift /> are mounted.
// Renders nothing.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { useMusicGenStore } from '@/stores/useMusicGenStore';
import { applyMoodShift, refCounted, setDecayDetune } from '@/lib/procedural-music/engine';
import { collectActivityDays, computeActivityStreak, utcDayKey } from '@/components/dream/activityHistory';

const STREAK_SHIFT_KEY = 'warrior-music-streak-shift';
/** Let the new mood settle before the minor shift lands. */
const STREAK_SHIFT_DELAY_MS = 2_500;

function readStreakShiftDay(): string | null {
  try {
    return window.localStorage.getItem(STREAK_SHIFT_KEY);
  } catch {
    return null;
  }
}

function writeStreakShiftDay(day: string): void {
  try {
    window.localStorage.setItem(STREAK_SHIFT_KEY, day);
  } catch {
    /* storage blocked — at worst the shift repeats */
  }
}

/** Once per day: if a 2+ day streak ended yesterday, play the minor shift. */
function checkStreakOnPlay(): number | null {
  const today = utcDayKey();
  if (readStreakShiftDay() === today) return null;
  let broken = false;
  try {
    const streak = computeActivityStreak(collectActivityDays().active, today);
    broken = streak.brokenYesterday && streak.brokenLength >= 2;
  } catch {
    return null;
  }
  writeStreakShiftDay(today);
  if (!broken) return null;
  return window.setTimeout(() => applyMoodShift('streak-broken'), STREAK_SHIFT_DELAY_MS);
}

function attachMoodShift(): () => void {
  // Start in tune with the current decay stage.
  setDecayDetune(useDecayStore.getState().decayStage);

  const unsubXP = useXPStore.subscribe((s, prev) => {
    if (s.level > prev.level) {
      applyMoodShift('levelup');
    } else if (s.recentUnlock && s.recentUnlock !== prev.recentUnlock) {
      applyMoodShift('achievement');
    }
  });

  const unsubDecay = useDecayStore.subscribe((s, prev) => {
    if (s.decayStage === prev.decayStage) return;
    if (s.decayStage > prev.decayStage) applyMoodShift('decay-increase');
    setDecayDetune(s.decayStage);
  });

  const onCreature = (e: Event) => {
    const detail = (e as CustomEvent<{ type?: string } | undefined>).detail;
    if (detail?.type === 'streak-break') {
      writeStreakShiftDay(utcDayKey());
      applyMoodShift('streak-broken');
    }
  };
  window.addEventListener('warrior:creature', onCreature);

  let streakTimer: number | null = null;
  if (useMusicGenStore.getState().status === 'playing') streakTimer = checkStreakOnPlay();
  const unsubMusic = useMusicGenStore.subscribe((s, prev) => {
    if (s.status === 'playing' && prev.status !== 'playing') {
      const next = checkStreakOnPlay(); // gated to once per day
      if (next !== null) {
        if (streakTimer !== null) window.clearTimeout(streakTimer);
        streakTimer = next;
      }
    }
  });

  return () => {
    unsubXP();
    unsubDecay();
    unsubMusic();
    if (streakTimer !== null) window.clearTimeout(streakTimer);
    window.removeEventListener('warrior:creature', onCreature);
  };
}

const retainMoodShift = refCounted(attachMoodShift);

export function MoodShift(): null {
  useEffect(() => retainMoodShift(), []);
  return null;
}
