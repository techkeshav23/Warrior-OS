// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DecaySettings
// Drop-in settings section for Reality Decay (spec 6.45):
// engine on/off, stage-threshold offset (−30…+30 min), break
// duration (3 / 5 / 10 min), and the live continuous-study readout.
// Reads and writes useDecayStore directly.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  useDecayStore,
  BREAK_DURATION_OPTIONS,
  DECAY_BASE_THRESHOLDS,
  DECAY_OFFSET_LIMIT,
} from '@/stores/useDecayStore';
import { DECAY_STAGE_NAMES, formatStudyMinutes, useLocalDayKey } from './DecayTrayTimer';

function DecaySettingsInner({ className }: { className?: string }) {
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

  return (
    <div className={cn('flex flex-col gap-4 text-sm', className)}>
      {/* On / off */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-3">
        <div>
          <p className="font-medium text-white/90">Reality Decay</p>
          <p className="mt-0.5 text-xs text-white/60">
            After long unbroken study the OS slowly degrades — warmth, blur, a red vignette, a
            heartbeat, cracks — and finally forces a recovery break.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Reality Decay"
          onClick={() => setEnabled(!enabled)}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
            enabled ? 'border-cyan-500/40 bg-cyan-500/30' : 'border-white/10 bg-white/10'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all',
              enabled ? 'left-[18px]' : 'left-0.5'
            )}
          />
        </button>
      </div>

      <div className={cn('flex flex-col gap-4', !enabled && 'pointer-events-none opacity-40')}>
        {/* Threshold offset */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <label htmlFor="decay-offset" className="font-medium text-white/90">
              Stage timing
            </label>
            <span className="font-mono text-xs text-white/60">
              {offset === 0 ? 'default' : `${offset > 0 ? '+' : ''}${offset} min`}
            </span>
          </div>
          <input
            id="decay-offset"
            type="range"
            min={-DECAY_OFFSET_LIMIT}
            max={DECAY_OFFSET_LIMIT}
            step={5}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
            className="mt-2 w-full accent-cyan-400"
          />
          <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[10px] text-white/60">
            {thresholds.map((t, i) => (
              <div key={i} className="rounded bg-black/20 px-1 py-1">
                <div className="text-white/80">Stage {i + 1}</div>
                <div className="font-mono">{formatStudyMinutes(t)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Break duration */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="font-medium text-white/90">Forced break length</p>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Forced break length">
            {BREAK_DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={breakDuration === d}
                onClick={() => setBreakDuration(d)}
                className={cn(
                  'flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors',
                  breakDuration === d
                    ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                )}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        {/* Live readout */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="text-[10px] uppercase tracking-wide text-white/50">Continuous</div>
            <div className="mt-0.5 font-semibold text-white/90">{formatStudyMinutes(minutes)}</div>
            <div className="text-[10px] text-white/50">
              Stage {stage} · {DECAY_STAGE_NAMES[Math.max(0, Math.min(5, stage))]}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="text-[10px] uppercase tracking-wide text-white/50">Today</div>
            <div className="mt-0.5 font-semibold text-white/90">{formatStudyMinutes(todayMinutes)}</div>
            <div className="text-[10px] text-white/50">
              {todayBreaks} break{todayBreaks === 1 ? '' : 's'}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="text-[10px] uppercase tracking-wide text-white/50">Lifetime</div>
            <div className="mt-0.5 font-semibold text-white/90">{stats.forcedBreaks} forced</div>
            <div className="text-[10px] text-white/50">{stats.fullDecays} full decays</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const DecaySettings = memo(DecaySettingsInner);
