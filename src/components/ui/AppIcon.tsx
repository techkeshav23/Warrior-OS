// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AppIcon (FORGED ARMOR kit)
// The one app icon used everywhere (desktop, start menu, taskbar, window
// title, palette, tour): a forged insignia plate — cut top-left and
// bottom-right, a beveled steel rim, a dark steel face with a faint hue
// wash, rivets on the small cuts (40px+), and the app's lucide glyph in
// its hue. `active` heats the rim to ember with a glow rising from the
// bottom; hovering a `.group` parent heats the rim to the app hue.
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

/** Insignia plate outline: big cuts top-left + bottom-right, small cuts on the other two. */
const PLATE =
  'polygon(26% 0, 92% 0, 100% 8%, 100% 74%, 74% 100%, 8% 100%, 0 92%, 0 26%)';

function AppIconInner({ appId, size = 40, active = false, label, className }: AppIconProps) {
  const spec = getAppIconSpec(appId);
  const hue = APP_HUES[spec.hue];
  const Glyph = spec.icon;
  const small = size <= 20;
  const edge = size >= 40 ? 1.5 : 1;
  const style = { width: size, height: size, '--app-hue': hue, clipPath: PLATE } as CSSProperties;
  const face = {
    inset: edge,
    clipPath: PLATE,
    backgroundImage: [
      active
        ? `radial-gradient(90% 60% at 50% 110%, color-mix(in srgb, var(--color-ember-500, #f76b15) 45%, transparent) 0%, transparent 70%)`
        : 'none',
      `radial-gradient(110% 80% at 50% 0%, color-mix(in srgb, ${hue} ${small ? 12 : 18}%, transparent) 0%, transparent 65%)`,
      'linear-gradient(180deg, #2a313a 0%, #171b21 48%, #0b0d11 100%)',
    ].join(', '),
    boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 -1px 0 rgb(0 0 0 / 0.6)',
  } as CSSProperties;

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-app-icon={appId}
      className={cn(
        // The rim: a beveled steel edge (light top-left → dark bottom-right)
        // that heats to ember when active and to the app hue on hover.
        'relative inline-flex shrink-0 items-center justify-center',
        'transition-[filter] duration-180 ease-out-quint',
        active
          ? 'bg-[linear-gradient(135deg,#ffd2a8_0%,var(--color-ember-400,#ff8a3d)_35%,var(--color-ember-600,#d4520b)_100%)]'
          : cn(
              'bg-[linear-gradient(135deg,#9aa6b6_0%,#4b5563_40%,#1a1f26_100%)]',
              'group-hover:bg-[linear-gradient(135deg,#fff_0%,var(--app-hue)_40%,#1a1f26_100%)]',
              'group-focus-visible:bg-[linear-gradient(135deg,#fff_0%,var(--app-hue)_40%,#1a1f26_100%)]'
            ),
        className
      )}
      style={style}
    >
      <span aria-hidden className="absolute" style={face} />
      {size >= 40 && (
        <>
          {/* Rivets on the two small cuts */}
          <span aria-hidden className="absolute size-[3px] rounded-full bg-[#8d97a5] shadow-[0_1px_0_rgb(0_0_0/0.8)]" style={{ top: '11%', right: '11%' }} />
          <span aria-hidden className="absolute size-[3px] rounded-full bg-[#8d97a5] shadow-[0_1px_0_rgb(0_0_0/0.8)]" style={{ bottom: '11%', left: '11%' }} />
        </>
      )}
      <Glyph
        size={glyphSize(size)}
        strokeWidth={strokeFor(size)}
        aria-hidden
        className="relative"
        style={{
          color: hue,
          filter: active
            ? `drop-shadow(0 1px 0 rgb(0 0 0 / 0.8)) drop-shadow(0 0 6px color-mix(in srgb, ${hue} 60%, transparent))`
            : small
              ? undefined
              : `drop-shadow(0 1px 0 rgb(0 0 0 / 0.85)) drop-shadow(0 0 3px color-mix(in srgb, ${hue} 30%, transparent))`,
        }}
      />
    </span>
  );
}

/** Designed app tile for an app id (fallback glyph for unknown ids). */
export const AppIcon = memo(AppIconInner);
