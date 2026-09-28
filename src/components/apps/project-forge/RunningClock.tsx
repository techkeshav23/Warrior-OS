// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Running Clock
// HH:MM:SS elapsed since a timer started, ticking every second
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatClock } from './forge-utils';
import { useNow } from './useNow';

interface RunningClockProps {
  startedAt: number;
  className?: string;
}

function RunningClockInner({ startedAt, className }: RunningClockProps) {
  const now = useNow(1000);
  return <span className={cn('font-mono tabular-nums', className)}>{formatClock(now - startedAt)}</span>;
}

export const RunningClock = memo(RunningClockInner);
