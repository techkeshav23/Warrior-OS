// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DesktopIcon Component
// Memoized desktop icon: glyph tile + label, 3D tilt and glow on
// hover, click to select, double-click / Enter to launch (with a
// small launch bounce). Props are primitives plus stable callbacks
// so only the icon that changes re-renders.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import type { AppDefinition } from '@/types/app';
import { cn } from '@/lib/utils';

/**
 * The glyph shown for an app: its emoji icon when it has one, else the
 * first letter of its name (registry icons are emoji; a plain ASCII
 * value such as a Lucide name falls back to the letter).
 */
export function appGlyph(icon: string | undefined, name: string): string {
  const trimmed = icon?.trim() ?? '';
  const hasNonAscii = Array.from(trimmed).some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f);
  if (hasNonAscii) return trimmed;
  return name.charAt(0).toUpperCase() || '?';
}

interface DesktopIconProps {
  app: AppDefinition;
  /** Stagger index for the entrance animation */
  index?: number;
  selected?: boolean;
  onSelect?: (appId: string) => void;
  onLaunch: (appId: string) => void;
}

function DesktopIconInner({ app, index = 0, selected = false, onSelect, onLaunch }: DesktopIconProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const bounce = useAnimationControls();
  const glyph = appGlyph(app.icon, app.name);

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (y - 0.5) * -14, y: (x - 0.5) * 14 });
  };

  const launch = () => {
    void bounce.start({
      scale: [1, 0.86, 1.08, 1],
      transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
    });
    onLaunch(app.id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      launch();
    }
  };

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 20) * 0.04, duration: 0.3 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onClick={() => onSelect?.(app.id)}
      onDoubleClick={launch}
      onKeyDown={handleKeyDown}
      aria-label={`${app.name}${app.description ? `: ${app.description}` : ''}. Double-click or press Enter to open.`}
      aria-pressed={selected}
      title={app.description ?? app.name}
      className={cn(
        'group w-20 h-20 flex flex-col items-center justify-center gap-1.5 outline-none',
        'rounded-[var(--radius-md)] cursor-default select-none',
        'transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-accent-primary/50',
        selected ? 'bg-accent-primary/10 ring-1 ring-accent-primary/30' : 'hover:bg-white/5 active:bg-white/10'
      )}
      style={{ perspective: 600 }}
    >
      <motion.div
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex flex-col items-center gap-1.5"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <motion.div
          animate={bounce}
          className={cn(
            'w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center',
            'bg-accent-primary/10 border border-accent-primary/20 transition-all duration-200',
            'group-hover:border-accent-primary/40 group-hover:shadow-[0_0_12px_rgba(0,240,255,0.15)]',
            selected && 'border-accent-primary/50 shadow-[0_0_14px_rgba(0,240,255,0.2)]'
          )}
        >
          <span className="text-lg leading-none text-accent-primary" aria-hidden="true">
            {glyph}
          </span>
        </motion.div>
        <span
          className={cn(
            'max-w-[76px] text-[10px] font-mono text-center leading-tight line-clamp-2 transition-colors',
            selected ? 'text-accent-primary' : 'text-text-secondary group-hover:text-text-primary'
          )}
          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
        >
          {app.name}
        </span>
      </motion.div>
    </motion.button>
  );
}

export const DesktopIcon = memo(DesktopIconInner);
