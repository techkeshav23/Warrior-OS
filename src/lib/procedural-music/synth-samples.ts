// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Synthesised Samples
// Sound effects rendered in code (PCM → WAV data URI) so Howler can
// play them without any audio asset on disk:
//   heartbeat     1 s "lub-dub" loop (60 bpm)      — Reality Decay stage 4
//   calm-ambient  8 s seamless A-major pad loop    — BreakMode
//   whoosh        soft filtered-noise sweep         — phantom dissolve
//   resurrect     reversed whoosh + bell chime      — phantom resurrection
// Everything is generated lazily in the browser and cached.
// ═══════════════════════════════════════════════════════════

import { Howl } from 'howler';
import { useSettingsStore } from '@/stores/useSettingsStore';

export type SynthSampleKind = 'heartbeat' | 'calm-ambient' | 'whoosh' | 'resurrect';

const SAMPLE_RATE = 22050;
const uriCache = new Map<SynthSampleKind, string>();
const oneShotHowls = new Map<SynthSampleKind, Howl>();

// ─── WAV encoding ───────────────────────────────────────────

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = Array.from(bytes.subarray(i, i + CHUNK));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** 16-bit mono PCM WAV as a base64 data URI. */
function encodeWavDataUri(samples: Float32Array, sampleRate: number): string {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return `data:audio/wav;base64,${toBase64(new Uint8Array(buffer))}`;
}

function normalize(buf: Float32Array, peak: number): void {
  let max = 0;
  for (let i = 0; i < buf.length; i++) max = Math.max(max, Math.abs(buf[i]));
  if (max === 0) return;
  const k = peak / max;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
}

/** Deterministic noise so every render of a sample is identical. */
function makeNoise(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

// ─── Sample synthesis ───────────────────────────────────────

/** 1-second lub-dub at 60 bpm; silent at both ends so it loops cleanly. */
function synthHeartbeat(): Float32Array {
  const n = SAMPLE_RATE; // 1.0 s
  const out = new Float32Array(n);
  const beat = (start: number, amp: number, baseHz: number, decay: number) => {
    const s0 = Math.floor(start * SAMPLE_RATE);
    let phase = 0;
    for (let i = s0; i < n; i++) {
      const t = (i - s0) / SAMPLE_RATE;
      if (t > 0.45) break;
      const f = baseHz + 28 * Math.exp(-t / 0.035);
      phase += (2 * Math.PI * f) / SAMPLE_RATE;
      const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / decay);
      // A few harmonics so the thump is audible on small speakers.
      const body = Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
      out[i] += amp * env * body;
    }
  };
  beat(0, 1, 52, 0.11); // lub
  beat(0.29, 0.72, 62, 0.085); // dub
  let y = 0;
  for (let i = 0; i < n; i++) {
    y += 0.35 * (out[i] - y); // gentle one-pole low-pass
    out[i] = y;
  }
  normalize(out, 0.9);
  return out;
}

/**
 * 8-second A-major pad. Every partial and every swell LFO completes a
 * whole number of cycles in 8 s, so the loop point is seamless.
 */
function synthCalmAmbient(): Float32Array {
  const seconds = 8;
  const n = SAMPLE_RATE * seconds;
  const out = new Float32Array(n);
  const partials = [
    { f: 110, a: 0.32, m: 1, p: 0 }, // A2
    { f: 165, a: 0.2, m: 2, p: 1.3 }, // E3
    { f: 220, a: 0.22, m: 1, p: 2.1 }, // A3
    { f: 277.25, a: 0.12, m: 3, p: 0.7 }, // C#4
    { f: 329.625, a: 0.12, m: 2, p: 2.9 }, // E4
    { f: 493.875, a: 0.05, m: 1, p: 4.2 }, // B4 shimmer
  ];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;
    for (const q of partials) {
      const swell = 0.55 + 0.45 * Math.sin(2 * Math.PI * (q.m / seconds) * t + q.p);
      v += q.a * swell * Math.sin(2 * Math.PI * q.f * t);
    }
    out[i] = v;
  }
  normalize(out, 0.5);
  return out;
}

