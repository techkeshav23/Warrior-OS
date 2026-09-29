// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DesktopIcon Component
// Memoized desktop icon: a 56px <AppIcon> tile over a two-line label.
//   hover     quiet surface tile, the glyph lifts 2px, hue glow on the tile
//   selected  surface-active tile with a hairline ring + active hue glow
//   focus     inset 2px accent ring (keyboard only)
//   pressed   surface-active; a double-click / Enter launch plays a
//             short press on the glyph (no bounce)
// Click selects, double-click / Enter launches. Props are primitives plus
// stable callbacks so only the icon that changes re-renders.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type KeyboardEvent } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import type { AppDefinition } from '@/types/app';
import { AppIcon } from '@/components/ui/AppIcon';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import { cn } from '@/lib/utils';

/**
 * The glyph shown for an app: its emoji icon when it has one, else the
 * first letter of its name (registry icons are emoji; a plain ASCII
 * value such as a Lucide name falls back to the letter).
 * Kept for callers that still render a text glyph; new UI uses <AppIcon>.
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

/** Legible over any wallpaper: a tight dark halo plus a soft wide one. */
const LABEL_SHADOW =
  '[text-shadow:0_1px_2px_var(--color-ink-950),0_0_6px_var(--color-ink-950),0_0_12px_color-mix(in_oklab,var(--color-ink-950)_70%,transparent)]';

function DesktopIconInner({ app, index = 0, selected = false, onSelect, onLaunch }: DesktopIconProps) {
  const press = useAnimationControls();
  const reduceMotion = useReducedMotion() ?? false;

  const launch = () => {
    if (!reduceMotion) {
      void press.start({
        scale: [1, 0.9, 1],
        transition: { duration: 0.26, ease: EASE_OUT_QUINT, times: [0, 0.35, 1] },
      });
    }
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
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 24) * 0.022, duration: 0.26, ease: EASE_OUT_QUINT }}
      onClick={() => onSelect?.(app.id)}
      onDoubleClick={launch}
      onKeyDown={handleKeyDown}
      aria-label={`${app.name}${app.description ? `: ${app.description}` : ''}. Double-click or press Enter to open.`}
      aria-pressed={selected}
      title={app.description ?? app.name}
      data-selected={selected || undefined}
      className={cn(
        'group relative flex h-[100px] w-[88px] flex-col items-center gap-1.5 px-1 pt-1.5',
        'cursor-default select-none rounded-card focus-ring-inset',
        'transition-colors duration-120 ease-out-quint',
        selected
          ? 'bg-surface-active ring-1 ring-inset ring-line-strong'
          : 'hover:bg-surface-hover hover:ring-1 hover:ring-inset hover:ring-line active:bg-surface-active'
      )}
    >
      <span
        className={cn(
          'block transition-transform duration-180 ease-out-quint',
          !selected && 'group-hover:-translate-y-0.5'
        )}
      >
        <motion.span animate={press} className="block">
          <AppIcon appId={app.id} size={56} active={selected} />
        </motion.span>
      </span>
      <span
        className={cn(
          'line-clamp-2 w-full break-words text-center text-xs font-medium',
          'transition-colors duration-120 ease-out-quint',
          LABEL_SHADOW,
          selected ? 'text-fg' : 'text-fg/90 group-hover:text-fg'
        )}
      >
        {app.name}
      </span>
    </motion.button>
  );
}

export const DesktopIcon = memo(DesktopIconInner);
