// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Learning Trend
// 30-day line of overall mastery (replayed from the answer log) with
// each day's answer accuracy on the same 0–100% axis. Days without
// answers leave accuracy blank; the tooltip adds the day's card count.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useMemo, type ReactNode } from 'react';
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
import { ChartSpline } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';
import { useLearningStore } from '@/stores/useLearningStore';
import { useNow } from '@/components/widgets/hooks';
import { utcDayKey } from '@/components/widgets/widget-data';
import { CHART, INK } from '@/styles/tokens';
import { ACCURACY_COLOR, MASTERY_COLOR, TREND_DAYS, buildLearningTrend, type TrendRow } from './learning-stats';

interface ChartRow extends TrendRow {
  label: string;
}

/** Shape of what Recharts hands a custom tooltip (only the fields read here). */
interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-fg-muted">{label}</span>
      <span className="tabular ml-auto pl-4 font-mono text-fg">{value}</span>
    </div>
  );
}

function renderTooltip({ active, payload }: ChartTooltipProps): ReactNode {
  const row = payload?.[0]?.payload as ChartRow | undefined;
  if (!active || !row) return null;
  return (
    <div className="glass-popover min-w-40 rounded-control px-3 py-2 font-sans text-xs">
      <p className="hud-label mb-1.5">{format(parseISO(row.key), 'EEE d MMM')}</p>
      <div className="space-y-1">
        <TooltipRow color={MASTERY_COLOR} label="Mastery" value={row.mastery === null ? '—' : `${row.mastery}%`} />
        <TooltipRow color={ACCURACY_COLOR} label="Accuracy" value={row.accuracy === null ? '—' : `${row.accuracy}%`} />
      </div>
      <p className="mt-1.5 border-t border-line pt-1.5 text-fg-subtle">
        {row.answered === 0 ? 'No cards answered' : `${row.answered} ${row.answered === 1 ? 'card' : 'cards'} answered`}
      </p>
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function LearningTrendInner() {
  const fillId = `trend-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
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

  // Mark the latest mastery reading (a lone point would otherwise be invisible).
  const lastMastery = rows.reduce((last, r, i) => (r.mastery !== null ? i : last), -1);
  const renderMasteryEnd = (props: { cx?: number; cy?: number; index?: number }) =>
    props.index === lastMastery && props.cx != null && props.cy != null ? (
      <circle key="mastery-end" cx={props.cx} cy={props.cy} r={4} fill={MASTERY_COLOR} stroke={INK[950]} strokeWidth={2} />
    ) : (
      <g key={`mastery-dot-${props.index}`} />
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
    <Card
      eyebrow={`Last ${TREND_DAYS} days`}
      title="Learning trend"
      description={
        summary.last === null
          ? 'No cards yet'
          : `Mastery ${Math.round(summary.last)}%${
              summary.delta ? ` (${summary.delta > 0 ? '+' : ''}${summary.delta} pts)` : ''
            } · ${summary.answered} ${summary.answered === 1 ? 'card' : 'cards'} answered`
      }
      role="region"
      aria-label={`Mastery and accuracy over the last ${TREND_DAYS} days`}
      className="h-full"
      actions={
        summary.answered > 0 ? (
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            <LegendKey color={MASTERY_COLOR} label="Mastery" />
            <LegendKey color={ACCURACY_COLOR} label="Accuracy" />
          </div>
        ) : undefined
      }
    >
      {summary.answered === 0 ? (
        <EmptyState
          size="sm"
          icon={ChartSpline}
          title="No answers yet"
          description={`Nothing answered in the last ${TREND_DAYS} days. Review a few cards and your trend starts here.`}
        />
      ) : (
        <>
          <div className="h-44 w-full font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MASTERY_COLOR} stopOpacity={CHART.areaOpacity} />
                    <stop offset="100%" stopColor={MASTERY_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis
                  dataKey="label"
                  tick={CHART.tick}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  tickMargin={6}
                />
                <YAxis
                  width={44}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tick={CHART.tick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip content={renderTooltip} cursor={{ stroke: CHART.cursor, strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="mastery"
                  name="Mastery"
                  stroke={MASTERY_COLOR}
                  strokeWidth={CHART.strokeWidth}
                  fill={`url(#${fillId})`}
                  dot={renderMasteryEnd}
                  activeDot={{ r: 4, stroke: INK[950], strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Accuracy"
                  stroke={ACCURACY_COLOR}
                  strokeWidth={CHART.strokeWidth}
                  connectNulls
                  dot={{ r: 2.5, fill: ACCURACY_COLOR, stroke: INK[950], strokeWidth: 1.5 }}
                  activeDot={{ r: 4, stroke: INK[950], strokeWidth: 2 }}
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
    </Card>
  );
}

export const LearningTrend = memo(LearningTrendInner);
