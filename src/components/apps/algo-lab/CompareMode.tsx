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
import { Flag, Lightbulb, Pause, Play, RotateCcw, Timer, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlgoSortFrame, SortAlgorithmId } from '@/types/algo';
import { SORTING_ALGORITHMS } from '@/data/algorithms';
import { SORT_ALGORITHM_IDS, buildSortFrames, frameOps } from '@/lib/algorithms/sorting';
import { DEFAULT_SPEED, RACE_SPEED_LEVELS } from '@/lib/algorithms/constants';
import { useAlgoLabStore } from './useAlgoLabStore';
import { DatasetControls } from './DatasetControls';
import { SortBars } from './SortBars';
import { ComplexityCard } from './ComplexityCard';
import { LabLayout, StepMessage } from './LabLayout';
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
  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-col rounded-lg border bg-black/25 transition-colors duration-300',
        outcome === 'winner'
          ? 'border-emerald-400/50 shadow-[0_0_24px_rgba(52,211,153,0.15)]'
          : outcome === 'tie'
            ? 'border-cyan-400/40'
            : 'border-white/10'
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
          {side === 'left' ? 'Lane A' : 'Lane B'}
        </span>
        <select
          value={algorithm}
          onChange={(event) => {
            const chosen = SORT_ALGORITHM_IDS.find((id) => id === event.target.value);
            if (chosen) onAlgorithmChange(side, chosen);
          }}
          disabled={locked}
          aria-label={`${side === 'left' ? 'Lane A' : 'Lane B'} algorithm`}
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-1.5 py-0.5 text-[12px] text-white outline-none focus:border-cyan-400/60 disabled:opacity-60"
        >
          {SORT_ALGORITHM_IDS.map((id) => (
            <option key={id} value={id} className="bg-[#0f1220]">
              {SORTING_ALGORITHMS[id].name}
            </option>
          ))}
        </select>
        <AnimatePresence>
          {finished && (
            <motion.span
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full border px-2 py-px text-[10px] font-semibold',
                outcome === 'winner'
                  ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                  : 'border-white/15 bg-white/5 text-white/70'
              )}
            >
              {outcome === 'winner' ? <Trophy className="h-3 w-3" aria-hidden /> : <Flag className="h-3 w-3" aria-hidden />}
              {outcome === 'winner' ? 'Winner' : outcome === 'tie' ? 'Tie' : 'Finished'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="min-h-0 flex-1">
        <SortBars frame={frame} maxValue={maxValue} animate={animate} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-white/10 px-2.5 py-1.5 font-mono text-[11px] text-white/60 @md/stage:grid-cols-4">
        <span className="flex items-center gap-1">
          <Timer className="h-3 w-3" aria-hidden />
          <span className={cn('tabular-nums', finished ? 'text-emerald-300' : 'text-white/90')}>{formatClock(timeMs)}</span>
        </span>
        <span>
          steps <span className="tabular-nums text-white/90">{frame.comparisons + frame.moves}</span>
        </span>
        <span>
          cmp <span className="tabular-nums text-yellow-200">{frame.comparisons}</span>
        </span>
        <span>
          {meta.moveLabel === 'writes' ? 'writes' : 'swaps'} <span className="tabular-nums text-rose-300">{frame.moves}</span>
        </span>
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

  const footer = (
    <>
      <StepMessage message={message}>
        {finished && winner && (
          <span className="flex items-center gap-1 text-emerald-300">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            {formatClock(race.finish[winner] ?? 0)}
          </span>
        )}
      </StepMessage>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
        <div className="flex items-center gap-1">
          {race.status === 'running' ? (
            <button
              type="button"
              onClick={pause}
              className="flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-[12px] text-amber-100 hover:bg-amber-400/25"
            >
              <Pause className="h-3.5 w-3.5" aria-hidden />
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              className="flex items-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-400/15 px-3 py-1.5 text-[12px] text-cyan-100 hover:bg-cyan-400/25"
            >
              <Play className="h-3.5 w-3.5" aria-hidden />
              {race.status === 'paused' ? 'Resume' : finished ? 'Race again' : 'Start race'}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            disabled={race.status === 'ready'}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </button>
        </div>
        <span className="font-mono text-[11px] text-white/55">
          race clock <span className="tabular-nums text-white/85">{formatClock(race.elapsed)}</span>
        </span>
        <div className="ml-auto">
          <SpeedSlider kind="race" level={speedLevel} onChange={(level) => setSpeed('race', level)} />
        </div>
      </div>
    </>
  );

  return (
    <LabLayout
      title="Compare Race"
      subtitle="Two sorts race on the same data at the same pace: every comparison, swap or write costs one tick. Fewer operations finish first."
      category="sorting"
      badgeLabel="Race"
      toolbar={<DatasetControls />}
      stageLabel="Race lanes"
      stage={
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-2 gap-2 p-2 @xl/stage:grid-cols-2 @xl/stage:grid-rows-1">
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
      footer={footer}
      code={
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
          <ComplexityCard meta={leftMeta} compact />
          <ComplexityCard meta={rightMeta} compact />
        </div>
      }
      details={
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/55">
            <Lightbulb className="h-3 w-3" aria-hidden />
            Races worth trying
          </h4>
          <ul className="space-y-1 text-[11.5px] leading-snug text-white/70">
            {RACE_TIPS.map((tip) => (
              <li key={tip} className="flex gap-1.5">
                <span className="text-cyan-400" aria-hidden>
                  ▸
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
}

export const CompareMode = memo(CompareModeInner);
