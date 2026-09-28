// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Budget Chart
// Recharts donut of the month's spending by category, wrapped in a
// thin outer ring that tracks spending against the monthly budget.
// Clicking a slice or legend row filters the transaction list.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { toPaise } from '@/stores/useExpenseStore';
import type { Expense, ExpenseCategory } from '@/types/expense';
import { EXPENSE_CATEGORIES, formatINR, formatINRCompact } from './expense-utils';

interface BudgetChartProps {
  className?: string;
  /** Expenses of the month being viewed. */
  expenses: readonly Expense[];
  budget: number;
  monthName: string;
  selected: ExpenseCategory | null;
  onSelect: (category: ExpenseCategory | null) => void;
}

interface DonutDatum {
  id: string;
  /** Category behind a donut slice; null for the budget ring. */
  category: ExpenseCategory | null;
  label: string;
  value: number;
  fill: string;
  fillOpacity: number;
  /** Tooltip line under the label. */
  detail: string;
}

interface CategoryRow {
  id: ExpenseCategory;
  label: string;
  color: string;
  amount: number;
  count: number;
  percent: number;
}

/** Shape of what Recharts hands a custom tooltip (only the fields read here). */
interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

function renderDonutTooltip({ active, payload }: ChartTooltipProps): ReactNode {
  const datum = payload?.[0]?.payload as DonutDatum | undefined;
  if (!active || !datum) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[rgba(10,10,16,0.94)] px-2.5 py-1.5 text-xs shadow-lg">
      <p className="flex items-center gap-1.5 font-semibold text-white">
        <span className="h-2 w-2 rounded-full" style={{ background: datum.fill }} />
        {datum.label}
      </p>
      <p className="mt-0.5 font-mono text-white/70">{datum.detail}</p>
    </div>
  );
}

const RING_TRACK = 'rgba(255,255,255,0.08)';

function ringColor(pct: number): string {
  if (pct > 100) return '#ff1744';
  if (pct >= 80) return '#ffab00';
  return '#00e676';
}

