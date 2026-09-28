// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Tone.js Setup
// Builds the instrument rig ONCE per play session:
//   PolySynth (piano) · FMSynth pad (poly) · FMSynth bell ·
//   PolySynth<FMSynth> brass (mood shifts) · MembraneSynth kick ·
//   MetalSynth hihat · NoiseSynth snare · MonoSynth bass ·
//   NoiseSynth rain/wind → Filter (+ slow LFO) · Reverb + FeedbackDelay
// Drums + bass run through a "beat bus" so the typing-rhythm mode can
// fade them without touching anything else; an FFT analyser taps the
// master for visuals. NOTHING here touches Tone / AudioContext at
// module scope — `loadTone()` imports it lazily and the rig is only
// built after the caller has run Tone.start() inside a user gesture.
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

/** Pentatonic pools per register. */
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
  analyser: ToneNS.Analyser;
  reverb: ToneNS.Reverb;
  delay: ToneNS.FeedbackDelay;
  piano: ToneNS.PolySynth<ToneNS.Synth>;
  pad: ToneNS.PolySynth<ToneNS.FMSynth>;
  brass: ToneNS.PolySynth<ToneNS.FMSynth>;
  bell: ToneNS.FMSynth;
  beatBus: ToneNS.Gain;
  kick: ToneNS.MembraneSynth;
  snare: ToneNS.NoiseSynth;
  hihat: ToneNS.MetalSynth;
  bass: ToneNS.MonoSynth;
  rain: ToneNS.NoiseSynth;
  rainFilter: ToneNS.Filter;
  rainGain: ToneNS.Gain;
  rainLFO: ToneNS.LFO;
}

let tonePromise: Promise<typeof ToneNS> | null = null;
let toneModule: typeof ToneNS | null = null;
let rigPromise: Promise<ToneRig> | null = null;

/** Lazily import Tone.js (browser only). */
export function loadTone(): Promise<typeof ToneNS> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Tone.js is only available in the browser'));
  }
  if (!tonePromise) {
    tonePromise = import('tone').then(
      (mod) => {
        toneModule = mod;
        return mod;
      },
      (e: unknown) => {
        tonePromise = null;
        throw e;
      }
    );
  }
  return tonePromise;
}

/** The Tone module if it has already been imported, else null (synchronous). */
export function getLoadedTone(): typeof ToneNS | null {
  return toneModule;
}

