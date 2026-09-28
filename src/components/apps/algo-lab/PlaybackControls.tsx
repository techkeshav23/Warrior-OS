// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Playback Controls (FORGE HUD)
// Transport toolbar pinned under the stage: reset, step back,
// play/pause (the primary control), step forward, jump to end,
// timeline scrubber and a speed slider.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type ReactNode } from 'react';
import { Gauge, Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';
import { IconButton, Slider, Toolbar, ToolbarGroup, ToolbarSeparator } from '@/components/ui';
import { formatSpeed, speedLevelsFor, type SpeedKind } from '@/lib/algorithms/constants';
import type { PlaybackControls as PlaybackApi } from './usePlayback';

export function ControlButton({
  label,
  onClick,
  disabled,
  shortcut,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
  children: ReactNode;
}) {
  return (
    <IconButton
      icon={children}
      aria-label={label}
      tooltip
      shortcut={shortcut}
      size="sm"
      onClick={onClick}
      disabled={disabled}
    />
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
    <div className="flex shrink-0 items-center gap-2" title="Playback speed">
      <Gauge size={16} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
      <div className="w-20">
        <Slider
          value={safeLevel}
          onValueChange={onChange}
          min={0}
          max={levels.length - 1}
          step={1}
          aria-label="Playback speed"
          aria-valuetext={formatSpeed(levels[safeLevel], kind)}
        />
      </div>
      <span className="tabular w-[4.75rem] shrink-0 font-mono text-xs text-fg-muted">{formatSpeed(levels[safeLevel], kind)}</span>
    </div>
  );
}

interface PlaybackControlsProps {
  player: PlaybackApi;
  speedKind: SpeedKind;
  speedLevel: number;
  onSpeedChange: (level: number) => void;
  disabled?: boolean;
  /**
   * primary = accent-filled play button (the view's main action);
   * soft = tinted, when the toolbar above owns the primary action.
   */
  emphasis?: 'primary' | 'soft';
}

function PlaybackControlsInner({
  player,
  speedKind,
  speedLevel,
  onSpeedChange,
  disabled = false,
  emphasis = 'primary',
}: PlaybackControlsProps) {
  const inactive = disabled || player.total <= 1;
  const playLabel = player.playing ? 'Pause' : 'Play';
  const pct = player.total > 1 ? (player.index / (player.total - 1)) * 100 : 0;
  return (
    <Toolbar border="top" aria-label="Playback" className="bg-ink-950/30">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ToolbarGroup>
          <IconButton
            icon={SkipBack}
            aria-label="Reset to first step"
            tooltip
            shortcut="Home"
            size="sm"
            onClick={player.reset}
            disabled={inactive || player.atStart}
          />
          <IconButton
            icon={StepBack}
            aria-label="Step back"
            tooltip
            shortcut="←"
            size="sm"
            onClick={player.stepBack}
            disabled={inactive || player.atStart}
          />
          <IconButton
            icon={player.playing ? Pause : Play}
            aria-label={playLabel}
            tooltip
            shortcut="Space"
            size="md"
            variant={!inactive && emphasis === 'primary' ? 'primary' : 'secondary'}
            // soft emphasis = the kit's accent-soft "active" look, without the pressed semantics
            active={!inactive && emphasis === 'soft' ? true : undefined}
            aria-pressed={undefined}
            onClick={player.toggle}
            disabled={inactive}
            className="mx-1"
          />
          <IconButton
            icon={StepForward}
            aria-label="Step forward"
            tooltip
            shortcut="→"
            size="sm"
            onClick={player.stepForward}
            disabled={inactive || player.atEnd}
          />
          <IconButton
            icon={SkipForward}
            aria-label="Jump to the last step"
            tooltip
            shortcut="End"
            size="sm"
            onClick={player.toEnd}
            disabled={inactive || player.atEnd}
          />
        </ToolbarGroup>

        <ToolbarSeparator />

        <div className="flex min-w-[7rem] flex-1 items-center gap-3">
          <Slider
            value={player.index}
            onValueChange={player.seek}
            min={0}
            max={Math.max(0, player.total - 1)}
            step={1}
            disabled={inactive}
            aria-label="Timeline"
            aria-valuetext={player.total === 0 ? 'No steps' : `Step ${player.index + 1} of ${player.total}`}
            wrapperClassName="min-w-0 flex-1"
          />
          <span className="tabular shrink-0 font-mono text-xs text-fg-muted" title={`${Math.round(pct)}% through`}>
            <span className="text-fg">{player.total === 0 ? 0 : player.index + 1}</span>
            <span className="text-fg-subtle"> / {player.total}</span>
          </span>
        </div>

        <div className="hidden items-center @xl/lab:flex">
          <ToolbarSeparator />
          <SpeedSlider kind={speedKind} level={speedLevel} onChange={onSpeedChange} />
        </div>
      </div>
    </Toolbar>
  );
}

export const PlaybackControls = memo(PlaybackControlsInner);
