// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Compare Mode
// Two sorting algorithms race on the same dataset. A shared race
// clock advances one operation (comparison, swap or write) per tick
// for both lanes; each lane has its own timer and step counter and
// the one needing fewer operations wins.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Flag, Lightbulb, Pause, Play, RotateCcw, Timer, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Select, Toolbar, ToolbarSeparator } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import type { AlgoSortFrame, SortAlgorithmId } from '@/types/algo';
import { SORTING_ALGORITHMS } from '@/data/algorithms';
import { SORT_ALGORITHM_IDS, buildSortFrames, frameOps } from '@/lib/algorithms/sorting';
import { DEFAULT_SPEED, RACE_SPEED_LEVELS } from '@/lib/algorithms/constants';
import { useAlgoLabStore } from './useAlgoLabStore';
import { useDatasetControls } from './DatasetControls';
import { SortBars } from './SortBars';
import { ComplexityCard } from './ComplexityCard';
import { LabLayout, Stat, StepMessage } from './LabLayout';
import { SpeedSlider } from './PlaybackControls';

type RaceStatus = 'ready' | 'running' | 'paused' | 'finished';
type Side = 'left' | 'right';

interface RaceState {
  status: RaceStatus;
  /** Operations elapsed on the shared race clock. */
  clock: number;
  /** Milliseconds of racing so far (pauses excluded). */
  elapsed: number;
  /** Milliseconds at which each lane finished. */
  finish: Record<Side, number | null>;
}

const READY: RaceState = { status: 'ready', clock: 0, elapsed: 0, finish: { left: null, right: null } };

/** Above this rate, bar height transitions would lag behind the race. */
const ANIMATE_BELOW_OPS_PER_SECOND = 60;

const RACE_TIPS: string[] = [
  'Nearly sorted: insertion sort needs about n steps and beats merge sort.',
  'Reversed: quick sort with a last-element pivot degrades to O(n²).',
  'Few unique: duplicates unbalance the Lomuto partition and slow quick sort down.',
  'Selection sort always makes n(n − 1)/2 comparisons, whatever the input.',
];

