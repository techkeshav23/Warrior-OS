// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Mastery Colour Scale
// Red → amber → green, with lightness rising along the scale so
// it still reads as "more" without hue. Always pair it with a
// second cue (a % label, an arc, a bar length): never colour alone.
// ═══════════════════════════════════════════════════════════

type Rgb = readonly [number, number, number];

/** Stops at 0, 0.5 and 1 mastery. */
const STOPS: readonly Rgb[] = [
  [0xd9, 0x42, 0x3f],
  [0xe3, 0x9a, 0x2d],
  [0x9a, 0xf0, 0xb8],
];

/** CSS gradient of the whole scale, for legends. */
export const MASTERY_GRADIENT = 'linear-gradient(90deg, #d9423f 0%, #e39a2d 50%, #9af0b8 100%)';

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