async function buildRig(): Promise<ToneRig> {
  const Tone = await loadTone();

  // Master + FX chain: instruments → delay → reverb → master → speakers
  const master = new Tone.Gain(0).toDestination();
  const analyser = new Tone.Analyser('fft', 64);
  analyser.smoothing = 0.8;
  master.connect(analyser);
  const reverb = new Tone.Reverb({ decay: 6, wet: 0.35 }).connect(master);
  const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.25, wet: 0.2 }).connect(reverb);

  // Piano-ish poly synth
  const piano = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.15, release: 1.4 },
  }).connect(delay);
  piano.volume.value = -8;

  // Warm FM pad (polyphonic so drones can hold a fifth)
  const pad = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5,
    modulationIndex: 3,
    oscillator: { type: 'sine' },
    envelope: { attack: 2.5, decay: 1, sustain: 0.9, release: 4 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 3, decay: 1, sustain: 0.6, release: 4 },
  }).connect(reverb);
  pad.volume.value = -16;

  // Brass-like FM chords for mood shifts (fast attack, bright modulation)
  const brass = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1,
    modulationIndex: 12,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.06, decay: 0.3, sustain: 0.7, release: 1.2 },
    modulation: { type: 'square' },
    modulationEnvelope: { attack: 0.08, decay: 0.2, sustain: 0.5, release: 0.8 },
  }).connect(reverb);
  brass.volume.value = -14;

  // Bell / chime
  const bell = new Tone.FMSynth({
    harmonicity: 3.01,
    modulationIndex: 14,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 2, sustain: 0, release: 2 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.4 },
  }).connect(reverb);
  bell.volume.value = -20;

  // Beat bus: drums + bass (the typing-rhythm fade acts only on this)
  const beatBus = new Tone.Gain(1).connect(master);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.2 },
  }).connect(beatBus);
  kick.volume.value = -6;

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
  }).connect(beatBus);
  snare.volume.value = -18;

  const hihat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.07, release: 0.02 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).connect(beatBus);
  hihat.volume.value = -30;

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.6 },
    filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6, baseFrequency: 120, octaves: 2.5 },
  }).connect(beatBus);
  bass.volume.value = -12;

  // Rain / wind: sustained NoiseSynth → low-pass (slow LFO sweep) → gain → reverb
  const rain = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 2, decay: 0.1, sustain: 1, release: 2 },
  });
  const rainFilter = new Tone.Filter({ frequency: 1800, type: 'lowpass', rolloff: -24 });
  const rainGain = new Tone.Gain(0).connect(reverb);
  const rainLFO = new Tone.LFO({ frequency: 0.08, min: 1200, max: 2600 });
  rain.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainLFO.connect(rainFilter.frequency);

  // The reverb's impulse response renders asynchronously.
  await reverb.ready;

  return {
    Tone,
    master,
    analyser,
    reverb,
    delay,
    piano,
    pad,
    brass,
    bell,
    beatBus,
    kick,
    snare,
    hihat,
    bass,
    rain,
    rainFilter,
    rainGain,
    rainLFO,
  };
}

/**
 * Build the synth graph exactly once (per play session) and return it.
 * Safe to call repeatedly. Call Tone.start() in the user gesture first.
 */
export function getToneRig(): Promise<ToneRig> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('getToneRig() called outside the browser'));
  }
  if (!rigPromise) {
    rigPromise = buildRig().catch((e: unknown) => {
      rigPromise = null;
      throw e;
    });
  }
  return rigPromise;
}

/** True once a rig has been (or is being) constructed. */
export function isRigReady(): boolean {
  return rigPromise !== null;
}

/** Detune every pitched instrument (cents) — used for decay's "lower pitch". */
export function setRigDetune(rig: ToneRig, cents: number): void {
  try {
    rig.piano.set({ detune: cents });
    rig.pad.set({ detune: cents });
    rig.brass.set({ detune: cents });
    rig.bell.detune.rampTo(cents, 1.5);
    rig.bass.detune.rampTo(cents, 1.5);
  } catch {
    /* rig mid-dispose */
  }
}

/**
 * Stop the transport and dispose every node. The next getToneRig()
 * rebuilds from scratch. Safe to call when nothing is initialized.
 */
export async function disposeToneRig(): Promise<void> {
  const pending = rigPromise;
  rigPromise = null;
  if (!pending) return;
  let rig: ToneRig;
  try {
    rig = await pending;
  } catch {
    return;
  }
  try {
    const transport = rig.Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    rig.Tone.getDraw().cancel(0);
  } catch {
    /* already stopped */
  }
  try {
    rig.rainLFO.stop();
  } catch {
    /* not started */
  }
  const nodes = [
    rig.piano,
    rig.pad,
    rig.brass,
    rig.bell,
    rig.kick,
    rig.snare,
    rig.hihat,
    rig.bass,
    rig.rain,
    rig.rainLFO,
    rig.rainFilter,
    rig.rainGain,
    rig.beatBus,
    rig.delay,
    rig.reverb,
    rig.analyser,
    rig.master,
  ];
  for (const node of nodes) {
    try {
      node.dispose();
    } catch {
      /* ignore */
    }
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
  const letter = note.replace(/[0-9#b-]/g, '');
  const idx = (PENTATONIC_SCALE as readonly string[]).indexOf(letter);
  return idx >= 0 ? idx : 0;
}
