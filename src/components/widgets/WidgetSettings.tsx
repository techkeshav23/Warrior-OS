// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Widget Settings Section
// Drop-in Settings block: one switch per desktop widget, the daily
// goal (what it counts + how much), and "reset positions". Styled to
// match the Appearance tab's toggle rows.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  DAILY_GOALS,
  DAILY_GOAL_KINDS,
  WIDGET_IDS,
  WIDGET_LABELS,
  useWidgetStore,
  type WidgetId,
} from './useWidgetStore';

const WIDGET_HINTS: Record<WidgetId, string> = {
  clock: 'Digital clock with the date',
  streak: 'Habit streak with a pulsing flame',
  target: 'Daily goal: cards reviewed or minutes focused',
};

function WidgetSettingsInner() {
  const enabled = useWidgetStore((s) => s.enabled);
  const toggleWidget = useWidgetStore((s) => s.toggleWidget);
  const resetPositions = useWidgetStore((s) => s.resetPositions);
  const goalKind = useWidgetStore((s) => s.dailyGoalKind);
  const target = useWidgetStore((s) => s.dailyGoalTargets[s.dailyGoalKind]);
  const setGoalKind = useWidgetStore((s) => s.setDailyGoalKind);
  const setTarget = useWidgetStore((s) => s.setDailyGoalTarget);
  const spec = DAILY_GOALS[goalKind];

  return (
    <section className="space-y-3">
      <h3 className="text-xs text-white/60 font-semibold">Desktop Widgets</h3>

      {WIDGET_IDS.map((id) => (
        <div key={id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white/70">{WIDGET_LABELS[id]}</p>
            <p className="text-[11px] text-white/50 truncate">{WIDGET_HINTS[id]}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled[id]}
            aria-label={`${WIDGET_LABELS[id]} widget`}
            onClick={() => toggleWidget(id)}
            className={cn(
              'w-10 h-5 shrink-0 rounded-full transition-all relative focus-ring',
              enabled[id] ? 'bg-cyan-500' : 'bg-white/20'
            )}
          >
            <span
              className={cn(
                'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
                enabled[id] ? 'left-5.5' : 'left-0.5'
              )}
            />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="widget-goal-kind-label" className="text-sm text-white/70">
          Daily goal
        </p>
        <div
          role="radiogroup"
          aria-labelledby="widget-goal-kind-label"
          className="flex gap-1 rounded-lg bg-white/5 p-0.5"
        >
          {DAILY_GOAL_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={goalKind === kind}
              onClick={() => setGoalKind(kind)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs transition-colors focus-ring',
                goalKind === kind ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/55 hover:text-white/85'
              )}
            >
              {DAILY_GOALS[kind].verb} {DAILY_GOALS[kind].unit}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="widget-daily-target" className="text-sm text-white/70">
          {spec.verb} per day
        </label>
        <div className="flex items-center gap-2">
          <input
            id="widget-daily-target"
            type="range"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={target}
            onChange={(e) => setTarget(goalKind, Number(e.target.value))}
            aria-valuetext={`${target} ${spec.unit}`}
            className="w-28 accent-cyan-400"
          />
          <span className="w-16 text-right text-xs font-mono text-cyan-300">
            {target} {spec.shortUnit}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={resetPositions}
        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
      >
        Reset widget positions
      </button>
    </section>
  );
}

export const WidgetSettings = memo(WidgetSettingsInner);
