// ═══════════════════════════════════════════════════════════
// FORGE HUD — token tables for the /design-system page.
// Class names are literal so Tailwind generates them; values mirror the
// token contract in src/app/globals.css.
// ═══════════════════════════════════════════════════════════

import { VIZ_SERIES } from '@/styles/tokens';

export interface Swatch {
  name: string;
  cls: string;
  value: string;
  note?: string;
}

export interface SwatchGroup {
  title: string;
  description: string;
  swatches: Swatch[];
}

export const COLOR_GROUPS: SwatchGroup[] = [
  {
    title: 'Ink',
    description: 'Deep-ink surfaces. 90% of the UI lives here.',
    swatches: [
      { name: 'ink-950', cls: 'bg-ink-950', value: '#04060b' },
      { name: 'ink-900', cls: 'bg-ink-900', value: '#070a12', note: 'canvas' },
      { name: 'ink-850', cls: 'bg-ink-850', value: '#0b1019' },
      { name: 'ink-800', cls: 'bg-ink-800', value: '#0f1520' },
      { name: 'ink-750', cls: 'bg-ink-750', value: '#141b28' },
      { name: 'ink-700', cls: 'bg-ink-700', value: '#1a2332' },
      { name: 'ink-600', cls: 'bg-ink-600', value: '#243044' },
      { name: 'ink-500', cls: 'bg-ink-500', value: '#33415a' },
    ],
  },
  {
    title: 'Plasma · accent',
    description: 'Machine, interaction, focus, info. The accent token follows the user’s chosen accent at runtime.',
    swatches: [
      { name: 'accent', cls: 'bg-accent', value: 'var(--accent)', note: 'runtime' },
      { name: 'plasma-300', cls: 'bg-plasma-300', value: '#7ce7fb' },
      { name: 'plasma-400', cls: 'bg-plasma-400', value: '#2fd6f5' },
      { name: 'plasma-500', cls: 'bg-plasma-500', value: '#10b8d8' },
      { name: 'plasma-600', cls: 'bg-plasma-600', value: '#0b8fad' },
    ],
  },
  {
    title: 'Ember',
    description: 'Warrior energy only: streaks, XP, fire, achievements, forge actions.',
    swatches: [
      { name: 'ember-300', cls: 'bg-ember-300', value: '#ffb27a' },
      { name: 'ember-400', cls: 'bg-ember-400', value: '#ff8a3d' },
      { name: 'ember-500', cls: 'bg-ember-500', value: '#f76b15' },
      { name: 'ember-600', cls: 'bg-ember-600', value: '#d4520b' },
    ],
  },
  {
    title: 'Status',
    description: 'Feedback colours — soft fills (12%) with full-strength text.',
    swatches: [
      { name: 'success', cls: 'bg-success', value: '#3ddc97' },
      { name: 'warning', cls: 'bg-warning', value: '#f5c04a' },
      { name: 'danger', cls: 'bg-danger', value: '#ff5470' },
      { name: 'info', cls: 'bg-info', value: '#6aa8ff' },
      { name: 'gold', cls: 'bg-gold', value: '#f5c04a', note: 'XP' },
    ],
  },
];

export const FG_SWATCHES: Swatch[] = [
  { name: 'fg', cls: 'text-fg', value: '#e6edf7', note: 'Primary text' },
  { name: 'fg-muted', cls: 'text-fg-muted', value: '#a0adc2', note: 'Secondary text' },
  { name: 'fg-subtle', cls: 'text-fg-subtle', value: '#6f7d94', note: 'Labels, meta ≥12px' },
  { name: 'fg-faint', cls: 'text-fg-faint', value: '#4a566b', note: 'Disabled, decoration' },
];

export const SURFACE_SWATCHES: Swatch[] = [
  { name: 'surface', cls: 'bg-surface', value: 'rgba(9,13,21,.78)', note: 'windows' },
  { name: 'surface-2', cls: 'bg-surface-2', value: 'rgba(255,255,255,.025)', note: 'cards' },
  { name: 'surface-3', cls: 'bg-surface-3', value: 'rgba(13,18,28,.94)', note: 'popovers' },
  { name: 'surface-hover', cls: 'bg-surface-hover', value: 'rgba(255,255,255,.045)', note: 'hover' },
  { name: 'surface-active', cls: 'bg-surface-active', value: 'rgba(255,255,255,.07)', note: 'pressed' },
  { name: 'line', cls: 'bg-line', value: 'rgba(148,170,205,.10)', note: 'hairline' },
  { name: 'line-strong', cls: 'bg-line-strong', value: 'rgba(148,170,205,.18)', note: 'focused edge' },
];

