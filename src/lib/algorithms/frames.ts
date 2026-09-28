// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Frame Collector
// Drains a step generator into an array of frames (with a safety cap)
// ═══════════════════════════════════════════════════════════

/** Hard cap so a pathological input can never freeze the tab. */
export const MAX_FRAMES = 60000;

export interface CollectedFrames<F, R> {
  frames: F[];
  /** The generator's return value, or undefined when the cap was hit. */
  result: R | undefined;
  truncated: boolean;
}

/** Run a step generator to completion and keep every frame it yields. */
export function collectFrames<F, R>(
  generator: Generator<F, R, undefined>,
  limit: number = MAX_FRAMES
): CollectedFrames<F, R> {
  const frames: F[] = [];
  let step = generator.next();
  while (!step.done) {
    if (frames.length >= limit) {
      return { frames, result: undefined, truncated: true };
    }
    frames.push(step.value);
    step = generator.next();
  }
  return { frames, result: step.value, truncated: false };
}
