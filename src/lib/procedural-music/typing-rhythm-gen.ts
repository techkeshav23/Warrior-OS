// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Typing Rhythm Generator
// YOUR typing tempo = the beat. Reads BPM from the biometrics /
// music-gen store (60-140). Lo-fi beat: kick on 1+3, snare-ish on
// 2+4, hihat every 8th, bass follows pentatonic root. Stop typing
// -> beat fades over 4s; resume typing -> it comes back.
// ═══════════════════════════════════════════════════════════

import type { MusicGenerator, GeneratorContext } from './generator';
import { PENTATONIC, makeRng, pick, noteToDegree } from './tone-setup';
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import { useMusicGenStore } from '@/stores/useMusicGenStore';

const FADE_SECONDS = 4;
// Biometrics updates ~every 5s, so require a longer gap before we treat
// the warrior as "stopped typing" and fade the beat out.
const IDLE_MS = 8000;

/**
 * Read WPM from biometrics and convert to a musical BPM (60-140).
 * Reads via getState() so it is not a React subscription. Wrapped
 * defensively in case the store shape shifts.
 */
function readTypingBPM(fallback: number): number {
  try {
    const raw = useBiometricsStore.getState() as unknown as Record<string, unknown>;
    const metrics = raw.metrics as { wpm?: number } | undefined;
    const wpm = typeof metrics?.wpm === 'number' ? metrics.wpm : undefined;
    if (typeof wpm === 'number' && Number.isFinite(wpm) && wpm > 0) {
      // ~1 word ≈ 5 keystrokes; scale WPM into a lo-fi tempo range.
      const bpm = 60 + wpm * 1.6;
      return Math.max(60, Math.min(140, bpm));
    }
  } catch { /* store missing / shape changed — fall through */ }
  return fallback;
}

/** Read the last-updated timestamp (proxy for last typing activity) for idle detection. */
function readLastActivity(): number | null {
  try {
    const raw = useBiometricsStore.getState() as unknown as Record<string, unknown>;
    const lu = typeof raw.lastUpdated === 'number' ? (raw.lastUpdated as number) : null;
    return lu;
  } catch { /* ignore */ }
  return null;
}

export function createTypingRhythmGenerator(): MusicGenerator {
  let ctx: GeneratorContext | null = null;
  let beatLoop: import('tone').Loop | null = null;
  let bpmPoll: ReturnType<typeof setInterval> | null = null;
  let sixteenthStep = 0;
  let bassPattern: string[] = [];

  return {
    start(context) {
      ctx = context;
      const { rig, seed } = ctx;
      const rng = makeRng(seed ^ 0x33333);
      bassPattern = Array.from({ length: 4 }, () => pick(PENTATONIC.low, rng));

      const initialBpm = readTypingBPM(useMusicGenStore.getState().typingBPM || 90);
      rig.Tone.getTransport().bpm.rampTo(initialBpm, 0.5);

      // Start the master lo-fi bus faded in
      rig.master.gain.rampTo(useMusicGenStore.getState().volume, 0.5);

      beatLoop = new rig.Tone.Loop((time) => {
        if (!ctx) return;
        const beat = Math.floor(sixteenthStep / 4) % 4; // 0..3 quarter
        const isEighth = sixteenthStep % 2 === 0;
        // Hihat every 8th
        if (isEighth) {
          rig.hihat.triggerAttackRelease('16n', time, 0.4);
        }
        // Kick on beats 1 & 3 (downbeat of quarter)
        if (sixteenthStep % 4 === 0 && (beat === 0 || beat === 2)) {
          rig.kick.triggerAttackRelease('C1', '8n', time, 0.9);
        }
        // Snare-ish (noise burst, brighter) on 2 & 4
        if (sixteenthStep % 4 === 0 && (beat === 1 || beat === 3)) {
          rig.hihat.triggerAttackRelease('8n', time, 0.7);
        }
        // Bass follows pentatonic root on each quarter
        if (sixteenthStep % 4 === 0) {
          const note = bassPattern[beat % bassPattern.length];
          rig.bass.triggerAttackRelease(note, '8n', time, 0.6);
          rig.Tone.getDraw().schedule(() => {
            ctx?.onNote({ note, degree: noteToDegree(note), velocity: 0.6 });
          }, time);
        }
        sixteenthStep = (sixteenthStep + 1) % 16;
      }, '16n');
      beatLoop.start(0);
      rig.Tone.getTransport().start();

      // Poll typing tempo + idle state; fade beat out when idle
      bpmPoll = setInterval(() => {
        if (!ctx) return;
        const store = useMusicGenStore.getState();
        const bpm = readTypingBPM(store.typingBPM || 90);
        store.updateTypingRhythm(bpm);
        rig.Tone.getTransport().bpm.rampTo(bpm, 1);

        const last = readLastActivity();
        const idle = last != null ? Date.now() - last > IDLE_MS : false;
        const target = idle ? 0 : store.volume;
        rig.master.gain.rampTo(target, idle ? FADE_SECONDS : 0.8);
      }, 700);
    },

    stop() {
      if (bpmPoll) { clearInterval(bpmPoll); bpmPoll = null; }
      if (beatLoop) { beatLoop.stop(); beatLoop.dispose(); beatLoop = null; }
      try {
        // restore master toward the configured volume so other moods aren't muted
        ctx?.rig.master.gain.rampTo(useMusicGenStore.getState().volume, 0.5);
      } catch { /* ignore */ }
      ctx = null;
    },
  };
}
