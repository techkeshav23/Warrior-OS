// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Brand mark
// The shield emblem (same silhouette as the app icon): a Plasma shield
// with the "W" chevron forged in Ember. Pure SVG, token colours only,
// so it renders anywhere (boot, lock, small-screen notice, fault screen).
//
//   <BrandMark size={20} />                 // chrome
//   <BrandMark size={56} glow />            // hero moments
//   <BrandMark size={20} tone="mono" />     // single colour (currentColor)
// ═══════════════════════════════════════════════════════════

import { memo, useId } from 'react';
import { cn } from '@/lib/utils';

export interface BrandMarkProps {
  size?: number;
  /** 'forge' = plasma shield + ember W (default) · 'mono' = currentColor. */
  tone?: 'forge' | 'mono';
  /** Soft halo behind the mark (hero moments only). */
  glow?: boolean;
  className?: string;
}

const SHIELD = 'M24 3.5 40.5 9.4v12.4c0 10.3-6.8 18.1-16.5 22.7C14.3 39.9 7.5 32.1 7.5 21.8V9.4L24 3.5Z';
const CHEVRON = 'M15.5 17.5 19.4 30.5 24 22.2l4.6 8.3 3.9-13';

function BrandMarkInner({ size = 20, tone = 'forge', glow = false, className }: BrandMarkProps) {
  const uid = useId().replace(/:/g, '');
  const shieldId = `wos-mark-shield-${uid}`;
  const wId = `wos-mark-w-${uid}`;
  const forge = tone === 'forge';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      style={glow ? { filter: 'drop-shadow(0 0 14px color-mix(in oklab, var(--color-plasma-400) 45%, transparent))' } : undefined}
    >
      {forge && (
        <defs>
          <linearGradient id={shieldId} x1="10" y1="4" x2="38" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--color-plasma-300)" />
            <stop offset="1" stopColor="var(--color-plasma-600)" />
          </linearGradient>
          <linearGradient id={wId} x1="16" y1="17" x2="32" y2="31" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--color-ember-300)" />
            <stop offset="1" stopColor="var(--color-ember-500)" />
          </linearGradient>
        </defs>
      )}
      <path
        d={SHIELD}
        fill={forge ? 'color-mix(in oklab, var(--color-plasma-400) 8%, transparent)' : 'none'}
        stroke={forge ? `url(#${shieldId})` : 'currentColor'}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <path
        d={CHEVRON}
        stroke={forge ? `url(#${wId})` : 'currentColor'}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const BrandMark = memo(BrandMarkInner);
