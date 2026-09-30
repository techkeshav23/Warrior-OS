// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Stats Center: warrior avatar plate
// A compact card-variant 3D warrior beside the level / XP plate. It
// stops rendering while scrolled out of view, in a hidden tab or a
// minimised window (WarriorStage), and opens Warrior Hall on click.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { openOrFocusApp } from '@/lib/nexus/windows';
import { WarriorStage } from '@/components/warrior3d/WarriorStage';
import { tierInfo, useWarriorProgress } from '@/components/warrior3d/progress';

function WarriorAvatarCardInner({ className }: { className?: string }) {
  const progress = useWarriorProgress();
  const tier = tierInfo(progress.tier);
  return (
    <button
      type="button"
      onClick={() => openOrFocusApp('warrior-hall')}
      aria-label={`Open Warrior Hall: ${tier.name} tier armor`}
      title="Open Warrior Hall"
      data-warrior-avatar-card=""
      className={cn(
        'armor-panel chamfer-md group relative isolate block min-h-[148px] w-full overflow-hidden text-left',
        'transition-[filter] duration-120 ease-out-quint hover:brightness-115 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className
      )}
      style={{ borderColor: `color-mix(in oklab, ${tier.trim} 30%, transparent)` }}
    >
      <WarriorStage variant="card" stageId="stats-avatar" className="pointer-events-none absolute inset-0" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-[#031318] via-[#031318]/80 to-transparent px-2.5 pb-2 pt-6"
      >
        <span className="truncate font-display text-2xs font-semibold uppercase tracking-[0.14em]" style={{ color: tier.trim }}>
          {tier.name}
        </span>
        <ArrowUpRight className="size-3.5 shrink-0 text-fg-subtle transition-colors duration-120 group-hover:text-fg" strokeWidth={2} />
      </span>
    </button>
  );
}

export const WarriorAvatarCard = memo(WarriorAvatarCardInner);
