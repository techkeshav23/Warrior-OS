// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom accent helper
// Maps an app category to a FORGE HUD accent hex (glow + particles for
// phantoms and the window-close disintegration). Phantoms prefer the
// app's own icon hue (getAppHue) and fall back to the category color.
// ═══════════════════════════════════════════════════════════

import type { AppCategory } from '@/types/app';
import { PLASMA, STATUS, VIZ } from '@/styles/tokens';

// On-palette: Plasma for learning, violet for building, mint for
// utilities, rose for chill, gold for system.
const CATEGORY_ACCENT: Record<AppCategory, string> = {
  study: PLASMA[400],
  build: VIZ[2],
  utility: VIZ[3],
  chill: VIZ[4],
  system: STATUS.gold,
};

/** Resolve an accent hex for a phantom given the source app's category. */
export function accentForCategory(category: AppCategory | undefined): string {
  if (!category) return PLASMA[400];
  return CATEGORY_ACCENT[category] ?? PLASMA[400];
}
