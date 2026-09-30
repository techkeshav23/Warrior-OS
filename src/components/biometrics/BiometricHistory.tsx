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
import { ChartLine, ShieldCheck, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBiometricsStore, localDayKey } from '@/stores/useBiometricsStore';
import { CHART, FG, INK, STATUS, VIZ } from '@/styles/tokens';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatTile } from '@/components/ui/StatTile';
import { recordHistoryCheck } from './achievements';
import type { BiometricSnapshot, BiometricState } from '@/types/biometrics';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEK_DAYS = 7;
const HEATMAP_DAYS = 14;

// Emphasis encoding: today and the 7-day average take the first two
// chart colours; earlier days are recessive context lines.
const TODAY_COLOR = VIZ[0];
const AVERAGE_COLOR = VIZ[1];
const CONTEXT_COLOR = FG.faint;

interface ChartTooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | null;
  color?: string;
}

/** armor-popover tooltip: hud-label title, swatch · name · value rows. */
function FocusTooltip({
  active,
  payload,
  label,
  dayLabels,
}: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  dayLabels: Map<string, string>;
}) {
  const rows = (payload ?? []).filter((p) => p.value !== null && p.value !== undefined);
  if (!active || rows.length === 0) return null;
  return (
    <div className="armor-popover px-3 py-2 text-xs [--cut:6px]">
      <div className="hud-label mb-1">{label}</div>
      {rows.map((p) => {
        const key = String(p.dataKey ?? p.name ?? '');
        const name = key === 'avg' ? '7-day average' : dayLabels.get(key) ?? key;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-fg-muted">{name}</span>
            <span className="tabular ml-auto pl-3 text-fg">{String(p.value)}%</span>
          </div>
        );
      })}
    </div>
  );
}

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

