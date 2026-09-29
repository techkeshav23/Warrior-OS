// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Mastery Colour Scale
// Ember → gold → mint (FORGE HUD): cold iron still in the forge,
// then tempered, then mastered. Lightness rises along the scale so
// it still reads as "more" without hue. Always pair it with a
// second cue (a % label, an arc, a bar length): never colour alone.
// ═══════════════════════════════════════════════════════════

import { EMBER, STATUS } from '@/styles/tokens';

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Stops at 0, 0.5 and 1 mastery: ember-500, gold, success. */
const STOPS: readonly Rgb[] = [hexToRgb(EMBER[500]), hexToRgb(STATUS.gold), hexToRgb(STATUS.success)];

/** CSS gradient of the whole scale, for legends. */
export const MASTERY_GRADIENT =
  'linear-gradient(90deg, var(--color-ember-500) 0%, var(--color-gold) 50%, var(--color-success) 100%)';

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Colour for a 0..1 mastery value; `alpha` < 1 gives a translucent fill. */
export function masteryColor(value: number, alpha = 1): string {
  const scaled = clamp01(value) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const from = STOPS[i];
  const to = STOPS[i + 1];
  const channel = (k: number) => Math.round(from[k] + (to[k] - from[k]) * t);
  return alpha >= 1
    ? `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`
    : `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${clamp01(alpha)})`;
}

/** 0..1 → whole percent. */
export function toPercent(value: number): number {
  return Math.round(clamp01(value) * 100);
}