/** Largest frame index whose cumulative operation count is ≤ clock. */
function frameIndexAt(ops: readonly number[], clock: number): number {
  let lo = 0;
  let hi = ops.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ops[mid] <= clock) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function formatClock(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

interface LaneProps {
  side: Side;
  algorithm: SortAlgorithmId;
  frame: AlgoSortFrame;
  maxValue: number;
  animate: boolean;
  timeMs: number;
  finished: boolean;
  outcome: 'winner' | 'loser' | 'tie' | null;
  locked: boolean;
  onAlgorithmChange: (side: Side, algorithm: SortAlgorithmId) => void;
}

const ALGORITHM_OPTIONS = SORT_ALGORITHM_IDS.map((id) => ({ value: id, label: SORTING_ALGORITHMS[id].name }));

function RaceLaneInner({
  side,
  algorithm,
  frame,
  maxValue,
  animate,
  timeMs,
  finished,
  outcome,
  locked,
  onAlgorithmChange,
}: LaneProps) {
  const meta = SORTING_ALGORITHMS[algorithm];
  const laneName = side === 'left' ? 'Lane A' : 'Lane B';
  return (
    <div
      className={cn(
        'relative isolate flex min-h-0 min-w-0 flex-col overflow-hidden rounded-card border bg-ink-950/45 transition-[border-color,box-shadow] duration-260 ease-out-quint',
        outcome === 'winner'
          ? 'border-success/45 shadow-[0_0_28px_-10px_var(--color-success)]'
          : outcome === 'tie'
            ? 'border-accent/35'
            : 'border-line'
      )}
    >
      {outcome === 'winner' && (
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-success/[0.07] to-transparent to-50%" />
      )}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="hud-label shrink-0">{laneName}</span>
        <div className="min-w-0 flex-1">
          <Select
            size="sm"
            value={algorithm}
            onValueChange={(value) => {
              const chosen = SORT_ALGORITHM_IDS.find((id) => id === value);
              if (chosen) onAlgorithmChange(side, chosen);
            }}
            disabled={locked}
            aria-label={`${laneName} algorithm`}
            options={ALGORITHM_OPTIONS}
          />
        </div>
        <AnimatePresence>
          {finished && (
            <motion.span
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION.small}
              className="flex shrink-0"
            >
              <Badge
                tone={outcome === 'winner' ? 'success' : outcome === 'tie' ? 'accent' : 'neutral'}
                icon={outcome === 'winner' ? Trophy : Flag}
              >
                {outcome === 'winner' ? 'Winner' : outcome === 'tie' ? 'Tie' : 'Finished'}
              </Badge>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-0 flex-1">
        <SortBars frame={frame} maxValue={maxValue} animate={animate} />
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 border-t border-line px-3 py-2 @2xl/stage:grid-cols-4">
        <span className="flex items-center gap-1.5">
          <Timer size={14} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
          <span className={cn('tabular font-mono text-ui font-medium', finished ? 'text-success' : 'text-fg')}>
            {formatClock(timeMs)}
          </span>
        </span>
        <Stat label="steps" value={frame.comparisons + frame.moves} />
        <Stat label="cmp" value={frame.comparisons} tone="warning" />
        <Stat label={meta.moveLabel === 'writes' ? 'writes' : 'swaps'} value={frame.moves} tone="danger" />
      </div>
    </div>
  );
}

const RaceLane = memo(RaceLaneInner);

function CompareModeInner() {
  const dataset = useAlgoLabStore((s) => s.dataset);
  const left = useAlgoLabStore((s) => s.raceLeft);
  const right = useAlgoLabStore((s) => s.raceRight);
  const setRaceSide = useAlgoLabStore((s) => s.setRaceSide);
  const speedLevel = useAlgoLabStore((s) => s.speeds.race);
  const setSpeed = useAlgoLabStore((s) => s.setSpeed);
  const recordRace = useAlgoLabStore((s) => s.recordRace);
  const datasetControls = useDatasetControls();

  const leftFrames = useMemo(() => buildSortFrames(left, dataset), [left, dataset]);
  const rightFrames = useMemo(() => buildSortFrames(right, dataset), [right, dataset]);
  const leftOps = useMemo(() => leftFrames.map(frameOps), [leftFrames]);
  const rightOps = useMemo(() => rightFrames.map(frameOps), [rightFrames]);
  const maxValue = useMemo(() => dataset.reduce((max, value) => Math.max(max, value), 1), [dataset]);
  const leftTotal = leftOps[leftOps.length - 1] ?? 0;
  const rightTotal = rightOps[rightOps.length - 1] ?? 0;

  const [race, setRace] = useState<RaceState>(READY);
  // New contenders or a new dataset put the race back on the starting line.
  const [raceInputs, setRaceInputs] = useState({ leftFrames, rightFrames });
  if (raceInputs.leftFrames !== leftFrames || raceInputs.rightFrames !== rightFrames) {
    setRaceInputs({ leftFrames, rightFrames });
    setRace(READY);
  }

  const opsPerSecond = RACE_SPEED_LEVELS[speedLevel] ?? RACE_SPEED_LEVELS[DEFAULT_SPEED.race];

  const raceRef = useRef(race);
  const finishRef = useRef(() => recordRace(left, right));
  useEffect(() => {
    raceRef.current = race;
    finishRef.current = () => recordRace(left, right);
  });

  useEffect(() => {
    if (race.status !== 'running') return;
    let raf = 0;
    let previous: number | null = null;

    const tick = (now: number) => {
      if (previous === null) previous = now;
      const dt = Math.min(now - previous, 250);
      previous = now;
      const current = raceRef.current;
      const clock = current.clock + (dt * opsPerSecond) / 1000;
      const elapsed = current.elapsed + dt;
      // Exact moment the clock passed `total`, so lane timers are precise.
      const crossedAt = (total: number) => Math.max(0, elapsed - ((clock - total) / opsPerSecond) * 1000);
      const leftAt = current.finish.left ?? (clock >= leftTotal ? crossedAt(leftTotal) : null);
      const rightAt = current.finish.right ?? (clock >= rightTotal ? crossedAt(rightTotal) : null);

      if (leftAt !== null && rightAt !== null) {
        const done: RaceState = {
          status: 'finished',
          clock: Math.max(leftTotal, rightTotal),
          elapsed: Math.max(leftAt, rightAt),
          finish: { left: leftAt, right: rightAt },
        };
        raceRef.current = done;
        setRace(done);
        finishRef.current();
        return;
      }

      const next: RaceState = { status: 'running', clock, elapsed, finish: { left: leftAt, right: rightAt } };
      raceRef.current = next;
      setRace(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [race.status, opsPerSecond, leftTotal, rightTotal]);

  const start = () => {
    if (race.status === 'paused') setRace({ ...raceRef.current, status: 'running' });
    else setRace({ ...READY, status: 'running' });
  };
  const pause = () => setRace({ ...raceRef.current, status: 'paused' });
  const reset = () => setRace(READY);

  const leftFrame = leftFrames[frameIndexAt(leftOps, race.clock)];
  const rightFrame = rightFrames[frameIndexAt(rightOps, race.clock)];
  const leftMeta = SORTING_ALGORITHMS[left];
  const rightMeta = SORTING_ALGORITHMS[right];
  const finished = race.status === 'finished';
  const tie = leftTotal === rightTotal;
  const winner: Side | null = finished && !tie ? (leftTotal < rightTotal ? 'left' : 'right') : null;
  const outcomeFor = (side: Side): LaneProps['outcome'] => {
    if (!finished) return null;
    if (tie) return 'tie';
    return winner === side ? 'winner' : 'loser';
  };
  const animate = opsPerSecond < ANIMATE_BELOW_OPS_PER_SECOND;
  const locked = race.status === 'running';

  let message: string;
  if (finished) {
    if (tie) {
      message = `Dead heat: both finished in ${leftTotal} steps on ${dataset.length} values.`;
    } else {
      const winMeta = winner === 'left' ? leftMeta : rightMeta;
      const winSteps = Math.min(leftTotal, rightTotal);
      const loseSteps = Math.max(leftTotal, rightTotal);
      const ratio = winSteps > 0 ? (loseSteps / winSteps).toFixed(1) : '∞';
      message = `${winMeta.name} wins: ${winSteps} steps vs ${loseSteps} (${ratio}× fewer operations) on ${dataset.length} values.`;
    }
  } else if (race.status === 'running') {
    message = `Racing at ${opsPerSecond} operations per second per lane...`;
  } else if (race.status === 'paused') {
    message = 'Race paused. Press Resume to continue.';
  } else {
    message = `${leftMeta.name} vs ${rightMeta.name} on the same ${dataset.length} values. Press Start race.`;
  }

  const narration = (
    <StepMessage message={message}>
      {finished && winner && (
        <span className="flex items-center gap-1.5 text-success">
          <Trophy size={14} strokeWidth={1.75} aria-hidden />
          <span className="tabular font-mono text-ui font-medium">{formatClock(race.finish[winner] ?? 0)}</span>
        </span>
      )}
    </StepMessage>
  );

  const transport = (
    <Toolbar border="top" aria-label="Race controls" className="bg-ink-950/30">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {race.status === 'running' ? (
          <Button size="sm" variant="secondary" leadingIcon={Pause} onClick={pause}>
            Pause
          </Button>
        ) : (
          <Button size="sm" variant="primary" leadingIcon={Play} onClick={start}>
            {race.status === 'paused' ? 'Resume' : finished ? 'Race again' : 'Start race'}
          </Button>
        )}
        <Button size="sm" variant="ghost" leadingIcon={RotateCcw} onClick={reset} disabled={race.status === 'ready'}>
          Reset
        </Button>
        <ToolbarSeparator />
        <span className="flex items-baseline gap-1.5">
          <span className="hud-label">Race clock</span>
          <span className="tabular font-mono text-ui font-medium text-fg">{formatClock(race.elapsed)}</span>
        </span>
        <div className="ml-auto hidden items-center @xl/lab:flex">
          <SpeedSlider kind="race" level={speedLevel} onChange={(level) => setSpeed('race', level)} />
        </div>
      </div>
    </Toolbar>
  );

  return (
    <LabLayout
      view="compare"
      title="Compare Race"
      category="sorting"
      badgeLabel="Race"
      keyHints={false}
      toolbar={datasetControls.toolbar}
      subbar={datasetControls.subbar}
      stageLabel="Race lanes"
      bareStage
      stage={
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-2 gap-3 @xl/stage:grid-cols-2 @xl/stage:grid-rows-1">
          <RaceLane
            side="left"
            algorithm={left}
            frame={leftFrame}
            maxValue={maxValue}
            animate={animate}
            timeMs={race.finish.left ?? race.elapsed}
            finished={race.finish.left !== null}
            outcome={outcomeFor('left')}
            locked={locked}
            onAlgorithmChange={setRaceSide}
          />
          <RaceLane
            side="right"
            algorithm={right}
            frame={rightFrame}
            maxValue={maxValue}
            animate={animate}
            timeMs={race.finish.right ?? race.elapsed}
            finished={race.finish.right !== null}
            outcome={outcomeFor('right')}
            locked={locked}
            onAlgorithmChange={setRaceSide}
          />
        </div>
      }
      narration={narration}
      aside={
        <>
          <ComplexityCard meta={leftMeta} compact />
          <ComplexityCard meta={rightMeta} compact />
          <section className="glass-panel rounded-card p-3" aria-label="Races worth trying">
            <h4 className="hud-label mb-2 flex items-center gap-1.5 px-1">
              <Lightbulb size={14} strokeWidth={1.75} aria-hidden />
              Races worth trying
            </h4>
            <ul className="space-y-1.5 px-1">
              {RACE_TIPS.map((tip) => (
                <li key={tip} className="flex gap-1.5 text-ui text-fg-muted">
                  <ChevronRight size={14} strokeWidth={1.75} className="mt-[3px] shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0 select-text">{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      }
      playback={transport}
    />
  );
}

export const CompareMode = memo(CompareModeInner);
