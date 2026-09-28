// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Chime
// Tiny Web Audio earcons (no audio files needed — public/sounds
// does not exist). Respects the global sound toggle + volume.
// ═══════════════════════════════════════════════════════════

import { getAudioContext } from '@/lib/audio-engine';
import { useSettingsStore } from '@/stores/useSettingsStore';

export type NexusChimeKind = 'focus-complete' | 'break-complete' | 'wake' | 'nudge';

const PATTERNS: Record<NexusChimeKind, Array<{ freq: number; at: number; dur: number }>> = {
  // Rising major triad — "done, well fought"
  'focus-complete': [
    { freq: 523.25, at: 0, dur: 0.35 },
    { freq: 659.25, at: 0.14, dur: 0.35 },
    { freq: 783.99, at: 0.28, dur: 0.6 },
  ],
  // Two soft taps — "back to work"
  'break-complete': [
    { freq: 659.25, at: 0, dur: 0.25 },
    { freq: 659.25, at: 0.22, dur: 0.35 },
  ],
  // Short blip — wake phrase heard
  wake: [{ freq: 880, at: 0, dur: 0.12 }],
  // Gentle single bell — a suggestion arrived
  nudge: [{ freq: 740, at: 0, dur: 0.4 }],
};

/** Play an earcon. Silently does nothing when sound is off or audio is unavailable. */
export function playNexusChime(kind: NexusChimeKind): void {
  if (typeof window === 'undefined') return;
  const { soundEnabled, soundVolume } = useSettingsStore.getState();
  if (!soundEnabled || soundVolume <= 0) return;
  try {
    const ctx = getAudioContext();
    const start = ctx.currentTime + 0.02;
    const peak = Math.min(0.25, 0.3 * soundVolume);
    for (const note of PATTERNS[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      const t0 = start + note.at;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + note.dur + 0.05);
    }
  } catch {
    /* audio blocked (no user gesture yet) — the visual notification still shows */
  }
}
