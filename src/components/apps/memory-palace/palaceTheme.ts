// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace palette (FORGE HUD)
// Scene colours for three.js materials, lights and fog, mirrored from
// the design tokens (src/styles/tokens.ts): cool deep-ink stone, plasma
// for live knowledge and machine light, ember for warm lamps and
// ageing knowledge, status colours for review state. Pure data, no
// three.js import, so the HUD and the data layer can share it.
// ═══════════════════════════════════════════════════════════

import { EMBER, FG, INK, PLASMA, STATUS, VIZ } from '@/styles/tokens';

export const PALACE = {
  /** Clear colour + fog (the void beyond the torches). */
  void: '#05070d',
  fogNear: 14,
  fogFar: 70,
  /** Hemisphere light: cool plasma-grey sky, warm ember-dark ground. */
  sky: '#a8bfdc',
  ground: '#1c1410',
  /** Entrance-hall key light. */
  keyLight: PLASMA[400],
  /** Emissive strips along corridors and the entrance. */
  glow: PLASMA[400],
  /** Lamps / sconces. */
  lamp: EMBER[300],
  /** Wing archways. */
  wing: VIZ[2],
  /** Grand hall trim + chandelier. */
  hall: STATUS.gold,
  /** Archive (unfiled) steel. */
  archive: FG.muted,
  /** Stone ramp: walls, pillars, floors, ceilings (cool ink). */
  stone: '#353c4b',
  stoneLight: '#465064',
  floor: '#1e2430',
  floorVestibule: '#232a37',
  ceiling: '#10141d',
  ceilingVestibule: '#131824',
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
