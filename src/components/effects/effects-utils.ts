// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Effects Utilities
// Shared helpers for the cinematic layers: stacking plan, reduced
// motion / lite mode, easing, rarity palette and pure XP / level maths
// ═══════════════════════════════════════════════════════════

import { Compass, Flame, GraduationCap, Hammer, Sparkles, type LucideIcon } from 'lucide-react';
import type { Achievement, AchievementCategory } from '@/types/achievement';
import { LEVEL_THRESHOLDS } from '@/lib/constants';
import { isLiteModeActive } from '@/lib/lite-mode';

export type Rarity = Achievement['rarity'];

/**
 * Stacking plan (numbers because canvas-confetti needs one; they follow
 * the CSS --z-* scale in globals.css).
 * - The achievement cinematic, its confetti and the level-up card sit
 *   above windows, the taskbar (--z-taskbar 500) and the Dynamic Island
 *   they fly into (--z-dynamic-island 600), but BELOW everything the
 *   user opens on purpose: start menu (700), command palette (800),
 *   context menus (850), notifications and toasts (900) and dialogs
 *   (--z-modal 950). They never take clicks outside their own card or
 *   medallion, and the lock screen (--z-boot 1000) covers them. The
 *   compact achievement toast lives in the toast layer (--z-notification).
 * - Phase transitions (unlock shatter, glitch) sit above the boot and
 *   lock screens and below the custom cursor (--z-cursor 9999).
 * - The disintegrate canvas lives in the desktop phase: above windows,
 *   below the taskbar.
 */
export const FX_Z = {
  disintegrate: 150,
  cinematic: 650,
  confetti: 660,
  levelUp: 670,
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
export const FX_DISPLAY_FONT = 'var(--font-display, var(--font-forge, "Chakra Petch")), var(--font-sans)';

/** True when the user asked the OS for reduced motion. Call from handlers/effects. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * True when a big animated moment should take its quiet path: reduced
 * motion, or lite mode (Settings → Performance) on an ordinary laptop.
 * Call from handlers/effects.
 */
export function prefersReducedEffects(): boolean {
  return prefersReducedMotion() || isLiteModeActive();
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

// FORGE HUD palette: steel → mint → azure → violet → gold (tokens.ts).
export const RARITY_STYLE: Record<Rarity, RarityStyle> = {
  common: {
    label: 'Common',
    color: '#a0adc2', // fg-muted
    glow: 'rgba(160, 173, 194, 0.4)',
    gradient: 'linear-gradient(135deg, #e6edf7 0%, #6f7d94 100%)',
  },
  uncommon: {
    label: 'Uncommon',
    color: '#3ddc97', // success / mint
    glow: 'rgba(61, 220, 151, 0.42)',
    gradient: 'linear-gradient(135deg, #b5f5d8 0%, #1fa874 100%)',
  },
  rare: {
    label: 'Rare',
    color: '#6aa8ff', // info / azure
    glow: 'rgba(106, 168, 255, 0.45)',
    gradient: 'linear-gradient(135deg, #c3dcff 0%, #3b7fe0 100%)',
  },
  epic: {
    label: 'Epic',
    color: '#a78bfa', // viz-3 / violet
    glow: 'rgba(167, 139, 250, 0.45)',
    gradient: 'linear-gradient(135deg, #ddd2fe 0%, #7c5ce6 100%)',
  },
  legendary: {
    label: 'Legendary',
    color: '#f5c04a', // gold
    glow: 'rgba(245, 192, 74, 0.5)',
    gradient: 'linear-gradient(135deg, #ffe9a8 0%, #f76b15 100%)',
  },
};

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Lucide glyph per achievement category (medallions, galleries, toasts). */
export const CATEGORY_ICON: Record<AchievementCategory, LucideIcon> = {
  study: GraduationCap,
  build: Hammer,
  streak: Flame,
  exploration: Compass,
  special: Sparkles,
};

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
