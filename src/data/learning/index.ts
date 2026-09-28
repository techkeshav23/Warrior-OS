// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Learning Content: Barrel Export
// Sample decks seeded into useLearningStore on first run.
// ═══════════════════════════════════════════════════════════

import type { DeckInput } from '@/types/learning';
import { WARRIOR_OS_BASICS } from './warrior-os-basics';

export { WARRIOR_OS_BASICS } from './warrior-os-basics';

/** Every shipped sample deck (each has a stable id and isSample: true). */
export const SAMPLE_DECKS: readonly DeckInput[] = [WARRIOR_OS_BASICS];
