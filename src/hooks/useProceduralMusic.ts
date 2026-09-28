// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useProceduralMusic
// React handle on the OS-wide procedural music engine:
// generate(mood) (call it from a click — it runs Tone.start()),
// stop(), setVolume(), applyMoodShift(), moodForNow().
// While a component using this hook is mounted it holds a reference
// on the engine; when the last holder unmounts, every synth and the
// Transport are disposed. SSR-safe: nothing touches Tone until
// generate() runs in the browser.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import {
  applyMoodShift,
  moodForNow,
  playMood,
  retainMusicEngine,
  setMusicVolume,
  stopMusic,
  type MoodShiftEvent,
} from '@/lib/procedural-music/engine';
import { useMusicGenStore } from '@/stores/useMusicGenStore';

export type { MoodShiftEvent };
export { moodForNow };

export function useProceduralMusic() {
  const status = useMusicGenStore((s) => s.status);
  const error = useMusicGenStore((s) => s.error);

  useEffect(() => retainMusicEngine(), []);

  return {
    /** True while the engine is producing sound. */
    isReady: status === 'playing',
    status,
    error,
    generate: playMood,
    stop: () => stopMusic(),
    setVolume: setMusicVolume,
    applyMoodShift,
    moodForNow,
  };
}
