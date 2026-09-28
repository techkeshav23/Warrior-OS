// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Tone.js Setup
// Lazy-initializes all synths + FX chain. NOTHING here touches
// Tone / AudioContext at module scope — everything is created on
// demand inside getToneRig(), which must be awaited only after a
// user gesture (see useProceduralMusic -> Tone.start()).
// ═══════════════════════════════════════════════════════════

import type * as ToneNS from 'tone';

// ── Musical material ────────────────────────────────────────
// C major pentatonic (C D E G A) across usable octaves.
export const PENTATONIC_SCALE = ['C', 'D', 'E', 'G', 'A'] as const;

/** Build pentatonic note names across the given octave range, e.g. ["C3","D3",...]. */
export function buildPentatonic(minOctave: number, maxOctave: number): string[] {
  const notes: string[] = [];
  for (let oct = minOctave; oct <= maxOctave; oct++) {
    for (const n of PENTATONIC_SCALE) notes.push(`${n}${oct}`);
  }
  return notes;
}

/** Pentatonic pools per mood register. */
export const PENTATONIC = {
  full: buildPentatonic(2, 6),
  mid: buildPentatonic(3, 5),
  high: buildPentatonic(4, 6),
  low: buildPentatonic(1, 3),
} as const;

// ── The rig ─────────────────────────────────────────────────
export interface ToneRig {
  Tone: typeof ToneNS;
  master: ToneNS.Gain;
  reverb: ToneNS.Reverb;
  delay: ToneNS.FeedbackDelay;
  piano: ToneNS.PolySynth;
  pad: ToneNS.FMSynth;
  bell: ToneNS.MetalSynth;
  kick: ToneNS.MembraneSynth;
  hihat: ToneNS.NoiseSynth;
  bass: ToneNS.MonoSynth;
  noise: ToneNS.Noise;
  noiseFilter: ToneNS.Filter;
  noiseGain: ToneNS.Gain;
  noiseLFO: ToneNS.LFO;
}

let rigPromise: Promise<ToneRig> | null = null;

/**
 * Lazily import Tone and construct the synth graph exactly once.
 * Safe to call multiple times; returns the same rig.
 * MUST only be invoked in the browser after a user gesture.
 */
export async function getToneRig(): Promise<ToneRig> {
  if (typeof window === 'undefined') {
    throw new Error('getToneRig() called outside the browser');
  }
  if (rigPromise) return rigPromise;

  rigPromise = (async (): Promise<ToneRig> => {
    const Tone = await import('tone');

    // Master + FX chain
    const master = new Tone.Gain(0.6).toDestination();
    const reverb = new Tone.Reverb({ decay: 6, wet: 0.35 }).connect(master);
    const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.25, wet: 0.2 }).connect(reverb);

    // Piano-ish poly synth
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.4, sustain: 0.15, release: 1.4 },
    }).connect(delay);
    piano.volume.value = -8;

    // Warm pad drone
    const pad = new Tone.FMSynth({
      harmonicity: 1.5,
      modulationIndex: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 2.5, decay: 1, sustain: 0.9, release: 4 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 3, decay: 1, sustain: 0.6, release: 4 },
    }).connect(reverb);
    pad.volume.value = -16;

    // Bell / chime
    const bell = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.4, release: 0.6 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(reverb);
    bell.volume.value = -22;

    // Kick
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.2 },
    }).connect(master);
    kick.volume.value = -6;

    // Hihat (noise burst)
    const hihat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    }).connect(delay);
    hihat.volume.value = -20;

    // Bass
    const bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.6 },
      filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6, baseFrequency: 120, octaves: 2.5 },
    }).connect(master);
    bass.volume.value = -10;

    // Rain / wind noise -> filter -> gain -> reverb, with a slow LFO on the filter
    const noise = new Tone.Noise('pink');
    const noiseFilter = new Tone.Filter({ frequency: 800, type: 'lowpass', rolloff: -24 });
    const noiseGain = new Tone.Gain(0).connect(reverb);
    const noiseLFO = new Tone.LFO({ frequency: 0.08, min: 300, max: 1200 });
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseLFO.connect(noiseFilter.frequency);

    return {
      Tone,
      master, reverb, delay,
      piano, pad, bell, kick, hihat, bass,
      noise, noiseFilter, noiseGain, noiseLFO,
    };
  })();

  return rigPromise;
}

/** True once a rig has been constructed. */
export function isRigReady(): boolean {
  return rigPromise !== null;
}

/**
 * Fully dispose the rig and release audio nodes. Next getToneRig()
 * rebuilds from scratch. Safe to call when nothing is initialized.
 */
export async function disposeToneRig(): Promise<void> {
  if (!rigPromise) return;
  try {
    const rig = await rigPromise;
    rig.noiseLFO.stop();
    try { rig.noise.stop(); } catch { /* already stopped */ }
    const nodes = [
      rig.piano, rig.pad, rig.bell, rig.kick, rig.hihat, rig.bass,
      rig.noise, rig.noiseFilter, rig.noiseGain, rig.noiseLFO,
      rig.delay, rig.reverb, rig.master,
    ];
    for (const node of nodes) {
      try { node.dispose(); } catch { /* ignore */ }
    }
  } finally {
    rigPromise = null;
  }
}

/** Seeded pseudo-random generator (mulberry32) for reproducible patterns. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a random element from an array using the provided rng. */
export function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Map a note string like "C4" to a pentatonic degree 0-4 (fallback 0). */
export function noteToDegree(note: string): number {
  const letter = note.replace(/[0-9]/g, '');
  const idx = (PENTATONIC_SCALE as readonly string[]).indexOf(letter);
  return idx >= 0 ? idx : 0;
}
