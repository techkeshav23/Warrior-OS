// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Forge Store
// Kanban projects + per-project time tracking (persisted).
// On first load it copies the old Projects app data
// ('warrior-projects') into this store, keeps a verbatim backup
// of that key, and afterwards mirrors every change back into
// 'warrior-projects' (legacy Project[] shape) so older readers
// such as the dream engine keep seeing live project activity.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import type { Project, ProjectStatus } from '@/types/project';
import type {
  ForgeActiveTimer,
  ForgeBoardColumns,
  ForgeLink,
  ForgeProject,
  ForgeProjectInput,
  ForgeSession,
  ForgeStage,
  ForgeTask,
} from '@/types/project-forge';
import { useXPStore } from '@/stores/useXPStore';
import { generateId } from '@/lib/utils';

// ─── Constants ───

export const FORGE_STAGES: readonly ForgeStage[] = ['ideas', 'building', 'testing', 'shipped'];

/** Key the old Projects app (components/apps/projects) stores its Project[] under. */
export const LEGACY_PROJECTS_KEY = 'warrior-projects';
/** One-time verbatim copy of the legacy key, written before anything else touches it. */
export const LEGACY_BACKUP_KEY = 'warrior-projects-backup';

export const FORGE_MAX_SESSIONS = 2000;
/** Timer runs shorter than this are dropped instead of logged. */
export const FORGE_MIN_SESSION_MS = 1000;
/** Hand-logged sessions must be between 1 minute and 24 hours. */
export const FORGE_MAX_MANUAL_MS = 24 * 60 * 60 * 1000;
/** XP granted the first time each project reaches Shipped (WARRIOR_HUB: "Ship a project +200 XP"). */
export const FORGE_SHIP_XP = 200;
export const FORGE_TEN_HOURS_MS = 10 * 60 * 60 * 1000;

export const FORGE_ACHIEVEMENT_IDS = {
  firstProject: 'first-project',
  firstShip: 'project-complete',
  fiveShipped: 'five-projects',
  tenHours: 'forge-10-hours',
  openSource: 'forge-open-source',
} as const;

const MAX_TAGS = 24;
const MAX_TAG_LENGTH = 32;
const MAX_LINKS = 12;

// ─── Small helpers ───

function nowISO(): string {
  return new Date().toISOString();
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

export function isForgeStage(value: unknown): value is ForgeStage {
  return value === 'ideas' || value === 'building' || value === 'testing' || value === 'shipped';
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Progress shown on cards: checklist completion when auto mode is on, else the manual value. */
export function effectiveProgress(project: Pick<ForgeProject, 'progress' | 'autoProgress' | 'tasks'>): number {
  if (project.autoProgress && project.tasks.length > 0) {
    const done = project.tasks.filter((t) => t.done).length;
    return Math.round((done / project.tasks.length) * 100);
  }
  return clampProgress(project.progress);
}

/** Ordered project ids per column. */
export function groupByStage(projects: readonly ForgeProject[]): ForgeBoardColumns {
  const columns: ForgeBoardColumns = { ideas: [], building: [], testing: [], shipped: [] };
  const sorted = [...projects].sort(
    (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)
  );
  for (const project of sorted) {
    (columns[project.stage] ?? columns.ideas).push(project.id);
  }
  return columns;
}

/** All tracked time, including sessions folded into archivedMs when the log was trimmed. */
export function trackedTotalMs(
  sessions: readonly ForgeSession[],
  archivedMs: Readonly<Record<string, number>>
): number {
  let total = 0;
  for (const s of sessions) total += Math.max(0, s.end - s.start);
  for (const value of Object.values(archivedMs)) total += value;
  return total;
}

export function cleanTag(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH);
}

export function cleanTechStack(tags: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const clean = cleanTag(tag);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/**
 * Accepts http(s)/mailto URLs as-is, prefixes bare hosts with https://
 * and rejects every other scheme (javascript:, data:, …). Returns '' when rejected.
 */
export function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^(https?:|mailto:)/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) return '';
  return `https://${value.replace(/^\/+/, '')}`;
}

