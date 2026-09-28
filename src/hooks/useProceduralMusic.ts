// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useProceduralMusic
// Owns the audio user-gesture (Tone.start), builds the rig, and
// drives the active mood generator. Exposes generate(mood)/stop().
// Auto-mood selection by time-of-day + typing activity. SSR-safe:
// nothing touches Tone/AudioContext until generate() is called from
// a user interaction.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getToneRig } from '@/lib/procedural-music/tone-setup';
import type { MusicGenerator, GeneratorContext } from '@/lib/procedural-music/generator';
import { createMorningGenerator } from '@/lib/procedural-music/morning-gen';
import { createStudyAmbientGenerator } from '@/lib/procedural-music/study-ambient-gen';
import { createTypingRhythmGenerator } from '@/lib/procedural-music/typing-rhythm-gen';
import { createNightAmbientGenerator } from '@/lib/procedural-music/night-ambient-gen';
import { useMusicGenStore, type MusicMood, type GeneratedNote } from '@/stores/useMusicGenStore';
import { generateId } from '@/lib/utils';

/** Event-driven mood shift kinds (achievement/level/streak/decay). */
export type MoodShiftEvent = 'achievement' | 'levelup' | 'streak-broken' | 'decay-increase';

function factoryFor(mood: MusicMood): MusicGenerator {
  switch (mood) {
    case 'morning': return createMorningGenerator();
    case 'study': return createStudyAmbientGenerator();
    case 'coding': return createTypingRhythmGenerator();
    case 'night': return createNightAmbientGenerator();
  }
}

/** Best-effort: has the user studied > 4h today? Reads biometrics/OS store defensively. */
function studiedHardTodayDefault(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('warrior-os-xp');
    // No reliable hours field guaranteed; default false so night stays calm.
    void raw;
  } catch { /* ignore */ }
  return false;
}

/** Choose a mood from the current hour (typing override handled by caller). */
export function moodForNow(): MusicMood {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'study';
  return 'night'; // evening + night
}

export function useProceduralMusic() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatorRef = useRef<MusicGenerator | null>(null);
  const startedRef = useRef(false);

  const setGenerating = useMusicGenStore((s) => s.setGenerating);
  const setMoodInStore = useMusicGenStore((s) => s.setMood);
  const pushNote = useMusicGenStore((s) => s.pushNote);
  const clearNotes = useMusicGenStore((s) => s.clearNotes);

  const makeCtx = useCallback((rig: Awaited<ReturnType<typeof getToneRig>>): GeneratorContext => ({
    rig,
    seed: useMusicGenStore.getState().seed,
    onNote: (n: Omit<GeneratedNote, 'id' | 'at'>) => {
      pushNote({ ...n, id: generateId('note'), at: Date.now() });
    },
    getTypingBPM: () => useMusicGenStore.getState().typingBPM,
    studiedHardToday: studiedHardTodayDefault,
  }), [pushNote]);

  const stop = useCallback(() => {
    if (generatorRef.current) {
      generatorRef.current.stop();
      generatorRef.current = null;
    }
    setGenerating(false);
    clearNotes();
  }, [setGenerating, clearNotes]);

  /** Start (or switch to) a mood. Must be triggered from a user gesture. */
  const generate = useCallback(async (mood: MusicMood) => {
    setError(null);
    try {
      const rig = await getToneRig();
      // Tone.start() resumes the AudioContext — only meaningful under a gesture.
      if (!startedRef.current) {
        await rig.Tone.start();
        startedRef.current = true;
      }
      setIsReady(true);

      // Swap generators
      if (generatorRef.current) {
        generatorRef.current.stop();
        generatorRef.current = null;
      }
      clearNotes();

      const gen = factoryFor(mood);
      gen.start(makeCtx(rig));
      generatorRef.current = gen;

      setMoodInStore(mood);
      setGenerating(true);

      // Apply the stored master volume
      rig.master.gain.rampTo(useMusicGenStore.getState().volume, 0.4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audio failed to start');
      setGenerating(false);
    }
  }, [makeCtx, setMoodInStore, setGenerating, clearNotes]);

  /** Live volume control (0-1). No-op if the rig isn't built yet. */
  const setVolume = useCallback(async (volume: number) => {
    useMusicGenStore.getState().setVolume(volume);
    try {
      const rig = await getToneRig();
      rig.master.gain.rampTo(volume, 0.2);
    } catch { /* rig not built yet — value persisted for next generate() */ }
  }, []);

  /**
   * Event-driven mood modification (achievement/level/streak/decay).
   * Applies a short musical flourish over the current mood. Safe no-op
   * if audio isn't running.
   */
  const applyMoodShift = useCallback(async (evt: MoodShiftEvent) => {
    if (!startedRef.current) return;
    try {
      const rig = await getToneRig();
      const now = rig.Tone.now();
      switch (evt) {
        case 'achievement':
          // Major chord swell + octave up for ~3s
          rig.piano.triggerAttackRelease(['C5', 'E5', 'G5', 'C6'], '2n', now, 0.6);
          rig.bell.triggerAttackRelease('C6', '4n', now + 0.05, 0.5);
          break;
        case 'levelup':
          // Triumphant rising arpeggio (brass-like FM pad)
          ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'].forEach((n, i) => {
            rig.pad.triggerAttackRelease(n, '8n', now + i * 0.12, 0.6);
          });
          break;
        case 'streak-broken':
          // Minor chord shift + tempo slows for ~5s
          rig.piano.triggerAttackRelease(['C4', 'Eb4', 'G4'], '2n', now, 0.5);
          {
            const t = rig.Tone.getTransport();
            const base = t.bpm.value;
            t.bpm.rampTo(Math.max(50, base * 0.7), 1);
            setTimeout(() => { try { t.bpm.rampTo(base, 3); } catch { /* ignore */ } }, 1500);
          }
          break;
        case 'decay-increase':
          // Dissonance + lower pitch (tritone cluster)
          rig.pad.triggerAttackRelease('C2', '2n', now, 0.5);
          rig.piano.triggerAttackRelease(['C3', 'F#3'], '2n', now + 0.05, 0.4);
          break;
      }
    } catch { /* audio not ready */ }
  }, []);

  // Clean up on unmount — stop schedules but keep the rig for re-entry.
  useEffect(() => {
    return () => {
      if (generatorRef.current) {
        generatorRef.current.stop();
        generatorRef.current = null;
      }
    };
  }, []);

  return {
    isReady,
    error,
    generate,
    stop,
    setVolume,
    applyMoodShift,
    moodForNow,
  };
}
