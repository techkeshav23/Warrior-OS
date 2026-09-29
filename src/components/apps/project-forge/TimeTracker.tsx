// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Time Tracker
// One running timer at a time (survives reloads: only startedAt
// is stored), manual time logging, hours per project this week
// and a session log. Compact mode for a single project.
// The running clock is the hero: Orbitron, tabular, ember-lit.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState, type FormEvent } from 'react';
import {
  Anvil,
  CalendarDays,
  CircleCheck,
  History,
  Play,
  Plus,
  Square,
  Timer,
  TriangleAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Select } from '@/components/ui';
import { BEVEL_SUNK, ENGRAVED_LABEL, SLOT_FILL } from '@/components/ui/armor';
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

const STAGE_RANK: Record<ForgeStage, number> = { building: 0, testing: 1, ideas: 2, shipped: 3 };

/** Ember HUD brackets for the live timer card. */

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
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        {!fixedProjectId && (
          <div className="min-w-[160px] flex-1">
            <Select
              label="Project"
              value={projectId}
              onValueChange={setPickedId}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
        )}
        <div className="w-[72px]">
          <Input
            label="Hours"
            type="number"
            min={0}
            max={MANUAL_MAX_HOURS}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="tabular font-mono"
          />
        </div>
        <div className="w-[72px]">
          <Input
            label="Min"
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="tabular font-mono"
          />
        </div>
        <div className="w-[148px]">
          <Input
            label="Date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="tabular font-mono"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Note (optional)"
            aria-label="Session note"
          />
        </div>
        <Button type="submit" variant="secondary" leadingIcon={Plus}>
          Log time
        </Button>
      </div>
      {message && (
        <p role="status" className={cn('flex items-center gap-1.5 text-xs', message.ok ? 'text-success' : 'text-danger')}>
          {message.ok ? (
            <CircleCheck size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <TriangleAlert size={14} strokeWidth={1.75} aria-hidden />
          )}
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
    return (
      <EmptyState
        size="sm"
        icon={History}
        title="No sessions logged yet"
        description="Start the timer or log time manually; sessions land here."
      />
    );
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
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.day}>
          <div className="flex h-7 items-center justify-between gap-3 px-2">
            <p className={ENGRAVED_LABEL}>{formatDayLabel(group.day, now)}</p>
            <span className="tabular font-mono text-2xs text-fg-muted">{formatDuration(group.total)}</span>
          </div>
          <ul className="divide-y divide-line">
            {group.items.map((session) => {
              const project = projectsById[session.projectId];
              return (
                <li
                  key={session.id}
                  className="group/session flex min-h-10 items-center gap-3 px-2 transition-colors duration-120 hover:bg-surface-hover"
                >
                  <span className="tabular shrink-0 font-mono text-xs text-fg-subtle">
                    {formatTimeOfDay(session.start)}–{formatTimeOfDay(session.end)}
                  </span>
                  <span className="tabular w-14 shrink-0 font-mono text-xs font-medium text-fg">
                    {formatDuration(session.end - session.start)}
                  </span>
                  {showProject && project && (
                    <button
                      type="button"
                      onClick={() => onOpenProject?.(project.id)}
                      title={`Open ${project.name}`}
                      className="focus-ring flex min-w-0 max-w-[40%] items-center gap-1.5 text-ui text-fg-muted transition-colors duration-120 hover:text-fg"
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', STAGE_META[project.stage].dot)} />
                      <span className="truncate">{project.name}</span>
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle" title={session.note || undefined}>
                    {session.note}
                  </span>
                  {session.manual && (
                    <Badge size="sm" tone="neutral">
                      Manual
                    </Badge>
                  )}
                  <ConfirmButton
                    label="Delete session"
                    icon={X}
                    size="xs"
                    onConfirm={() => deleteSession(session.id)}
                    armedChildren="Delete?"
                    className="opacity-0 focus:opacity-100 group-hover/session:opacity-100"
                  />
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
function RunningTimer({
  activeTimer,
  runningProject,
  now,
  onOpenProject,
}: Omit<TimerCardProps, 'project'> & { activeTimer: ForgeActiveTimer }) {
  const stopTimer = useProjectForgeStore((s) => s.stopTimer);
  const discardTimer = useProjectForgeStore((s) => s.discardTimer);
  const setTimerNote = useProjectForgeStore((s) => s.setTimerNote);
  const elapsed = now - activeTimer.startedAt;

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-center gap-2">
        <Badge tone="ember" dot pulse>
          Live
        </Badge>
        {runningProject && onOpenProject ? (
          <button
            type="button"
            onClick={() => onOpenProject(runningProject.id)}
            className="focus-ring min-w-0 truncate text-ui font-medium text-fg transition-colors duration-120 hover:text-ember-300"
          >
            {runningProject.name}
          </button>
        ) : (
          <span className="min-w-0 truncate text-ui font-medium text-fg">{runningProject?.name ?? 'Timer running'}</span>
        )}
      </div>
      <RunningClock
        face="display"
        startedAt={activeTimer.startedAt}
        className="block text-4xl leading-none text-fg [text-shadow:0_0_24px_color-mix(in_oklab,var(--color-ember-500)_35%,transparent)]"
      />
      <Input
        value={activeTimer.note}
        onChange={(e) => setTimerNote(e.target.value)}
        maxLength={200}
        placeholder="What are you working on? Saved with the session."
        aria-label="Timer note"
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button variant="ember" fullWidth leadingIcon={Square} onClick={() => stopTimer()}>
          Stop and log
        </Button>
        <ConfirmButton
          label="Discard timer without logging"
          variant="secondary"
          size="md"
          onConfirm={discardTimer}
          armedChildren="Discard?"
        >
          Discard
        </ConfirmButton>
      </div>
      {elapsed > LONG_RUN_MS && (
        <p className="chamfer-sm flex items-start gap-2 bg-warning/10 px-3 py-2 text-xs text-warning shadow-[inset_2px_0_0_var(--color-warning)]">
          <TriangleAlert size={14} strokeWidth={1.75} aria-hidden className="mt-px shrink-0" />
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
    <div className="space-y-2">
      <Button variant="ember" fullWidth leadingIcon={Play} onClick={() => startTimer(project.id)}>
        {runningProject ? 'Switch the timer here' : 'Start timer'}
      </Button>
      {runningProject && (
        <p className="text-xs text-fg-subtle">Stops and logs the timer running on {runningProject.name}.</p>
      )}
    </div>
  );
}

/** Small unbordered stat well. */
function TimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn('chamfer-sm px-3 py-2.5', SLOT_FILL, BEVEL_SUNK)}>
      <p className={ENGRAVED_LABEL}>{label}</p>
      <p className="tabular mt-1 font-display text-lg font-semibold leading-6 text-fg">{value}</p>
    </div>
  );
}

// ─── Main component ───

interface TimeTrackerProps {
  /** Compact single-project mode (project details). Omit for the full overview. */
  projectId?: string;
  onOpenProject?: (id: string) => void;
  /** Overview empty state: open the new-project dialog. */
  onCreateProject?: () => void;
}

function TimeTrackerInner({ projectId, onOpenProject, onCreateProject }: TimeTrackerProps) {
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
      onCreateProject={onCreateProject}
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
  const live = activeTimer?.projectId === project.id;

  return (
    <Card
      title="Time tracker"
      icon={Timer}
      tone={live ? 'ember' : 'default'}
      rivets={live}
    >
      <div className="space-y-4">
        <ProjectTimerControl
          project={project}
          activeTimer={activeTimer}
          runningProject={runningProject}
          now={now}
        />

        <div className="grid grid-cols-2 gap-2">
          <TimeStat label="This week" value={formatDuration(weekMs)} />
          <TimeStat label="All time" value={formatDuration(totalMs)} />
        </div>

        <div>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showManual}
            onClick={() => setShowManual((v) => !v)}
            leadingIcon={
              <Plus
                size={14}
                strokeWidth={1.75}
                aria-hidden
                className={cn('shrink-0 transition-transform duration-180 ease-out-quint', showManual && 'rotate-45')}
              />
            }
          >
            {showManual ? 'Hide manual log' : 'Log time manually'}
          </Button>
          {showManual && (
            <div className="mt-3 animate-fade-in">
              <ManualLogForm projects={[project]} fixedProjectId={project.id} />
            </div>
          )}
        </div>

        {recent.length > 0 && (
          <div>
            <p className={cn(ENGRAVED_LABEL, 'mb-1 flex items-center gap-1.5')}>
              <History size={12} strokeWidth={1.75} aria-hidden /> Recent sessions
            </p>
            <SessionList sessions={recent} projectsById={projectsById} now={minuteNow} showProject={false} />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Week bars ───

function WeekBars({ week, today }: { week: WeekSummary; today: number }) {
  const maxDay = Math.max(...week.byDay);
  return (
    <div className="relative flex gap-2" role="list" aria-label="Tracked time per day this week">
      {week.total === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-10 text-center text-xs text-fg-subtle">
          Nothing tracked yet this week
        </p>
      )}
      {DAY_LABELS.map((label, i) => {
        const ms = week.byDay[i];
        const isToday = addDays(week.weekStart, i) === today;
        const pct = maxDay > 0 ? (ms / maxDay) * 100 : 0;
        return (
          <div
            key={label}
            role="listitem"
            aria-label={`${label}: ${formatDuration(ms)}`}
            className="group/day flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <div className="relative flex h-28 w-full items-end justify-center border-b border-line">
              {ms > 0 && (
                <div
                  className={cn(
                    'chamfer [--cut-tl:4px] [--cut-tr:4px] [--cut-bl:0px] [--cut-br:0px] w-full max-w-7 transition-[height,opacity,filter] duration-260 ease-out-quint',
                    'bg-linear-to-t from-ember-800 via-ember-600 to-ember-400',
                    isToday
                      ? 'to-ember-200 shadow-[inset_0_2px_0_var(--color-ember-100)]'
                      : 'opacity-75 group-hover/day:opacity-100'
                  )}
                  style={{ height: `max(4px, ${pct}%)` }}
                />
              )}
              <span className="armor-popover pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap px-2 py-1 font-mono text-2xs text-fg tabular group-hover/day:block">
                {formatDuration(ms)}
              </span>
            </div>
            <span className={cn('font-mono text-2xs', isToday ? 'font-medium text-ember-300' : 'text-fg-subtle')}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
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
  onCreateProject?: () => void;
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
  onCreateProject,
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
  const today = startOfDay(now);
  const allTime = Object.entries(totals).reduce((sum, [id, ms]) => (projectsById[id] ? sum + ms : sum), 0);

  return (
    <div className="space-y-4 p-5">
      <div className="grid gap-4 @3xl:grid-cols-2">
        {/* Timer */}
        <Card
          title="Timer"
          icon={Timer}
          tone={activeTimer ? 'ember' : 'default'}
          rivets={Boolean(activeTimer)}
        >
          {activeTimer ? (
            <RunningTimer
              activeTimer={activeTimer}
              runningProject={runningProject}
              now={now}
              onOpenProject={onOpenProject}
            />
          ) : pickerProjects.length === 0 ? (
            <EmptyState
              size="sm"
              tone="ember"
              icon={Anvil}
              title="No projects to time yet"
              description="Create a project on the board, then track its hours here."
              actions={
                onCreateProject && (
                  <Button variant="ember" size="sm" leadingIcon={Plus} onClick={onCreateProject}>
                    New project
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-4">
              <p aria-hidden className="tabular font-display text-4xl font-semibold leading-none text-fg-faint">
                00:00:00
              </p>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    value={startTarget}
                    onValueChange={setPicked}
                    aria-label="Project to time"
                    options={pickerProjects.map((p) => ({
                      value: p.id,
                      label: `${p.name} · ${STAGE_META[p.stage].label}`,
                    }))}
                  />
                </div>
                <Button variant="ember" leadingIcon={Play} disabled={!startTarget} onClick={() => startTimer(startTarget)}>
                  Start
                </Button>
              </div>
              <p className="text-xs text-fg-subtle">The timer keeps running if you close this window or reload the OS.</p>
            </div>
          )}
        </Card>

        {/* This week */}
        <Card
          title="This week"
          icon={CalendarDays}
          actions={
            <span className="tabular font-display text-xl font-semibold leading-none text-fg">
              {formatDuration(week.total)}
            </span>
          }
        >
          <WeekBars week={week} today={today} />
          <p className="mt-3 text-xs text-fg-subtle">
            Monday to Sunday, local time · all time <span className="tabular font-mono text-fg-muted">{formatHours(allTime)}</span>
          </p>
        </Card>
      </div>

      <div className="grid gap-4 @3xl:grid-cols-2">
        {/* Hours per project */}
        <Card title="Hours per project" description="This week">
          {weekRows.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Timer}
              title="No time tracked this week"
              description="Press play on any project card or start the timer above."
            />
          ) : (
            <ul className="space-y-3">
              {weekRows.map(([id, ms]) => {
                const project = projectsById[id];
                const meta = STAGE_META[project.stage];
                return (
                  <li key={id} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenProject?.(id)}
                      title={`Open ${project.name}`}
                      className="focus-ring flex w-32 min-w-0 shrink-0 items-center gap-2 text-left text-ui text-fg-muted transition-colors duration-120 hover:text-fg"
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', meta.dot)} />
                      <span className="truncate">{project.name}</span>
                    </button>
                    <ProgressBar
                      value={ms}
                      max={maxWeek}
                      tone={meta.progress}
                      size="sm"
                      animated={false}
                      aria-label={`${project.name}: ${formatHours(ms)} this week`}
                      className="flex-1"
                    />
                    <span className="tabular w-11 shrink-0 text-right font-mono text-xs text-fg">{formatHours(ms)}</span>
                    <span className="tabular hidden w-[72px] shrink-0 text-right font-mono text-xs text-fg-subtle @5xl:inline">
                      {formatHours(totals[id] ?? 0)} total
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Manual log */}
        <Card title="Log time manually" description="For work you did away from the timer">
          {pickerProjects.length === 0 ? (
            <EmptyState size="sm" icon={Plus} title="Nothing to log against" description="Create a project first." />
          ) : (
            <ManualLogForm projects={pickerProjects} />
          )}
        </Card>
      </div>

      {/* Session log */}
      <Card
        title="Session log"
        icon={History}
        actions={
          <div className="w-48">
            <Select
              size="sm"
              value={activeFilter}
              onValueChange={(value) => {
                setFilter(value);
                setLimit(PAGE_SIZE);
              }}
              aria-label="Filter sessions by project"
            >
              <option value="all">All projects</option>
              {pickerProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        <SessionList
          sessions={visible}
          projectsById={projectsById}
          now={minuteNow}
          showProject={activeFilter === 'all'}
          onOpenProject={onOpenProject}
        />
        {filtered.length > limit && (
          <Button variant="ghost" size="sm" fullWidth className="mt-3" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, filtered.length - limit)} more
          </Button>
        )}
      </Card>
    </div>
  );
}
