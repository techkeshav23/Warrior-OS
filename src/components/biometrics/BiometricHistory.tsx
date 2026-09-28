// ═══════════════════════════════════════════════════════════
// WARRIOR OS — BiometricHistory
// Charts the persisted hourly biometric aggregates:
//  - "Your Focus Pattern This Week": x = hour of day, y = focus,
//    one line per day (today emphasised, earlier days as context)
//    plus the 7-day average; peak / low focus hours called out.
//  - Heatmap: last 14 days × 24 hours, focus intensity.
//  - Table view twin of the same data.
// History lives on this device only (localStorage, hourly averages
// of typing timing) — nothing is uploaded.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useBiometricsStore, localDayKey } from '@/stores/useBiometricsStore';
import { recordHistoryCheck } from './achievements';
import type { BiometricSnapshot, BiometricState } from '@/types/biometrics';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEK_DAYS = 7;
const HEATMAP_DAYS = 14;

// Emphasis encoding: today in the focus hue, the 7-day average in the
// secondary accent, earlier days as recessive context lines.
const TODAY_COLOR = '#00e676';
const AVERAGE_COLOR = '#7b61ff';
const CONTEXT_COLOR = 'rgba(136, 136, 160, 0.45)';

function hourLabel(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}

interface DayInfo {
  key: string; // YYYY-MM-DD
  label: string; // "Mon 22"
  isToday: boolean;
}

function lastDays(now: number, count: number): DayInfo[] {
  const base = new Date(now);
  const out: DayInfo[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    out.push({
      key: localDayKey(d),
      label: `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}`,
      isToday: i === 0,
    });
  }
  return out;
}

function bucketKey(day: string, hour: number): string {
  return `${day}|${hour}`;
}

function snapDay(snap: BiometricSnapshot): string {
  return snap.day ?? localDayKey(new Date(snap.timestamp));
}

function focusCellColor(v: number): string {
  const alpha = 0.14 + (Math.max(0, Math.min(100, v)) / 100) * 0.86;
  return `rgba(0, 230, 118, ${alpha.toFixed(3)})`;
}

type ChartRow = { hour: string; h: number } & Record<string, number | string | null>;

interface WeekSummary {
  averages: BiometricState | null;
  hoursTracked: number;
  peak: { hour: number; focus: number } | null;
  low: { hour: number; focus: number } | null;
}

interface TableRow {
  key: string;
  label: string;
  hours: number;
  focus: number | null;
  energy: number | null;
  peakHour: number | null;
}

