// ═══════════════════════════════════════════════════════════
// WARRIOR OS — BiometricHistory
// Charts persisted biometric snapshots (localStorage via store).
// - Line chart: average focus per hour of day.
// - Heatmap: day (rows) × hour (cols) focus intensity.
// Firestore is not configured, so history is purely local.
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
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import type { BiometricSnapshot } from '@/types/biometrics';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hourLabel(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}

/** Average a channel over snapshots. */
function avg(snaps: BiometricSnapshot[], key: 'focus' | 'energy' | 'stress' | 'fatigue') {
  if (snaps.length === 0) return 0;
  return Math.round(
    snaps.reduce((a, s) => a + s.state[key], 0) / snaps.length
  );
}

function focusColor(v: number): string {
  // v: 0-100 → transparent-ish → strong green.
  const alpha = 0.08 + (v / 100) * 0.85;
  return `rgba(0, 230, 118, ${alpha.toFixed(3)})`;
}

function BiometricHistoryInner({ className }: { className?: string }) {
  const history = useBiometricsStore((s) => s.history);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Line chart data: avg focus per hour-of-day across all history ──
  const focusByHour = useMemo(() => {
    return HOURS.map((h) => {
      const snaps = history.filter((s) => s.hour === h);
      return {
        hour: hourLabel(h),
        focus: avg(snaps, 'focus'),
        energy: avg(snaps, 'energy'),
      };
    });
  }, [history]);

  // ── Heatmap grid: [day-of-week][hour] = avg focus ──
  const heatmap = useMemo(() => {
    const grid: number[][] = DAY_LABELS.map(() => HOURS.map(() => -1));
    const buckets: BiometricSnapshot[][][] = DAY_LABELS.map(() =>
      HOURS.map(() => [])
    );
    for (const snap of history) {
      const dow = new Date(snap.timestamp).getDay();
      buckets[dow][snap.hour].push(snap);
    }
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const b = buckets[d][h];
        grid[d][h] = b.length ? avg(b, 'focus') : -1;
      }
    }
    return grid;
  }, [history]);

  const peakHour = useMemo(() => {
    let best = -1;
    let bestVal = -1;
    for (const row of focusByHour) {
      if (row.focus > bestVal) {
        bestVal = row.focus;
        best = focusByHour.indexOf(row);
      }
    }
    return best >= 0 && bestVal > 0 ? focusByHour[best].hour : null;
  }, [focusByHour]);

  if (!mounted) return null;

  const hasData = history.length > 0;

  return (
    <div className={cn('flex h-full flex-col gap-4 overflow-y-auto p-4', className)}>
      <div>
        <h2 className="font-display text-sm font-semibold text-text-primary">
          Your Focus Pattern
        </h2>
        <p className="text-xs text-text-secondary">
          {hasData
            ? peakHour
              ? `Focus peaks around ${peakHour}. ${history.length} snapshots recorded.`
              : `${history.length} snapshots recorded.`
            : 'No data yet — keep typing and your patterns will appear here.'}
        </p>
      </div>

      {/* ── Line chart ── */}
      <div className="glass-dark glass-border rounded-lg p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-text-muted">
          Focus &amp; Energy by hour of day
        </p>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={focusByHour} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="hour"
                tick={{ fill: '#8888a0', fontSize: 10 }}
                interval={2}
                stroke="rgba(255,255,255,0.1)"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#8888a0', fontSize: 10 }}
                stroke="rgba(255,255,255,0.1)"
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(10,10,16,0.9)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#e4e4ef',
                }}
              />
              <Line
                type="monotone"
                dataKey="focus"
                stroke="#00e676"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="Focus"
              />
              <Line
                type="monotone"
                dataKey="energy"
                stroke="#00f0ff"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="Energy"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Heatmap ── */}
      <div className="glass-dark glass-border rounded-lg p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-text-muted">
          Focus heatmap (day × hour)
        </p>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* hour axis */}
            <div className="mb-1 flex pl-8">
              {HOURS.filter((h) => h % 3 === 0).map((h) => (
                <div
                  key={h}
                  className="text-[9px] text-text-muted"
                  style={{ width: 12 * 3, minWidth: 12 * 3 }}
                >
                  {hourLabel(h)}
                </div>
              ))}
            </div>
            {DAY_LABELS.map((label, d) => (
              <div key={label} className="flex items-center">
                <div className="w-8 shrink-0 text-[9px] text-text-muted">{label}</div>
                <div className="flex gap-[2px]">
                  {HOURS.map((h) => {
                    const v = heatmap[d][h];
                    return (
                      <div
                        key={h}
                        title={`${label} ${hourLabel(h)}: ${v < 0 ? 'no data' : `${v}% focus`}`}
                        className="h-3 w-2.5 rounded-[2px]"
                        style={{
                          background: v < 0 ? 'rgba(255,255,255,0.04)' : focusColor(v),
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const BiometricHistory = memo(BiometricHistoryInner);
