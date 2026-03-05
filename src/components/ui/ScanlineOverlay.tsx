// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ScanlineOverlay Component
// CRT scanline and vignette effect overlay
// ═══════════════════════════════════════════════════════════

'use client';

import { useSettingsStore } from '@/stores/useSettingsStore';
import { cn } from '@/lib/utils';

interface ScanlineOverlayProps {
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export function ScanlineOverlay({
  className,
  intensity = 'medium',
}: ScanlineOverlayProps) {
  const crtEffect = useSettingsStore((s) => s.crtEffect);

  if (!crtEffect) return null;

  const opacityMap = {
    low: 0.02,
    medium: 0.04,
    high: 0.08,
  };

  return (
    <div
      className={cn('fixed inset-0 pointer-events-none', className)}
      style={{ zIndex: 'var(--z-overlay)' }}
    >
      {/* Scanlines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, ${opacityMap[intensity]}) 2px,
            rgba(0, 0, 0, ${opacityMap[intensity]}) 4px
          )`,
          animation: 'scanline-move 8s linear infinite',
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />
      {/* Subtle flicker */}
      <div
        className="absolute inset-0"
        style={{
          animation: 'hologram-flicker 0.15s infinite alternate',
          opacity: 0.01,
          background: 'white',
        }}
      />
    </div>
  );
}
