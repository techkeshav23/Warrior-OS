// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Typing Rhythm Generator
// YOUR typing tempo = the beat. Keystroke timestamps come from the
// typing-biometrics bus; the average in-burst interval becomes the
// tempo (one keystroke = one eighth note, clamped 60-140 BPM).
// Lo-fi beat: kick on 1 + 3, snare on 2 + 4, hihat on every eighth,
// bass walking pentatonic roots, soft chord on each bar. Stop typing
// → the beat fades out over 4 s; type again → it comes right back.
// If typing biometrics are switched off it plays a steady 90 BPM.
// ═══════════════════════════════════════════════════════════

import type { Loop } from 'tone';
import {
  type MusicGenerator,
  type GeneratorContext,
  clearTransportEvents,
  reportNote,
  transposeNote,
} from './generator';
import { makeRng, noteToDegree } from './tone-setup';
import {
  onTypingKeystroke,
  getRecentKeystrokeTimes,
  getLastKeystrokeAt,
  isTypingTrackerActive,
} from '@/hooks/useTypingBiometrics';
import { recentKeystrokeInterval } from '@/lib/biometric-calculator';
import { useMusicGenStore } from '@/stores/useMusicGenStore';

export const TYPING_FALLBACK_BPM = 90;
export const TYPING_MIN_BPM = 60;
export const TYPING_MAX_BPM = 140;
/** Spec: the beat fades over 4 s after typing stops. */
export const TYPING_FADE_SECONDS = 4;
/** A gap this long counts as "stopped typing". */
const STOP_TYPING_MS = 1600;
const BPM_UPDATE_MS = 400;

/** Keystroke interval (ms) → tempo, treating each keystroke as an eighth note. */
export function intervalToBpm(intervalMs: number): number {
  const bpm = 60_000 / (intervalMs * 2);
  return Math.max(TYPING_MIN_BPM, Math.min(TYPING_MAX_BPM, Math.round(bpm)));
}

// Four-bar root progressions drawn from C major pentatonic.
const PROGRESSIONS: string[][] = [
  ['C2', 'A1', 'E2', 'G1'],
  ['A1', 'G1', 'C2', 'E2'],
  ['C2', 'E2', 'A1', 'G1'],
  ['E2', 'A1', 'D2', 'G1'],
];
// Soft pentatonic voicings (sixth / add9 colours) keyed by root letter.
const VOICINGS: Record<string, string[]> = {
  C: ['E4', 'G4', 'A4', 'D5'],
  A: ['C4', 'E4', 'G4', 'D5'],
  E: ['G4', 'A4', 'D5', 'E5'],
  G: ['A4', 'D5', 'E5', 'G5'],
  D: ['E4', 'A4', 'C5', 'G5'],
};

