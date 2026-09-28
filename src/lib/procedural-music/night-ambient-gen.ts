// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Night Ambient Generator
// A deep bass drone on C1, wind from brown noise through a slowly
// sweeping low-pass (LFO), distant low rumbles every 30-60 s — dark
// and atmospheric. If the warrior has studied more than 4 hours
// today (tracked by the Reality Decay engine), a subtle heroic pad
// swell rises every 2 minutes.
// ═══════════════════════════════════════════════════════════

import {
  type MusicGenerator,
  type GeneratorContext,
  clearTransportEvents,
  reportNote,
  scheduleRandomly,
  transposeNote,
} from './generator';
import { makeRng, pick, noteToDegree, buildPentatonic } from './tone-setup';

const LOW_RUMBLE = buildPentatonic(1, 1); // C1 D1 E1 G1 A1
const HERO_CHORD = ['C3', 'G3', 'E4']; // rising heroic swell
export const NIGHT_HERO_INTERVAL_S = 120;

export function createNightAmbientGenerator(): MusicGenerator {
  let ctx: GeneratorContext | null = null;
  let cancelRumble: (() => void) | null = null;
  let events: number[] = [];

  return {
    start(context) {
      ctx = context;
      const { rig } = context;
      const transport = rig.Tone.getTransport();
      const rng = makeRng(context.seed ^ 0x44444);
      const now = rig.Tone.now();

      // Deep drone on C1 (C2 an octave up, quietly, so small speakers hear it)
      rig.pad.triggerAttack(['C1', 'C2'], now, 0.45);

      // Wind: brown noise with a slow LFO sweep on the low-pass
      rig.rain.noise.type = 'brown';
      rig.rainLFO.set({ frequency: 0.05, min: 220, max: 900 });
      if (rig.rainLFO.state !== 'started') rig.rainLFO.start(now);
      rig.rainGain.gain.rampTo(0.12, 4);
      rig.rain.triggerAttack(now);

      // Distant low rumbles, 30-60 s apart
      cancelRumble = scheduleRandomly(rig, 30, 60, rng, (time) => {
        if (!ctx) return;
        const raw = pick(LOW_RUMBLE, rng);
        const note = transposeNote(rig, raw, ctx.getTranspose());
        rig.bass.triggerAttackRelease(note, '1n', time, 0.4);
        reportNote(ctx, time, note, noteToDegree(raw), 0.4);
      });

      // Heroic swell every 2 minutes — only after a 4 h+ study day.
      events.push(
        transport.scheduleRepeat(
          (time) => {
            const c = ctx;
            if (!c || !c.studiedHardToday()) return;
            const shift = c.getTranspose();
            const chord = HERO_CHORD.map((n) => transposeNote(rig, n, shift));
            rig.pad.triggerAttackRelease(chord, 6, time, 0.5);
            chord.forEach((n, i) => reportNote(c, time + i * 0.4, n, noteToDegree(HERO_CHORD[i]), 0.5));
          },
          NIGHT_HERO_INTERVAL_S,
          transport.seconds + NIGHT_HERO_INTERVAL_S
        )
      );
    },

    stop() {
      if (!ctx) return;
      const { rig } = ctx;
      cancelRumble?.();
      cancelRumble = null;
      clearTransportEvents(rig, events);
      events = [];
      rig.pad.releaseAll();
      rig.rainGain.gain.rampTo(0, 2);
      rig.rain.triggerRelease(rig.Tone.now());
      ctx = null;
    },
  };
}
