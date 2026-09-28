// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AutoMood
// While procedural music is playing and "Auto-mood" is on, keeps the
// mode matched to the moment: 6 AM–12 PM Morning, 12–6 PM Deep Study,
// 6 PM onward Night — and sustained typing overrides with Typing
// Rhythm until the keyboard has been quiet for 45 s. Typing is read
// from the timing-only biometrics bus, so the override needs typing
// biometrics to be on. Attaches once however many are mounted.
// Renders nothing.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import {
  getActiveMood,
  isMusicPlaying,
  moodForNow,
  playMood,
  refCounted,
} from '@/lib/procedural-music/engine';
import { getLastKeystrokeAt, getRecentKeystrokeTimes } from '@/hooks/useTypingBiometrics';
import { useMusicGenStore, type MusicMood } from '@/stores/useMusicGenStore';

const EVALUATE_EVERY_MS = 4_000;
/** Typing override engages after this many keystrokes within the window… */
const TYPING_MIN_KEYS = 15;
const TYPING_WINDOW_MS = 10_000;
/** …and releases after this long without a keystroke. */
const TYPING_RELEASE_MS = 45_000;

function attachAutoMood(): () => void {
  let typingOverride = false;

  const evaluate = () => {
    const s = useMusicGenStore.getState();
    if (!s.autoMood || !isMusicPlaying() || s.status !== 'playing') {
      typingOverride = false;
      return;
    }
    const now = Date.now();
    const recent = getRecentKeystrokeTimes().filter((t) => now - t <= TYPING_WINDOW_MS).length;
    const last = getLastKeystrokeAt();
    if (!typingOverride && recent >= TYPING_MIN_KEYS) typingOverride = true;
    else if (typingOverride && (last === null || now - last > TYPING_RELEASE_MS)) typingOverride = false;

    const target: MusicMood = typingOverride ? 'coding' : moodForNow();
    if (target !== getActiveMood()) void playMood(target);
  };

  const id = window.setInterval(evaluate, EVALUATE_EVERY_MS);
  const unsub = useMusicGenStore.subscribe((s, prev) => {
    if (s.autoMood && !prev.autoMood) evaluate();
  });
  return () => {
    window.clearInterval(id);
    unsub();
  };
}

const retainAutoMood = refCounted(attachAutoMood);

export function AutoMood(): null {
  useEffect(() => retainAutoMood(), []);
  return null;
}
