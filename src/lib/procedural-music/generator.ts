// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music :: Generator Contract
// Every mood generator schedules its notes on Tone.Transport (Loops,
// scheduleOnce / scheduleRepeat) using the rig's long-lived synths —
// never one synth per note, never setTimeout for musical events.
// Notes are reported to the visual staff on the Draw thread.
// ═══════════════════════════════════════════════════════════

import type { ToneRig } from './tone-setup';
import type { GeneratedNote } from '@/stores/useMusicGenStore';

export interface GeneratorContext {
  rig: ToneRig;
  seed: number;
  /** Called every time a note plays (for the visual staff). */
  onNote: (note: Omit<GeneratedNote, 'id' | 'at'>) => void;
  /** Semitone offset applied to melodic notes (achievement "octave up"). */
  getTranspose: () => number;
  /** Has the warrior studied > 4 h today? (night hero swell) */
  studiedHardToday: () => boolean;
}

export interface MusicGenerator {
  /** Begin scheduling. Never calls Tone.start() — the engine owns the gesture. */
  start(ctx: GeneratorContext): void;
  /** Cancel every scheduled event and release held voices. */
  stop(): void;
}

/** Transpose a note name by semitones (no-op for 0). */
export function transposeNote(rig: ToneRig, note: string, semitones: number): string {
  if (!semitones) return note;
  try {
    return rig.Tone.Frequency(note).transpose(semitones).toNote();
  } catch {
    return note;
  }
}

/** Report a note to the visual staff in sync with when it is heard. */
export function reportNote(
  ctx: GeneratorContext,
  time: number,
  note: string,
  degree: number,
  velocity: number
): void {
  ctx.rig.Tone.getDraw().schedule(() => ctx.onNote({ note, degree, velocity }), time);
}

/**
 * Fire `fn(time)` again and again on the Transport, waiting a random
 * `min..max` seconds between calls. Returns a cancel function.
 */
export function scheduleRandomly(
  rig: ToneRig,
  minSeconds: number,
  maxSeconds: number,
  rng: () => number,
  fn: (time: number) => void
): () => void {
  const transport = rig.Tone.getTransport();
  let eventId: number | null = null;
  let cancelled = false;
  const plan = () => {
    if (cancelled) return;
    const wait = minSeconds + rng() * (maxSeconds - minSeconds);
    eventId = transport.scheduleOnce((time) => {
      eventId = null;
      if (cancelled) return;
      fn(time);
      plan();
    }, transport.seconds + wait);
  };
  plan();
  return () => {
    cancelled = true;
    if (eventId !== null) {
      try {
        transport.clear(eventId);
      } catch {
        /* transport disposed */
      }
    }
  };
}

/** Clear a list of Transport event ids, ignoring failures. */
export function clearTransportEvents(rig: ToneRig, ids: number[]): void {
  const transport = rig.Tone.getTransport();
  for (const id of ids) {
    try {
      transport.clear(id);
    } catch {
      /* already cleared */
    }
  }
}
