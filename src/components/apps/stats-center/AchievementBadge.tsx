// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Badge
// Round medallion for one achievement: rarity-coloured ring when
// unlocked, grey + padlock when locked, "?" when hidden and locked
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { Lock } from 'lucide-react';
import type { Achievement } from '@/types/achievement';
import { RARITY_STYLE } from '@/components/effects/effects-utils';
import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: number;
  className?: string;
}

function AchievementBadgeInner({ achievement, size = 48, className }: AchievementBadgeProps) {
  const unlocked = !!achievement.unlockedAt;
  const secret = !unlocked && !!achievement.hidden;
  const rarity = RARITY_STYLE[achievement.rarity];
  const ring = Math.max(2, Math.round(size / 18));

  return (
    <div
      className={cn('relative shrink-0 rounded-full', className)}
      style={{
        width: size,
        height: size,
        padding: ring,
        background: unlocked
          ? rarity.gradient
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04))',
        boxShadow: unlocked ? `0 0 ${Math.round(size / 3)}px ${rarity.glow}` : undefined,
      }}
    >
      <div
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{ background: 'radial-gradient(circle at 35% 28%, #2c2c3e 0%, #121219 60%, #07070c 100%)' }}
      >
        {secret ? (
          <span className="font-black leading-none text-white/40" style={{ fontSize: size * 0.42 }}>
            ?
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={cn('select-none leading-none', !unlocked && 'opacity-40 grayscale')}
            style={{ fontSize: size * 0.46 }}
          >
            {achievement.icon}
          </span>
        )}
      </div>
      {!unlocked && !secret && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border border-white/15 bg-black/85"
          style={{ width: size * 0.36, height: size * 0.36 }}
        >
          <Lock className="text-white/55" style={{ width: size * 0.18, height: size * 0.18 }} />
        </span>
      )}
    </div>
  );
}

export const AchievementBadge = memo(AchievementBadgeInner);
