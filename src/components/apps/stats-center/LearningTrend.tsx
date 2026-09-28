// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Learning Trend
// 30-day line of overall mastery (replayed from the answer log) with
// each day's answer accuracy on the same 0–100% axis. Days without
// answers leave accuracy blank; the tooltip adds the day's card count.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, type ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { useLearningStore } from '@/stores/useLearningStore';
import { useNow } from '@/components/widgets/hooks';
import { utcDayKey } from '@/components/widgets/widget-data';
import { ACCURACY_COLOR, MASTERY_COLOR, TREND_DAYS, buildLearningTrend, type TrendRow } from './learning-stats';

const SURFACE = '#0c0c12';
const AXIS_TICK = { fill: '#8888a0', fontSize: 10 };

interface ChartRow extends TrendRow {
  label: string;
}

/** Shape of what Recharts hands a custom tooltip (only the fields read here). */
interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

function renderTooltip({ active, payload }: ChartTooltipProps): ReactNode {
  const row = payload?.[0]?.payload as ChartRow | undefined;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[rgba(10,10,16,0.94)] px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-semibold text-white">{format(parseISO(row.key), 'EEE, d MMM')}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-white/85">
        <span className="h-0.5 w-3 rounded" style={{ background: MASTERY_COLOR }} />
        <span className="font-mono font-semibold">{row.mastery === null ? '—' : `${row.mastery}%`}</span>
        <span className="text-white/50">mastery</span>
      </p>
      <p className="flex items-center gap-1.5 text-white/85">
        <span className="h-0.5 w-3 rounded" style={{ background: ACCURACY_COLOR }} />
        <span className="font-mono font-semibold">{row.accuracy === null ? '—' : `${row.accuracy}%`}</span>
        <span className="text-white/50">accuracy</span>
      </p>
      <p className="mt-0.5 text-[11px] text-white/50">
        {row.answered === 0 ? 'No cards answered' : `${row.answered} ${row.answered === 1 ? 'card' : 'cards'} answered`}
      </p>
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}

function LearningTrendInner() {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const attempts = useLearningStore((s) => s.attempts);
  const now = useNow(60_000);
  const todayKey = utcDayKey(now);

  const rows = useMemo<ChartRow[]>(
    () =>
      buildLearningTrend(decks, reviews, attempts, todayKey).map((r) => ({
        ...r,
        label: format(parseISO(r.key), 'd MMM'),
      })),
    [decks, reviews, attempts, todayKey]
  );

  const summary = useMemo(() => {
    let answered = 0;
    let first: number | null = null;
    for (const r of rows) {
      answered += r.answered;
      if (first === null && r.mastery !== null) first = r.mastery;
    }
    const last = rows.length > 0 ? rows[rows.length - 1].mastery : null;
    const delta = first !== null && last !== null ? Math.round(last - first) : null;
    return { answered, last, delta };
  }, [rows]);

  return (
    <section
      className="rounded-xl border border-white/10 bg-black/20 p-4"
      aria-label={`Mastery and accuracy over the last ${TREND_DAYS} days`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-white/60">Learning trend · {TREND_DAYS} days</p>
          <p className="text-[11px] text-white/45">
            {summary.last === null
              ? 'No cards yet'
              : `Mastery ${Math.round(summary.last)}%${
                  summary.delta ? ` (${summary.delta > 0 ? '+' : ''}${summary.delta} pts)` : ''
                } · ${summary.answered} ${summary.answered === 1 ? 'card' : 'cards'} answered`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/55">
          <LegendKey color={MASTERY_COLOR} label="Mastery" />
          <LegendKey color={ACCURACY_COLOR} label="Daily accuracy" />
        </div>
      </div>

      {summary.answered === 0 ? (
        <p className="py-8 text-center text-[11px] text-white/40">
          No answers in the last {TREND_DAYS} days. Review a few cards and your trend starts here.
        </p>
      ) : (
        <>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={AXIS_TICK}
                  stroke="rgba(255,255,255,0.1)"
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  width={36}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={AXIS_TICK}
                  stroke="rgba(255,255,255,0.1)"
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip content={renderTooltip} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                <Area
                  type="monotone"
                  dataKey="mastery"
                  name="Mastery"
                  stroke={MASTERY_COLOR}
                  strokeWidth={2}
                  fill={MASTERY_COLOR}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Daily accuracy"
                  stroke={ACCURACY_COLOR}
                  strokeWidth={2}
                  connectNulls
                  dot={{ r: 4, fill: ACCURACY_COLOR, stroke: SURFACE, strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Same numbers without hovering, for screen readers. */}
          <table className="sr-only">
            <caption>Daily mastery, accuracy and cards answered</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Mastery</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Cards answered</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.answered > 0 || r.key === todayKey)
                .map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    <td>{r.mastery === null ? 'none' : `${r.mastery}%`}</td>
                    <td>{r.accuracy === null ? 'none' : `${r.accuracy}%`}</td>
                    <td>{r.answered}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

export const LearningTrend = memo(LearningTrendInner);
