// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Badge
// Round medallion for one achievement, the same object the unlock
// cinematic presents: rarity-gradient rim, ink face with a hairline
// ring and the category's lucide glyph lit in the rarity colour.
// Locked = cold ink rim, dim glyph and a padlock chip; hidden and
// locked = a shield-question glyph.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
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
const HIGHLIGHT = 'color-mix(in oklab, var(--color-fg) 10%, transparent)';

function AchievementBadgeInner({ achievement, size = 48, className }: AchievementBadgeProps) {
  const unlocked = !!achievement.unlockedAt;
  const secret = !unlocked && !!achievement.hidden;
  const rarity = RARITY_STYLE[achievement.rarity] ?? RARITY_STYLE.common;
  const Glyph = CATEGORY_ICON[achievement.category] ?? Trophy;
  const rim = Math.max(2, Math.round(size / 28));
  const glyph = Math.round(size * 0.44);

  return (
    <div
      className={cn('relative shrink-0 rounded-full', className)}
      style={{
        width: size,
        height: size,
        padding: rim,
        background: unlocked ? rarity.gradient : 'linear-gradient(135deg, var(--color-ink-500), var(--color-ink-700))',
        boxShadow: unlocked && achievement.rarity !== 'common' ? `0 0 ${Math.round(size / 4)}px ${rarity.glow}` : undefined,
      }}
    >
      <div
        className="relative flex size-full items-center justify-center overflow-hidden rounded-full"
        style={{
          background: FACE,
          boxShadow: unlocked
            ? `inset 0 1px 0 ${HIGHLIGHT}, inset 0 0 ${Math.round(size / 4)}px ${rarity.glow}`
            : `inset 0 1px 0 ${HIGHLIGHT}`,
        }}
      >
        {size >= 40 && (
          <span
            aria-hidden
            className="absolute rounded-full"
            style={{
              inset: Math.round(size * 0.09),
              border: `1px solid ${unlocked ? tint(rarity.color, 32) : 'var(--color-line)'}`,
            }}
          />
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
      {!unlocked && !secret && size >= 28 && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-line-strong bg-ink-850 text-fg-muted"
          style={{ width: Math.round(size * 0.38), height: Math.round(size * 0.38) }}
        >
          <Lock size={Math.max(8, Math.round(size * 0.19))} strokeWidth={2} />
        </span>
      )}
    </div>
  );
}

export const AchievementBadge = memo(AchievementBadgeInner);
