// ═══════════════════════════════════════════════════════════
// WARRIOR OS — "Deep Space" wallpaper (id: void)
// The default / fallback wallpaper: lite mode, browsers without hardware
// WebGL, and any wallpaper that crashes all land here, so it is the
// desktop most visitors see first. Deep ink, a plasma aurora top-left,
// dawn breaking over a planet's ember rim bottom-right, fine star dust,
// vignette and grain.
// CSS-only (src/styles/deep-space.css): painted once, zero JS animation.
// The only motion is a very slow compositor drift of the aurora, which
// stops under reduced motion and lite mode. In live mode the mouse
// uniforms feed a gentle two-depth parallax through CSS variables.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';

/** -1…1 → a short, stable CSS number (still mode passes 0). */
function uniform(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}

function VoidMinimalInner({ mouseX, mouseY }: WallpaperProps) {
  const style = {
    '--wp-mx': uniform(mouseX),
    '--wp-my': uniform(mouseY),
  } as CSSProperties;

  return (
    <div className="wos-deep-space" style={style} aria-hidden="true">
      <div className="wos-deep-space__aurora" />
      <div className="wos-deep-space__field" />
    </div>
  );
}

export const VoidMinimal = memo(VoidMinimalInner);