function BudgetChartInner({ className, expenses, budget, monthName, selected, onSelect }: BudgetChartProps) {
  const { rows, totalPaise } = useMemo(() => {
    const paiseBy = new Map<ExpenseCategory, number>();
    const countBy = new Map<ExpenseCategory, number>();
    let total = 0;
    for (const e of expenses) {
      const p = toPaise(e.amount);
      total += p;
      paiseBy.set(e.category, (paiseBy.get(e.category) ?? 0) + p);
      countBy.set(e.category, (countBy.get(e.category) ?? 0) + 1);
    }
    const list: CategoryRow[] = [];
    for (const meta of EXPENSE_CATEGORIES) {
      const p = paiseBy.get(meta.id) ?? 0;
      if (p <= 0) continue;
      list.push({
        id: meta.id,
        label: meta.label,
        color: meta.color,
        amount: p / 100,
        count: countBy.get(meta.id) ?? 0,
        percent: total > 0 ? (p / total) * 100 : 0,
      });
    }
    list.sort((a, b) => b.amount - a.amount);
    return { rows: list, totalPaise: total };
  }, [expenses]);

  const spent = totalPaise / 100;
  const usedPct = budget > 0 ? (spent / budget) * 100 : 0;

  const categoryData = useMemo<DonutDatum[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        category: r.id,
        label: r.label,
        value: r.amount,
        fill: r.color,
        fillOpacity: selected === null || selected === r.id ? 1 : 0.25,
        detail: `${formatINR(r.amount)} · ${r.percent.toFixed(r.percent < 10 ? 1 : 0)}% · ${r.count} ${
          r.count === 1 ? 'entry' : 'entries'
        }`,
      })),
    [rows, selected]
  );

  const ringData = useMemo<DonutDatum[]>(() => {
    if (spent <= 0) {
      return [
        {
          id: 'left',
          category: null,
          label: 'Budget left',
          value: 1,
          fill: RING_TRACK,
          fillOpacity: 1,
          detail: `All ${formatINR(budget)} left`,
        },
      ];
    }
    if (spent >= budget) {
      return [
        {
          id: 'over',
          category: null,
          label: spent > budget ? 'Over budget' : 'Budget used up',
          value: 1,
          fill: ringColor(usedPct),
          fillOpacity: 1,
          detail:
            spent > budget
              ? `${formatINR(spent - budget)} over ${formatINR(budget)}`
              : `${formatINR(spent)} of ${formatINR(budget)}`,
        },
      ];
    }
    return [
      {
        id: 'spent',
        category: null,
        label: 'Spent',
        value: spent,
        fill: ringColor(usedPct),
        fillOpacity: 1,
        detail: `${formatINR(spent)} of ${formatINR(budget)} (${Math.round(usedPct)}%)`,
      },
      {
        id: 'left',
        category: null,
        label: 'Budget left',
        value: budget - spent,
        fill: RING_TRACK,
        fillOpacity: 1,
        detail: `${formatINR(budget - spent)} left`,
      },
    ];
  }, [spent, budget, usedPct]);

  const toggle = (id: ExpenseCategory) => onSelect(selected === id ? null : id);

  const top = rows[0];

  return (
    <section
      aria-label="Spending by category"
      className={cn('@container rounded-xl border border-white/10 bg-white/[0.03] p-4', className)}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Where it went</h3>
          <p className="truncate text-[11px] text-white/50">
            {top
              ? `${top.label} leads ${monthName} at ${Math.round(top.percent)}% of spending`
              : `No spending logged in ${monthName} yet`}
          </p>
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 @md:flex-row @md:items-center">
        {/* Donut (inner: categories, outer ring: share of the monthly budget used) */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="relative h-52 w-52 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={renderDonutTooltip} wrapperStyle={{ zIndex: 5 }} />
                <Pie
                  data={ringData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="86%"
                  outerRadius="94%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  isAnimationActive={false}
                />
                {categoryData.length > 0 && (
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="56%"
                    outerRadius="78%"
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={categoryData.length > 1 ? 2 : 0}
                    cornerRadius={3}
                    stroke="none"
                    animationDuration={500}
                    className="cursor-pointer outline-none"
                    onClick={(_data: unknown, index: number) => {
                      const hit = categoryData[index]?.category;
                      if (hit) toggle(hit);
                    }}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] uppercase tracking-wider text-white/45">Spent</span>
              <span className="font-mono text-base font-semibold text-white">
                {spent >= 1_000_000 ? formatINRCompact(spent) : formatINR(spent, 'never')}
              </span>
              <span className="text-[10px] text-white/45">of {formatINRCompact(budget)}</span>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-[10px] text-white/45">
            <span className="h-1.5 w-3 rounded-full" style={{ background: ringColor(usedPct) }} />
            Outer ring: {Math.round(usedPct)}% of the monthly budget
          </p>
        </div>

        {/* Legend / filter */}
        <ul className="w-full min-w-0 flex-1 space-y-1">
          {rows.length === 0 && (
            <li className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/45">
              Log an expense to see the category split.
            </li>
          )}
          {rows.map((r) => {
            const active = selected === r.id;
            const dimmed = selected !== null && !active;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-pressed={active}
                  className={cn(
                    'w-full rounded-lg px-2 py-1.5 text-left transition-colors',
                    active ? 'bg-white/10 ring-1 ring-white/15' : 'hover:bg-white/5',
                    dimmed && 'opacity-50'
                  )}
                >
                  <span className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className="min-w-0 flex-1 truncate text-white/85">{r.label}</span>
                    <span className="font-mono text-white">{formatINR(r.amount)}</span>
                    <span className="w-10 text-right font-mono text-white/45">{Math.round(r.percent)}%</span>
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/5">
                    <span className="block h-full rounded-full" style={{ width: `${r.percent}%`, background: r.color }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export const BudgetChart = memo(BudgetChartInner);
