// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Transaction List
// The month's expenses grouped by day, with category filter chips,
// note search, and edit / delete actions on every row (revealed
// on hover / focus; always on for the row being edited).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState, type CSSProperties } from 'react';
import { Pencil, Receipt, SearchX, Trash2 } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button, Chip, EmptyState, IconButton, SearchField } from '@/components/ui';
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

/** Re-tints the accent utilities of a subtree to a category colour. */
function tint(color: string): CSSProperties {
  return { '--accent': color } as CSSProperties;
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
      className={cn('glass-panel flex min-h-0 flex-col rounded-card', className)}
    >
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">Transactions</h3>
          <p className="text-xs text-fg-subtle">
            {filtered.length} {isFiltered ? 'shown' : filtered.length === 1 ? 'entry' : 'entries'} ·{' '}
            <span className="tabular font-mono text-fg">{formatINR(filteredTotal)}</span>
          </p>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <Chip size="sm" selected={categoryFilter === null} onClick={() => onCategoryFilterChange(null)}>
            All <span className="tabular font-mono opacity-70">{expenses.length}</span>
          </Chip>
          {EXPENSE_CATEGORIES.map((c) => {
            const active = categoryFilter === c.id;
            return (
              <Chip
                key={c.id}
                size="sm"
                selected={active}
                onClick={() => onCategoryFilterChange(active ? null : c.id)}
                disabled={countByCategory[c.id] === 0 && !active}
                icon={<span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />}
              >
                {c.label} <span className="tabular font-mono opacity-70">{countByCategory[c.id]}</span>
              </Chip>
            );
          })}
        </div>

        <SearchField size="sm" value={query} onValueChange={setQuery} placeholder="Search notes" autoComplete="off" />
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 ? (
          expenses.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Receipt}
              title={`Nothing logged in ${monthName}`}
              description="Use quick add to record your first expense."
            />
          ) : (
            <EmptyState
              size="sm"
              icon={SearchX}
              title="No matches"
              description="No transactions match this filter."
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    onCategoryFilterChange(null);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.date}>
                <div className="flex h-7 items-center justify-between gap-3 px-2">
                  <span className="hud-label">{g.date === todayKey ? `Today · ${dayLabel(g.date)}` : dayLabel(g.date)}</span>
                  <span className="tabular font-mono text-2xs text-fg-muted">{formatINR(g.total)}</span>
                </div>
                <ul>
                  {g.items.map((e) => {
                    const meta = EXPENSE_CATEGORY_MAP[e.category];
                    const Icon = meta.Icon;
                    const isEditing = editingId === e.id;
                    const title = e.note || meta.label;
                    return (
                      <li
                        key={e.id}
                        className={cn(
                          'group/row relative flex min-h-12 items-center gap-3 rounded-control px-2 py-1.5 transition-colors duration-120 ease-out-quint',
                          isEditing ? 'bg-accent/10' : 'hover:bg-surface-hover'
                        )}
                      >
                        {isEditing && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent/12 text-accent"
                          style={tint(meta.color)}
                        >
                          <Icon size={16} strokeWidth={1.75} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-ui text-fg" title={title}>
                            {title}
                          </p>
                          <p className="truncate text-xs text-fg-subtle">
                            {e.note ? `${meta.label} · ` : ''}
                            {loggedLabel(e)}
                            {e.updatedAt !== e.createdAt && ' · edited'}
                            {isEditing && ' · editing'}
                          </p>
                        </div>
                        <span className="tabular shrink-0 font-mono text-ui font-medium text-fg">{formatINR(e.amount)}</span>
                        <div
                          className={cn(
                            'flex shrink-0 items-center gap-0.5 transition-opacity duration-120',
                            isEditing
                              ? 'opacity-100'
                              : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100'
                          )}
                        >
                          <IconButton
                            icon={Pencil}
                            size="xs"
                            aria-label={`Edit ${title}, ${formatINR(e.amount)}`}
                            title="Edit"
                            onClick={() => onEdit(e)}
                          />
                          <IconButton
                            icon={Trash2}
                            size="xs"
                            variant="ghost-danger"
                            aria-label={`Delete ${title}, ${formatINR(e.amount)}`}
                            title="Delete"
                            onClick={() => onDelete(e)}
                          />
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
