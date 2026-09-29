// ═══════════════════════════════════════════════════════════
// WARRIOR OS — StatTile + Sparkline (FORGED ARMOR kit)
// Armor stat plate: engraved label, forged display-face number, delta
// chip, optional sparkline slot and an optional forge-heat meter.
//   <StatTile label="Focus today" value="3h 20m" delta={12} deltaLabel="vs last week"
//             icon={Timer} sparkline={<Sparkline data={series} />} />
//   <StatTile label="Due now" value={due} icon={TriangleAlert} tone={due > 0 ? 'danger' : 'success'} />
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';
import { PROGRESS_COLOR, type ProgressTone } from './ProgressBar';
import { ENGRAVED_LABEL } from './armor';

export type StatTileTone = 'default' | 'accent' | 'ember' | 'gold' | 'success' | 'warning' | 'danger';

export interface StatTileProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  label: ReactNode;
  value: ReactNode;
  /** Small unit after the value ("XP", "days", "%"). */
  unit?: ReactNode;
  /** Number → signed % chip (green up / red down); string → shown as-is. */
  delta?: number | string;
  /** Force the delta color. `inverse` = down is good (e.g. spending). */
  deltaTone?: 'auto' | 'inverse' | 'positive' | 'negative' | 'neutral';
  deltaLabel?: ReactNode;
  icon?: IconLike;
  /**
   * Value color. accent / ember / gold for hero tiles; success / warning /
   * danger when the number itself is a status ("Due now: 12" in danger,
   * "0" in success). Pair a status tone with a label or icon, never color alone.
   */
  tone?: StatTileTone;
  /** Sparkline, ProgressBar or any mini chart. */
  sparkline?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Use the sans font for the value instead of font-display. */
  plainValue?: boolean;
  /** Render without the card surface (inside another card). */
  bare?: boolean;
  /** 0–100: a forge-heat meter along the bottom of the plate. */
  meter?: number;
}

const VALUE_SIZE = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' } as const;
const VALUE_TONE: Record<StatTileTone, string> = {
  default: 'text-fg',
  accent: 'text-accent',
  ember: 'text-ember-400',
  gold: 'text-gold',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function deltaColor(delta: number | string, tone: StatTileProps['deltaTone']): string {
  if (tone === 'positive') return 'text-success bg-success/10';
  if (tone === 'negative') return 'text-danger bg-danger/10';
  if (tone === 'neutral' || typeof delta === 'string' || delta === 0) return 'text-fg-muted bg-surface-active';
  const good = tone === 'inverse' ? delta < 0 : delta > 0;
  return good ? 'text-success bg-success/10' : 'text-danger bg-danger/10';
}

/** KPI tile. */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaTone = 'auto',
  deltaLabel,
  icon,
  tone = 'default',
  sparkline,
  size = 'md',
  plainValue = false,
  bare = false,
  meter,
  className,
  ...props
}: StatTileProps) {
  const heat = meter == null ? null : Math.min(100, Math.max(0, meter));
  const DeltaIcon = typeof delta === 'number' ? (delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus) : null;
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col gap-3',
        !bare && 'armor-panel chamfer-md p-4 pl-5',
        className
      )}
      {...props}
    >
      {/* Ember notch on the plate's left edge */}
      {!bare && <span aria-hidden className="absolute left-0 top-4 h-4 w-1 bg-ember-500 shadow-[0_0_8px_var(--color-ember-500,#f76b15)]" />}
      <div className="flex items-center justify-between gap-2">
        <span className={cn(ENGRAVED_LABEL, 'truncate')}>{label}</span>
        {icon != null && <span className="shrink-0 text-fg-subtle">{renderIcon(icon, 16)}</span>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={cn('flex items-baseline gap-1.5 leading-none', VALUE_TONE[tone])}>
            <span
              className={cn(
                'tabular truncate',
                plainValue ? 'font-sans font-semibold tracking-tight' : 'font-display font-bold tracking-[0.02em] [text-shadow:0_1px_0_rgb(0_0_0/0.8),0_-1px_0_rgb(255_255_255/0.06)]',
                VALUE_SIZE[size]
              )}
            >
              {value}
            </span>
            {unit != null && <span className="text-xs font-medium text-fg-subtle">{unit}</span>}
          </div>
          {(delta != null || deltaLabel != null) && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              {delta != null && (
                <span className={cn('tabular inline-flex items-center gap-1 chamfer [--cut:3px] px-1.5 py-px font-mono text-2xs font-medium', deltaColor(delta, deltaTone))}>
                  {DeltaIcon && <DeltaIcon size={12} strokeWidth={2} aria-hidden />}
                  {typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta}%` : delta}
                </span>
              )}
              {deltaLabel != null && <span className="truncate text-fg-subtle">{deltaLabel}</span>}
            </div>
          )}
        </div>
        {sparkline != null && <div className="w-24 shrink-0">{sparkline}</div>}
      </div>
      {heat != null && (
        <div aria-hidden className="flex h-1.5 gap-0.5">
          {Array.from({ length: 12 }, (_, i) => {
            const lit = (i + 1) / 12 <= heat / 100 + 0.001;
            return (
              <span
                key={i}
                className={cn('flex-1 skew-x-[-20deg]', lit ? '' : 'bg-white/[0.07]')}
                style={lit ? { background: `color-mix(in srgb, #ffe2c4 ${Math.round((i / 11) * 60)}%, var(--color-ember-${i < 4 ? 600 : 400}, #ff8a3d))` } : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────

export interface SparklineProps {
  data: number[];
  tone?: ProgressTone;
  /** Any CSS color; overrides tone. */
  color?: string;
  height?: number;
  /** Soft area fill under the line. */
  fill?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Tiny trend line (no axes). Width follows its container. */
export function Sparkline({ data, tone = 'accent', color, height = 32, fill = true, className, ...aria }: SparklineProps) {
  const gradientId = useId();
  const stroke = color ?? PROGRESS_COLOR[tone];
  if (data.length < 2) return <div className={className} style={{ height }} />;
  const w = 100;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, height - 2 - ((d - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={cn('block w-full overflow-visible', className)}
      style={{ height }}
      role={aria['aria-label'] ? 'img' : undefined}
      aria-label={aria['aria-label']}
      aria-hidden={aria['aria-label'] ? undefined : true}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${line} L${w},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2} fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
