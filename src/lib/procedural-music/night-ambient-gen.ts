// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Night Ambient Generator
// Deep bass drone (C1), wind noise (filtered brown noise + slow
// LFO), distant low rumbles every 30-60s, dark + atmospheric.
// If studied > 4h today, adds a subtle heroic pad swell every 2 min.
// ═══════════════════════════════════════════════════════════

import type { MusicGenerator, GeneratorContext } from './generator';
import { makeRng, pick, noteToDegree, buildPentatonic } from './tone-setup';

const LOW_RUMBLE = buildPentatonic(1, 1); // C1 D1 E1 G1 A1
const HERO_NOTES = ['C3', 'G3', 'E4'];    // rising heroic pad swell

export function createNightAmbientGenerator(): MusicGenerator {
  let ctx: GeneratorContext | null = null;
  let rumbleTimeout: ReturnType<typeof setTimeout> | null = null;
  let heroInterval: ReturnType<typeof setInterval> | null = null;

  function scheduleRumble(rng: () => number) {
    if (!ctx) return;
    const delayMs = 30000 + rng() * 30000; // 30-60s
    rumbleTimeout = setTimeout(() => {
      if (!ctx) return;
      const note = pick(LOW_RUMBLE, rng);
      try {
        ctx.rig.bass.triggerAttackRelease(note, '1n', undefined, 0.4);
        ctx.onNote({ note, degree: noteToDegree(note), velocity: 0.4 });
      } catch { /* not ready */ }
      scheduleRumble(rng);
    }, delayMs);
  }

  return {
    start(context) {
      ctx = context;
      const { rig, seed } = ctx;
      const rng = makeRng(seed ^ 0x44444);

      // Deep bass drone on C1
      try { rig.pad.triggerAttack('C1'); } catch { /* not ready */ }

      // Wind: brown noise with slow LFO sweep
      try {
        rig.noise.type = 'brown';
        rig.noiseFilter.frequency.value = 500;
        rig.noise.start();
        rig.noiseGain.gain.rampTo(0.08, 4);
        rig.noiseLFO.frequency.value = 0.05;
        rig.noiseLFO.min = 200;
        rig.noiseLFO.max = 900;
        rig.noiseLFO.start();
      } catch { /* not ready */ }

      scheduleRumble(rng);

      // Heroic swell every 2 min if the warrior ground hard today
      if (ctx.studiedHardToday()) {
        let heroStep = 0;
        heroInterval = setInterval(() => {
          if (!ctx) return;
          const note = HERO_NOTES[heroStep % HERO_NOTES.length];
          heroStep++;
          try {
            ctx.rig.pad.triggerAttackRelease(note, '2n', undefined, 0.5);
            ctx.onNote({ note, degree: noteToDegree(note), velocity: 0.5 });
          } catch { /* not ready */ }
        }, 120000);
      }
    },

    stop() {
      if (rumbleTimeout) { clearTimeout(rumbleTimeout); rumbleTimeout = null; }
      if (heroInterval) { clearInterval(heroInterval); heroInterval = null; }
      try { ctx?.rig.pad.triggerRelease(); } catch { /* ignore */ }
      try {
        ctx?.rig.noiseGain.gain.rampTo(0, 2);
        ctx?.rig.noiseLFO.stop();
        const noise = ctx?.rig.noise;
        setTimeout(() => { try { noise?.stop(); } catch { /* ignore */ } }, 2200);
      } catch { /* ignore */ }
      ctx = null;
    },
  };
}
