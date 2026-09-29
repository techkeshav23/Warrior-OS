// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Badge
// Forged octagonal badge for one achievement, the same object the unlock
// cinematic presents: rarity-alloy cut rim, ink face with an engraved
// octagon and the category's lucide glyph lit in the rarity colour.
// Locked = cold ink rim, dim glyph and a padlock chip; hidden and
// locked = a shield-question glyph.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import { Lock, ShieldQuestion, Trophy } from 'lucide-react';
import type { Achievement } from '@/types/achievement';
import { CATEGORY_ICON, RARITY_STYLE } from '@/components/effects/effects-utils';
import { cn } from '@/lib/utils';
import { tint } from './achievement-data';

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: number;
  className?: string;
}

const FACE = 'radial-gradient(circle at 50% 30%, var(--color-ink-600) 0%, var(--color-ink-800) 58%, var(--color-ink-900) 100%)';
/** Corner cut of a regular octagon, as a share of its width. */
const OCT = 1 / (2 + Math.SQRT2);
const HIGHLIGHT = 'color-mix(in oklab, var(--color-fg) 10%, transparent)';

/** Regular octagon (cut corners) as an SVG path, inset by `i`. */
function octagon(size: number, i: number): string {
  const s = size - i * 2;
  const c = s * OCT;
  return `M${i + c} ${i}H${i + s - c}L${i + s} ${i + c}V${i + s - c}L${i + s - c} ${i + s}H${i + c}L${i} ${i + s - c}V${i + c}Z`;
}

function AchievementBadgeInner({ achievement, size = 48, className }: AchievementBadgeProps) {
  const unlocked = !!achievement.unlockedAt;
  const secret = !unlocked && !!achievement.hidden;
  const rarity = RARITY_STYLE[achievement.rarity] ?? RARITY_STYLE.common;
  const Glyph = CATEGORY_ICON[achievement.category] ?? Trophy;
  const rim = Math.max(2, Math.round(size / 24));
  const glyph = Math.round(size * 0.44);
  const cut = (n: number) => ({ '--cut': `${Math.round(n * OCT)}px` }) as CSSProperties;

  return (
    // Unclipped wrapper: carries the rarity glow (a clipped plate eats its own shadow) and the lock tag.
    <div
      className={cn('relative shrink-0', className)}
      style={{
        width: size,
        height: size,
        filter:
          unlocked && achievement.rarity !== 'common'
            ? `drop-shadow(0 0 ${Math.max(2, Math.round(size / 8))}px ${rarity.glow})`
            : undefined,
      }}
    >
      {/* Cut rim: rarity alloy when earned, cold steel when locked */}
      <div
        className="chamfer absolute inset-0"
        style={{
          ...cut(size),
          padding: rim,
          background: unlocked
            ? rarity.gradient
            : 'linear-gradient(135deg, var(--color-steel-400), var(--color-steel-700) 55%, var(--color-steel-500))',
        }}
      >
        <div
          className="chamfer relative flex size-full items-center justify-center overflow-hidden"
          style={{
            ...cut(size - rim * 2),
            background: FACE,
            boxShadow: unlocked
              ? `inset 0 1px 0 ${HIGHLIGHT}, inset 0 -1px 0 rgb(0 0 0 / 0.6), inset 0 0 ${Math.round(size / 4)}px ${rarity.glow}`
              : `inset 0 1px 0 ${HIGHLIGHT}, inset 0 -1px 0 rgb(0 0 0 / 0.6)`,
          }}
        >
          {size >= 40 && (
            <svg aria-hidden width={size - rim * 2} height={size - rim * 2} className="absolute inset-0">
              <path
                d={octagon(size - rim * 2, Math.round(size * 0.09))}
                fill="none"
                strokeWidth={1}
                stroke={unlocked ? tint(rarity.color, 32) : 'var(--color-line-strong)'}
              />
            </svg>
          )}
          {secret ? (
            <ShieldQuestion aria-hidden size={glyph} strokeWidth={1.5} className="relative text-fg-faint" />
          ) : (
            <Glyph
              aria-hidden
              size={glyph}
              strokeWidth={1.5}
              className={cn('relative', !unlocked && 'text-fg-faint')}
              style={
                unlocked
                  ? { color: rarity.color, filter: `drop-shadow(0 0 ${Math.max(2, Math.round(size / 12))}px ${rarity.glow})` }
                  : undefined
              }
            />
          )}
        </div>
      </div>
      {!unlocked && !secret && size >= 28 && (
        <span
          aria-hidden
          className="chamfer-xs absolute -bottom-0.5 -right-0.5 flex items-center justify-center bg-linear-to-b from-steel-600 to-steel-800 text-fg-muted shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-1px_0_rgb(0_0_0/0.6)]"
          style={{ width: Math.round(size * 0.38), height: Math.round(size * 0.38) }}
        >
          <Lock size={Math.max(8, Math.round(size * 0.19))} strokeWidth={2} />
        </span>
      )}
    </div>
  );
}

export const AchievementBadge = memo(AchievementBadgeInner);