export const VIZ_SWATCHES: Swatch[] = [
  { name: 'viz-1', cls: 'bg-viz-1', value: '#2fd6f5' },
  { name: 'viz-2', cls: 'bg-viz-2', value: '#ff8a3d' },
  { name: 'viz-3', cls: 'bg-viz-3', value: '#a78bfa' },
  { name: 'viz-4', cls: 'bg-viz-4', value: '#3ddc97' },
  { name: 'viz-5', cls: 'bg-viz-5', value: '#ff6b8a' },
  { name: 'viz-6', cls: 'bg-viz-6', value: '#6aa8ff' },
  { name: 'viz-7', cls: 'bg-viz-7', value: '#f5c04a' },
  { name: 'viz-8', cls: 'bg-viz-8', value: '#b8e068' },
];

/**
 * Multi-series order (VIZ_SERIES / vizColor(i) in src/styles/tokens.ts,
 * series-1…8 in globals.css): colour-blind-safe neighbours.
 */
export const VIZ_SERIES_SWATCHES: Swatch[] = [
  { name: 'series-1', cls: 'bg-series-1', value: VIZ_SERIES[0], note: 'plasma' },
  { name: 'series-2', cls: 'bg-series-2', value: VIZ_SERIES[1], note: 'ember' },
  { name: 'series-3', cls: 'bg-series-3', value: VIZ_SERIES[2], note: 'violet' },
  { name: 'series-4', cls: 'bg-series-4', value: VIZ_SERIES[3], note: 'amber' },
  { name: 'series-5', cls: 'bg-series-5', value: VIZ_SERIES[4], note: 'mint' },
  { name: 'series-6', cls: 'bg-series-6', value: VIZ_SERIES[5], note: 'azure' },
  { name: 'series-7', cls: 'bg-series-7', value: VIZ_SERIES[6], note: 'rose' },
  { name: 'series-8', cls: 'bg-series-8', value: VIZ_SERIES[7], note: 'lime' },
];

export interface TypeStep {
  token: string;
  cls: string;
  spec: string;
  sample: string;
  use: string;
}

export const TYPE_SCALE: TypeStep[] = [
  { token: 'text-3xl', cls: 'text-3xl font-display font-semibold', spec: '40 / 44 · Orbitron', sample: '07:42', use: 'Hero numbers, clocks' },
  { token: 'text-2xl', cls: 'text-2xl font-semibold tracking-tight', spec: '28 / 34', sample: 'Forge your discipline', use: 'Page heroes' },
  { token: 'text-xl', cls: 'text-xl font-semibold tracking-tight', spec: '22 / 28', sample: 'Weekly review', use: 'Section titles' },
  { token: 'text-lg', cls: 'text-lg font-semibold', spec: '18 / 26', sample: 'Training Grounds', use: 'App header titles' },
  { token: 'text-base', cls: 'text-base', spec: '16 / 24', sample: 'Readable long-form copy for notes and docs.', use: 'Reading text' },
  { token: 'text-sm', cls: 'text-sm', spec: '14 / 22', sample: 'Dialog copy and card titles.', use: 'Card titles, dialogs' },
  { token: 'text-ui', cls: 'text-ui', spec: '13 / 20', sample: 'The default dense text inside windows.', use: 'Default in windows' },
  { token: 'text-xs', cls: 'text-xs', spec: '12 / 16', sample: 'Meta, hints and helper lines.', use: 'Hints, meta' },
  { token: 'text-2xs', cls: 'hud-label', spec: '11 / 16 · mono caps .14em', sample: 'System status · online', use: 'HUD labels' },
];

export const SPACING = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];

export const RADII = [
  { name: 'rounded-control', cls: 'rounded-control', value: '8px', use: 'buttons, inputs' },
  { name: 'rounded-card', cls: 'rounded-card', value: '12px', use: 'cards, menus' },
  { name: 'rounded-window', cls: 'rounded-window', value: '16px', use: 'windows' },
  { name: 'rounded-sheet', cls: 'rounded-sheet', value: '20px', use: 'dialogs, sheets' },
  { name: 'rounded-full', cls: 'rounded-full', value: '999px', use: 'pills, avatars' },
];

export const ELEVATION = [
  { name: 'shadow-e1', cls: 'shadow-e1', use: 'Cards' },
  { name: 'shadow-e2', cls: 'shadow-e2', use: 'Popovers, menus' },
  { name: 'shadow-e3', cls: 'shadow-e3', use: 'Windows, dialogs' },
  { name: 'shadow-glow', cls: 'shadow-glow', use: 'Focus / live accent' },
];
