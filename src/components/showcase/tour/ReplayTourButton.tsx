// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Replay Tour button (drop into Settings)
// Starts the NEXUS guided tour again from the first stop. While the
// tour runs its click shield covers this button, and focus comes back
// here when the tour ends.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { Compass } from 'lucide-react';
import { useTourStore } from '@/stores/useTourStore';
import { cn } from '@/lib/utils';

interface ReplayTourButtonProps {
  className?: string;
}

function replayTour(): void {
  useTourStore.getState().startTour();
}

function ReplayTourButtonInner({ className }: ReplayTourButtonProps) {
  return (
    <button
      type="button"
      onClick={replayTour}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2',
        'text-sm text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-400/20 focus-ring',
        className
      )}
    >
      <Compass className="h-4 w-4" aria-hidden="true" />
      Replay tour
    </button>
  );
}

export const ReplayTourButton = memo(ReplayTourButtonInner);
