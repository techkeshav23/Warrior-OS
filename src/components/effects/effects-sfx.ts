// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Effects SFX
// Tiny Web Audio synth for the cinematic layers. public/sounds is
// empty, so every cue is generated. Respects the sound settings and
// never starts audio before the page has had a user gesture.
// ═══════════════════════════════════════════════════════════

import { getAudioContext } from '@/lib/audio-engine';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { Rarity } from './effects-utils';

type NavigatorWithActivation = Navigator & {
  userActivation?: { hasBeenActive: boolean };
};

interface Bus {
  ctx: AudioContext;
  out: GainNode;
  t0: number;
}

/** Opens a gain bus on the shared AudioContext, or null when sound can't/shouldn't play. */
function openBus(level: number): Bus | null {
  if (typeof window === 'undefined') return null;
  const { soundEnabled, soundVolume } = useSettingsStore.getState();
  if (!soundEnabled || soundVolume <= 0) return null;
  const activation = (navigator as NavigatorWithActivation).userActivation;
  if (activation && !activation.hasBeenActive) return null;

  let ctx: AudioContext;
  try {
    ctx = getAudioContext();
  } catch {
    return null;
  }
  if (ctx.state !== 'running') return null;

  const out = ctx.createGain();
  out.gain.value = Math.min(1, soundVolume) * level;
  out.connect(ctx.destination);
  return { ctx, out, t0: ctx.currentTime + 0.02 };
}

function closeBus(bus: Bus, afterSec: number): void {
  window.setTimeout(() => {
    try {
      bus.out.disconnect();
    } catch {
      /* already disconnected */
    }
  }, (afterSec + 0.3) * 1000);
}

interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  to?: number;
  at?: number;
  dur: number;
  gain: number;
  attack?: number;
}

function tone(bus: Bus, o: ToneOptions): void {
  const { ctx, out, t0 } = bus;
  const start = t0 + (o.at ?? 0);
  const end = start + o.dur;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, end);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(o.gain, start + (o.attack ?? 0.006));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(env);
  env.connect(out);
  osc.start(start);
  osc.stop(end + 0.03);
}

let noiseCache: { ctx: AudioContext; buffer: AudioBuffer } | null = null;

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseCache && noiseCache.ctx === ctx) return noiseCache.buffer;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache = { ctx, buffer };
  return buffer;
}

interface NoiseOptions {
  at?: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
  attack?: number;
}

function noise(bus: Bus, o: NoiseOptions): void {
  const { ctx, out, t0 } = bus;
  const start = t0 + (o.at ?? 0);
  const end = start + o.dur;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.setValueAtTime(o.freq, start);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, end);
  filter.Q.value = o.q ?? 0.8;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(o.gain, start + (o.attack ?? 0.01));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(filter);
  filter.connect(env);
  env.connect(out);
  src.start(start);
  src.stop(end + 0.03);
}

/** Orb burst: low boom + bell arpeggio that climbs higher for rarer badges. */
export function playAchievementChime(rarity: Rarity): void {
  const bus = openBus(0.55);
  if (!bus) return;
  tone(bus, { type: 'sine', freq: 150, to: 48, dur: 0.7, gain: 0.45 });
  noise(bus, { dur: 0.5, gain: 0.12, filter: 'highpass', freq: 5000, attack: 0.004 });
  const notes = [523.25, 659.25, 783.99, 1046.5];
  if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') notes.push(1318.51);
  if (rarity === 'epic' || rarity === 'legendary') notes.push(1567.98);
  if (rarity === 'legendary') notes.push(2093.0);
  notes.forEach((freq, i) => {
    const at = 0.05 + i * 0.075;
    tone(bus, { type: 'triangle', freq, at, dur: 1.2, gain: 0.16 });
    tone(bus, { type: 'sine', freq: freq * 2, at, dur: 0.55, gain: 0.05 });
  });
  closeBus(bus, 0.05 + notes.length * 0.075 + 1.3);
}

/** Level up: rising sweep into a bright major chord at the flash (~0.95 s). */
export function playLevelUpSound(): void {
  const bus = openBus(0.5);
  if (!bus) return;
  const { ctx, out, t0 } = bus;
  const sweep = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const env = ctx.createGain();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(180, t0);
  sweep.frequency.exponentialRampToValueAtTime(880, t0 + 0.8);
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(500, t0);
  lp.frequency.exponentialRampToValueAtTime(5200, t0 + 0.8);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.1, t0 + 0.12);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
  sweep.connect(lp);
  lp.connect(env);
  env.connect(out);
  sweep.start(t0);
  sweep.stop(t0 + 0.9);

  tone(bus, { type: 'sine', freq: 110, to: 55, at: 0.8, dur: 0.45, gain: 0.35 });
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    tone(bus, { type: 'triangle', freq, at: 0.8 + i * 0.02, dur: 1.4, gain: 0.13 });
  });
  noise(bus, { at: 0.8, dur: 0.35, gain: 0.08, filter: 'highpass', freq: 6000 });
  closeBus(bus, 2.3);
}

/** Glass breaking: impact thump, bright crash and scattered tinkles. */
export function playShatterSound(): void {
  const bus = openBus(0.6);
  if (!bus) return;
  tone(bus, { type: 'sine', freq: 95, to: 38, dur: 0.35, gain: 0.5 });
  noise(bus, { dur: 0.6, gain: 0.34, filter: 'highpass', freq: 1800, attack: 0.003 });
  noise(bus, { at: 0.02, dur: 0.25, gain: 0.18, filter: 'bandpass', freq: 3200, q: 1.4 });
  for (let i = 0; i < 9; i++) {
    tone(bus, {
      type: 'sine',
      freq: 2400 + Math.random() * 3800,
      at: 0.05 + Math.random() * 0.75,
      dur: 0.1 + Math.random() * 0.22,
      gain: 0.03 + Math.random() * 0.05,
      attack: 0.002,
    });
  }
  closeBus(bus, 1.2);
}

/** Digital glitch: a few square-wave blips over a band-passed crackle. */
export function playGlitchSound(): void {
  const bus = openBus(0.35);
  if (!bus) return;
  for (let i = 0; i < 6; i++) {
    tone(bus, {
      type: 'square',
      freq: 90 + Math.random() * 1100,
      at: i * 0.032,
      dur: 0.028,
      gain: 0.05,
      attack: 0.001,
    });
  }
  noise(bus, { dur: 0.2, gain: 0.07, filter: 'bandpass', freq: 2200, q: 2 });
  closeBus(bus, 0.4);
}

/** Window disintegrating: a soft sand-like sweep from bright to dull. */
export function playDisintegrateSound(): void {
  const bus = openBus(0.4);
  if (!bus) return;
  noise(bus, { dur: 1.0, gain: 0.12, filter: 'bandpass', freq: 3200, to: 500, q: 0.9, attack: 0.08 });
  closeBus(bus, 1.1);
}
