// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quiz Controls
// Small building blocks shared by the Quiz Engine, Mock Test and
// Question Bank: option chips, labelled setting rows, stat tiles
// and accuracy bars
// ═══════════════════════════════════════════════════════════

'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChipProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}

/** A toggle chip for one choice in a setting row. */
export function Chip({ active, onClick, disabled = false, title, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'px-3 py-1 rounded text-xs border transition-all disabled:opacity-30 disabled:cursor-not-allowed',
        active
          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
          : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
      )}
    >
      {children}
    </button>
  );
}

/** A labelled row of chips (or any controls). */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-white/70">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {hint && <p className="text-[11px] text-white/40">{hint}</p>}
    </div>
  );
}

const TILE_TONES = {
  green: 'bg-green-500/10 border-green-500/20 text-green-300',
  red: 'bg-red-500/10 border-red-500/20 text-red-300',
  cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
  neutral: 'bg-white/5 border-white/10 text-white/70',
} as const;

export function StatTile({
  value,
  label,
  tone = 'neutral',
}: {
  value: ReactNode;
  label: string;
  tone?: keyof typeof TILE_TONES;
}) {
  return (
    <div className={cn('p-3 rounded-lg border text-center', TILE_TONES[tone])}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] opacity-60">{label}</p>
    </div>
  );
}

/** 0..100 bar: green from 75%, yellow from 50%, red below. */
export function AccuracyBar({ pct, className }: { pct: number; className?: string }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className={cn('h-1.5 bg-white/10 rounded overflow-hidden', className)}>
      <div
        className={cn('h-full rounded', pct >= 75 ? 'bg-green-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400')}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
