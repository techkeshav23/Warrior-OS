// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Playback Controls
// Reset, step back, play/pause, step forward, jump to end,
// timeline scrubber and speed slider
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type ReactNode } from 'react';
import { Gauge, Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSpeed, speedLevelsFor, type SpeedKind } from '@/lib/algorithms/constants';
import type { PlaybackControls as PlaybackApi } from './usePlayback';

export function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

export function SpeedSlider({
  kind,
  level,
  onChange,
}: {
  kind: SpeedKind;
  level: number;
  onChange: (level: number) => void;
}) {
  const levels = speedLevelsFor(kind);
  const safeLevel = Math.max(0, Math.min(levels.length - 1, level));
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-white/60" title="Playback speed">
      <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <input
        type="range"
        min={0}
        max={levels.length - 1}
        step={1}
        value={safeLevel}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Playback speed"
        className="w-20 accent-cyan-400"
      />
      <span className="w-16 shrink-0 font-mono tabular-nums text-white/70">{formatSpeed(levels[safeLevel], kind)}</span>
    </label>
  );
}

interface PlaybackControlsProps {
  player: PlaybackApi;
  speedKind: SpeedKind;
  speedLevel: number;
  onSpeedChange: (level: number) => void;
  disabled?: boolean;
}

function PlaybackControlsInner({ player, speedKind, speedLevel, onSpeedChange, disabled = false }: PlaybackControlsProps) {
  const inactive = disabled || player.total <= 1;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
      <div className="flex items-center gap-0.5">
        <ControlButton label="Reset to first step (Home)" onClick={player.reset} disabled={inactive || player.atStart}>
          <SkipBack className="h-4 w-4" />
        </ControlButton>
        <ControlButton label="Step back (←)" onClick={player.stepBack} disabled={inactive || player.atStart}>
          <StepBack className="h-4 w-4" />
        </ControlButton>
        <button
          type="button"
          onClick={player.toggle}
          disabled={inactive}
          title={player.playing ? 'Pause (Space)' : 'Play (Space)'}
          aria-label={player.playing ? 'Pause' : 'Play'}
          className={cn(
            'mx-0.5 flex h-8 w-10 items-center justify-center rounded-md border transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-30',
            player.playing
              ? 'border-amber-400/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25'
              : 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25'
          )}
        >
          {player.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <ControlButton label="Step forward (→)" onClick={player.stepForward} disabled={inactive || player.atEnd}>
          <StepForward className="h-4 w-4" />
        </ControlButton>
        <ControlButton label="Jump to the last step (End)" onClick={player.toEnd} disabled={inactive || player.atEnd}>
          <SkipForward className="h-4 w-4" />
        </ControlButton>
      </div>

      <div className="flex min-w-[8rem] flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, player.total - 1)}
          step={1}
          value={player.index}
          onChange={(event) => player.seek(Number(event.target.value))}
          disabled={inactive}
          aria-label="Timeline"
          className="min-w-0 flex-1 accent-cyan-400 disabled:opacity-30"
        />
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/60">
          {player.total === 0 ? '0 / 0' : `${player.index + 1} / ${player.total}`}
        </span>
      </div>

      <SpeedSlider kind={speedKind} level={speedLevel} onChange={onSpeedChange} />
    </div>
  );
}

export const PlaybackControls = memo(PlaybackControlsInner);
