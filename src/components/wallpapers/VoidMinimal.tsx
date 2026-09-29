// ═══════════════════════════════════════════════════════════
// WARRIOR OS — "Forge Night" wallpaper (id: void)
// The default / fallback wallpaper: new visitors, lite mode, browsers
// without hardware WebGL, and any wallpaper that crashes all land here.
// A gunmetal night: cold steel sky, a jagged ridge rim-lit by the ember
// glow of a forge below it, sparks rising from the valley, faint ash,
// vignette and grain.
// CSS-only (src/styles/deep-space.css): painted once, zero JS animation.
// The only motion is a slow compositor "breathing" of the forge glow,
// which stops under reduced motion and lite mode. In live mode the mouse
// uniforms feed a gentle three-depth parallax through CSS variables.
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
      <div className="wos-deep-space__heat" />
      <div className="wos-deep-space__sparks" />
      <div className="wos-deep-space__field" />
    </div>
  );
}

export const VoidMinimal = memo(VoidMinimalInner);
