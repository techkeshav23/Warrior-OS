// ═══════════════════════════════════════════════════════════
// WARRIOR OS — FORGE HUD tokens for JavaScript
// The source of truth is src/app/globals.css (Tailwind @theme). Use the
// utilities there in markup; reach for these constants only where CSS
// classes can't go: canvas / WebGL, recharts props, SVG attributes,
// framer-motion transitions. Guide: docs/design-system.md
// ═══════════════════════════════════════════════════════════

// ─── Palette (hex / rgba strings, same values as the CSS tokens) ───

export const INK = {
  950: '#04060b',
  900: '#070a12',
  850: '#0b1019',
  800: '#0f1520',
  750: '#141b28',
  700: '#1a2332',
  600: '#243044',
  500: '#33415a',
} as const;

export const FG = {
  base: '#e6edf7',
  muted: '#a0adc2',
  subtle: '#6f7d94',
  faint: '#4a566b',
} as const;

export const LINE = {
  base: 'rgba(148,170,205,0.10)',
  strong: 'rgba(148,170,205,0.18)',
} as const;

export const PLASMA = { 300: '#7ce7fb', 400: '#2fd6f5', 500: '#10b8d8', 600: '#0b8fad' } as const;
export const EMBER = { 300: '#ffb27a', 400: '#ff8a3d', 500: '#f76b15', 600: '#d4520b' } as const;

export const STATUS = {
  success: '#3ddc97',
  warning: '#f5c04a',
  danger: '#ff5470',
  info: '#6aa8ff',
  gold: '#f5c04a',
} as const;

/**
 * The eight chart hues, by slot (= the CSS viz-1…viz-8 tokens). A slot is
 * a hue's name: VIZ[3] is always mint, VIZ[4] always rose. Pick a slot for
 * a mark with one fixed meaning; multi-series charts use VIZ_SERIES.
 */
export const VIZ = [
  '#2fd6f5', // viz-1 plasma
  '#ff8a3d', // viz-2 ember
  '#a78bfa', // viz-3 violet
  '#3ddc97', // viz-4 mint
  '#ff6b8a', // viz-5 rose
  '#6aa8ff', // viz-6 azure
  '#f5c04a', // viz-7 amber
  '#b8e068', // viz-8 lime
] as const;

/**
 * Multi-series chart order (CSS series-1…series-8): brand hues first,
 * then the rest arranged so neighbours stay apart under protan/deutan
 * vision (adjacent CVD ΔE ≥ 8.2, normal ΔE ≥ 19.3 on ink-900/850/800;
 * rose never next to mint). Series i takes VIZ_SERIES[i]; past 8 series,
 * fold into "Other" instead of wrapping. Scatter / bubble / small
 * multiples (any two marks can touch): 3 series at most.
 */
export const VIZ_SERIES = [
  VIZ[0], // plasma
  VIZ[1], // ember
  VIZ[2], // violet
  VIZ[6], // amber
  VIZ[3], // mint
  VIZ[5], // azure
  VIZ[4], // rose
  VIZ[7], // lime
] as const;

/** Colour for series i in the color-blind-safe order (wraps after 8). */
export function vizColor(i: number): string {
  return VIZ_SERIES[((i % VIZ_SERIES.length) + VIZ_SERIES.length) % VIZ_SERIES.length];
}

// ─── Charts (recharts and hand-drawn SVG/canvas) ───
// Wrap charts in an element with `font-mono` so tick text inherits
// JetBrains Mono; SVG attributes can't read CSS variables reliably.
export const CHART = {
  /** Gridlines: horizontal only, hairline. */
  grid: LINE.base,
  /** Axis tick text colour (11px mono). */
  axis: FG.subtle,
  axisFontSize: 11,
  /** Hover cursor band / line. */
  cursor: 'rgba(148,170,205,0.08)',
  /** recharts `tick` prop. */
  tick: { fill: FG.subtle, fontSize: 11 },
  /** Area fills: series colour at this opacity, fading to 0. */
  areaOpacity: 0.22,
  strokeWidth: 2,
} as const;

// ─── Motion (framer-motion: seconds + cubic-bezier arrays) ───

export const EASE_OUT_QUINT = [0.16, 1, 0.3, 1] as const;

/** 120ms hover · 180ms small transitions · 260ms panels/windows. */
export const DURATION = { hover: 0.12, small: 0.18, panel: 0.26 } as const;

export const TRANSITION = {
  hover: { duration: DURATION.hover, ease: EASE_OUT_QUINT },
  small: { duration: DURATION.small, ease: EASE_OUT_QUINT },
  panel: { duration: DURATION.panel, ease: EASE_OUT_QUINT },
} as const;

// ─── Accent ───

export const DEFAULT_ACCENT = PLASMA[400];

/** Accent choices for Settings (the viz palette, Plasma first). */
export const ACCENT_PRESETS = [
  { label: 'Plasma', value: '#2fd6f5' },
  { label: 'Ember', value: '#ff8a3d' },
  { label: 'Violet', value: '#a78bfa' },
  { label: 'Mint', value: '#3ddc97' },
  { label: 'Rose', value: '#ff6b8a' },
  { label: 'Azure', value: '#6aa8ff' },
  { label: 'Gold', value: '#f5c04a' },
  { label: 'Lime', value: '#b8e068' },
] as const;

/**
 * Pre-FORGE accent values still stored in settings / workspaces (and the old
 * Settings swatches) → their on-palette successor.
 */
const LEGACY_ACCENTS: Readonly<Record<string, string>> = {
  '#00f0ff': '#2fd6f5', // old neon cyan default → Plasma
  '#00e676': '#3ddc97', // old Build workspace → Mint
  '#7b61ff': '#a78bfa', // old Chill workspace → Violet
  '#a855f7': '#a78bfa',
  '#22c55e': '#3ddc97',
  '#ec4899': '#ff6b8a',
  '#f97316': '#ff8a3d',
  '#3b82f6': '#6aa8ff',
  '#ef4444': '#ff5470',
  '#eab308': '#f5c04a',
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/;

/**
 * The accent to paint for a stored accent value: lower-cased hex, legacy
 * values mapped onto the palette, anything invalid → Plasma. Always a plain
 * hex, so it is safe to interpolate into CSS.
 */
export function resolveAccent(color: string | null | undefined): string {
  if (typeof color !== 'string') return DEFAULT_ACCENT;
  const hex = color.trim().toLowerCase();
  if (!HEX_COLOR.test(hex)) return DEFAULT_ACCENT;
  return LEGACY_ACCENTS[hex] ?? hex;
}

/**
 * Settings → Glass Opacity (0.3–0.9, default 0.6) → window glass alpha
 * (0.74–0.98). The default lands on 0.86: legible glass over busy
 * wallpapers and other windows, with the blur still reading through.
 */
export function glassAlphaFor(opacity: number): number {
  const v = Number.isFinite(opacity) ? Math.min(0.9, Math.max(0.3, opacity)) : 0.6;
  return Math.round((0.74 + (v - 0.3) * 0.4) * 1000) / 1000;
}

/**
 * The live accent as a computed colour string (e.g. "rgb(47, 214, 245)"),
 * for canvas / WebGL code that can't use CSS variables. Includes the
 * decay-stage warming. Falls back to Plasma outside the browser.
 */
export function readAccent(): string {
  if (typeof document === 'undefined') return DEFAULT_ACCENT;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--accent)';
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || DEFAULT_ACCENT;
}
