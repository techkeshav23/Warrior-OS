// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GlitchText Component
// Chromatic aberration glitch on text (plasma / ember split, FORGE HUD).
// Reserve for boot / lock / fault moments.
// ═══════════════════════════════════════════════════════════

'use client';

import { cn } from '@/lib/utils';

interface GlitchTextProps {
  text: string;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
  active?: boolean;
}

export function GlitchText({
  text,
  className,
  intensity = 'medium',
  active = true,
}: GlitchTextProps) {
  const offsetMap = {
    low: { x: '1px', blur: '0px' },
    medium: { x: '2px', blur: '0px' },
    high: { x: '3px', blur: '1px' },
  };

  const offset = offsetMap[intensity];

  if (!active) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn('relative inline-block', className)} aria-label={text}>
      {/* Ember layer */}
      <span
        className="absolute inset-0 opacity-60"
        style={{
          color: 'var(--color-ember-500, #f76b15)',
          clipPath: 'polygon(0 0, 100% 0, 100% 45%, 0 45%)',
          transform: `translate(${offset.x}, 0)`,
          filter: `blur(${offset.blur})`,
        }}
        aria-hidden
      >
        {text}
      </span>

      {/* Plasma layer */}
      <span
        className="absolute inset-0 opacity-60"
        style={{
          color: 'var(--color-plasma-400, #2fd6f5)',
          clipPath: 'polygon(0 55%, 100% 55%, 100% 100%, 0 100%)',
          transform: `translate(-${offset.x}, 0)`,
          filter: `blur(${offset.blur})`,
        }}
        aria-hidden
      >
        {text}
      </span>

      {/* Main text */}
      <span className="relative">{text}</span>
    </span>
  );
}
