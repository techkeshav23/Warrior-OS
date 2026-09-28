// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom accent helper
// Maps an app category to a theme accent hex (used for glow + particles)
// ═══════════════════════════════════════════════════════════

import type { AppCategory } from '@/types/app';

// Mirrors the accent CSS vars in globals.css (§4 conventions).
const CATEGORY_ACCENT: Record<AppCategory, string> = {
  study: '#00f0ff', // accent-primary (cyan)
  build: '#7b61ff', // accent-secondary (purple)
  utility: '#00e676', // accent-success (green)
  chill: '#ff3d71', // accent-tertiary (pink)
  system: '#ffab00', // accent-warning (amber)
};

/** Resolve an accent hex for a phantom given the source app's category. */
export function accentForCategory(category: AppCategory | undefined): string {
  if (!category) return '#00f0ff';
  return CATEGORY_ACCENT[category] ?? '#00f0ff';
}
