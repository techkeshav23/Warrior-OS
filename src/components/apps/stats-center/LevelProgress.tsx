// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Level Progress Ring
// Gold ring around the level number: progress toward the next level
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { ProgressRing } from '@/components/ui';
import { useXPStore } from '@/stores/useXPStore';
import { levelProgress, levelTitle } from '@/components/effects/effects-utils';

interface LevelProgressProps {
  size?: number;
}

function LevelProgressInner({ size = 88 }: LevelProgressProps) {
  // Derive from primitives: store getter calls during render can be
  // memoised into stale values by the React Compiler.
  const xp = useXPStore((s) => s.xp);
  const level = useXPStore((s) => s.level);
  const progress = levelProgress(xp, level);

  return (
    <div title={`${levelTitle(level)} · ${Math.round(progress)}% of the way to the next level`}>
      <ProgressRing value={progress} size={size} strokeWidth={5} tone="gold" glow label={`Level ${level} progress`}>
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-subtle">Level</span>
        <span className="tabular mt-0.5 font-display text-2xl font-semibold leading-none text-fg">{level}</span>
      </ProgressRing>
    </div>
  );
}

export const LevelProgress = memo(LevelProgressInner);
