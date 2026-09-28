// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Learning Content: Barrel Export
// Sample decks seeded into useLearningStore on first run.
// ═══════════════════════════════════════════════════════════

import type { DeckInput } from '@/types/learning';
import { WARRIOR_OS_BASICS } from './warrior-os-basics';
import { DEV_FUNDAMENTALS } from './dev-fundamentals';

export { WARRIOR_OS_BASICS } from './warrior-os-basics';
export { DEV_FUNDAMENTALS } from './dev-fundamentals';

/** Every shipped sample deck (each has a stable id and isSample: true). */
export const SAMPLE_DECKS: readonly DeckInput[] = [WARRIOR_OS_BASICS, DEV_FUNDAMENTALS];

/** Ids of the shipped sample decks. */
export const SAMPLE_DECK_IDS: readonly string[] = SAMPLE_DECKS.map((d) => d.id).filter(
  (id): id is string => typeof id === 'string'
);
