// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AppIcon (FORGE HUD kit)
// The one app icon used everywhere (desktop, start menu, taskbar, window
// title, palette, tour): a rounded-[28%] ink tile with a hairline edge,
// an inner top highlight, a faint hue wash and the app's lucide glyph
// tinted with its hue. `active` (or hovering a `.group` parent) adds a
// soft hue glow.
//   <AppIcon appId="notes" size={40} />
//   <button className="group"><AppIcon appId={id} size={56} active={running} /></button>
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { APP_HUES, getAppIconSpec } from '@/data/app-icons';

/** Designed sizes: 16 · 18 · 20 · 28 · 40 · 56 (other numbers scale). */
export type AppIconSize = 16 | 18 | 20 | 24 | 28 | 32 | 40 | 48 | 56 | 64;

export interface AppIconProps {
  appId: string;
  size?: AppIconSize | number;
  /** Running / focused / selected: hue glow + brighter edge. */
  active?: boolean;
  /** Accessible name; omit when a visible label sits next to the icon. */
  label?: string;
  className?: string;
}

function glyphSize(size: number): number {
  if (size <= 16) return 10;
  if (size <= 20) return Math.round(size * 0.62);
  if (size <= 28) return 16;
  return Math.round(size * 0.52);
}

function strokeFor(size: number): number {
  if (size <= 20) return 2.25;
  if (size <= 28) return 2;
  if (size <= 40) return 1.85;
  return 1.75;
}

function AppIconInner({ appId, size = 40, active = false, label, className }: AppIconProps) {
  const spec = getAppIconSpec(appId);
  const hue = APP_HUES[spec.hue];
  const Glyph = spec.icon;
  const small = size <= 20;
  const style = {
    width: size,
    height: size,
    '--app-hue': hue,
    backgroundImage: `radial-gradient(120% 85% at 50% 0%, color-mix(in srgb, ${hue} ${small ? 10 : 16}%, transparent) 0%, transparent 62%), linear-gradient(180deg, var(--color-ink-750, #141b28) 0%, var(--color-ink-900, #070a12) 100%)`,
  } as CSSProperties;

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-app-icon={appId}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-[28%] border',
        'transition-[border-color,box-shadow] duration-180 ease-out-quint',
        'inset-shadow-[0_1px_0_rgb(255_255_255/0.09)]',
        active
          ? 'border-[color-mix(in_srgb,var(--app-hue)_45%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--app-hue)_14%,transparent),0_0_18px_-4px_color-mix(in_srgb,var(--app-hue)_55%,transparent)]'
          : cn(
              'border-line-strong shadow-[0_1px_2px_rgb(0_0_0/0.35)]',
              'group-hover:border-[color-mix(in_srgb,var(--app-hue)_35%,transparent)] group-hover:shadow-[0_0_16px_-6px_color-mix(in_srgb,var(--app-hue)_50%,transparent)]',
              'group-focus-visible:border-[color-mix(in_srgb,var(--app-hue)_35%,transparent)]'
            ),
        className
      )}
      style={style}
    >
      <Glyph
        size={glyphSize(size)}
        strokeWidth={strokeFor(size)}
        aria-hidden
        className="relative"
        style={{
          color: hue,
          filter: active
            ? `drop-shadow(0 0 6px color-mix(in srgb, ${hue} 60%, transparent))`
            : small
              ? undefined
              : `drop-shadow(0 0 3px color-mix(in srgb, ${hue} 30%, transparent))`,
        }}
      />
    </span>
  );
}

/** Designed app tile for an app id (fallback glyph for unknown ids). */
export const AppIcon = memo(AppIconInner);
