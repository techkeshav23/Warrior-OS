// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Brand mark
// The forged shield: a faceted steel shield (lit left face, shadowed
// right face) with a sunk ember core and a molten "W" chevron. Pure SVG, token colours only,
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
  /** 'forge' = steel shield + ember core (default) · 'mono' = currentColor. */
  tone?: 'forge' | 'mono';
  /** Soft halo behind the mark (hero moments only). */
  glow?: boolean;
  className?: string;
}

// Faceted shield: flat top with cut shoulders, a center ridge, a point.
const SHIELD = 'M13 4h22l6.5 5.5v13.2c0 9.6-6.9 16.9-17.5 21.8C13.4 39.6 6.5 32.3 6.5 22.7V9.5L13 4Z';
const LEFT_FACE = 'M13 4h11v40.5C13.4 39.6 6.5 32.3 6.5 22.7V9.5L13 4Z';
const INNER = 'M14.4 7.4h19.2l4.6 3.9v11.4c0 7.7-5.4 13.8-14.2 18-8.8-4.2-14.2-10.3-14.2-18V11.3l4.6-3.9Z';
const CHEVRON = 'M15.5 17.5 19.4 30.5 24 22.2l4.6 8.3 3.9-13';

function BrandMarkInner({ size = 20, tone = 'forge', glow = false, className }: BrandMarkProps) {
  const uid = useId().replace(/:/g, '');
  const steelL = `wos-mark-steel-l-${uid}`;
  const steelR = `wos-mark-steel-r-${uid}`;
  const coreId = `wos-mark-core-${uid}`;
  const wId = `wos-mark-w-${uid}`;
  const forge = tone === 'forge';

  if (!forge) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn('shrink-0', className)}>
        <path d={SHIELD} stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" />
        <path d={CHEVRON} stroke="currentColor" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      style={glow ? { filter: 'drop-shadow(0 0 14px color-mix(in oklab, var(--color-ember-500) 50%, transparent))' } : undefined}
    >
      <defs>
        <linearGradient id={steelL} x1="8" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c9d1dc" />
          <stop offset="0.45" stopColor="#6d7785" />
          <stop offset="1" stopColor="#2a3039" />
        </linearGradient>
        <linearGradient id={steelR} x1="24" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c8592" />
          <stop offset="0.5" stopColor="#3e4651" />
          <stop offset="1" stopColor="#15191e" />
        </linearGradient>
        <radialGradient id={coreId} cx="24" cy="26" r="15" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-ember-600, #d4520b)" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0b0d10" stopOpacity="0.95" />
        </radialGradient>
        <linearGradient id={wId} x1="16" y1="17" x2="32" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-ember-100, #fff4e0)" />
          <stop offset="0.4" stopColor="var(--color-ember-300, #ffb27a)" />
          <stop offset="1" stopColor="var(--color-ember-500, #f76b15)" />
        </linearGradient>
      </defs>
      {/* Forged steel shield: lit left face, shadowed right face, dark rim */}
      <path d={SHIELD} fill={`url(#${steelR})`} stroke="#07080a" strokeWidth={1} strokeLinejoin="round" />
      <path d={LEFT_FACE} fill={`url(#${steelL})`} />
      {/* Sunk ember core */}
      <path d={INNER} fill={`url(#${coreId})`} stroke="rgb(0 0 0 / 0.6)" strokeWidth={0.8} strokeLinejoin="round" />
      {/* Molten W */}
      <path
        d={CHEVRON}
        stroke={`url(#${wId})`}
        strokeWidth={3.2}
        strokeLinecap="square"
        strokeLinejoin="miter"
        style={{ filter: 'drop-shadow(0 0 2px var(--color-ember-500, #f76b15))' }}
      />
    </svg>
  );
}

export const BrandMark = memo(BrandMarkInner);
