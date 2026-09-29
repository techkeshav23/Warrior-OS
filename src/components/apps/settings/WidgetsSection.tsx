// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Desktop widget settings
// One switch per desktop widget, the daily goal (what it counts + how
// much), and "reset positions". Reads and writes useWidgetStore.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, SegmentedControl, Slider } from '@/components/ui';
import {
  DAILY_GOALS,
  DAILY_GOAL_KINDS,
  WIDGET_IDS,
  WIDGET_LABELS,
  useWidgetStore,
  type WidgetId,
} from '@/components/widgets/useWidgetStore';
import { RowValue, SettingRow, SettingsCard, SettingsSection, SwitchRow } from './parts';

const WIDGET_HINTS: Record<WidgetId, string> = {
  clock: 'Digital clock with the date.',
  streak: 'Habit streak with an ember flame and a breathing glow.',
  target: 'Daily goal: cards reviewed or minutes focused.',
};

function WidgetsSectionInner() {
  const enabled = useWidgetStore((s) => s.enabled);
  const toggleWidget = useWidgetStore((s) => s.toggleWidget);
  const resetPositions = useWidgetStore((s) => s.resetPositions);
  const goalKind = useWidgetStore((s) => s.dailyGoalKind);
  const target = useWidgetStore((s) => s.dailyGoalTargets[s.dailyGoalKind]);
  const setGoalKind = useWidgetStore((s) => s.setDailyGoalKind);
  const setTarget = useWidgetStore((s) => s.setDailyGoalTarget);
  const spec = DAILY_GOALS[goalKind];

  return (
    <SettingsSection title="Desktop widgets" description="Glanceable tiles on the desktop. Drag one to move it.">
      <SettingsCard>
        {WIDGET_IDS.map((id) => (
          <SwitchRow
            key={id}
            label={WIDGET_LABELS[id]}
            ariaLabel={`${WIDGET_LABELS[id]} widget`}
            description={WIDGET_HINTS[id]}
            checked={enabled[id]}
            onCheckedChange={() => toggleWidget(id)}
          />
        ))}

        <SettingRow
          label="Goal type"
          labelId="widget-goal-kind-label"
          description="What the Daily goal widget counts."
          control={
            <SegmentedControl
              size="sm"
              aria-label="Daily goal"
              value={goalKind}
              onChange={setGoalKind}
              options={DAILY_GOAL_KINDS.map((kind) => ({
                value: kind,
                label: `${DAILY_GOALS[kind].verb} ${DAILY_GOALS[kind].unit}`,
              }))}
            />
          }
        />

        <SettingRow
          label={`${spec.verb} per day`}
          htmlFor="widget-daily-target"
          description={`Between ${spec.min} and ${spec.max} ${spec.unit}.`}
          control={
            <RowValue>
              {target} {spec.shortUnit}
            </RowValue>
          }
        >
          <Slider
            id="widget-daily-target"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={target}
            onValueChange={(v) => setTarget(goalKind, v)}
            aria-valuetext={`${target} ${spec.unit}`}
          />
        </SettingRow>

        <SettingRow
          label="Layout"
          description="Move every widget back to its default spot."
          control={
            <Button size="sm" leadingIcon={RotateCcw} onClick={resetPositions}>
              Reset widget positions
            </Button>
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}

export const WidgetsSection = memo(WidgetsSectionInner);
