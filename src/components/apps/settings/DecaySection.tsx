// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Reality Decay settings (spec 6.45)
// Engine on/off, stage-threshold offset (−30…+30 min), forced break
// length (3 / 5 / 10 min) and the live study readout. Reads and writes
// useDecayStore directly.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { SegmentedControl, Slider, StatTile } from '@/components/ui';
import {
  useDecayStore,
  BREAK_DURATION_OPTIONS,
  DECAY_BASE_THRESHOLDS,
  DECAY_OFFSET_LIMIT,
  type BreakDurationMinutes,
} from '@/stores/useDecayStore';
import { DECAY_STAGE_NAMES, formatStudyMinutes, useLocalDayKey } from '@/components/decay/DecayTrayTimer';
import { RowValue, SettingRow, SettingsCard, SettingsSection, SwitchRow } from './parts';

function DecaySectionInner() {
  const enabled = useDecayStore((s) => s.enabled);
  const setEnabled = useDecayStore((s) => s.setEnabled);
  const offset = useDecayStore((s) => s.thresholdOffset);
  const setOffset = useDecayStore((s) => s.setThresholdOffset);
  const breakDuration = useDecayStore((s) => s.breakDuration);
  const setBreakDuration = useDecayStore((s) => s.setBreakDuration);
  const minutes = useDecayStore((s) => s.continuousStudyMinutes);
  const stage = useDecayStore((s) => s.decayStage);
  const stats = useDecayStore((s) => s.stats);
  const daily = useDecayStore((s) => s.daily);
  const today = useLocalDayKey();

  const thresholds = DECAY_BASE_THRESHOLDS.map((t) => t + offset);
  const todayMinutes = daily.day === today ? daily.studyMinutes : 0;
  const todayBreaks = daily.day === today ? daily.breaks : 0;
  const stageIndex = Math.max(0, Math.min(5, stage));
  const offsetLabel = offset === 0 ? 'Default' : `${offset > 0 ? '+' : ''}${offset} min`;

  return (
    <SettingsSection
      title="Reality Decay"
      description="After long unbroken study the OS slowly degrades (warmth, blur, a red vignette, a heartbeat, cracks) and finally forces a recovery break."
    >
      <SettingsCard>
        <SwitchRow
          label="Reality Decay"
          description="Degrade the OS during long, unbroken study sessions."
          checked={enabled}
          onCheckedChange={setEnabled}
        />

        <SettingRow
          label="Stage timing"
          htmlFor="decay-offset"
          disabled={!enabled}
          description="Shift when every stage begins."
          control={<RowValue muted={!enabled}>{offsetLabel}</RowValue>}
        >
          <Slider
            id="decay-offset"
            min={-DECAY_OFFSET_LIMIT}
            max={DECAY_OFFSET_LIMIT}
            step={5}
            value={offset}
            disabled={!enabled}
            onValueChange={setOffset}
            aria-valuetext={offsetLabel}
          />
          <ol className={`grid grid-cols-5 gap-1.5 ${enabled ? '' : 'opacity-50'}`}>
            {thresholds.map((t, i) => (
              <li
                key={i}
                title={`Stage ${i + 1}: ${DECAY_STAGE_NAMES[i + 1]}`}
                className="flex min-w-0 flex-col items-center gap-0.5 rounded-control bg-surface-2 px-1 py-1.5"
              >
                <span className="truncate text-2xs text-fg-subtle">Stage {i + 1}</span>
                <span className="tabular truncate font-mono text-xs text-fg">{formatStudyMinutes(t)}</span>
              </li>
            ))}
          </ol>
        </SettingRow>

        <SettingRow
          label="Forced break length"
          disabled={!enabled}
          description="How long the recovery break lasts once decay peaks."
          control={
            <SegmentedControl<string>
              size="sm"
              aria-label="Forced break length"
              value={String(breakDuration)}
              onChange={(v) => setBreakDuration(Number(v) as BreakDurationMinutes)}
              options={BREAK_DURATION_OPTIONS.map((d) => ({ value: String(d), label: `${d} min`, disabled: !enabled }))}
            />
          }
        />

        {/* Live readout */}
        <div className="grid grid-cols-1 divide-y divide-line @sm:grid-cols-3 @sm:divide-x @sm:divide-y-0">
          <StatTile
            bare
            size="sm"
            className="px-4 py-3.5"
            label="Continuous"
            value={formatStudyMinutes(minutes)}
            deltaLabel={`Stage ${stage} · ${DECAY_STAGE_NAMES[stageIndex]}`}
          />
          <StatTile
            bare
            size="sm"
            className="px-4 py-3.5"
            label="Today"
            value={formatStudyMinutes(todayMinutes)}
            deltaLabel={`${todayBreaks} break${todayBreaks === 1 ? '' : 's'}`}
          />
          <StatTile
            bare
            size="sm"
            className="px-4 py-3.5"
            label="Lifetime"
            value={stats.forcedBreaks}
            unit="forced"
            deltaLabel={`${stats.fullDecays} full decay${stats.fullDecays === 1 ? '' : 's'}`}
          />
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}

export const DecaySection = memo(DecaySectionInner);
