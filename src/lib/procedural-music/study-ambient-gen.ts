// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Study Ambient Generator
// Very low drone on C2 (pad), rain noise (filtered), distant bell
// hits every 20-40s, no rhythm/beat, ultra-minimal + low volume.
// Designed to fade into the background.
// ═══════════════════════════════════════════════════════════

import type { MusicGenerator, GeneratorContext } from './generator';
import { PENTATONIC, makeRng, pick, noteToDegree } from './tone-setup';

export function createStudyAmbientGenerator(): MusicGenerator {
  let ctx: GeneratorContext | null = null;
  let bellTimeout: ReturnType<typeof setTimeout> | null = null;

  function scheduleBell(rng: () => number) {
    if (!ctx) return;
    const delayMs = 20000 + rng() * 20000; // 20-40s
    bellTimeout = setTimeout(() => {
      if (!ctx) return;
      const note = pick(PENTATONIC.high, rng);
      try {
        ctx.rig.bell.triggerAttackRelease(note, '2n', undefined, 0.3);
        ctx.onNote({ note, degree: noteToDegree(note), velocity: 0.3 });
      } catch { /* not ready */ }
      scheduleBell(rng);
    }, delayMs);
  }

  return {
    start(context) {
      ctx = context;
      const { rig, seed } = ctx;
      const rng = makeRng(seed ^ 0x22222);

      // Ultra-low drone
      try { rig.pad.triggerAttack('C2'); } catch { /* not ready */ }

      // Rain: filtered noise, gentle
      try {
        rig.noiseFilter.frequency.value = 900;
        rig.noise.type = 'pink';
        rig.noise.start();
        rig.noiseGain.gain.rampTo(0.06, 3);
        rig.noiseLFO.frequency.value = 0.1;
        rig.noiseLFO.min = 500;
        rig.noiseLFO.max = 1400;
        rig.noiseLFO.start();
      } catch { /* not ready */ }

      scheduleBell(rng);
    },

    stop() {
      if (bellTimeout) { clearTimeout(bellTimeout); bellTimeout = null; }
      try { ctx?.rig.pad.triggerRelease(); } catch { /* ignore */ }
      try {
        ctx?.rig.noiseGain.gain.rampTo(0, 1.5);
        ctx?.rig.noiseLFO.stop();
        // Stop noise slightly after the gain fade to avoid a click
        const noise = ctx?.rig.noise;
        setTimeout(() => { try { noise?.stop(); } catch { /* ignore */ } }, 1800);
      } catch { /* ignore */ }
      ctx = null;
    },
  };
}
