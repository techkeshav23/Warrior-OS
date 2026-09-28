// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Morning Generator
// Random arpeggios from C major pentatonic (piano) @ ~80bpm,
// soft pad drone on C3, occasional bell chime (8-15s random),
// pattern re-rolls every 30s. Light + uplifting.
// ═══════════════════════════════════════════════════════════

import type { MusicGenerator, GeneratorContext } from './generator';
import { PENTATONIC, makeRng, pick, noteToDegree } from './tone-setup';

export function createMorningGenerator(): MusicGenerator {
  let ctx: GeneratorContext | null = null;
  let arpLoop: import('tone').Loop | null = null;
  let bellTimeout: ReturnType<typeof setTimeout> | null = null;
  let rerollTimeout: ReturnType<typeof setTimeout> | null = null;
  let pattern: string[] = [];
  let step = 0;

  function rollPattern(rng: () => number) {
    const pool = PENTATONIC.mid.concat(PENTATONIC.high);
    const len = 6 + Math.floor(rng() * 4); // 6-9 notes
    pattern = Array.from({ length: len }, () => pick(pool, rng));
    step = 0;
  }

  function scheduleBell() {
    if (!ctx) return;
    const { rig } = ctx;
    const delayMs = 8000 + Math.random() * 7000; // 8-15s
    bellTimeout = setTimeout(() => {
      if (!ctx) return;
      try {
        rig.bell.triggerAttackRelease('C6', '8n', undefined, 0.5);
        ctx.onNote({ note: 'C6', degree: noteToDegree('C6'), velocity: 0.5 });
      } catch { /* audio not ready */ }
      scheduleBell();
    }, delayMs);
  }

  return {
    start(context) {
      ctx = context;
      const { rig, seed } = ctx;
      const rng = makeRng(seed ^ 0x11111);
      rollPattern(rng);

      rig.Tone.getTransport().bpm.rampTo(80, 1);

      // Soft pad drone on C3
      try { rig.pad.triggerAttack('C3'); } catch { /* not ready */ }

      arpLoop = new rig.Tone.Loop((time) => {
        if (!ctx || pattern.length === 0) return;
        const note = pattern[step % pattern.length];
        step++;
        const vel = 0.25 + Math.random() * 0.25;
        rig.piano.triggerAttackRelease(note, '8n', time, vel);
        // report on the draw thread to keep the store off the audio thread
        rig.Tone.getDraw().schedule(() => {
          ctx?.onNote({ note, degree: noteToDegree(note), velocity: vel });
        }, time);
      }, '4n');
      arpLoop.humanize = true;
      arpLoop.start(0);

      rig.Tone.getTransport().start();

      // Re-roll the pattern every 30s so it never repeats exactly
      const reroll = () => {
        rollPattern(rng);
        rerollTimeout = setTimeout(reroll, 30000);
      };
      rerollTimeout = setTimeout(reroll, 30000);

      scheduleBell();
    },

    stop() {
      if (bellTimeout) { clearTimeout(bellTimeout); bellTimeout = null; }
      if (rerollTimeout) { clearTimeout(rerollTimeout); rerollTimeout = null; }
      if (arpLoop) { arpLoop.stop(); arpLoop.dispose(); arpLoop = null; }
      try { ctx?.rig.pad.triggerRelease(); } catch { /* ignore */ }
      ctx = null;
    },
  };
}
