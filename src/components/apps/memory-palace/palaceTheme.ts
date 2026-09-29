// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace palette (FORGED ARMOR)
// Scene colours for three.js materials, lights and fog, mirrored from
// the design tokens (src/styles/tokens.ts): gunmetal stone lit like a
// forge (ember key light, molten seams along the corridors, warm
// lamps), plasma only for live knowledge (recency), status colours for
// review state. Colours only: no extra lights or passes, so FPS holds. Pure data, no
// three.js import, so the HUD and the data layer can share it.
// ═══════════════════════════════════════════════════════════

import { EMBER, FG, INK, PLASMA, STATUS, VIZ } from '@/styles/tokens';

export const PALACE = {
  /** Clear colour + fog (the void beyond the torches). */
  void: '#060708',
  fogNear: 14,
  fogFar: 70,
  /** Hemisphere light: steel-grey sky, warm ember-dark ground. */
  sky: '#b9bec6',
  ground: '#1c1410',
  /** Entrance-hall key light. */
  keyLight: EMBER[300],
  /** Emissive strips along corridors and the entrance (molten seams). */
  glow: EMBER[400],
  /** Lamps / sconces. */
  lamp: EMBER[300],
  /** Wing archways. */
  wing: VIZ[2],
  /** Grand hall trim + chandelier. */
  hall: STATUS.gold,
  /** Archive (unfiled) steel. */
  archive: FG.muted,
  /** Stone ramp: walls, pillars, floors, ceilings (forged gunmetal). */
  stone: '#3a3f46',
  stoneLight: '#4c525b',
  floor: '#1d2024',
  floorVestibule: '#23272c',
  ceiling: '#101215',
  ceilingVestibule: '#14171b',
  trimWood: '#3b2f25',
  carpet: '#3a1a16',
  hallStone: '#4f4a45',
  hallFloor: '#2a2622',
  hallCeiling: '#12100e',
  hallCarpet: '#4a1d18',
  wingFloor: '#252233',
  wingWall: '#3d3850',
  wingPillar: '#5d5577',
  /** Scroll knobs on formula notes; cobweb dust + strands on stale ones. */
  scrollKnob: '#6b5a4c',
  cobwebDust: '#a8aab2',
  cobwebWeb: '#c4c8d0',
} as const;

/** Spaced repetition states. */
export const DUE_HEX = STATUS.danger;
export const NEW_HEX = STATUS.warning;

/** Recency glow: today plasma → this week deep plasma → month ember → dust. */
export const RECENCY_HEX = {
  today: PLASMA[400],
  week: PLASMA[600],
  month: EMBER[400],
  stale: '#3b4150',
} as const;

/** Readable label colour for a stale (dusty) object in DOM overlays. */
export const STALE_LABEL_HEX = FG.subtle;

/** Room accents (drawn from the viz palette so rooms read as one family). */
export const ROOM_ACCENTS = {
  notes: [VIZ[6], VIZ[5], VIZ[2], VIZ[0], EMBER[300], VIZ[3]],
  projects: [EMBER[400], VIZ[6], VIZ[3], EMBER[500]],
} as const;

export { INK };
