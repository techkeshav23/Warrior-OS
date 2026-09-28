// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Datasets
// Seeded random generation, dataset shapes and custom-input validation
// ═══════════════════════════════════════════════════════════

import type { AlgoDatasetShape } from '@/types/algo';
import {
  ARRAY_SIZE_MAX,
  ARRAY_SIZE_MIN,
  CUSTOM_MAX_LENGTH,
  CUSTOM_MIN_LENGTH,
  CUSTOM_VALUE_MAX,
  CUSTOM_VALUE_MIN,
} from './constants';

/** A source of uniform random numbers in [0, 1). */
export type Rng = () => number;

/** Deterministic PRNG (mulberry32) so defaults and tests are reproducible. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const RANDOM_VALUE_MIN = 5;
const RANDOM_VALUE_MAX = 100;

export const DATASET_SHAPES: { id: AlgoDatasetShape; label: string; hint: string }[] = [
  { id: 'random', label: 'Random', hint: 'Uniformly random values' },
  { id: 'nearly-sorted', label: 'Nearly sorted', hint: 'Sorted, with a few values out of place' },
  { id: 'reversed', label: 'Reversed', hint: 'Sorted in descending order (worst case for many sorts)' },
  { id: 'few-unique', label: 'Few unique', hint: 'Only four distinct values, lots of duplicates' },
];

function randomValues(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => randomInt(rng, RANDOM_VALUE_MIN, RANDOM_VALUE_MAX));
}

/** Build a dataset of the given shape. `size` is clamped to the slider range. */
export function generateDataset(shape: AlgoDatasetShape, size: number, rng: Rng): number[] {
  const n = Math.max(ARRAY_SIZE_MIN, Math.min(ARRAY_SIZE_MAX, Math.round(size)));

  switch (shape) {
    case 'nearly-sorted': {
      const values = randomValues(rng, n).sort((a, b) => a - b);
      const disorder = Math.max(1, Math.round(n * 0.08));
      for (let k = 0; k < disorder; k++) {
        const i = randomInt(rng, 0, n - 1);
        const j = Math.min(n - 1, i + randomInt(rng, 1, 3));
        const tmp = values[i];
        values[i] = values[j];
        values[j] = tmp;
      }
      return values;
    }
    case 'reversed':
      return randomValues(rng, n).sort((a, b) => b - a);
    case 'few-unique': {
      const pool = [12, 30, 48, 66, 84, 100];
      // Fisher-Yates on the pool, then keep four distinct values.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = randomInt(rng, 0, i);
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      const picks = pool.slice(0, 4);
      return Array.from({ length: n }, () => picks[randomInt(rng, 0, picks.length - 1)]);
    }
    case 'random':
    default:
      return randomValues(rng, n);
  }
}

export type ParsedArray = { ok: true; values: number[] } | { ok: false; error: string };

/** Validate user-typed numbers such as "42, 7 19;3". */
export function parseCustomArray(text: string): ParsedArray {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Type some numbers first, for example 42, 7, 19, 3.' };
  }
  const parts = trimmed.split(/[\s,;]+/).filter((part) => part.length > 0);
  if (parts.length < CUSTOM_MIN_LENGTH) {
    return { ok: false, error: `Enter at least ${CUSTOM_MIN_LENGTH} numbers.` };
  }
  if (parts.length > CUSTOM_MAX_LENGTH) {
    return {
      ok: false,
      error: `At most ${CUSTOM_MAX_LENGTH} numbers are supported (you entered ${parts.length}).`,
    };
  }
  const values: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return { ok: false, error: `"${part}" is not a positive whole number.` };
    }
    const value = Number(part);
    if (value < CUSTOM_VALUE_MIN || value > CUSTOM_VALUE_MAX) {
      return {
        ok: false,
        error: `${value} is out of range: use ${CUSTOM_VALUE_MIN} to ${CUSTOM_VALUE_MAX}.`,
      };
    }
    values.push(value);
  }
  return { ok: true, values };
}
