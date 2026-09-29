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
import { BEVEL_SUNK, EMBER_PLATE, SLOT_FILL } from '@/components/ui/armor';
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

// The forge socket: an octagonal (cut-corner) frame the heat runs around.
const RING = 44;
const STROKE = 2.5;
const SOCKET = (() => {
  const i = STROKE / 2;
  const c = 12;
  const e = RING - i;
  return `M${c} ${i}H${RING - c}L${e} ${c}V${RING - c}L${RING - c} ${e}H${c}L${i} ${RING - c}V${c}Z`;
})();
const EASE = [0.16, 1, 0.3, 1] as const;

function HabitCardInner({ habit, done, run, week, onToggle, onRemove }: HabitCardProps) {
  const reduceMotion = useReducedMotion();
  const name = habit.name || 'Untitled habit';

  return (
    <div
      className={cn(
        'group/habit armor-panel chamfer-md relative isolate flex min-h-[72px] items-center gap-3 px-3.5 py-3',
        'transition-[filter,border-color,box-shadow] duration-180 ease-out-quint',
        done ? 'ember-edge' : 'hover:brightness-115'
      )}
    >
      {/* Heat wash: the plate glows from the socket side once forged. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-ember-500/[0.16] via-ember-600/[0.06] to-transparent',
          'transition-opacity duration-260 ease-out-quint',
          done ? 'opacity-100' : 'opacity-0'
        )}
      />
      {/* Stretched toggle: the whole card checks the habit off. */}
      <button
        type="button"
        onClick={() => onToggle(habit.id)}
        aria-pressed={done}
        aria-label={`${name}: ${done ? 'forged today. Select to undo' : 'not done yet today. Select to forge it'}`}
        title={name.length > 24 ? name : undefined}
        className="focus-ring-inset absolute inset-0 cursor-pointer active:bg-surface-active"
      />

      {/* Emoji in the forge ring */}
      <span className="pointer-events-none relative flex size-11 shrink-0 items-center justify-center" aria-hidden>
        <svg width={RING} height={RING} className="absolute inset-0">
          <path
            d={SOCKET}
            fill="none"
            strokeWidth={STROKE}
            strokeLinejoin="miter"
            className={cn(
              'transition-[stroke] duration-180',
              done ? 'stroke-ember-500/30' : 'stroke-ink-600 group-hover/habit:stroke-fg-faint'
            )}
          />
          <motion.path
            d={SOCKET}
            fill="none"
            strokeWidth={STROKE}
            strokeLinejoin="miter"
            pathLength={1}
            strokeDasharray="1 1"
            className="stroke-ember-400"
            initial={false}
            animate={{ strokeDashoffset: done ? 0 : 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: EASE }}
          />
        </svg>
        <span
          className={cn(
            'chamfer flex size-8 items-center justify-center text-lg leading-none transition-colors duration-180 [--cut:8px]',
            done
              ? 'bg-linear-to-b from-ember-500/30 to-ember-700/20'
              : cn(SLOT_FILL, BEVEL_SUNK)
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
                  className="chamfer absolute inset-0 bg-ember-400/35 [--cut:12px]"
                  initial={{ scale: 0.9, opacity: 0.8 }}
                  animate={{ scale: 1.45, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                />
              )}
              <motion.span
                key="check"
                className={'chamfer-xs absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center ' + EMBER_PLATE}
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
          <span className="flex items-center gap-0.5" aria-hidden>
            {week.map((d) => (
              <span
                key={d.key}
                className={cn(
                  'h-1.5 w-2 -skew-x-[20deg]',
                  d.done ? 'bg-ember-400' : d.isToday ? 'bg-ember-500/20 shadow-[inset_0_0_0_1px_var(--color-ember-500)]' : 'bg-steel-600'
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
