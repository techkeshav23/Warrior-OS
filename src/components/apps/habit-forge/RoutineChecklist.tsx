// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Routine Checklist
// Daily set of tasks organized by time-of-day categories: a progress
// strip (one ember cell per task) over Morning / Study / Night
// columns of check rows.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Check, Moon, Sunrise, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BEVEL_SUNK, EMBER_PLATE, SLOT_FILL } from '@/components/ui/armor';
import { Card, ProgressBar } from '@/components/ui';
import { checkStudyStreak } from '@/components/achievements/study-streak';
import type { RoutineItem } from './HabitForgeApp';
import { ROUTINE_KEY, loadRoutineDone } from './habit-utils';

interface Props {
  routines: RoutineItem[];
  /** Called after every check / uncheck has been saved (e.g. to refresh a streak counter). */
  onProgress?: () => void;
}


const CATEGORIES: { key: RoutineItem['category']; label: string; icon: LucideIcon }[] = [
  { key: 'morning', label: 'Morning', icon: Sunrise },
  { key: 'study', label: 'Study', icon: BookOpen },
  { key: 'night', label: 'Night', icon: Moon },
];

/** '6:00' → '06:00' so the time column lines up. */
function padTime(time: string): string {
  return /^\d:\d\d$/.test(time) ? `0${time}` : time;
}

function RoutineChecklistInner({ routines, onProgress }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const reduceMotion = useReducedMotion();

  const [completed, setCompleted] = useState<Set<string>>(() => loadRoutineDone(today));

  const toggle = useCallback((id: string) => {
    const next = new Set(completed);
    const nowDone = !next.has(id);
    if (nowDone) next.add(id);
    else next.delete(id);
    setCompleted(next);
    // Save (outside the state updater, so it runs exactly once)
    try {
      const allData = JSON.parse(localStorage.getItem(ROUTINE_KEY) || '{}') as Record<string, string[]>;
      allData[today] = [...next];
      localStorage.setItem(ROUTINE_KEY, JSON.stringify(allData));
    } catch {
      /* storage blocked or corrupt — the checklist still works for this session */
    }
    // A routine check-off is study activity for the day's streak.
    if (nowDone) checkStudyStreak();
    onProgress?.();
  }, [completed, today, onProgress]);

  const doneCount = routines.filter((r) => completed.has(r.id)).length;
  const totalCount = routines.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && doneCount === totalCount;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <Card padding="md">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="hud-label">Today&apos;s routine</p>
            <p className="mt-1.5 flex items-baseline gap-2 leading-none">
              <span className={cn('tabular font-display text-3xl font-semibold', allDone ? 'text-ember-400' : 'text-fg')}>
                {doneCount}
              </span>
              <span className="tabular font-mono text-sm text-fg-subtle">/ {totalCount}</span>
            </p>
          </div>
          <p className={cn('text-right text-xs', allDone ? 'text-ember-300' : 'text-fg-muted')}>
            {allDone ? 'Routine complete. The forge is hot.' : doneCount === 0 ? 'Check off a block to light the day.' : `${pct}% of the day forged`}
          </p>
        </div>
        <ProgressBar
          className="mt-4"
          value={doneCount}
          max={Math.max(totalCount, 1)}
          segments={Math.max(totalCount, 1)}
          size="lg"
          tone="ember"
          glow={allDone}
          aria-label="Routine progress"
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const items = routines.filter((r) => r.category === cat.key);
          if (items.length === 0) return null;
          const catDone = items.filter((r) => completed.has(r.id)).length;
          const Icon = cat.icon;
          return (
            <section key={cat.key} aria-label={cat.label} className="min-w-0">
              <header className="mb-2 flex items-center gap-2 px-1">
                <Icon size={16} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
                <h4 className="text-ui font-semibold text-fg">{cat.label}</h4>
                <span
                  className={cn(
                    'tabular ml-auto font-mono text-xs',
                    catDone === items.length ? 'text-ember-400' : 'text-fg-subtle'
                  )}
                >
                  {catDone}/{items.length}
                </span>
              </header>
              <div className="armor-panel chamfer-md overflow-hidden">
                <ul className="divide-y divide-line">
                  {items.map((item, i) => {
                    const done = completed.has(item.id);
                    return (
                      <li key={item.id}>
                        <motion.button
                          type="button"
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => toggle(item.id)}
                          aria-pressed={done}
                          className={cn(
                            'focus-ring-inset group/row flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left',
                            'transition-colors duration-120 ease-out-quint hover:bg-surface-hover active:bg-surface-active'
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'chamfer-xs flex size-[18px] shrink-0 items-center justify-center transition-[background-color,box-shadow] duration-180 ease-out-quint',
                              done
                                ? EMBER_PLATE
                                : cn(SLOT_FILL, BEVEL_SUNK, 'group-hover/row:shadow-[inset_0_0_0_1px_var(--color-ember-500)]')
                            )}
                          >
                            {done && <Check size={11} strokeWidth={3} />}
                          </span>
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-ui transition-colors duration-120',
                              done ? 'text-fg-subtle line-through decoration-fg-faint' : 'text-fg'
                            )}
                            title={item.text}
                          >
                            {item.text}
                          </span>
                          <span className="tabular shrink-0 font-mono text-xs text-fg-subtle">{padTime(item.time)}</span>
                        </motion.button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export const RoutineChecklist = memo(RoutineChecklistInner);
