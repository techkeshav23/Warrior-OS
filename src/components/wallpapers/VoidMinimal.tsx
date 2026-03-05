// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Void Minimal Wallpaper
// Near-black with subtle grain noise + breathing center glow
// CSS-only — most performance-friendly wallpaper
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';

function VoidMinimalInner({ mouseX, mouseY }: WallpaperProps) {
  const glowX = 50 + mouseX * 8;
  const glowY = 50 + mouseY * 8;

  return (
    <div className="absolute inset-0 bg-[#020204]">
      {/* Breathing center glow */}
      <div
        className="absolute inset-0 animate-[breathe_6s_ease-in-out_infinite]"
        style={{
          background: `radial-gradient(ellipse 40% 35% at ${glowX}% ${glowY}%, rgba(0,180,255,0.04) 0%, transparent 70%)`,
        }}
      />

      {/* Secondary subtle glow */}
      <div
        className="absolute inset-0 animate-[breathe_8s_ease-in-out_infinite_reverse]"
        style={{
          background: `radial-gradient(ellipse 30% 25% at ${50 - mouseX * 5}% ${50 - mouseY * 5}%, rgba(120,0,255,0.025) 0%, transparent 60%)`,
        }}
      />

      {/* Grain noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(0,0,0,0.5) 100%)',
        }}
      />
    </div>
  );
}

export const VoidMinimal = memo(VoidMinimalInner);
