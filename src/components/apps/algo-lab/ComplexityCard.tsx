// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Complexity Card (FORGE HUD)
// Best / average / worst time and space as HUD stat cells (tone by
// growth rate) plus stability / in-place badges.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { Check, Gauge, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ENGRAVED_LABEL } from '@/components/ui/armor';
import { Badge } from '@/components/ui';
import type { AlgorithmMeta } from '@/types/algo';

type Growth = 'fast' | 'good' | 'slow';

/** Colour a Big-O expression by growth: sub-linear, up to n log n, or polynomial. */
function growthOf(expression: string): Growth {
  const e = expression.replace(/\s+/g, '');
  if (e.includes('²') || e.includes('^2') || e.includes('³')) return 'slow';
  if (e === 'O(1)' || e === 'O(logn)' || e === 'O(h)') return 'fast';
  return 'good';
}

const GROWTH: Record<Growth, { text: string; dot: string; label: string }> = {
  fast: { text: 'text-success', dot: 'bg-success', label: 'fast' },
  good: { text: 'text-fg', dot: 'bg-info', label: 'efficient' },
  slow: { text: 'text-warning', dot: 'bg-warning', label: 'grows quickly' },
};

function Flag({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return null;
  return (
    <Badge tone={value ? 'success' : 'neutral'} icon={value ? Check : X} size="sm">
      {value ? label : `Not ${label.toLowerCase()}`}
    </Badge>
  );
}

interface ComplexityCardProps {
  meta: AlgorithmMeta;
  /** Show the algorithm name in the header (Compare Mode shows two cards). */
  compact?: boolean;
}

function ComplexityCardInner({ meta, compact = false }: ComplexityCardProps) {
  const rows: { label: string; value: string }[] = [
    { label: 'Best', value: meta.complexity.best },
    { label: 'Average', value: meta.complexity.average },
    { label: 'Worst', value: meta.complexity.worst },
    { label: 'Space', value: meta.complexity.space },
  ];

  return (
    <section className="armor-panel shrink-0 p-3 [--cut:10px]" aria-label={`${meta.name} complexity`}>
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <span className={cn(ENGRAVED_LABEL, 'flex items-center gap-1.5')}>
          <Gauge size={14} strokeWidth={1.75} aria-hidden />
          Complexity
        </span>
        {compact && (
          <span className="truncate text-xs font-medium text-fg" title={meta.name}>
            {meta.name}
          </span>
        )}
      </div>

      <dl className="chamfer-sm grid grid-cols-2 gap-px overflow-hidden bg-black/60">
        {rows.map((row) => {
          const growth = GROWTH[growthOf(row.value)];
          return (
            <div key={row.label} className="bg-steel-900 px-2.5 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]" title={`${row.label}: ${row.value} (${growth.label})`}>
              <dt className="hud-label flex items-center gap-1.5">
                <span aria-hidden className={cn('size-1.5 rotate-45', growth.dot)} />
                {row.label}
              </dt>
              <dd
                className={cn(
                  'mt-1 break-words font-mono font-medium',
                  row.value.length > 9 ? 'text-xs leading-4' : 'text-ui',
                  growth.text
                )}
              >
                {row.value}
              </dd>
            </div>
          );
        })}
      </dl>

      {(meta.stable !== null || meta.inPlace !== null) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 px-1">
          <Flag label="Stable" value={meta.stable} />
          <Flag label="In place" value={meta.inPlace} />
        </div>
      )}
    </section>
  );
}

export const ComplexityCard = memo(ComplexityCardInner);