/** Band-passed noise with a moving centre frequency. */
function sweptNoise(
  seconds: number,
  centre: (x: number) => number,
  envelope: (x: number) => number,
  seed: number
): Float32Array {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const out = new Float32Array(n);
  const rnd = makeNoise(seed);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const q = 1.4;
  for (let i = 0; i < n; i++) {
    const x = i / n; // 0..1 progress
    const w0 = (2 * Math.PI * centre(x)) / SAMPLE_RATE;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - alpha) / a0;
    const input = rnd();
    const y = b0 * input + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = y;
    out[i] = y * envelope(x);
  }
  return out;
}

/** Gentle whoosh (~0.9 s) for a phantom breaking into particles. */
function synthWhoosh(): Float32Array {
  const out = sweptNoise(
    0.9,
    (x) => 320 + 1500 * Math.sin(Math.PI * x),
    (x) => (x < 0.3 ? Math.sin((x / 0.3) * (Math.PI / 2)) : Math.exp(-(x - 0.3) * 5)),
    1337
  );
  normalize(out, 0.55);
  return out;
}

/** Reverse-of-close: a rising sweep that resolves into a soft chime. */
function synthResurrect(): Float32Array {
  const seconds = 1.1;
  const sweep = sweptNoise(
    seconds,
    (x) => 380 + 2400 * Math.pow(x, 1.6),
    (x) => (x < 0.55 ? Math.pow(x / 0.55, 2) : Math.exp(-(x - 0.55) * 9)),
    4242
  );
  normalize(sweep, 0.45);
  const chimeStart = Math.floor(0.55 * seconds * SAMPLE_RATE);
  for (let i = chimeStart; i < sweep.length; i++) {
    const t = (i - chimeStart) / SAMPLE_RATE;
    const env = (1 - Math.exp(-t / 0.003)) * Math.exp(-t / 0.28);
    sweep[i] +=
      env * (0.28 * Math.sin(2 * Math.PI * 880 * t) + 0.16 * Math.sin(2 * Math.PI * 1318.5 * t) + 0.08 * Math.sin(2 * Math.PI * 1760 * t));
  }
  normalize(sweep, 0.7);
  return sweep;
}

// ─── Public API ─────────────────────────────────────────────

const RENDERERS: Record<SynthSampleKind, () => Float32Array> = {
  heartbeat: synthHeartbeat,
  'calm-ambient': synthCalmAmbient,
  whoosh: synthWhoosh,
  resurrect: synthResurrect,
};

/** WAV data URI for a synthesised sample (rendered once, then cached). */
export function getSynthSampleUri(kind: SynthSampleKind): string {
  const cached = uriCache.get(kind);
  if (cached) return cached;
  const uri = encodeWavDataUri(RENDERERS[kind](), SAMPLE_RATE);
  uriCache.set(kind, uri);
  return uri;
}

/**
 * Create a looping Howl for a synthesised sample (caller owns it and must
 * stop + unload it). Returns null outside the browser or on failure.
 */
export function createSynthLoop(kind: 'heartbeat' | 'calm-ambient', volume: number): Howl | null {
  if (typeof window === 'undefined') return null;
  try {
    return new Howl({
      src: [getSynthSampleUri(kind)],
      format: ['wav'],
      loop: true,
      volume: Math.max(0, Math.min(1, volume)),
    });
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget one-shot through Howler, respecting the OS sound
 * toggle and master volume. `gain` scales relative to the master volume.
 */
export function playSynthSample(kind: 'whoosh' | 'resurrect', gain = 1): void {
  if (typeof window === 'undefined') return;
  const { soundEnabled, soundVolume } = useSettingsStore.getState();
  if (!soundEnabled) return;
  try {
    let howl = oneShotHowls.get(kind);
    if (!howl) {
      howl = new Howl({ src: [getSynthSampleUri(kind)], format: ['wav'], preload: true });
      oneShotHowls.set(kind, howl);
    }
    howl.volume(Math.max(0, Math.min(1, soundVolume * gain)));
    howl.play();
  } catch {
    /* audio unavailable — effects are best-effort */
  }
}