function labelForUrl(url: string): string {
  if (/github\.com/i.test(url)) return 'GitHub';
  if (/gitlab\.com/i.test(url)) return 'GitLab';
  if (/figma\.com/i.test(url)) return 'Figma';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'Video';
  if (/^mailto:/i.test(url)) return 'Email';
  return 'Link';
}

function isRepoLink(link: ForgeLink): boolean {
  return (
    /github\.com|gitlab\.com|bitbucket\.org/i.test(link.url) ||
    /git|repo|source|code/i.test(link.label)
  );
}

function hasGithubLink(links: readonly ForgeLink[]): boolean {
  return links.some((l) => /^https?:\/\/(www\.)?github\.com\//i.test(l.url));
}

/** Source-code link of a project, if any. */
export function pickRepoLink(links: readonly ForgeLink[]): ForgeLink | undefined {
  return links.find(isRepoLink);
}

/** Live/demo link of a project, if any (never the repo link). */
export function pickLiveLink(links: readonly ForgeLink[]): ForgeLink | undefined {
  const others = links.filter((l) => !isRepoLink(l));
  return others.find((l) => /live|demo|site|app|deploy|web|prod/i.test(l.label)) ?? others[0];
}

export function cleanLinks(links: readonly ForgeLink[]): ForgeLink[] {
  const out: ForgeLink[] = [];
  for (const link of links) {
    const url = normalizeUrl(link.url);
    if (!url) continue;
    out.push({
      id: link.id || generateId('fl'),
      label: link.label.replace(/\s+/g, ' ').trim().slice(0, 24) || labelForUrl(url),
      url,
    });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

function cleanInput(input: Partial<ForgeProjectInput>): Partial<ForgeProjectInput> {
  const out: Partial<ForgeProjectInput> = {};
  if (input.name !== undefined) {
    out.name = input.name.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled project';
  }
  if (input.description !== undefined) out.description = input.description.trim().slice(0, 4000);
  if (input.techStack !== undefined) out.techStack = cleanTechStack(input.techStack);
  if (input.stage !== undefined && isForgeStage(input.stage)) out.stage = input.stage;
  if (input.progress !== undefined) out.progress = clampProgress(input.progress);
  if (input.autoProgress !== undefined) out.autoProgress = Boolean(input.autoProgress);
  if (input.links !== undefined) out.links = cleanLinks(input.links);
  if (input.onHold !== undefined) out.onHold = Boolean(input.onHold);
  return out;
}

/** Moves a (draft) project into a stage, stamping ship data the first time it ships. */
function enterStage(project: ForgeProject, stage: ForgeStage, iso: string, shipped: string[]): void {
  if (project.stage === stage) return;
  project.stage = stage;
  project.updatedAt = iso;
  if (stage === 'shipped') {
    project.onHold = false;
    if (!project.autoProgress) project.progress = 100;
    if (!project.shippedAt) {
      project.shippedAt = iso;
      shipped.push(project.name);
    }
  }
}

function nextOrderIn(projects: readonly ForgeProject[], stage: ForgeStage, excludeId?: string): number {
  let max = -1;
  for (const p of projects) {
    if (p.stage === stage && p.id !== excludeId) max = Math.max(max, p.order);
  }
  return max + 1;
}

// ─── Coercion of stored data ───

function coerceTask(raw: unknown): ForgeTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const title = str(t.title).trim();
  if (!title) return null;
  return {
    id: str(t.id) || generateId('ft'),
    title,
    // Forge tasks use `done`, the legacy Projects app used `completed`.
    done: t.done === true || t.completed === true,
    createdAt: str(t.createdAt) || nowISO(),
  };
}

function coerceLink(raw: unknown): ForgeLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, unknown>;
  const url = normalizeUrl(str(l.url));
  if (!url) return null;
  return { id: str(l.id) || generateId('fl'), label: str(l.label).trim() || labelForUrl(url), url };
}

function normalizeProject(raw: unknown, index: number): ForgeProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id).trim();
  if (!id) return null;
  const createdAt = str(r.createdAt) || nowISO();
  return {
    id,
    name: str(r.name).trim() || 'Untitled project',
    description: str(r.description),
    techStack: Array.isArray(r.techStack)
      ? cleanTechStack(r.techStack.filter((t): t is string => typeof t === 'string'))
      : [],
    stage: isForgeStage(r.stage) ? r.stage : 'ideas',
    order: finiteNumber(r.order) ?? index,
    progress: clampProgress(finiteNumber(r.progress) ?? 0),
    autoProgress: r.autoProgress === true,
    links: Array.isArray(r.links) ? r.links.map(coerceLink).filter(isPresent) : [],
    tasks: Array.isArray(r.tasks) ? r.tasks.map(coerceTask).filter(isPresent) : [],
    onHold: r.onHold === true,
    createdAt,
    updatedAt: str(r.updatedAt) || createdAt,
    shippedAt: typeof r.shippedAt === 'string' ? r.shippedAt : null,
  };
}