function BiometricHistoryInner({ className }: { className?: string }) {
  const history = useBiometricsStore((s) => s.hourly);
  const clearHistory = useBiometricsStore((s) => s.clearHistory);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [confirmClear, setConfirmClear] = useState(false);

  // Viewing the history counts as "checking your biometrics" today.
  useEffect(() => {
    recordHistoryCheck();
  }, []);

  // Keep "today" fresh while the panel stays open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const data = useMemo(() => {
    const index = new Map<string, BiometricSnapshot>();
    for (const snap of history) index.set(bucketKey(snapDay(snap), snap.hour), snap);

    const week = lastDays(now, WEEK_DAYS);
    const heatDays = lastDays(now, HEATMAP_DAYS).reverse(); // newest first

    // Chart rows: one per hour, one column per day + the weighted average.
    const rows: ChartRow[] = HOURS.map((h) => {
      const row: ChartRow = { hour: hourLabel(h), h };
      let sum = 0;
      let weight = 0;
      for (const day of week) {
        const snap = index.get(bucketKey(day.key, h));
        row[day.key] = snap ? Math.round(snap.state.focus) : null;
        if (snap) {
          const w = snap.samples ?? 1;
          sum += snap.state.focus * w;
          weight += w;
        }
      }
      row.avg = weight > 0 ? Math.round(sum / weight) : null;
      return row;
    });

    // Week summary.
    const totals = { energy: 0, focus: 0, fatigue: 0, stress: 0 };
    let totalWeight = 0;
    let hoursTracked = 0;
    const weekKeys = new Set(week.map((d) => d.key));
    for (const snap of history) {
      if (!weekKeys.has(snapDay(snap))) continue;
      const w = snap.samples ?? 1;
      hoursTracked++;
      totalWeight += w;
      totals.energy += snap.state.energy * w;
      totals.focus += snap.state.focus * w;
      totals.fatigue += snap.state.fatigue * w;
      totals.stress += snap.state.stress * w;
    }
    const withAvg = rows.filter((r) => typeof r.avg === 'number');
    let peak: WeekSummary['peak'] = null;
    let low: WeekSummary['low'] = null;
    if (withAvg.length >= 3) {
      for (const r of withAvg) {
        const v = r.avg as number;
        if (!peak || v > peak.focus) peak = { hour: r.h, focus: v };
        if (!low || v < low.focus) low = { hour: r.h, focus: v };
      }
    }
    const summary: WeekSummary = {
      averages:
        totalWeight > 0
          ? {
              energy: Math.round(totals.energy / totalWeight),
              focus: Math.round(totals.focus / totalWeight),
              fatigue: Math.round(totals.fatigue / totalWeight),
              stress: Math.round(totals.stress / totalWeight),
            }
          : null,
      hoursTracked,
      peak,
      low,
    };

    // Heatmap grid (newest day first).
    const heat = heatDays.map((day) => ({
      day,
      cells: HOURS.map((h) => {
        const snap = index.get(bucketKey(day.key, h));
        return snap ? Math.round(snap.state.focus) : -1;
      }),
    }));

    // Table twin: per day of the week.
    const table: TableRow[] = [...week].reverse().map((day) => {
      let fSum = 0;
      let eSum = 0;
      let w = 0;
      let hours = 0;
      let best: { hour: number; focus: number } | null = null;
      for (const h of HOURS) {
        const snap = index.get(bucketKey(day.key, h));
        if (!snap) continue;
        const sw = snap.samples ?? 1;
        hours++;
        w += sw;
        fSum += snap.state.focus * sw;
        eSum += snap.state.energy * sw;
        if (!best || snap.state.focus > best.focus) best = { hour: h, focus: snap.state.focus };
      }
      return {
        key: day.key,
        label: day.isToday ? `Today (${day.label})` : day.label,
        hours,
        focus: w > 0 ? Math.round(fSum / w) : null,
        energy: w > 0 ? Math.round(eSum / w) : null,
        peakHour: best ? best.hour : null,
      };
    });

    return { week, rows, summary, heat, table };
  }, [history, now]);

  const { week, rows, summary, heat, table } = data;
  const hasWeekData = summary.hoursTracked > 0;
  const dayLabels = new Map(week.map((d) => [d.key, d.isToday ? 'Today' : d.label]));

  return (
    <div className={cn('flex h-full flex-col gap-4 overflow-y-auto p-4', className)}>
      {/* ── Headline ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Your Focus Pattern This Week
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            {hasWeekData
              ? summary.peak && summary.low
                ? `Your focus peaks around ${hourLabel(summary.peak.hour)} (${summary.peak.focus}%) and dips around ${hourLabel(summary.low.hour)} (${summary.low.focus}%).`
                : `${summary.hoursTracked} tracked hour${summary.hoursTracked === 1 ? '' : 's'} this week — patterns appear after a few more.`
              : 'No readings this week yet — type for a minute and your pattern starts here.'}
          </p>
        </div>
        <div className="flex shrink-0 rounded-md border border-white/10 bg-white/5 p-0.5 text-[10px]">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded px-2 py-0.5 capitalize transition-colors',
                view === v ? 'bg-white/10 text-text-primary' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Week averages (stat tiles) ── */}
      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ['Energy', 'energy', 'bg-accent-primary'],
            ['Focus', 'focus', 'bg-accent-success'],
            ['Fatigue', 'fatigue', 'bg-accent-warning'],
            ['Stress', 'stress', 'bg-accent-danger'],
          ] as const
        ).map(([label, key, swatch]) => (
          <div key={key} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-text-muted">
              <span className={cn('h-1.5 w-1.5 rounded-full', swatch)} aria-hidden />
              {label}
            </div>
            <div className="mt-0.5 text-lg font-semibold text-text-primary">
              {summary.averages ? `${summary.averages[key]}%` : '—'}
            </div>
          </div>
        ))}
      </div>

      {view === 'chart' ? (
        <>
          {/* ── Weekly focus lines ── */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: TODAY_COLOR }} />
                Today
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: AVERAGE_COLOR }} />
                7-day average
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: CONTEXT_COLOR }} />
                Earlier days
              </span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: '#8888a0', fontSize: 10 }}
                    interval={2}
                    stroke="rgba(255,255,255,0.1)"
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tick={{ fill: '#8888a0', fontSize: 10 }}
                    stroke="rgba(255,255,255,0.1)"
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                    contentStyle={{
                      background: 'rgba(10,10,16,0.94)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      fontSize: 11,
                      color: '#e4e4ef',
                    }}
                    labelStyle={{ color: '#e4e4ef' }}
                    itemStyle={{ color: '#e4e4ef', padding: 0 }}
                    formatter={(value, name) => [
                      value === null || value === undefined ? '—' : `${String(value)}%`,
                      name === 'avg' ? '7-day average' : dayLabels.get(String(name)) ?? String(name),
                    ]}
                  />
                  {week
                    .filter((d) => !d.isToday)
                    .map((d) => (
                      <Line
                        key={d.key}
                        type="monotone"
                        dataKey={d.key}
                        name={d.key}
                        stroke={CONTEXT_COLOR}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  <Line
                    type="monotone"
                    dataKey="avg"
                    name="avg"
                    stroke={AVERAGE_COLOR}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                  {week
                    .filter((d) => d.isToday)
                    .map((d) => (
                      <Line
                        key={d.key}
                        type="monotone"
                        dataKey={d.key}
                        name={d.key}
                        stroke={TODAY_COLOR}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Heatmap ── */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-text-muted">
                Focus heatmap · last {HEATMAP_DAYS} days × hour
              </p>
              <div className="flex items-center gap-1 text-[9px] text-text-muted">
                Low
                {[10, 30, 50, 70, 90].map((v) => (
                  <span
                    key={v}
                    className="inline-block h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: focusCellColor(v) }}
                  />
                ))}
                High
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="inline-block">
                <div className="mb-1 flex pl-14">
                  {HOURS.filter((h) => h % 3 === 0).map((h) => (
                    <div key={h} className="text-[9px] text-text-muted" style={{ width: 42, minWidth: 42 }}>
                      {hourLabel(h)}
                    </div>
                  ))}
                </div>
                {heat.map(({ day, cells }) => (
                  <div key={day.key} className="mb-[2px] flex items-center">
                    <div className="w-14 shrink-0 pr-1 text-[9px] text-text-muted">
                      {day.isToday ? 'Today' : day.label}
                    </div>
                    <div className="flex gap-[2px]">
                      {cells.map((v, h) => (
                        <div
                          key={h}
                          title={`${day.label} ${hourLabel(h)}: ${v < 0 ? 'no data' : `${v}% focus`}`}
                          className="h-3 w-3 rounded-[2px]"
                          style={{ background: v < 0 ? 'rgba(255,255,255,0.04)' : focusCellColor(v) }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-white/5 text-text-muted">
              <tr>
                <th className="px-3 py-1.5 font-medium">Day</th>
                <th className="px-3 py-1.5 font-medium">Hours tracked</th>
                <th className="px-3 py-1.5 font-medium">Avg focus</th>
                <th className="px-3 py-1.5 font-medium">Avg energy</th>
                <th className="px-3 py-1.5 font-medium">Peak focus hour</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-text-secondary">
              {table.map((row) => (
                <tr key={row.key} className="border-t border-white/5">
                  <td className="px-3 py-1.5 text-text-primary">{row.label}</td>
                  <td className="px-3 py-1.5">{row.hours}</td>
                  <td className="px-3 py-1.5">{row.focus === null ? '—' : `${row.focus}%`}</td>
                  <td className="px-3 py-1.5">{row.energy === null ? '—' : `${row.energy}%`}</td>
                  <td className="px-3 py-1.5">{row.peakHour === null ? '—' : hourLabel(row.peakHour)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Storage + privacy note ── */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-[10px] text-text-muted">
        <span>
          Stored on this device only as hourly averages of typing timing — no keys or text.
          Cloud sync isn&apos;t configured.
        </span>
        {history.length > 0 &&
          (confirmClear ? (
            <span className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  clearHistory();
                  setConfirmClear(false);
                }}
                className="rounded border border-accent-danger/40 bg-accent-danger/10 px-2 py-0.5 text-text-primary"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded px-2 py-0.5 text-text-secondary hover:text-text-primary"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="shrink-0 rounded px-2 py-0.5 text-text-secondary hover:bg-white/5 hover:text-text-primary"
            >
              Clear history
            </button>
          ))}
      </div>
    </div>
  );
}

export const BiometricHistory = memo(BiometricHistoryInner);
