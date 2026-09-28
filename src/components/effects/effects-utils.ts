// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Effects Utilities
// Shared helpers for the cinematic layers: stacking plan, reduced
// motion, easing, rarity palette and pure XP / level maths
// ═══════════════════════════════════════════════════════════

import type { Achievement, AchievementCategory } from '@/types/achievement';
import { LEVEL_THRESHOLDS } from '@/lib/constants';

export type Rarity = Achievement['rarity'];

/**
 * Stacking plan. Root-level layers sit above the boot and lock screens
 * (--z-boot 1000) and below the custom cursor (--z-cursor 9999). The
 * disintegrate canvas lives in the desktop phase: above windows, below
 * the taskbar (--z-taskbar 500).
 */
export const FX_Z = {
  disintegrate: 150,
  levelUp: 1080,
  cinematic: 1090,
  confetti: 1095,
  shatter: 1100,
  glitch: 1110,
} as const;

/** Every effect layer carries this attribute so DOM capture skips it. */
export const FX_IGNORE_SELECTOR = '[data-fx-ignore]';

/**
 * Font stacks that resolve to the faces next/font actually loaded
 * (the CSS tokens name "Orbitron", which next/font registers under a
 * generated family name exposed as --font-orbitron on <body>).
 */
export const FX_DISPLAY_FONT = 'var(--font-orbitron, "Orbitron"), var(--font-sans)';

/** True when the user asked the OS for reduced motion. Call from handlers/effects. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Canvas font family for the display face, resolved from <body>. Browser only. */
export function resolveDisplayFontFamily(): string {
  if (typeof document === 'undefined') return '"Orbitron", sans-serif';
  const family = getComputedStyle(document.body).getPropertyValue('--font-orbitron').trim();
  return family ? `${family}, "Orbitron", sans-serif` : '"Orbitron", sans-serif';
}

// ─── Maths ───
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** '#rrggbb' + alpha → 'rgba(r, g, b, a)'. Falls back to the input for other formats. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ─── Rarity + category presentation (shared with the Stats Center gallery) ───
export interface RarityStyle {
  label: string;
  color: string;
  glow: string;
  gradient: string;
}

export const RARITY_STYLE: Record<Rarity, RarityStyle> = {
  common: {
    label: 'Common',
    color: '#b0bec5',
    glow: 'rgba(176, 190, 197, 0.45)',
    gradient: 'linear-gradient(135deg, #eceff1 0%, #90a4ae 100%)',
  },
  uncommon: {
    label: 'Uncommon',
    color: '#00e676',
    glow: 'rgba(0, 230, 118, 0.45)',
    gradient: 'linear-gradient(135deg, #b9f6ca 0%, #00c853 100%)',
  },
  rare: {
    label: 'Rare',
    color: '#40c4ff',
    glow: 'rgba(64, 196, 255, 0.5)',
    gradient: 'linear-gradient(135deg, #80d8ff 0%, #0091ea 100%)',
  },
  epic: {
    label: 'Epic',
    color: '#b388ff',
    glow: 'rgba(179, 136, 255, 0.5)',
    gradient: 'linear-gradient(135deg, #e1bee7 0%, #7c4dff 100%)',
  },
  legendary: {
    label: 'Legendary',
    color: '#ffc400',
    glow: 'rgba(255, 196, 0, 0.55)',
    gradient: 'linear-gradient(135deg, #fff59d 0%, #ff8f00 100%)',
  },
};

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  study: 'Study',
  build: 'Build',
  streak: 'Streak',
  exploration: 'Exploration',
  special: 'Special',
};

// ─── XP / level maths (pure: safe to call during render) ───
export const MAX_LEVEL = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].level;

export function levelInfo(level: number) {
  return LEVEL_THRESHOLDS.find((l) => l.level === level) ?? LEVEL_THRESHOLDS[0];
}

export function levelTitle(level: number): string {
  return levelInfo(level).title;
}

/** Progress through `level` at `xp`, 0-100 (100 at the max level). */
export function levelProgress(xp: number, level: number): number {
  const info = levelInfo(level);
  if (info.maxXP === Infinity) return 100;
  const range = info.maxXP - info.minXP;
  if (range <= 0) return 100;
  return Math.max(0, Math.min(100, ((xp - info.minXP) / range) * 100));
}

/** XP still needed to leave `level` (0 at the max level). */
export function xpToNextLevel(xp: number, level: number): number {
  const info = levelInfo(level);
  if (info.maxXP === Infinity) return 0;
  return Math.max(0, info.maxXP - xp);
}
