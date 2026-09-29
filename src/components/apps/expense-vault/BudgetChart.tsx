// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Budget Chart
// Recharts donut of the month's spending by category (viz palette,
// fixed per category), wrapped in a thin outer ring that tracks
// spending against the monthly budget (status colours). Clicking a
// slice or legend row filters the transaction list.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartPie, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, EmptyState } from '@/components/ui';
import { INK, STATUS } from '@/styles/tokens';
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
    <div className="armor-popover px-3 py-2 text-xs">
      <p className="flex items-center gap-2 font-medium text-fg">
        <span className="size-2 shrink-0 rounded-full" style={{ background: datum.fill }} />
        {datum.label}
      </p>
      <p className="tabular mt-1 font-mono text-fg-muted">{datum.detail}</p>
    </div>
  );
}

/** Budget ring track (unspent part). */
const RING_TRACK = INK[700];

function ringColor(pct: number): string {
  if (pct > 100) return STATUS.danger;
  if (pct >= 80) return STATUS.warning;
  return STATUS.success;
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
        fillOpacity: selected === null || selected === r.id ? 1 : 0.22,
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
    <Card
      role="region"
      aria-label="Spending by category"
      title="Where it went"
      description={
        top
          ? `${top.label} leads ${monthName} at ${Math.round(top.percent)}% of spending`
          : `No spending logged in ${monthName} yet`
      }
      actions={
        selected && (
          <Button variant="ghost" size="sm" leadingIcon={X} onClick={() => onSelect(null)}>
            Clear filter
          </Button>
        )
      }
      className={cn('@container', className)}
    >
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:items-center">
        {/* Donut (inner: categories, outer ring: share of the monthly budget used) */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="relative size-52 shrink-0">
            {/* Forged gauge bezel: etched ticks on the outer rim, a sunk hub in the middle */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-[repeating-conic-gradient(rgb(200_210_225/0.22)_0_0.8deg,transparent_0.8deg_7.5deg)] [mask-image:radial-gradient(closest-side,transparent_96%,black_97%)]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-[20%] rounded-full bg-linear-to-b from-steel-950 to-steel-900 shadow-[inset_0_2px_6px_rgb(0_0_0/0.7),inset_0_-1px_0_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.45)]"
            />
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={renderDonutTooltip} wrapperStyle={{ zIndex: 5 }} />
                <Pie
                  data={ringData}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="88%"
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
                    innerRadius="58%"
                    outerRadius="78%"
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={categoryData.length > 1 ? 2 : 0}
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
              <span className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Spent</span>
              <span className="tabular mt-1 font-display text-lg font-semibold leading-6 text-fg">
                {spent >= 1_000_000 ? formatINRCompact(spent) : formatINR(spent, 'never')}
              </span>
              <span className="tabular font-mono text-2xs text-fg-subtle">of {formatINRCompact(budget)}</span>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <span className="h-1.5 w-3" style={{ background: ringColor(usedPct) }} />
            Outer ring: <span className="tabular font-mono text-fg-muted">{Math.round(usedPct)}%</span> of the budget
          </p>
        </div>

        {/* Legend / filter */}
        <div className="w-full min-w-0 flex-1">
          {rows.length === 0 ? (
            <EmptyState
              size="sm"
              icon={ChartPie}
              title="No spending yet"
              description="Log an expense to see the category split."
            />
          ) : (
            <ul className="space-y-0.5">
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
                        'focus-ring chamfer-sm w-full px-2.5 py-2 text-left transition-[background-color,opacity] duration-120 ease-out-quint',
                        active ? 'ember-edge bg-accent/[0.07]' : 'hover:bg-surface-hover',
                        dimmed && 'opacity-50 hover:opacity-100'
                      )}
                    >
                      <span className="flex items-center gap-2.5 text-ui">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />
                        <span className="min-w-0 flex-1 truncate text-fg">{r.label}</span>
                        <span className="tabular font-mono text-xs text-fg">{formatINR(r.amount)}</span>
                        <span className="tabular w-9 text-right font-mono text-xs text-fg-subtle">
                          {Math.round(r.percent)}%
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden bg-steel-950 shadow-[inset_0_1px_0_rgb(0_0_0/0.6)]">
                        <span
                          className="block h-full"
                          style={{ width: `${r.percent}%`, background: r.color }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

export const BudgetChart = memo(BudgetChartInner);