function coerceSession(raw: unknown): ForgeSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const start = finiteNumber(s.start);
  const end = finiteNumber(s.end);
  const projectId = str(s.projectId);
  if (!projectId || start === null || end === null || end <= start) return null;
  return {
    id: str(s.id) || generateId('fs'),
    projectId,
    start,
    end,
    note: str(s.note),
    manual: s.manual === true,
  };
}

function coerceTimer(raw: unknown): ForgeActiveTimer | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const projectId = str(t.projectId);
  const startedAt = finiteNumber(t.startedAt);
  if (!projectId || startedAt === null) return null;
  return { projectId, startedAt, note: str(t.note) };
}

// ─── Legacy Projects app bridge ───

const LEGACY_TO_STAGE: Record<ProjectStatus, ForgeStage> = {
  planning: 'ideas',
  'in-progress': 'building',
  paused: 'building',
  completed: 'shipped',
};

const STAGE_TO_LEGACY: Record<ForgeStage, ProjectStatus> = {
  ideas: 'planning',
  building: 'in-progress',
  testing: 'in-progress',
  shipped: 'completed',
};

function isLegacyStatus(value: string): value is ProjectStatus {
  return value === 'planning' || value === 'in-progress' || value === 'completed' || value === 'paused';
}

/** Converts one entry of the old Projects app into a Forge project (nothing is dropped). */
function fromLegacy(raw: unknown): ForgeProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id).trim();
  if (!id) return null;
  const statusRaw = str(r.status);
  const status: ProjectStatus = isLegacyStatus(statusRaw) ? statusRaw : 'planning';
  const createdAt = str(r.createdAt) || nowISO();
  const updatedAt = str(r.updatedAt) || createdAt;
  const tasks = Array.isArray(r.tasks) ? r.tasks.map(coerceTask).filter(isPresent) : [];

  const links: ForgeLink[] = [];
  const github = normalizeUrl(str(r.githubUrl));
  const deploy = normalizeUrl(str(r.deployUrl));
  if (github) links.push({ id: `${id}-repo`, label: 'GitHub', url: github });
  if (deploy) links.push({ id: `${id}-live`, label: 'Live', url: deploy });

  // Same rules as the old app's progressOf(): checklist completion when the
  // project has tasks (autoProgress below), else the stored value, else 100
  // for completed projects.
  const manual = finiteNumber(r.progress) ?? 0;
  const progress = manual > 0 ? manual : status === 'completed' ? 100 : 0;

  return {
    id,
    name: str(r.name).trim() || 'Untitled project',
    description: str(r.description),
    techStack: Array.isArray(r.techStack)
      ? cleanTechStack(r.techStack.filter((t): t is string => typeof t === 'string'))
      : [],
    stage: LEGACY_TO_STAGE[status],
    order: 0,
    progress: clampProgress(progress),
    autoProgress: tasks.length > 0,
    links,
    tasks,
    onHold: status === 'paused',
    createdAt,
    updatedAt,
    shippedAt: status === 'completed' ? updatedAt : null,
  };
}

/** Forge project → the legacy Project shape (types/project) other features read. */
function toLegacy(project: ForgeProject): Project {
  const repo = pickRepoLink(project.links);
  const live = pickLiveLink(project.links);
  const out: Project = {
    id: project.id,
    name: project.name,
    description: project.description,
    techStack: [...project.techStack],
    status: project.stage !== 'shipped' && project.onHold ? 'paused' : STAGE_TO_LEGACY[project.stage],
    progress: effectiveProgress(project),
    tasks: project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      completed: t.done,
      createdAt: t.createdAt,
    })),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  if (repo) out.githubUrl = repo.url;
  if (live) out.deployUrl = live.url;
  return out;
}

