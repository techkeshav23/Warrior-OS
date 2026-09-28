// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Complexity Card
// Best / average / worst time, space, stability and exam notes
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlgorithmMeta } from '@/types/algo';

type Tone = 'fast' | 'good' | 'slow';

/** Colour a Big-O expression by growth: sub-linear, up to n log n, or polynomial. */
function toneOf(expression: string): Tone {
  const e = expression.replace(/\s+/g, '');
  if (e.includes('²') || e.includes('^2') || e.includes('³')) return 'slow';
  if (e === 'O(1)' || e === 'O(logn)' || e === 'O(h)') return 'fast';
  return 'good';
}

const TONE_CLASS: Record<Tone, string> = {
  fast: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  good: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  slow: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
};

function Flag({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return null;
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10px] font-medium',
        value ? 'border-emerald-400/30 text-emerald-300' : 'border-white/15 text-white/55'
      )}
    >
      {value ? '✓' : '✗'} {label}
    </span>
  );
}

interface ComplexityCardProps {
  meta: AlgorithmMeta;
  /** Hide the description, steps and notes (used in Compare Mode). */
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
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/55">
          <Info className="h-3 w-3" aria-hidden />
          Complexity
        </span>
        {compact && <span className="truncate text-[11px] text-white/70">{meta.name}</span>}
      </div>

      <dl className="grid grid-cols-2 gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className={cn('rounded-md border px-2 py-1', TONE_CLASS[toneOf(row.value)])}>
            <dt className="text-[9px] uppercase tracking-wider opacity-75">{row.label}</dt>
            <dd className="font-mono text-[12px] leading-tight">{row.value}</dd>
          </div>
        ))}
      </dl>

      {(meta.stable !== null || meta.inPlace !== null) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Flag label="Stable" value={meta.stable} />
          <Flag label="In place" value={meta.inPlace} />
        </div>
      )}

      {!compact && (
        <>
          <p className="mt-3 text-[12px] leading-relaxed text-white/75">{meta.description}</p>

          <h4 className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-white/55">How it works</h4>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11.5px] leading-snug text-white/70 marker:text-white/40">
            {meta.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <h4 className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-white/55">Exam notes</h4>
          <ul className="mt-1 space-y-1 text-[11.5px] leading-snug text-white/70">
            {meta.facts.map((fact) => (
              <li key={fact} className="flex gap-1.5">
                <span className="text-cyan-400" aria-hidden>
                  ▸
                </span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export const ComplexityCard = memo(ComplexityCardInner);