/** Focus intensity: the success hue from faint to full. */
function focusCellColor(v: number): string {
  const pct = Math.round(14 + (Math.max(0, Math.min(100, v)) / 100) * 86);
  return `color-mix(in srgb, ${STATUS.success} ${pct}%, transparent)`;
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
    <div className={cn('flex flex-col gap-5', className)}>
      {/* ── Headline ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">Your focus pattern this week</h3>
          <p className="mt-0.5 text-ui text-fg-muted">
            {hasWeekData
              ? summary.peak && summary.low
                ? `Your focus peaks around ${hourLabel(summary.peak.hour)} (${summary.peak.focus}%) and dips around ${hourLabel(summary.low.hour)} (${summary.low.focus}%).`
                : `${summary.hoursTracked} tracked hour${summary.hoursTracked === 1 ? '' : 's'} this week — patterns appear after a few more.`
              : 'No readings this week yet — type for a minute and your pattern starts here.'}
          </p>
        </div>
        <SegmentedControl
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
          ]}
          className="shrink-0"
        />
      </div>

      {/* ── Week averages (stat tiles) ── */}
      <div className="grid grid-cols-4 gap-3">
        {(
          [
            ['Energy', 'energy', 'bg-plasma-400'],
            ['Focus', 'focus', 'bg-success'],
            ['Fatigue', 'fatigue', 'bg-warning'],
            ['Stress', 'stress', 'bg-danger'],
          ] as const
        ).map(([label, key, swatch]) => (
          <StatTile
            key={key}
            size="sm"
            label={label}
            value={summary.averages ? summary.averages[key] : '—'}
            unit={summary.averages ? '%' : undefined}
            icon={<span aria-hidden className={cn('block size-2 rounded-full', swatch)} />}
            className="p-3"
          />
        ))}
      </div>

      {view === 'chart' ? (
        <>
          {/* ── Weekly focus lines ── */}
          <Card
            eyebrow="Focus by hour"
            title="Last 7 days"
            actions={
              hasWeekData ? (
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-fg-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: TODAY_COLOR }} />
                    Today
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: AVERAGE_COLOR }} />
                    7-day average
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: CONTEXT_COLOR }} />
                    Earlier days
                  </span>
                </div>
              ) : undefined
            }
          >
            {hasWeekData ? (
              <div className="h-56 w-full font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="hour" tick={CHART.tick} interval={2} axisLine={false} tickLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={CHART.tick}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                      width={48}
                    />
                    <Tooltip
                      cursor={{ stroke: CHART.cursor, strokeWidth: 1 }}
                      content={<FocusTooltip dayLabels={dayLabels} />}
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
                          strokeOpacity={0.7}
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
                      strokeWidth={CHART.strokeWidth}
                      dot={false}
                      activeDot={{ r: 4, stroke: INK[950], strokeWidth: 2 }}
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
                          strokeWidth={CHART.strokeWidth}
                          dot={false}
                          activeDot={{ r: 4, stroke: INK[950], strokeWidth: 2 }}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                size="sm"
                icon={ChartLine}
                title="No readings this week"
                description="Type for a minute in any app and your hourly focus shows up here."
              />
            )}
          </Card>

          {/* ── Heatmap ── */}
          <Card
            eyebrow="Focus heatmap"
            title={`Last ${HEATMAP_DAYS} days × hour`}
            actions={
              <div className="flex items-center gap-1 font-mono text-2xs text-fg-subtle">
                Low
                {[10, 30, 50, 70, 90].map((v) => (
                  <span key={v} className="inline-block size-2.5 rounded-[2px]" style={{ background: focusCellColor(v) }} />
                ))}
                High
              </div>
            }
          >
            <div className="scrollbar-thin overflow-x-auto font-mono">
              <div className="inline-block">
                <div className="mb-1 flex pl-16">
                  {HOURS.filter((h) => h % 3 === 0).map((h) => (
                    <div key={h} className="text-2xs text-fg-subtle" style={{ width: 45, minWidth: 45 }}>
                      {hourLabel(h)}
                    </div>
                  ))}
                </div>
                {heat.map(({ day, cells }) => (
                  <div key={day.key} className="mb-[3px] flex items-center">
                    <div className={cn('w-16 shrink-0 pr-2 text-2xs', day.isToday ? 'text-fg' : 'text-fg-subtle')}>
                      {day.isToday ? 'Today' : day.label}
                    </div>
                    <div className="flex gap-[3px]">
                      {cells.map((v, h) => (
                        <div
                          key={h}
                          title={`${day.label} ${hourLabel(h)}: ${v < 0 ? 'no data' : `${v}% focus`}`}
                          className="size-3 rounded-[2px]"
                          style={{ background: v < 0 ? 'var(--color-surface-hover)' : focusCellColor(v) }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      ) : (
        <div className="armor-panel overflow-hidden [--cut:8px]">
          <table className="w-full text-left text-ui">
            <thead className="bg-surface-2">
              <tr>
                {['Day', 'Hours tracked', 'Avg focus', 'Avg energy', 'Peak focus hour'].map((h) => (
                  <th key={h} scope="col" className="hud-label h-9 px-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular text-fg-muted">
              {table.map((row) => (
                <tr key={row.key} className="h-10 border-t border-line transition-colors duration-120 hover:bg-surface-hover">
                  <td className="px-3 text-fg">{row.label}</td>
                  <td className="px-3 font-mono">{row.hours}</td>
                  <td className="px-3 font-mono">{row.focus === null ? '—' : `${row.focus}%`}</td>
                  <td className="px-3 font-mono">{row.energy === null ? '—' : `${row.energy}%`}</td>
                  <td className="px-3 font-mono">{row.peakHour === null ? '—' : hourLabel(row.peakHour)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Storage + privacy note ── */}
      <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
        <p className="flex min-w-0 items-start gap-2 text-xs text-fg-subtle">
          <ShieldCheck size={14} strokeWidth={1.75} aria-hidden className="mt-px shrink-0 text-success" />
          <span>
            Hourly averages of typing timing — no keys or text. Kept on this device (and on your own server when
            owner sync is on).
          </span>
        </p>
        {history.length > 0 &&
          (confirmClear ? (
            <span className="flex shrink-0 items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                Keep
              </Button>
              <Button
                variant="danger"
                size="sm"
                leadingIcon={Trash2}
                onClick={() => {
                  clearHistory();
                  setConfirmClear(false);
                }}
              >
                Clear all
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" leadingIcon={Trash2} className="shrink-0" onClick={() => setConfirmClear(true)}>
              Clear history
            </Button>
          ))}
      </div>
    </div>
  );
}

export const BiometricHistory = memo(BiometricHistoryInner);