export function createTypingRhythmGenerator(): MusicGenerator {
  let ctx: GeneratorContext | null = null;
  let loop: Loop | null = null;
  let events: number[] = [];
  let unsubKeys: (() => void) | null = null;
  let step = 0;
  let bar = 0;
  let audible = false;
  let steady = false;
  let lastBpmUpdate = 0;

  const setAudible = (next: boolean) => {
    if (!ctx || audible === next) return;
    audible = next;
    ctx.rig.beatBus.gain.rampTo(next ? 1 : 0, next ? 0.35 : TYPING_FADE_SECONDS);
    useMusicGenStore.getState().setTypingActive(next);
  };

  return {
    start(context) {
      ctx = context;
      const { rig } = context;
      const transport = rig.Tone.getTransport();
      const rng = makeRng(context.seed ^ 0x33333);
      const progression = PROGRESSIONS[Math.floor(rng() * PROGRESSIONS.length)];
      step = 0;
      bar = 0;

      steady = !isTypingTrackerActive();
      const last = getLastKeystrokeAt();
      const typingNow = !steady && last !== null && Date.now() - last < STOP_TYPING_MS;
      const interval = steady ? null : recentKeystrokeInterval(getRecentKeystrokeTimes());
      const bpm = interval ? intervalToBpm(interval) : TYPING_FALLBACK_BPM;
      transport.bpm.rampTo(bpm, 0.5);
      transport.swing = 0.12; // lo-fi shuffle
      transport.swingSubdivision = '8n';
      useMusicGenStore.getState().updateTypingRhythm(bpm);

      audible = steady || typingNow;
      const now = rig.Tone.now();
      rig.beatBus.gain.cancelScheduledValues(now);
      rig.beatBus.gain.setValueAtTime(audible ? 1 : 0, now);
      useMusicGenStore.getState().setTypingActive(audible);

      loop = new rig.Tone.Loop((time) => {
        const c = ctx;
        if (!c) return;
        const s = step % 16;
        const root = progression[bar % progression.length];

        if (s % 2 === 0) rig.hihat.triggerAttackRelease(300, '32n', time, s % 4 === 0 ? 0.55 : 0.3);
        if (s === 0 || s === 8) rig.kick.triggerAttackRelease('C1', '8n', time, 0.9);
        if (s === 4 || s === 12) rig.snare.triggerAttackRelease('16n', time, 0.6);

        if (s === 0 || s === 8 || (s === 14 && rng() < 0.5)) {
          const raw = s === 0 ? root : s === 8 ? transposeNote(rig, root, rng() < 0.5 ? 7 : 12) : transposeNote(rig, root, 9);
          const note = transposeNote(rig, raw, c.getTranspose());
          const vel = s === 0 ? 0.7 : 0.5;
          rig.bass.triggerAttackRelease(note, s === 14 ? '16n' : '8n', time, vel);
          reportNote(c, time, note, noteToDegree(raw), vel);
        }
        if (s === 0) {
          const voicing = VOICINGS[root.replace(/[0-9]/g, '')] ?? VOICINGS.C;
          const chord = voicing.map((n) => transposeNote(rig, n, c.getTranspose()));
          rig.piano.triggerAttackRelease(chord, '2n', time, 0.1);
          reportNote(c, time, chord[chord.length - 1], noteToDegree(voicing[voicing.length - 1]), 0.3);
        }

        step++;
        if (step % 16 === 0) bar++;
      }, '16n');
      loop.start(0);

      // Typing drives tempo and brings the beat back.
      unsubKeys = onTypingKeystroke(() => {
        if (steady || !ctx) return;
        setAudible(true);
        const t = Date.now();
        if (t - lastBpmUpdate < BPM_UPDATE_MS) return;
        lastBpmUpdate = t;
        const avg = recentKeystrokeInterval(getRecentKeystrokeTimes());
        if (avg === null) return;
        const next = intervalToBpm(avg);
        transport.bpm.rampTo(next, 1.2);
        useMusicGenStore.getState().updateTypingRhythm(next);
      });

      // Stopped typing → fade the beat over 4 s (checked every eighth note).
      events.push(
        transport.scheduleRepeat(() => {
          if (steady || !audible) return;
          const lastKey = getLastKeystrokeAt();
          if (lastKey === null || Date.now() - lastKey > STOP_TYPING_MS) setAudible(false);
        }, '8n')
      );
    },

    stop() {
      if (!ctx) return;
      const { rig } = ctx;
      unsubKeys?.();
      unsubKeys = null;
      clearTransportEvents(rig, events);
      events = [];
      if (loop) {
        loop.stop();
        loop.dispose();
        loop = null;
      }
      const transport = rig.Tone.getTransport();
      transport.swing = 0;
      const now = rig.Tone.now();
      rig.beatBus.gain.cancelScheduledValues(now);
      rig.beatBus.gain.setValueAtTime(1, now + 0.3);
      useMusicGenStore.getState().setTypingActive(false);
      audible = false;
      ctx = null;
    },
  };
}
