// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Time Tracker
// One running timer at a time (survives reloads: only startedAt
// is stored), manual time logging, hours per project this week
// and a session log. Compact mode for a single project.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useMemo, useState, type FormEvent } from 'react';
import { History, Play, Plus, Square, Timer, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import type { ForgeActiveTimer, ForgeProject, ForgeSession, ForgeStage } from '@/types/project-forge';
import { ConfirmButton } from './ConfirmButton';
import { RunningClock } from './RunningClock';
import { useNow } from './useNow';
import {
  HOUR_MS,
  MINUTE_MS,
  STAGE_META,
  addDays,
  formatDayLabel,
  formatDuration,
  formatHours,
  formatTimeOfDay,
  localDateKey,
  parseDateKey,
  startOfDay,
  summarizeWeek,
  totalsByProject,
  type WeekSummary,
} from './forge-utils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LONG_RUN_MS = 8 * HOUR_MS;
const MANUAL_MAX_HOURS = 16;
const PAGE_SIZE = 40;

const LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-white/45';
const INPUT =
  'w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white/90 outline-none placeholder:text-white/30 focus:border-cyan-400/50';
const SELECT =
  'w-full rounded-md border border-white/10 bg-[#0d121b] px-2 py-1.5 text-xs text-white/90 outline-none focus:border-cyan-400/50';

const STAGE_RANK: Record<ForgeStage, number> = { building: 0, testing: 1, ideas: 2, shipped: 3 };

function sortForPicker(projects: readonly ForgeProject[]): ForgeProject[] {
  return [...projects].sort(
    (a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage] || a.name.localeCompare(b.name)
  );
}

// ─── Manual logging ───

interface ManualLogFormProps {
  projects: ForgeProject[];
  /** Locks the form to one project (project details). */
  fixedProjectId?: string;
}

function ManualLogFormInner({ projects, fixedProjectId }: ManualLogFormProps) {
  const logManualSession = useProjectForgeStore((s) => s.logManualSession);
  const uid = useId();
  const [today] = useState(() => localDateKey(Date.now()));
  const [pickedId, setPickedId] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const projectId =
    fixedProjectId ?? (projects.some((p) => p.id === pickedId) ? pickedId : projects[0]?.id ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const h = Number.parseInt(hours, 10);
    const m = Number.parseInt(minutes, 10);
    const totalMinutes = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    if (!projectId) {
      setMessage({ ok: false, text: 'Create a project first.' });
      return;
    }
    if (totalMinutes < 1 || totalMinutes > MANUAL_MAX_HOURS * 60) {
      setMessage({ ok: false, text: `Enter between 1 minute and ${MANUAL_MAX_HOURS} hours.` });
      return;
    }
    const dayStart = parseDateKey(date);
    const nowMs = Date.now();
    if (dayStart === null) {
      setMessage({ ok: false, text: 'Pick a valid date.' });
      return;
    }
    if (dayStart > nowMs) {
      setMessage({ ok: false, text: 'That date is in the future.' });
      return;
    }
    const duration = totalMinutes * MINUTE_MS;
    // Today: the block ends now. Earlier days: it starts at 09:00 (earlier if it would pass midnight).
    const end =
      dayStart === startOfDay(nowMs)
        ? nowMs
        : Math.min(dayStart + 9 * HOUR_MS + duration, addDays(dayStart, 1) - 1);
    const session = logManualSession({ projectId, start: end - duration, end, note });
    if (session) {
      setMessage({ ok: true, text: `Logged ${formatDuration(duration)}.` });
      setNote('');
    } else {
      setMessage({ ok: false, text: 'Could not log that session.' });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        {!fixedProjectId && (
          <div className="flex min-w-[150px] flex-1 flex-col gap-1">
            <label htmlFor={`${uid}-project`} className={LABEL}>
              Project
            </label>
            <select
              id={`${uid}-project`}
              value={projectId}
              onChange={(e) => setPickedId(e.target.value)}
              className={SELECT}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex w-16 flex-col gap-1">
          <label htmlFor={`${uid}-hours`} className={LABEL}>
            Hours
          </label>
          <input
            id={`${uid}-hours`}
            type="number"
            min={0}
            max={MANUAL_MAX_HOURS}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="flex w-16 flex-col gap-1">
          <label htmlFor={`${uid}-minutes`} className={LABEL}>
            Min
          </label>
          <input
            id={`${uid}-minutes`}
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className={INPUT}
          />
        </div>
        <div className="flex w-[136px] flex-col gap-1">
          <label htmlFor={`${uid}-date`} className={LABEL}>
            Date
          </label>
          <input
            id={`${uid}-date`}
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Note (optional)"
          aria-label="Session note"
          className={cn(INPUT, 'min-w-0 flex-1')}
        />
        <button
          type="submit"
          className="flex shrink-0 items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20"
        >
          <Plus className="h-3.5 w-3.5" /> Log time
        </button>
      </div>
      {message && (
        <p role="status" className={cn('text-[11px]', message.ok ? 'text-emerald-300' : 'text-red-300')}>
          {message.text}
        </p>
      )}
    </form>
  );
}

const ManualLogForm = memo(ManualLogFormInner);

// ─── Session log ───

interface SessionListProps {
  /** Already filtered and sorted newest first. */
  sessions: ForgeSession[];
  projectsById: Record<string, ForgeProject>;
  /** Minute-resolution clock for day labels. */
  now: number;
  showProject: boolean;
  onOpenProject?: (id: string) => void;
}

function SessionListInner({ sessions, projectsById, now, showProject, onOpenProject }: SessionListProps) {
  const deleteSession = useProjectForgeStore((s) => s.deleteSession);

  if (sessions.length === 0) {
    return <p className="py-3 text-center text-[11px] text-white/35">No sessions logged yet.</p>;
  }

  const groups: { day: number; total: number; items: ForgeSession[] }[] = [];
  for (const session of sessions) {
    const day = startOfDay(session.start);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(session);
      last.total += session.end - session.start;
    } else {
      groups.push({ day, total: session.end - session.start, items: [session] });
    }
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.day}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {formatDayLabel(group.day, now)} · {formatDuration(group.total)}
          </p>
          <ul className="space-y-1">
            {group.items.map((session) => {
              const project = projectsById[session.projectId];
              return (
                <li
                  key={session.id}
                  className="group flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5 text-xs"
                >
                  <span className="shrink-0 font-mono tabular-nums text-white/50">
                    {formatTimeOfDay(session.start)}–{formatTimeOfDay(session.end)}
                  </span>
                  <span className="w-14 shrink-0 font-semibold tabular-nums text-white/85">
                    {formatDuration(session.end - session.start)}
                  </span>
                  {showProject && project && (
                    <button
                      type="button"
                      onClick={() => onOpenProject?.(project.id)}
                      className="flex min-w-0 max-w-[40%] items-center gap-1.5 text-white/70 hover:text-cyan-300"
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STAGE_META[project.stage].dot)} />
                      <span className="truncate">{project.name}</span>
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-white/45" title={session.note || undefined}>
                    {session.note}
                  </span>
                  {session.manual && (
                    <span className="rounded bg-white/[0.06] px-1 text-[9px] uppercase tracking-wide text-white/40">
                      manual
                    </span>
                  )}
                  <ConfirmButton
                    label="Delete session"
                    onConfirm={() => deleteSession(session.id)}
                    armedChildren="Delete?"
                    className="rounded p-0.5 text-white/30 opacity-0 transition-opacity hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                    armedClassName="rounded bg-red-500/20 px-1.5 text-[10px] font-semibold text-red-200"
                  >
                    <X className="h-3 w-3" />
                  </ConfirmButton>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

const SessionList = memo(SessionListInner);

// ─── Timer controls ───

interface TimerCardProps {
  project: ForgeProject | null;
  activeTimer: ForgeActiveTimer | null;
  runningProject: ForgeProject | null;
  now: number;
  onOpenProject?: (id: string) => void;
}

/** Running timer readout with note, stop and discard. */
function RunningTimer({ activeTimer, runningProject, now, onOpenProject }: Omit<TimerCardProps, 'project'> & { activeTimer: ForgeActiveTimer }) {
  const stopTimer = useProjectForgeStore((s) => s.stopTimer);
  const discardTimer = useProjectForgeStore((s) => s.discardTimer);
  const setTimerNote = useProjectForgeStore((s) => s.setTimerNote);
  const elapsed = now - activeTimer.startedAt;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-400" />
        {runningProject && onOpenProject ? (
          <button
            type="button"
            onClick={() => onOpenProject(runningProject.id)}
            className="min-w-0 truncate text-sm font-semibold text-cyan-200 hover:underline"
          >
            {runningProject.name}
          </button>
        ) : (
          <span className="min-w-0 truncate text-sm font-semibold text-cyan-200">
            {runningProject?.name ?? 'Timer running'}
          </span>
        )}
      </div>
      <RunningClock startedAt={activeTimer.startedAt} className="block text-3xl font-semibold text-white" />
      <input
        value={activeTimer.note}
        onChange={(e) => setTimerNote(e.target.value)}
        maxLength={200}
        placeholder="What are you working on? Saved with the session."
        aria-label="Timer note"
        className={INPUT}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => stopTimer()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-cyan-300"
        >
          <Square className="h-3.5 w-3.5" /> Stop and log
        </button>
        <ConfirmButton
          label="Discard timer without logging"
          onConfirm={discardTimer}
          armedChildren="Discard?"
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:border-red-400/40 hover:text-red-300"
          armedClassName="rounded-md border border-red-400/60 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100"
        >
          Discard
        </ConfirmButton>
      </div>
      {elapsed > LONG_RUN_MS && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Running for {formatDuration(elapsed)}. Discard it if you forgot to stop it.
        </p>
      )}
    </div>
  );
}

/** Start/stop control bound to one project (project details). */
function ProjectTimerControl({ project, activeTimer, runningProject, now }: TimerCardProps & { project: ForgeProject }) {
  const startTimer = useProjectForgeStore((s) => s.startTimer);

  if (activeTimer && activeTimer.projectId === project.id) {
    return <RunningTimer activeTimer={activeTimer} runningProject={runningProject} now={now} />;
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => startTimer(project.id)}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20"
      >
        <Play className="h-3.5 w-3.5" /> {runningProject ? 'Switch the timer here' : 'Start timer'}
      </button>
      {runningProject && (
        <p className="text-[10px] text-white/40">
          Stops and logs the timer running on {runningProject.name}.
        </p>
      )}
    </div>
  );
}

// ─── Main component ───

interface TimeTrackerProps {
  /** Compact single-project mode (project details). Omit for the full overview. */
  projectId?: string;
  onOpenProject?: (id: string) => void;
}

function TimeTrackerInner({ projectId, onOpenProject }: TimeTrackerProps) {
  const projects = useProjectForgeStore((s) => s.projects);
  const sessions = useProjectForgeStore((s) => s.sessions);
  const archivedMs = useProjectForgeStore((s) => s.archivedMs);
  const activeTimer = useProjectForgeStore((s) => s.activeTimer);
  const now = useNow(activeTimer ? 1000 : 30_000);
  const minuteNow = Math.floor(now / MINUTE_MS) * MINUTE_MS;

  const week = useMemo(() => summarizeWeek(sessions, activeTimer, now), [sessions, activeTimer, now]);
  const totals = useMemo(
    () => totalsByProject(sessions, archivedMs, activeTimer, now),
    [sessions, archivedMs, activeTimer, now]
  );
  const projectsById = useMemo(() => {
    const map: Record<string, ForgeProject> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);
  const runningProject = activeTimer ? projectsById[activeTimer.projectId] ?? null : null;

  if (projectId) {
    const project = projectsById[projectId];
    if (!project) return null;
    return (
      <ProjectTimePanel
        project={project}
        sessions={sessions}
        projectsById={projectsById}
        activeTimer={activeTimer}
        runningProject={runningProject}
        now={now}
        minuteNow={minuteNow}
        weekMs={week.byProject[project.id] ?? 0}
        totalMs={totals[project.id] ?? 0}
      />
    );
  }

  return (
    <TimeOverview
      projects={projects}
      projectsById={projectsById}
      sessions={sessions}
      activeTimer={activeTimer}
      runningProject={runningProject}
      now={now}
      minuteNow={minuteNow}
      week={week}
      totals={totals}
      onOpenProject={onOpenProject}
    />
  );
}

export const TimeTracker = memo(TimeTrackerInner);

// ─── Compact project panel ───

interface ProjectTimePanelProps {
  project: ForgeProject;
  sessions: ForgeSession[];
  projectsById: Record<string, ForgeProject>;
  activeTimer: ForgeActiveTimer | null;
  runningProject: ForgeProject | null;
  now: number;
  minuteNow: number;
  weekMs: number;
  totalMs: number;
}

function ProjectTimePanel({
  project,
  sessions,
  projectsById,
  activeTimer,
  runningProject,
  now,
  minuteNow,
  weekMs,
  totalMs,
}: ProjectTimePanelProps) {
  const [showManual, setShowManual] = useState(false);
  const recent = useMemo(
    () =>
      sessions
        .filter((s) => s.projectId === project.id)
        .sort((a, b) => b.start - a.start)
        .slice(0, 8),
    [sessions, project.id]
  );

  return (
    <section className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <header className="flex items-center gap-2">
        <Timer className="h-3.5 w-3.5 text-cyan-300" />
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Time tracker</h3>
      </header>

      <ProjectTimerControl
        project={project}
        activeTimer={activeTimer}
        runningProject={runningProject}
        now={now}
      />

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-md bg-white/[0.04] py-2">
          <p className="text-base font-semibold tabular-nums text-white/90">{formatDuration(weekMs)}</p>
          <p className="text-[10px] text-white/40">this week</p>
        </div>
        <div className="rounded-md bg-white/[0.04] py-2">
          <p className="text-base font-semibold tabular-nums text-white/90">{formatDuration(totalMs)}</p>
          <p className="text-[10px] text-white/40">all time</p>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={showManual}
        onClick={() => setShowManual((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-white/55 hover:text-cyan-300"
      >
        <Plus className={cn('h-3 w-3 transition-transform', showManual && 'rotate-45')} />
        {showManual ? 'Hide manual log' : 'Log time manually'}
      </button>
      {showManual && <ManualLogForm projects={[project]} fixedProjectId={project.id} />}

      {recent.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
            <History className="h-3 w-3" /> Recent sessions
          </p>
          <SessionList sessions={recent} projectsById={projectsById} now={minuteNow} showProject={false} />
        </div>
      )}
    </section>
  );
}

// ─── Full overview (Time tab) ───

interface TimeOverviewProps {
  projects: ForgeProject[];
  projectsById: Record<string, ForgeProject>;
  sessions: ForgeSession[];
  activeTimer: ForgeActiveTimer | null;
  runningProject: ForgeProject | null;
  now: number;
  minuteNow: number;
  week: WeekSummary;
  totals: Record<string, number>;
  onOpenProject?: (id: string) => void;
}

function TimeOverview({
  projects,
  projectsById,
  sessions,
  activeTimer,
  runningProject,
  now,
  minuteNow,
  week,
  totals,
  onOpenProject,
}: TimeOverviewProps) {
  const startTimer = useProjectForgeStore((s) => s.startTimer);
  const [picked, setPicked] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const pickerProjects = useMemo(() => sortForPicker(projects), [projects]);
  const startTarget = pickerProjects.some((p) => p.id === picked) ? picked : pickerProjects[0]?.id ?? '';
  const activeFilter = filter !== 'all' && projectsById[filter] ? filter : 'all';

  const filtered = useMemo(
    () =>
      sessions
        .filter((s) => activeFilter === 'all' || s.projectId === activeFilter)
        .sort((a, b) => b.start - a.start),
    [sessions, activeFilter]
  );
  const visible = filtered.slice(0, limit);

  const weekRows = Object.entries(week.byProject)
    .filter(([id, ms]) => ms > 0 && projectsById[id])
    .sort((a, b) => b[1] - a[1]);
  const maxWeek = weekRows[0]?.[1] ?? 0;
  const maxDay = Math.max(...week.byDay);
  const today = startOfDay(now);
  const allTime = Object.entries(totals).reduce((sum, [id, ms]) => (projectsById[id] ? sum + ms : sum), 0);

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 @3xl:grid-cols-2">
        {/* Timer */}
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
            <Timer className="h-3.5 w-3.5 text-cyan-300" /> Timer
          </h3>
          {activeTimer ? (
            <RunningTimer
              activeTimer={activeTimer}
              runningProject={runningProject}
              now={now}
              onOpenProject={onOpenProject}
            />
          ) : pickerProjects.length === 0 ? (
            <p className="text-xs text-white/45">Create a project on the Board first, then time it here.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-3xl font-semibold tabular-nums text-white/25">00:00:00</p>
              <div className="flex gap-2">
                <select
                  value={startTarget}
                  onChange={(e) => setPicked(e.target.value)}
                  aria-label="Project to time"
                  className={cn(SELECT, 'min-w-0 flex-1')}
                >
                  {pickerProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {STAGE_META[p.stage].label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!startTarget}
                  onClick={() => startTimer(startTarget)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-cyan-300 disabled:opacity-40"
                >
                  <Play className="h-3.5 w-3.5" /> Start
                </button>
              </div>
              <p className="text-[10px] text-white/35">
                The timer keeps running if you close this window or reload the OS.
              </p>
            </div>
          )}
        </section>

        {/* This week */}
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/45">This week</h3>
            <span className="text-xl font-semibold tabular-nums text-white">{formatDuration(week.total)}</span>
          </div>
          <div className="mt-3 flex h-24 items-end gap-1.5">
            {DAY_LABELS.map((label, i) => {
              const ms = week.byDay[i];
              const isToday = addDays(week.weekStart, i) === today;
              const pct = maxDay > 0 ? (ms / maxDay) * 100 : 0;
              return (
                <div
                  key={label}
                  className="flex h-full flex-1 flex-col items-center gap-1"
                  title={`${label}: ${formatDuration(ms)}`}
                >
                  <div className="flex w-full flex-1 items-end overflow-hidden rounded bg-white/[0.04]">
                    <div
                      className={cn('w-full rounded', isToday ? 'bg-cyan-400/80' : 'bg-cyan-400/35')}
                      style={{ height: ms > 0 ? `max(3px, ${pct}%)` : 0 }}
                    />
                  </div>
                  <span className={cn('text-[10px]', isToday ? 'font-semibold text-cyan-300' : 'text-white/40')}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-white/40">
            Monday to Sunday, local time · all time {formatHours(allTime)}
          </p>
        </section>
      </div>

      {/* Hours per project */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Hours per project · this week
        </h3>
        {weekRows.length === 0 ? (
          <p className="text-xs text-white/40">
            No time tracked this week yet. Press play on any project card or start the timer above.
          </p>
        ) : (
          <ul className="space-y-2">
            {weekRows.map(([id, ms]) => {
              const project = projectsById[id];
              return (
                <li key={id} className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenProject?.(id)}
                    className="flex w-36 min-w-0 shrink-0 items-center gap-1.5 text-left text-white/80 hover:text-cyan-300"
                  >
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STAGE_META[project.stage].dot)} />
                    <span className="truncate">{project.name}</span>
                  </button>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cn('h-full rounded-full', STAGE_META[project.stage].bar)}
                      style={{ width: `${maxWeek > 0 ? (ms / maxWeek) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-white/85">
                    {formatHours(ms)}
                  </span>
                  <span className="hidden w-20 shrink-0 text-right tabular-nums text-white/40 @2xl:inline">
                    {formatHours(totals[id] ?? 0)} total
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Manual log */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">Log time manually</h3>
        {pickerProjects.length === 0 ? (
          <p className="text-xs text-white/40">Create a project first.</p>
        ) : (
          <ManualLogForm projects={pickerProjects} />
        )}
      </section>

      {/* Session log */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-white/45" />
          <h3 className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">Session log</h3>
          <select
            value={activeFilter}
            onChange={(e) => {
              setFilter(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            aria-label="Filter sessions by project"
            className={cn(SELECT, 'w-auto max-w-[180px]')}
          >
            <option value="all">All projects</option>
            {pickerProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <SessionList
          sessions={visible}
          projectsById={projectsById}
          now={minuteNow}
          showProject={activeFilter === 'all'}
          onOpenProject={onOpenProject}
        />
        {filtered.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="mt-3 w-full rounded-md border border-white/10 py-1.5 text-xs text-white/55 hover:bg-white/5"
          >
            Show {Math.min(PAGE_SIZE, filtered.length - limit)} more
          </button>
        )}
      </section>
    </div>
  );
}
