// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Sorting Visualizer
// Bubble, selection, insertion, merge, quick and heap sort as an
// animated bar chart with step-through playback
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo } from 'react';
import type { SortAlgorithmId } from '@/types/algo';
import { SORTING_ALGORITHMS } from '@/data/algorithms';
import { buildSortFrames } from '@/lib/algorithms/sorting';
import { DEFAULT_SPEED, SPEED_LEVELS } from '@/lib/algorithms/constants';
import { useAlgoLabStore } from './useAlgoLabStore';
import { handlePlaybackKeys, usePlayback } from './usePlayback';
import { PlaybackControls } from './PlaybackControls';
import { CodePanel } from './CodePanel';
import { ComplexityCard } from './ComplexityCard';
import { DatasetControls } from './DatasetControls';
import { SortBars, SortLegend } from './SortBars';
import { LabLayout, Stat, StepMessage } from './LabLayout';

/** Above this speed, height transitions would lag behind the frames. */
const ANIMATE_BELOW_STEPS_PER_SECOND = 40;

function SortingVisualizerInner({ algorithm }: { algorithm: SortAlgorithmId }) {
  const meta = SORTING_ALGORITHMS[algorithm];
  const dataset = useAlgoLabStore((s) => s.dataset);
  const speedLevel = useAlgoLabStore((s) => s.speeds.sort);
  const setSpeed = useAlgoLabStore((s) => s.setSpeed);
  const recordRun = useAlgoLabStore((s) => s.recordRun);

  const frames = useMemo(() => buildSortFrames(algorithm, dataset), [algorithm, dataset]);
  const maxValue = useMemo(() => dataset.reduce((max, value) => Math.max(max, value), 1), [dataset]);

  const stepsPerSecond = SPEED_LEVELS[speedLevel] ?? SPEED_LEVELS[DEFAULT_SPEED.sort];
  const player = usePlayback(frames, {
    stepsPerSecond,
    onComplete: () => recordRun('sort', algorithm),
  });
  const frame = player.frame ?? frames[0];
  const moveLabel = meta.moveLabel ?? 'swaps';

  return (
    <LabLayout
      title={meta.name}
      subtitle={meta.description}
      category="sorting"
      toolbar={<DatasetControls />}
      stageLabel="Sorting bars. Space plays or pauses; arrow keys step."
      stage={
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1">
            <SortBars
              frame={frame}
              maxValue={maxValue}
              animate={stepsPerSecond < ANIMATE_BELOW_STEPS_PER_SECOND}
            />
          </div>
          <SortLegend />
        </div>
      }
      footer={
        <>
          <StepMessage message={frame.message}>
            <Stat label="comparisons" value={frame.comparisons} className="text-yellow-200" />
            <Stat label={moveLabel} value={frame.moves} className="text-rose-300" />
          </StepMessage>
          <PlaybackControls
            player={player}
            speedKind="sort"
            speedLevel={speedLevel}
            onSpeedChange={(level) => setSpeed('sort', level)}
          />
        </>
      }
      code={<CodePanel title={meta.name} lines={meta.pseudocode} activeLine={frame.line} />}
      details={<ComplexityCard meta={meta} />}
      onStageKeyDown={(event) => handlePlaybackKeys(event, player)}
    />
  );
}

export const SortingVisualizer = memo(SortingVisualizerInner);
