// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Forge Utilities
// Stage styling, week/time maths and formatting for the Forge UI
// ═══════════════════════════════════════════════════════════

import type { ForgeActiveTimer, ForgeSession, ForgeStage } from '@/types/project-forge';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;

// ─── Stage styling (full class strings so Tailwind can see them) ───

export interface StageMeta {
  label: string;
  hint: string;
  dot: string;
  text: string;
  border: string;
  chip: string;
  bar: string;
  activeButton: string;
}

export const STAGE_META: Record<ForgeStage, StageMeta> = {
  ideas: {
    label: 'Ideas',
    hint: 'Sparks worth exploring',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-400/20',
    chip: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
    bar: 'bg-amber-400',
    activeButton: 'bg-amber-400/20 text-amber-200 border-amber-400/50',
  },
  building: {
    label: 'Building',
    hint: 'In the forge right now',
    dot: 'bg-cyan-400',
    text: 'text-cyan-300',
    border: 'border-cyan-400/20',
    chip: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/25',
    bar: 'bg-cyan-400',
    activeButton: 'bg-cyan-400/20 text-cyan-200 border-cyan-400/50',
  },
  testing: {
    label: 'Testing',
    hint: 'Polish, QA and feedback',
    dot: 'bg-violet-400',
    text: 'text-violet-300',
    border: 'border-violet-400/20',
    chip: 'bg-violet-400/10 text-violet-300 border-violet-400/25',
    bar: 'bg-violet-400',
    activeButton: 'bg-violet-400/20 text-violet-200 border-violet-400/50',
  },
  shipped: {
    label: 'Shipped',
    hint: 'Live in the world',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-400/20',
    chip: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25',
    bar: 'bg-emerald-400',
    activeButton: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/50',
  },
};

// ─── Droppable column ids ───

const COLUMN_PREFIX = 'forge-column:';

export function columnId(stage: ForgeStage): string {
  return `${COLUMN_PREFIX}${stage}`;
}

export function stageOfColumnId(id: string): ForgeStage | null {
  if (!id.startsWith(COLUMN_PREFIX)) return null;
  const stage = id.slice(COLUMN_PREFIX.length);
  return stage === 'ideas' || stage === 'building' || stage === 'testing' || stage === 'shipped'
    ? stage
    : null;
}

// ─── Calendar maths (local time) ───

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Monday 00:00 local time of the week containing ts. */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - sinceMonday);
  return d.getTime();
}

export function overlapMs(start: number, end: number, from: number, to: number): number {
  return Math.max(0, Math.min(end, to) - Math.max(start, from));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD in local time (for <input type="date">). */
export function localDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local midnight of a YYYY-MM-DD key, or null when invalid. */
export function parseDateKey(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// ─── Time aggregation ───

export interface TimeSpan {
  projectId: string;
  start: number;
  end: number;
}

/** Logged sessions plus the live timer (up to `now`). */
export function collectSpans(
  sessions: readonly ForgeSession[],
  timer: ForgeActiveTimer | null,
  now: number
): TimeSpan[] {
  const spans: TimeSpan[] = sessions.map((s) => ({ projectId: s.projectId, start: s.start, end: s.end }));
  if (timer && now > timer.startedAt) {
    spans.push({ projectId: timer.projectId, start: timer.startedAt, end: now });
  }
  return spans;
}

export interface WeekSummary {
  weekStart: number;
  total: number;
  byProject: Record<string, number>;
  /** Monday … Sunday. */
  byDay: number[];
}

export function summarizeWeek(
  sessions: readonly ForgeSession[],
  timer: ForgeActiveTimer | null,
  now: number
): WeekSummary {
  const weekStart = startOfWeek(now);
  const bounds = Array.from({ length: 8 }, (_, i) => addDays(weekStart, i));
  const byDay = [0, 0, 0, 0, 0, 0, 0];
  const byProject: Record<string, number> = {};
  let total = 0;
  for (const span of collectSpans(sessions, timer, now)) {
    const inWeek = overlapMs(span.start, span.end, bounds[0], bounds[7]);
    if (inWeek <= 0) continue;
    total += inWeek;
    byProject[span.projectId] = (byProject[span.projectId] ?? 0) + inWeek;
    for (let i = 0; i < 7; i += 1) {
      byDay[i] += overlapMs(span.start, span.end, bounds[i], bounds[i + 1]);
    }
  }
  return { weekStart, total, byProject, byDay };
}

/** All-time tracked ms per project (archived + logged + live). */
export function totalsByProject(
  sessions: readonly ForgeSession[],
  archivedMs: Readonly<Record<string, number>>,
  timer: ForgeActiveTimer | null,
  now: number
): Record<string, number> {
  const out: Record<string, number> = { ...archivedMs };
  for (const span of collectSpans(sessions, timer, now)) {
    out[span.projectId] = (out[span.projectId] ?? 0) + (span.end - span.start);
  }
  return out;
}

export function lastSessionEnd(sessions: readonly ForgeSession[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) out[s.projectId] = Math.max(out[s.projectId] ?? 0, s.end);
  return out;
}

// ─── Formatting ───

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds === 0) return '0m';
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Compact hours, e.g. "3.5h". */
export function formatHours(ms: number): string {
  const hours = ms / HOUR_MS;
  if (hours <= 0) return '0h';
  if (hours < 0.1) return '<0.1h';
  return `${hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10}h`;
}

export function formatRelative(ts: number, now: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return 'never';
  const seconds = Math.floor(Math.max(0, now - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatDayLabel(ts: number, now: number): string {
  const day = startOfDay(ts);
  const today = startOfDay(now);
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatTimeOfDay(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatCalendarDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** URL without protocol, www. and trailing slash, for compact display. */
export function displayUrl(url: string): string {
  return url
    .replace(/^mailto:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

// ─── Celebration ───

/** Confetti burst when a project ships (skipped for reduced-motion users). */
export function celebrateShip(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  import('canvas-confetti')
    .then(({ default: confetti }) => {
      confetti({
        particleCount: 110,
        spread: 75,
        startVelocity: 42,
        origin: { x: 0.5, y: 0.65 },
        zIndex: 9000,
        colors: ['#00f0ff', '#7b61ff', '#00e676', '#ffab00', '#ff3d71'],
        disableForReducedMotion: true,
      });
    })
    .catch(() => {
      // Decorative only.
    });
}
