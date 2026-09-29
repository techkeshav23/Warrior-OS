// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Running Clock
// HH:MM:SS elapsed since a timer started, ticking every second.
// Tabular figures so the digits never jitter.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatClock } from './forge-utils';
import { useNow } from './useNow';

interface RunningClockProps {
  startedAt: number;
  /** mono = inline readouts (cards, pills) · display = the big hero clock (Orbitron). */
  face?: 'mono' | 'display';
  className?: string;
}

function RunningClockInner({ startedAt, face = 'mono', className }: RunningClockProps) {
  const now = useNow(1000);
  return (
    <span className={cn('tabular', face === 'display' ? 'font-display font-semibold' : 'font-mono', className)}>
      {formatClock(now - startedAt)}
    </span>
  );
}

export const RunningClock = memo(RunningClockInner);
