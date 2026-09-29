// ═══════════════════════════════════════════════════════════
// WARRIOR OS — XP System
// The profile's hero: level ring, total XP, and a segmented gold →
// ember bar for the XP still needed for the next level
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card } from '@/components/ui';
import { ENGRAVED_LABEL } from '@/components/ui/armor';
import { cn } from '@/lib/utils';
import { useXPStore } from '@/stores/useXPStore';
import { MAX_LEVEL, levelInfo, levelProgress, levelTitle, xpToNextLevel } from '@/components/effects/effects-utils';
import { LevelProgress } from './LevelProgress';

const SEGMENTS = 24;

const GOLD_FRAME = {
  borderColor: 'color-mix(in oklab, var(--color-gold) 24%, transparent)',
} as CSSProperties;

/** Cell colour along the bar: gold at the start, ember at the end. */
function segmentColor(i: number): string {
  const t = Math.round((i / (SEGMENTS - 1)) * 100);
  return `color-mix(in oklab, var(--color-ember-400) ${t}%, var(--color-gold))`;
}

function XpSegments({ progress, label }: { progress: number; label: string }) {
  const filled = (progress / 100) * SEGMENTS;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="flex h-3 gap-[2px]"
    >
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const cell = Math.min(Math.max(filled - i, 0), 1);
        return (
          <span key={i} className="relative h-full flex-1 overflow-hidden bg-steel-900 shadow-[inset_0_1px_0_rgb(0_0_0/0.7)] [clip-path:polygon(3px_0,100%_0,calc(100%-3px)_100%,0_100%)]">
            {cell > 0 && (
              <span
                className="absolute inset-y-0 left-0 transition-[width] duration-260 ease-out-quint"
                style={{
                  width: `${cell * 100}%`,
                  background: segmentColor(i),
                  boxShadow: `0 0 8px color-mix(in oklab, ${segmentColor(i)} 45%, transparent)`,
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

function XPSystemInner() {
  // Derive from primitives: store getter calls during render can be
  // memoised into stale values by the React Compiler.
  const xp = useXPStore((s) => s.xp);
  const level = useXPStore((s) => s.level);
  const reduceMotion = useReducedMotion();
  const toNext = xpToNextLevel(xp, level);
  const progress = levelProgress(xp, level);
  const info = levelInfo(level);
  const maxed = level >= MAX_LEVEL;
  const nextTitle = maxed ? null : levelTitle(level + 1);

  return (
    <Card rivets padding="lg" style={GOLD_FRAME} role="region" aria-label="Level and XP">
      <div className="flex items-center gap-5">
        <LevelProgress />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className={cn(ENGRAVED_LABEL, 'text-gold')}>Total XP</p>
              <p className="mt-1.5 flex items-baseline gap-1.5 leading-none">
                <motion.span
                  key={xp}
                  className="tabular font-display text-3xl font-semibold text-fg"
                  initial={reduceMotion ? false : { opacity: 0.5, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                >
                  {xp.toLocaleString()}
                </motion.span>
                <span className="font-mono text-xs text-fg-subtle">XP</span>
              </p>
            </div>
            <div className="text-right">
              <p className="hud-label">{maxed ? 'Max level' : `Next · ${nextTitle}`}</p>
              <p className="mt-1 text-ui text-fg-muted">
                {maxed ? (
                  'Every rank earned'
                ) : (
                  <>
                    <span className="tabular font-mono font-medium text-fg">{toNext.toLocaleString()}</span> XP to go
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="mt-3.5">
            <XpSegments progress={progress} label={`Progress to level ${maxed ? level : level + 1}`} />
            <div className="tabular mt-1.5 flex justify-between font-mono text-2xs text-fg-subtle">
              <span>
                LV {level} · {info.minXP.toLocaleString()}
              </span>
              {!maxed && (
                <span>
                  {info.maxXP.toLocaleString()} · LV {level + 1}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export const XPSystem = memo(XPSystemInner);
