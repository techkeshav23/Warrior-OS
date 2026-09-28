// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Morning Generator
// Random arpeggios from C major pentatonic on the piano at 80 bpm,
// a soft pad drone on C3, an occasional bell chime every 8-15 s, and
// a pattern that re-rolls every 30 s so it never repeats exactly.
// Light and uplifting. Everything is scheduled on the Transport.
// ═══════════════════════════════════════════════════════════

import type { Loop } from 'tone';
import {
  type MusicGenerator,
  type GeneratorContext,
  clearTransportEvents,
  reportNote,
  scheduleRandomly,
  transposeNote,
} from './generator';
import { PENTATONIC, makeRng, pick, noteToDegree } from './tone-setup';

export const MORNING_BPM = 80;
const CHIMES = ['C6', 'G5', 'E6', 'A5', 'D6'];

export function createMorningGenerator(): MusicGenerator {
  let ctx: GeneratorContext | null = null;
  let arpLoop: Loop | null = null;
  let events: number[] = [];
  let cancelBell: (() => void) | null = null;
  let pattern: string[] = [];
  let restChance = 0.12;
  let step = 0;

  function rollPattern(rng: () => number) {
    // A rising-then-falling contour through two octaves, randomised.
    const pool = PENTATONIC.mid.concat(PENTATONIC.high);
    const len = 6 + Math.floor(rng() * 4); // 6-9 notes
    const startIdx = Math.floor(rng() * (pool.length - 8));
    const next: string[] = [];
    let idx = startIdx;
    for (let i = 0; i < len; i++) {
      next.push(pool[Math.max(0, Math.min(pool.length - 1, idx))]);
      idx += rng() < 0.7 ? 1 + Math.floor(rng() * 2) : -1 - Math.floor(rng() * 2);
    }
    pattern = next;
    restChance = 0.05 + rng() * 0.2;
    step = 0;
  }

  return {
    start(context) {
      ctx = context;
      const { rig } = context;
      const transport = rig.Tone.getTransport();
      const rng = makeRng(context.seed ^ 0x11111);
      rollPattern(rng);

      // Soft pad drone on C3 (plus a quiet fifth for warmth)
      rig.pad.triggerAttack(['C3', 'G3'], rig.Tone.now(), 0.35);

      arpLoop = new rig.Tone.Loop((time) => {
        if (!ctx || pattern.length === 0) return;
        const raw = pattern[step % pattern.length];
        step++;
        if (rng() < restChance) return;
        const note = transposeNote(rig, raw, ctx.getTranspose());
        const vel = 0.22 + rng() * 0.22;
        rig.piano.triggerAttackRelease(note, '8n', time, vel);
        reportNote(ctx, time, note, noteToDegree(raw), vel);
      }, '8n');
      arpLoop.humanize = 0.012;
      arpLoop.start(0);

      // Pattern changes every 30 s so it never repeats exactly
      events.push(transport.scheduleRepeat(() => rollPattern(rng), 30, transport.seconds + 30));

      // Occasional bell chime, 8-15 s apart
      cancelBell = scheduleRandomly(rig, 8, 15, rng, (time) => {
        if (!ctx) return;
        const raw = pick(CHIMES, rng);
        const note = transposeNote(rig, raw, ctx.getTranspose());
        rig.bell.triggerAttackRelease(note, '2n', time, 0.35);
        reportNote(ctx, time, note, noteToDegree(raw), 0.35);
      });
    },

    stop() {
      if (!ctx) return;
      const { rig } = ctx;
      cancelBell?.();
      cancelBell = null;
      clearTransportEvents(rig, events);
      events = [];
      if (arpLoop) {
        arpLoop.stop();
        arpLoop.dispose();
        arpLoop = null;
      }
      rig.pad.releaseAll();
      ctx = null;
    },
  };
}