function readLegacyRaw(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LEGACY_PROJECTS_KEY);
  } catch {
    return null;
  }
}

function backupLegacyRaw(raw: string): void {
  try {
    if (window.localStorage.getItem(LEGACY_BACKUP_KEY) === null) {
      window.localStorage.setItem(LEGACY_BACKUP_KEY, raw);
    }
  } catch {
    // Storage blocked or full: the original key is still untouched at this point.
  }
}

function mirrorToLegacy(projects: readonly ForgeProject[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LEGACY_PROJECTS_KEY, JSON.stringify(projects.map(toLegacy)));
  } catch {
    // Quota errors only affect the compatibility mirror, never Forge data.
  }
}

// ─── Cross-feature side effects ───

function unlock(id: string): void {
  useXPStore.getState().unlockAchievement(id);
}

/** Tracked build time feeds the Warrior Creature's "code" side. */
function feedCreature(durationMs: number): void {
  if (typeof window === 'undefined') return;
  const minutes = Math.round(durationMs / 60_000);
  if (minutes < 1) return;
  window.dispatchEvent(
    new CustomEvent('warrior:creature', { detail: { type: 'activity', kind: 'code', amount: minutes } })
  );
}

/** Contract event: park the detail in sessionStorage, then dispatch it. */
function nexusSay(text: string, tone: 'info' | 'success' | 'warning' | 'danger'): void {
  if (typeof window === 'undefined') return;
  const detail = { text, tone };
  try {
    window.sessionStorage.setItem('warrior:pending:warrior:nexus-say', JSON.stringify(detail));
  } catch {
    // sessionStorage unavailable: the live event below still fires.
  }
  window.dispatchEvent(new CustomEvent('warrior:nexus-say', { detail }));
}

interface SessionDraftTarget {
  sessions: ForgeSession[];
  archivedMs: Record<string, number>;
  projects: ForgeProject[];
}

/** Appends a session inside an immer recipe, bumps last-activity and trims the log. */
function addSessionDraft(s: SessionDraftTarget, session: ForgeSession): void {
  s.sessions.push(session);
  const project = s.projects.find((p) => p.id === session.projectId);
  if (project && Date.parse(project.updatedAt) < session.end) {
    project.updatedAt = new Date(session.end).toISOString();
  }
  const overflow = s.sessions.length - FORGE_MAX_SESSIONS;
  if (overflow > 0) {
    s.sessions.sort((a, b) => a.end - b.end);
    const removed = s.sessions.splice(0, overflow);
    for (const r of removed) {
      s.archivedMs[r.projectId] = (s.archivedMs[r.projectId] ?? 0) + Math.max(0, r.end - r.start);
    }
  }
}

// ─── Store ───

interface ProjectForgeState {
  projects: ForgeProject[];
  sessions: ForgeSession[];
  activeTimer: ForgeActiveTimer | null;
  /** Time of sessions trimmed from the log, per project (keeps all-time totals exact). */
  archivedMs: Record<string, number>;
  legacyImported: boolean;

  /** Copies the old Projects app data in once. Idempotent. */
  ensureMigrated: () => void;
  /** Unlocks every Forge achievement whose condition already holds. Idempotent. */
  syncAchievements: () => void;

  createProject: (input: ForgeProjectInput) => string;
  /** Returns names of projects that shipped for the first time. */
  updateProject: (id: string, input: Partial<ForgeProjectInput>) => string[];
  deleteProject: (id: string) => void;
  /** Moves to the bottom of another column. Returns first-time shipped names. */
  moveProject: (id: string, stage: ForgeStage) => string[];
  /** Commits a full board layout after drag and drop. Returns first-time shipped names. */
  applyBoard: (columns: ForgeBoardColumns) => string[];
  addTask: (projectId: string, title: string) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  removeTask: (projectId: string, taskId: string) => void;

  /** Starts timing a project; a timer on another project is stopped and logged first. */
  startTimer: (projectId: string) => void;
  stopTimer: () => ForgeSession | null;
  /** Stops the running timer without logging it. */
  discardTimer: () => void;
  setTimerNote: (note: string) => void;
  logManualSession: (entry: { projectId: string; start: number; end: number; note: string }) => ForgeSession | null;
  deleteSession: (id: string) => void;
}

