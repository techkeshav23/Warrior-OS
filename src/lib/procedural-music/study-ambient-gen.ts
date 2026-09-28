// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Study Ambient Generator
// A very low pad drone on C2, rain from filtered white noise, and a
// distant bell every 20-40 s (randomised). No rhythm, no beat —
// ultra-minimal and designed to fade into the background. The engine
// also plays this mode quieter than the others.
// ═══════════════════════════════════════════════════════════

import {
  type MusicGenerator,
  type GeneratorContext,
  reportNote,
  scheduleRandomly,
  transposeNote,
} from './generator';
import { PENTATONIC, makeRng, pick, noteToDegree } from './tone-setup';

export function createStudyAmbientGenerator(): MusicGenerator {
  let ctx: GeneratorContext | null = null;
  let cancelBell: (() => void) | null = null;

  return {
    start(context) {
      ctx = context;
      const { rig } = context;
      const rng = makeRng(context.seed ^ 0x22222);
      const now = rig.Tone.now();

      // Ultra-low drone
      rig.pad.triggerAttack(['C2', 'G2'], now, 0.3);

      // Rain: white noise through a gently wandering low-pass
      rig.rain.noise.type = 'white';
      rig.rainLFO.set({ frequency: 0.07, min: 1300, max: 2600 });
      if (rig.rainLFO.state !== 'started') rig.rainLFO.start(now);
      rig.rainGain.gain.rampTo(0.09, 3);
      rig.rain.triggerAttack(now);

      // Distant bell, 20-40 s apart
      cancelBell = scheduleRandomly(rig, 20, 40, rng, (time) => {
        if (!ctx) return;
        const raw = pick(PENTATONIC.high, rng);
        const note = transposeNote(rig, raw, ctx.getTranspose());
        rig.bell.triggerAttackRelease(note, '1n', time, 0.22);
        reportNote(ctx, time, note, noteToDegree(raw), 0.22);
      });
    },

    stop() {
      if (!ctx) return;
      const { rig } = ctx;
      cancelBell?.();
      cancelBell = null;
      rig.pad.releaseAll();
      // Release now (2 s envelope tail); the next mood can re-attack cleanly.
      rig.rainGain.gain.rampTo(0, 2);
      rig.rain.triggerRelease(rig.Tone.now());
      ctx = null;
    },
  };
}
