// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Habit card
// One habit for today. The whole card is the check-off target: the
// emoji sits in a ring that fills with ember when forged (a short
// burst plays on the way in), with this week's dots and the habit's
// own run underneath. Remove is a hover / focus action on the right.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Flame, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui';
import type { Habit } from './HabitForgeApp';

export interface HabitWeekDay {
  key: string;
  done: boolean;
  isToday: boolean;
}

interface HabitCardProps {
  habit: Habit;
  done: boolean;
  /** Consecutive days of this habit (ending today or yesterday). */
  run: number;
  /** Last seven days, oldest first. */
  week: readonly HabitWeekDay[];
  onToggle: (habitId: string) => void;
  onRemove: (habit: Habit) => void;
}

const RING = 44;
const STROKE = 2.5;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const EASE = [0.16, 1, 0.3, 1] as const;

function HabitCardInner({ habit, done, run, week, onToggle, onRemove }: HabitCardProps) {
  const reduceMotion = useReducedMotion();
  const name = habit.name || 'Untitled habit';

  return (
    <div
      className={cn(
        'group/habit relative flex min-h-[72px] items-center gap-3 rounded-card border px-3.5 py-3',
        'transition-[background-color,border-color,box-shadow] duration-180 ease-out-quint',
        done
          ? 'border-ember-500/35 bg-linear-to-r from-ember-500/[0.09] to-ember-500/[0.02] shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]'
          : 'border-line bg-surface-2 hover:border-line-strong hover:bg-surface-hover'
      )}
    >
      {/* Stretched toggle: the whole card checks the habit off. */}
      <button
        type="button"
        onClick={() => onToggle(habit.id)}
        aria-pressed={done}
        aria-label={`${name}: ${done ? 'forged today. Select to undo' : 'not done yet today. Select to forge it'}`}
        title={name.length > 24 ? name : undefined}
        className="focus-ring absolute inset-0 cursor-pointer rounded-card active:bg-surface-active"
      />

      {/* Emoji in the forge ring */}
      <span className="pointer-events-none relative flex size-11 shrink-0 items-center justify-center" aria-hidden>
        <svg width={RING} height={RING} className="absolute inset-0 -rotate-90">
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            className={cn(
              'transition-[stroke] duration-180',
              done ? 'stroke-ember-500/30' : 'stroke-ink-600 group-hover/habit:stroke-fg-faint'
            )}
          />
          <motion.circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            className="stroke-ember-400"
            initial={false}
            animate={{ strokeDashoffset: done ? 0 : CIRC }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: EASE }}
          />
        </svg>
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-full text-lg leading-none transition-colors duration-180',
            done ? 'bg-ember-500/15' : 'bg-ink-800'
          )}
        >
          {habit.icon || <Flame size={16} strokeWidth={1.75} className="text-ember-400" />}
        </span>
        {/* Burst + check badge when forged */}
        <AnimatePresence>
          {done && (
            <>
              {!reduceMotion && (
                <motion.span
                  key="burst"
                  className="absolute inset-0 rounded-full border-2 border-ember-400"
                  initial={{ scale: 0.9, opacity: 0.7 }}
                  animate={{ scale: 1.45, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                />
              )}
              <motion.span
                key="check"
                className="absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full bg-linear-to-b from-ember-400 to-ember-500 text-ink-950 ring-2 ring-ink-900"
                initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                <Check size={11} strokeWidth={3} />
              </motion.span>
            </>
          )}
        </AnimatePresence>
      </span>

      {/* Name + week */}
      <span className="pointer-events-none relative min-w-0 flex-1">
        <span className="block truncate text-ui font-medium text-fg">
          {name}
        </span>
        <span className="mt-1.5 flex items-center gap-2.5">
          <span className="flex items-center gap-[3px]" aria-hidden>
            {week.map((d) => (
              <span
                key={d.key}
                className={cn(
                  'size-1.5 rounded-full',
                  d.done ? 'bg-ember-400' : d.isToday ? 'ring-1 ring-inset ring-ember-500/60' : 'bg-ink-600'
                )}
              />
            ))}
          </span>
          <span className={cn('truncate text-xs', done ? 'text-ember-300' : 'text-fg-subtle')}>
            {done ? 'Forged today' : run > 0 ? `${run}-day run` : 'Start a run today'}
            {done && run > 1 && <span className="tabular text-fg-subtle"> · {run}-day run</span>}
          </span>
        </span>
      </span>

      {/* Hover / focus action */}
      <IconButton
        icon={Trash2}
        size="sm"
        variant="ghost-danger"
        aria-label={`Remove ${habit.name}`}
        tooltip="Remove habit"
        onClick={() => onRemove(habit)}
        className="relative z-10 opacity-0 group-hover/habit:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}

export const HabitCard = memo(HabitCardInner);
