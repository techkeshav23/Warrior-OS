// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Generator Contract
// Shared interface for every mood generator. A generator owns its
// Tone.js Loops/schedules and reports generated notes back to the
// store via the injected onNote callback (for visualization).
// ═══════════════════════════════════════════════════════════

import type { ToneRig } from './tone-setup';
import type { GeneratedNote } from '@/stores/useMusicGenStore';

export interface GeneratorContext {
  rig: ToneRig;
  seed: number;
  /** Called every time a note is scheduled/played (for the visual staff). */
  onNote: (note: Omit<GeneratedNote, 'id' | 'at'>) => void;
  /** Live BPM read from typing biometrics (60-140). Only used by some gens. */
  getTypingBPM: () => number;
  /** Whether the user has studied > 4h today (for night hero-swell). */
  studiedHardToday: () => boolean;
}

export interface MusicGenerator {
  /** Begin scheduling. Should NOT call Tone.start() — the hook owns the gesture. */
  start(ctx: GeneratorContext): void;
  /** Stop + dispose all schedules owned by this generator. */
  stop(): void;
}
