// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Trends Graph
// Recharts line of daily spending over the past 30 days, with the
// daily budget (month budget ÷ days in that month) overlaid as a
// dashed step line. Days above the line get a red dot.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, type ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from 'recharts';
import { addDays, format, getDaysInMonth, parseISO, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { resolveMonthBudget, toPaise } from '@/stores/useExpenseStore';
import type { Expense } from '@/types/expense';
import { formatINR, formatINRCompact, toDateKey } from './expense-utils';

const WINDOW_DAYS = 30;
const SPENT_COLOR = '#00f0ff';
const LIMIT_COLOR = '#ffab00';
const OVER_COLOR = '#ff1744';

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
    <div className="rounded-lg border border-white/10 bg-[rgba(10,10,16,0.94)] px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-semibold text-white">{format(parseISO(row.key), 'EEE, d MMM')}</p>
      <p className="mt-0.5 font-mono" style={{ color: SPENT_COLOR }}>
        Spent {formatINR(row.spent)}
      </p>
      <p className="font-mono" style={{ color: LIMIT_COLOR }}>
        Daily budget {formatINR(row.limit, 'never')}
      </p>
      <p className={cn('mt-0.5 text-[11px]', row.over ? 'text-red-300' : 'text-white/50')}>
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
  if (cx == null || cy == null || !row || row.spent <= 0) return <g key={`spend-dot-${index}`} />;
  return (
    <circle
      key={`spend-dot-${index}`}
      cx={cx}
      cy={cy}
      r={row.over ? 3.5 : 2.5}
      fill={row.over ? OVER_COLOR : SPENT_COLOR}
      stroke="rgba(10,10,16,0.9)"
      strokeWidth={1}
    />
  );
}

function TrendsGraphInner({ className, expenses, budgets, todayKey }: TrendsGraphProps) {
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
    <section
      aria-label="Daily spending over the past 30 days"
      className={cn('rounded-xl border border-white/10 bg-white/[0.03] p-4', className)}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Last 30 days</h3>
          <p className="text-[11px] text-white/50">
            {formatINR(summary.total)} spent · avg {formatINR(summary.average, 'never')}/day ·{' '}
            <span className={summary.daysOver > 0 ? 'text-red-300' : 'text-emerald-300'}>
              {summary.daysOver} {summary.daysOver === 1 ? 'day' : 'days'} over the daily budget
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-white/55">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: SPENT_COLOR }} />
            Spent per day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: LIMIT_COLOR }} />
            Daily budget
          </span>
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#8888a0', fontSize: 10 }}
              stroke="rgba(255,255,255,0.1)"
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              width={52}
              tick={{ fill: '#8888a0', fontSize: 10 }}
              stroke="rgba(255,255,255,0.1)"
              tickLine={false}
              tickFormatter={formatINRCompact}
              allowDecimals={false}
            />
            <Tooltip content={renderTrendTooltip} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
            <Line
              type="stepAfter"
              dataKey="limit"
              name="Daily budget"
              stroke={LIMIT_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="spent"
              name="Spent"
              stroke={SPENT_COLOR}
              strokeWidth={2}
              dot={renderSpendDot}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {summary.peak && (
        <p className="mt-2 text-[11px] text-white/45">
          Biggest day: {format(parseISO(summary.peak.key), 'EEE, d MMM')} at {formatINR(summary.peak.spent)}
        </p>
      )}
    </section>
  );
}

export const TrendsGraph = memo(TrendsGraphInner);