type PersistedForge = Pick<
  ProjectForgeState,
  'projects' | 'sessions' | 'activeTimer' | 'archivedMs' | 'legacyImported'
>;

export const useProjectForgeStore = create<ProjectForgeState>()(
  persist(
    immer((set, get) => {
      const unlockShipAchievements = (): void => {
        const shippedCount = get().projects.filter((p) => p.shippedAt !== null).length;
        if (shippedCount >= 1) unlock(FORGE_ACHIEVEMENT_IDS.firstShip);
        if (shippedCount >= 5) unlock(FORGE_ACHIEVEMENT_IDS.fiveShipped);
      };

      /**
       * Mirrors the legacy key and rewards projects that just moved into
       * Shipped for the first time (XP once per project, NEXUS line, achievements).
       */
      const afterProjectsChanged = (shipped: string[]): void => {
        mirrorToLegacy(get().projects);
        if (shipped.length === 0) return;
        const xp = FORGE_SHIP_XP * shipped.length;
        useXPStore.getState().addXP(xp, 'project-forge');
        const label = shipped.length === 1 ? `"${shipped[0]}"` : `${shipped.length} projects`;
        nexusSay(`${label} shipped! +${xp} XP. Resume Builder me import karna mat bhoolna.`, 'success');
        unlockShipAchievements();
      };

      const afterSessionLogged = (session: ForgeSession): void => {
        mirrorToLegacy(get().projects);
        feedCreature(session.end - session.start);
        const { sessions, archivedMs } = get();
        if (trackedTotalMs(sessions, archivedMs) >= FORGE_TEN_HOURS_MS) {
          unlock(FORGE_ACHIEVEMENT_IDS.tenHours);
        }
      };

      return {
        projects: [],
        sessions: [],
        activeTimer: null,
        archivedMs: {},
        legacyImported: false,

        ensureMigrated: () => {
          if (get().legacyImported || typeof window === 'undefined') return;
          const raw = readLegacyRaw();
          let legacy: unknown[] = [];
          if (raw) {
            backupLegacyRaw(raw);
            try {
              const parsed: unknown = JSON.parse(raw);
              if (Array.isArray(parsed)) legacy = parsed;
            } catch {
              legacy = [];
            }
          }
          set((s) => {
            const known = new Set(s.projects.map((p) => p.id));
            const nextOrder: Record<ForgeStage, number> = { ideas: 0, building: 0, testing: 0, shipped: 0 };
            for (const p of s.projects) nextOrder[p.stage] = Math.max(nextOrder[p.stage], p.order + 1);
            for (const item of legacy) {
              const project = fromLegacy(item);
              if (!project || known.has(project.id)) continue;
              known.add(project.id);
              project.order = nextOrder[project.stage];
              nextOrder[project.stage] += 1;
              s.projects.push(project);
            }
            s.legacyImported = true;
          });
        },

        syncAchievements: () => {
          const { projects, sessions, archivedMs } = get();
          if (projects.length > 0) unlock(FORGE_ACHIEVEMENT_IDS.firstProject);
          if (projects.some((p) => hasGithubLink(p.links))) unlock(FORGE_ACHIEVEMENT_IDS.openSource);
          unlockShipAchievements();
          if (trackedTotalMs(sessions, archivedMs) >= FORGE_TEN_HOURS_MS) {
            unlock(FORGE_ACHIEVEMENT_IDS.tenHours);
          }
        },

        createProject: (input) => {
          const id = generateId('fp');
          const iso = nowISO();
          const clean = cleanInput(input);
          const stage = clean.stage ?? 'ideas';
          set((s) => {
            // New cards land at the top of their column.
            for (const p of s.projects) if (p.stage === stage) p.order += 1;
            const project: ForgeProject = {
              id,
              name: clean.name ?? 'Untitled project',
              description: clean.description ?? '',
              techStack: clean.techStack ?? [],
              stage,
              order: 0,
              progress: clean.progress ?? 0,
              autoProgress: clean.autoProgress ?? false,
              links: clean.links ?? [],
              tasks: [],
              onHold: stage === 'shipped' ? false : clean.onHold ?? false,
              createdAt: iso,
              updatedAt: iso,
              shippedAt: null,
            };
            if (stage === 'shipped') {
              if (!project.autoProgress) project.progress = 100;
              project.shippedAt = iso;
            }
            s.projects.push(project);
          });
          unlock(FORGE_ACHIEVEMENT_IDS.firstProject);
          if (clean.links && hasGithubLink(clean.links)) unlock(FORGE_ACHIEVEMENT_IDS.openSource);
          // Logging an already-shipped project counts for the ship achievements,
          // but ship XP is only paid when a card moves into Shipped on the board.
          if (stage === 'shipped') unlockShipAchievements();
          afterProjectsChanged([]);
          return id;
        },

        updateProject: (id, input) => {
          const clean = cleanInput(input);
          const iso = nowISO();
          const shipped: string[] = [];
          set((s) => {
            const p = s.projects.find((x) => x.id === id);
            if (!p) return;
            if (clean.name !== undefined) p.name = clean.name;
            if (clean.description !== undefined) p.description = clean.description;
            if (clean.techStack !== undefined) p.techStack = clean.techStack;
            if (clean.progress !== undefined) p.progress = clean.progress;
            if (clean.autoProgress !== undefined) p.autoProgress = clean.autoProgress;
            if (clean.links !== undefined) p.links = clean.links;
            if (clean.stage !== undefined && clean.stage !== p.stage) {
              const order = nextOrderIn(s.projects, clean.stage, p.id);
              enterStage(p, clean.stage, iso, shipped);
              p.order = order;
            }
            if (clean.onHold !== undefined) p.onHold = p.stage === 'shipped' ? false : clean.onHold;
            p.updatedAt = iso;
          });
          if (clean.links && hasGithubLink(clean.links)) unlock(FORGE_ACHIEVEMENT_IDS.openSource);
          afterProjectsChanged(shipped);
          return shipped;
        },

        deleteProject: (id) => {
          set((s) => {
            const index = s.projects.findIndex((p) => p.id === id);
            if (index === -1) return;
            const stage = s.projects[index].stage;
            s.projects.splice(index, 1);
            s.projects
              .filter((p) => p.stage === stage)
              .sort((a, b) => a.order - b.order)
              .forEach((p, i) => {
                p.order = i;
              });
            s.sessions = s.sessions.filter((x) => x.projectId !== id);
            delete s.archivedMs[id];
            if (s.activeTimer?.projectId === id) s.activeTimer = null;
          });
          afterProjectsChanged([]);
        },

        moveProject: (id, stage) => {
          const iso = nowISO();
          const shipped: string[] = [];
          set((s) => {
            const p = s.projects.find((x) => x.id === id);
            if (!p || p.stage === stage) return;
            const order = nextOrderIn(s.projects, stage, p.id);
            enterStage(p, stage, iso, shipped);
            p.order = order;
          });
          afterProjectsChanged(shipped);
          return shipped;
        },

        applyBoard: (columns) => {
          const iso = nowISO();
          const shipped: string[] = [];
          set((s) => {
            const byId = new Map(s.projects.map((p) => [p.id, p] as const));
            for (const stage of FORGE_STAGES) {
              (columns[stage] ?? []).forEach((id, index) => {
                const p = byId.get(id);
                if (!p) return;
                enterStage(p, stage, iso, shipped);
                p.order = index;
              });
            }
          });
          afterProjectsChanged(shipped);
          return shipped;
        },

        addTask: (projectId, title) => {
          const clean = title.replace(/\s+/g, ' ').trim().slice(0, 160);
          if (!clean) return;
          const iso = nowISO();
          set((s) => {
            const p = s.projects.find((x) => x.id === projectId);
            if (!p) return;
            p.tasks.push({ id: generateId('ft'), title: clean, done: false, createdAt: iso });
            p.updatedAt = iso;
          });
          afterProjectsChanged([]);
        },

        toggleTask: (projectId, taskId) => {
          const iso = nowISO();
          set((s) => {
            const p = s.projects.find((x) => x.id === projectId);
            const task = p?.tasks.find((t) => t.id === taskId);
            if (!p || !task) return;
            task.done = !task.done;
            p.updatedAt = iso;
          });
          afterProjectsChanged([]);
        },

        removeTask: (projectId, taskId) => {
          const iso = nowISO();
          set((s) => {
            const p = s.projects.find((x) => x.id === projectId);
            if (!p) return;
            p.tasks = p.tasks.filter((t) => t.id !== taskId);
            p.updatedAt = iso;
          });
          afterProjectsChanged([]);
        },

        startTimer: (projectId) => {
          const current = get();
          if (!current.projects.some((p) => p.id === projectId)) return;
          if (current.activeTimer?.projectId === projectId) return;
          // Only one timer at a time: switching logs the previous one.
          if (current.activeTimer) get().stopTimer();
          const startedAt = Date.now();
          set((s) => {
            s.activeTimer = { projectId, startedAt, note: '' };
            const p = s.projects.find((x) => x.id === projectId);
            if (p) p.updatedAt = new Date(startedAt).toISOString();
          });
          afterProjectsChanged([]);
        },

        stopTimer: () => {
          const { activeTimer, projects } = get();
          if (!activeTimer) return null;
          const end = Date.now();
          const exists = projects.some((p) => p.id === activeTimer.projectId);
          const session: ForgeSession | null =
            exists && end - activeTimer.startedAt >= FORGE_MIN_SESSION_MS
              ? {
                  id: generateId('fs'),
                  projectId: activeTimer.projectId,
                  start: activeTimer.startedAt,
                  end,
                  note: activeTimer.note.trim().slice(0, 200),
                  manual: false,
                }
              : null;
          set((s) => {
            s.activeTimer = null;
            if (session) addSessionDraft(s, session);
          });
          if (session) afterSessionLogged(session);
          return session;
        },

        discardTimer: () =>
          set((s) => {
            s.activeTimer = null;
          }),

        setTimerNote: (note) =>
          set((s) => {
            if (s.activeTimer) s.activeTimer.note = note.slice(0, 200);
          }),

        logManualSession: (entry) => {
          if (!get().projects.some((p) => p.id === entry.projectId)) return null;
          const duration = entry.end - entry.start;
          if (!Number.isFinite(duration) || duration < 60_000 || duration > FORGE_MAX_MANUAL_MS) return null;
          const session: ForgeSession = {
            id: generateId('fs'),
            projectId: entry.projectId,
            start: entry.start,
            end: entry.end,
            note: entry.note.trim().slice(0, 200),
            manual: true,
          };
          set((s) => addSessionDraft(s, session));
          afterSessionLogged(session);
          return session;
        },

        deleteSession: (id) =>
          set((s) => {
            s.sessions = s.sessions.filter((x) => x.id !== id);
          }),
      };
    }),
    {
      name: 'warrior-os-project-forge',
      partialize: (state): PersistedForge => ({
        projects: state.projects,
        sessions: state.sessions,
        activeTimer: state.activeTimer,
        archivedMs: state.archivedMs,
        legacyImported: state.legacyImported,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const p = persisted as Record<string, unknown>;
        const seen = new Set<string>();
        const projects = (Array.isArray(p.projects) ? p.projects : [])
          .map((raw, i) => normalizeProject(raw, i))
          .filter(isPresent)
          .filter((proj) => {
            if (seen.has(proj.id)) return false;
            seen.add(proj.id);
            return true;
          });
        const sessions = (Array.isArray(p.sessions) ? p.sessions : []).map(coerceSession).filter(isPresent);
        const timer = coerceTimer(p.activeTimer);
        const archivedMs: Record<string, number> = {};
        if (p.archivedMs && typeof p.archivedMs === 'object') {
          for (const [key, value] of Object.entries(p.archivedMs as Record<string, unknown>)) {
            const ms = finiteNumber(value);
            if (ms !== null && ms > 0) archivedMs[key] = ms;
          }
        }
        return {
          ...current,
          projects,
          sessions,
          activeTimer: timer && projects.some((x) => x.id === timer.projectId) ? timer : null,
          archivedMs,
          legacyImported: p.legacyImported === true,
        };
      },
      // Runs in the browser right after hydration (never on the server,
      // where persist has no storage): first-load copy of the old data.
      onRehydrateStorage: () => (state) => {
        state?.ensureMigrated();
      },
    }
  )
);
