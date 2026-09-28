// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Transaction List
// The month's expenses grouped by day, with category filter chips,
// note search, and edit / delete actions on every row
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useMemo, useState } from 'react';
import { Pencil, Search, Trash2, X } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { sumExpenses } from '@/stores/useExpenseStore';
import type { Expense, ExpenseCategory } from '@/types/expense';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_MAP, dayLabel, formatINR, toDateKey } from './expense-utils';

interface TransactionListProps {
  className?: string;
  /** Expenses of the month being viewed (unfiltered). */
  expenses: readonly Expense[];
  monthName: string;
  todayKey: string;
  categoryFilter: ExpenseCategory | null;
  onCategoryFilterChange: (category: ExpenseCategory | null) => void;
  editingId: string | null;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

interface DayGroup {
  date: string;
  items: Expense[];
  total: number;
}

/** "logged 3:40 PM" (or "logged 12 Sep" when it was entered on another day). */
function loggedLabel(e: Expense): string {
  const logged = parseISO(e.createdAt);
  if (!isValid(logged)) return 'logged earlier';
  return toDateKey(logged) === e.date ? `logged ${format(logged, 'h:mm a')}` : `logged ${format(logged, 'd MMM')}`;
}

/** Newest day first; within a day, most recently logged first. */
function compareNewestFirst(a: Expense, b: Expense): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return 0;
}

function TransactionListInner({
  className,
  expenses,
  monthName,
  todayKey,
  categoryFilter,
  onCategoryFilterChange,
  editingId,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const searchId = useId();
  const [query, setQuery] = useState('');

  const countByCategory = useMemo(() => {
    const counts: Record<ExpenseCategory, number> = { food: 0, transport: 0, books: 0, entertainment: 0, other: 0 };
    for (const e of expenses) counts[e.category] += 1;
    return counts;
  }, [expenses]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (categoryFilter && e.category !== categoryFilter) return false;
        if (!needle) return true;
        const label = EXPENSE_CATEGORY_MAP[e.category].label.toLowerCase();
        return e.note.toLowerCase().includes(needle) || label.includes(needle);
      })
      .sort(compareNewestFirst);
  }, [expenses, categoryFilter, query]);

  const groups = useMemo<DayGroup[]>(() => {
    const out: DayGroup[] = [];
    for (const e of filtered) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else out.push({ date: e.date, items: [e], total: 0 });
    }
    for (const g of out) g.total = sumExpenses(g.items);
    return out;
  }, [filtered]);

  const filteredTotal = useMemo(() => sumExpenses(filtered), [filtered]);
  const isFiltered = categoryFilter !== null || query.trim() !== '';

  return (
    <section
      aria-label="Transactions"
      className={cn('flex min-h-0 flex-col rounded-xl border border-white/10 bg-white/[0.03]', className)}
    >
      <div className="border-b border-white/10 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Transactions</h3>
          <p className="text-[11px] text-white/50">
            {filtered.length} {isFiltered ? 'shown' : filtered.length === 1 ? 'entry' : 'entries'} ·{' '}
            <span className="font-mono text-white/80">{formatINR(filteredTotal)}</span>
          </p>
        </div>

        {/* Category chips */}
        <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => onCategoryFilterChange(null)}
            aria-pressed={categoryFilter === null}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
              categoryFilter === null
                ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                : 'border-white/10 text-white/55 hover:bg-white/10'
            )}
          >
            All {expenses.length}
          </button>
          {EXPENSE_CATEGORIES.map((c) => {
            const active = categoryFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryFilterChange(active ? null : c.id)}
                aria-pressed={active}
                disabled={countByCategory[c.id] === 0 && !active}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                  active ? 'text-white' : 'border-white/10 text-white/55 hover:bg-white/10'
                )}
                style={active ? { borderColor: `${c.color}80`, background: `${c.color}26` } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                {c.label} {countByCategory[c.id]}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <label htmlFor={searchId} className="sr-only">
            Search notes
          </label>
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            autoComplete="off"
            className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-7 pr-7 text-xs text-white placeholder:text-white/35 outline-none focus:border-cyan-400/50"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/45 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-white/45">
            {expenses.length === 0
              ? `Nothing logged in ${monthName}. Use the quick-add form to record your first expense.`
              : 'No transactions match this filter.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.date}>
                <div className="flex items-center justify-between px-2 pb-1 text-[11px] text-white/45">
                  <span>{g.date === todayKey ? `Today · ${dayLabel(g.date)}` : dayLabel(g.date)}</span>
                  <span className="font-mono">{formatINR(g.total)}</span>
                </div>
                <ul className="space-y-0.5">
                  {g.items.map((e) => {
                    const meta = EXPENSE_CATEGORY_MAP[e.category];
                    const Icon = meta.Icon;
                    const isEditing = editingId === e.id;
                    const title = e.note || meta.label;
                    return (
                      <li
                        key={e.id}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors',
                          isEditing ? 'bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'hover:bg-white/5'
                        )}
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: `${meta.color}1f`, color: meta.color }}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white/90" title={title}>
                            {title}
                          </p>
                          <p className="truncate text-[11px] text-white/45">
                            {e.note ? `${meta.label} · ` : ''}
                            {loggedLabel(e)}
                            {e.updatedAt !== e.createdAt && ' · edited'}
                            {isEditing && ' · editing'}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-sm text-white">{formatINR(e.amount)}</span>
                        <div className="flex shrink-0 items-center opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => onEdit(e)}
                            className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-cyan-300"
                            aria-label={`Edit ${title}, ${formatINR(e.amount)}`}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(e)}
                            className="rounded p-1.5 text-white/60 hover:bg-red-500/15 hover:text-red-300"
                            aria-label={`Delete ${title}, ${formatINR(e.amount)}`}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export const TransactionList = memo(TransactionListInner);
