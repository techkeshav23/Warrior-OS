// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab palette (FORGED ARMOR)
// One vocabulary for every visualizer, mirrored from the design
// tokens (src/styles/tokens.ts) because SVG attributes can't take
// Tailwind classes:
//   comparing / current  → warning     swap / delete  → danger
//   sorted / found / path → success    visited        → info
//   frontier / key        → violet     active / pivot → live accent
// ═══════════════════════════════════════════════════════════

import { EMBER, FG, INK, LINE, PLASMA, STATUS, STEEL, VIZ } from '@/styles/tokens';

/** The live accent for SVG `style` props (follows Settings). */
export const ACCENT = 'var(--accent, #ff8a3d)';

/** Mix a colour with transparency (CSS color-mix, works in SVG style props). */
export function tint(color: string, percent: number): string {
  return `color-mix(in oklab, ${color} ${percent}%, transparent)`;
}

export const LAB = {
  ink: INK,
  fg: FG,
  line: LINE,
  plasma: PLASMA,
  steel: STEEL,
  ember: EMBER,
  compare: STATUS.warning,
  swap: STATUS.danger,
  sorted: STATUS.success,
  visited: STATUS.info,
  frontier: VIZ[2],
  target: VIZ[4],
  rotate: EMBER[400],
  accent: ACCENT,
  /** Node / chip fill on the stage. */
  nodeFill: STEEL[800],
  /** Idle edges and grid. */
  edge: 'rgba(148,170,205,0.28)',
  grid: 'rgba(148,170,205,0.06)',
} as const;

export interface NodeStyle {
  fill: string;
  stroke: string;
  text: string;
  width: number;
}

/** Shared node look: dark core, coloured ring, tinted fill for "hot" states. */
export function nodeStyle(color: string, opts: { hot?: boolean; width?: number; text?: string } = {}): NodeStyle {
  return {
    fill: opts.hot ? tint(color, 26) : LAB.nodeFill,
    stroke: color,
    text: opts.text ?? FG.base,
    width: opts.width ?? 2,
  };
}
