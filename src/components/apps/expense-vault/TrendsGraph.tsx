// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Trends Graph
// Recharts area of daily spending over the past 30 days (viz-1),
// with the daily budget (month budget ÷ days in that month) as a
// dashed neutral step line. Days above the line get a danger dot.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useMemo, type ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from 'recharts';
import { addDays, format, getDaysInMonth, parseISO, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { CHART, FG, INK, LINE, STATUS, VIZ } from '@/styles/tokens';
import { resolveMonthBudget, toPaise } from '@/stores/useExpenseStore';
import type { Expense } from '@/types/expense';
import { formatINR, formatINRCompact, toDateKey } from './expense-utils';

const WINDOW_DAYS = 30;
const SPENT_COLOR = VIZ[0];
/** Reference line: neutral, so it never competes with the data. */
const LIMIT_COLOR = FG.subtle;
const OVER_COLOR = STATUS.danger;

interface TrendsGraphProps {
  className?: string;
  /** The whole ledger; the graph picks the last 30 days itself. */
  expenses: readonly Expense[];
  budgets: Readonly<Record<string, number>>;
  todayKey: string;
}

interface TrendRow {
  key: string;
  label: string;
  spent: number;
  limit: number;
  over: boolean;
}

/** Shape of what Recharts hands a custom tooltip (only the fields read here). */
interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

function renderTrendTooltip({ active, payload }: ChartTooltipProps): ReactNode {
  const row = payload?.[0]?.payload as TrendRow | undefined;
  if (!active || !row) return null;
  const diff = row.limit - row.spent;
  return (
    <div className="armor-popover min-w-44 px-3 py-2 text-xs">
      <p className="hud-label mb-1.5">{format(parseISO(row.key), 'EEE, d MMM')}</p>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: SPENT_COLOR }} />
        <span className="text-fg-muted">Spent</span>
        <span className="tabular ml-auto pl-3 font-mono text-fg">{formatINR(row.spent)}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="w-2 border-t-2 border-dashed border-fg-subtle" />
        <span className="text-fg-muted">Daily budget</span>
        <span className="tabular ml-auto pl-3 font-mono text-fg">{formatINR(row.limit, 'never')}</span>
      </div>
      <p className={cn('mt-1.5 border-t border-line pt-1.5', row.over ? 'text-danger' : 'text-fg-subtle')}>
        {row.spent === 0
          ? 'No spending'
          : row.over
            ? `${formatINR(-diff, 'never')} over the daily budget`
            : `${formatINR(diff, 'never')} under the daily budget`}
      </p>
    </div>
  );
}

function renderSpendDot(props: DotItemDotProps): ReactNode {
  const { cx, cy, index } = props;
  const row = props.payload as TrendRow | undefined;
  if (cx == null || cy == null || !row || !row.over) return <g key={`spend-dot-${index}`} />;
  return (
    <circle
      key={`spend-dot-${index}`}
      cx={cx}
      cy={cy}
      r={3.5}
      fill={OVER_COLOR}
      stroke={INK[900]}
      strokeWidth={2}
    />
  );
}

function TrendsGraphInner({ className, expenses, budgets, todayKey }: TrendsGraphProps) {
  const fillId = `trend-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const rows = useMemo<TrendRow[]>(() => {
    const today = parseISO(todayKey);
    const start = subDays(today, WINDOW_DAYS - 1);
    const startKey = toDateKey(start);

    const paiseByDay = new Map<string, number>();
    for (const e of expenses) {
      if (e.date < startKey || e.date > todayKey) continue;
      paiseByDay.set(e.date, (paiseByDay.get(e.date) ?? 0) + toPaise(e.amount));
    }

    const budgetByMonth = new Map<string, number>();
    const out: TrendRow[] = [];
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const day = addDays(start, i);
      const key = toDateKey(day);
      const monthKey = key.slice(0, 7);
      let monthBudget = budgetByMonth.get(monthKey);
      if (monthBudget === undefined) {
        monthBudget = resolveMonthBudget(budgets, monthKey).amount;
        budgetByMonth.set(monthKey, monthBudget);
      }
      const limit = Math.round((monthBudget / getDaysInMonth(day)) * 100) / 100;
      const spent = (paiseByDay.get(key) ?? 0) / 100;
      out.push({ key, label: format(day, 'd MMM'), spent, limit, over: spent > limit });
    }
    return out;
  }, [expenses, budgets, todayKey]);

  const summary = useMemo(() => {
    let totalPaise = 0;
    let daysOver = 0;
    let peak: TrendRow | null = null;
    for (const r of rows) {
      totalPaise += toPaise(r.spent);
      if (r.over) daysOver += 1;
      if (r.spent > 0 && (peak === null || r.spent > peak.spent)) peak = r;
    }
    const total = totalPaise / 100;
    return { total, average: total / WINDOW_DAYS, daysOver, peak };
  }, [rows]);

  return (
    <Card
      role="region"
      aria-label="Daily spending over the past 30 days"
      title="Last 30 days"
      description={
        <>
          <span className="tabular font-mono">{formatINR(summary.total)}</span> spent · avg{' '}
          <span className="tabular font-mono">{formatINR(summary.average, 'never')}</span>/day ·{' '}
          <span className={summary.daysOver > 0 ? 'text-danger' : 'text-success'}>
            {summary.daysOver} {summary.daysOver === 1 ? 'day' : 'days'} over the daily budget
          </span>
        </>
      }
      actions={
        <div className="flex items-center gap-3 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3.5" style={{ background: SPENT_COLOR }} />
            Spent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-fg-subtle" />
            Daily budget
          </span>
        </div>
      }
      className={cn('@container', className)}
    >
      <div className="h-48 w-full font-mono">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SPENT_COLOR} stopOpacity={CHART.areaOpacity} />
                <stop offset="100%" stopColor={SPENT_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="label"
              tick={CHART.tick}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
              tickMargin={8}
            />
            <YAxis
              width={52}
              tick={CHART.tick}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatINRCompact}
              allowDecimals={false}
            />
            <Tooltip content={renderTrendTooltip} cursor={{ stroke: LINE.strong, strokeWidth: 1 }} />
            <Line
              type="stepAfter"
              dataKey="limit"
              name="Daily budget"
              stroke={LIMIT_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="spent"
              name="Spent"
              stroke={SPENT_COLOR}
              strokeWidth={CHART.strokeWidth}
              strokeLinejoin="round"
              fill={`url(#${fillId})`}
              dot={renderSpendDot}
              activeDot={{ r: 4, stroke: INK[950], strokeWidth: 2, fill: SPENT_COLOR }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {summary.peak && (
        <p className="mt-3 text-xs text-fg-subtle">
          Biggest day: {format(parseISO(summary.peak.key), 'EEE, d MMM')} at{' '}
          <span className="tabular font-mono text-fg-muted">{formatINR(summary.peak.spent)}</span>
        </p>
      )}
    </Card>
  );
}

export const TrendsGraph = memo(TrendsGraphInner);
