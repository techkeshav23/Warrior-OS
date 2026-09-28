// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Forge Types
// Kanban projects, links, checklist tasks and time-tracking sessions
// ═══════════════════════════════════════════════════════════

/** Kanban column a project lives in, left to right. */
export type ForgeStage = 'ideas' | 'building' | 'testing' | 'shipped';

export interface ForgeLink {
  id: string;
  /** Short label shown on the chip, e.g. "GitHub" or "Live". */
  label: string;
  /** Normalised http(s)/mailto URL. */
  url: string;
}

export interface ForgeTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: string; // ISO
}

export interface ForgeProject {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  stage: ForgeStage;
  /** Position inside its column (0 = top). */
  order: number;
  /** Manual progress 0–100. Ignored while autoProgress is on and tasks exist. */
  progress: number;
  /** Derive progress from the checklist instead of the manual value. */
  autoProgress: boolean;
  links: ForgeLink[];
  tasks: ForgeTask[];
  /** Parked project (the old Projects app's "paused" status). */
  onHold: boolean;
  createdAt: string; // ISO
  /** Last activity on the project (ISO). */
  updatedAt: string;
  /** First time the project reached Shipped (ISO). Never cleared. */
  shippedAt: string | null;
}

/** One block of tracked work on a project. */
export interface ForgeSession {
  id: string;
  projectId: string;
  /** Epoch ms. */
  start: number;
  /** Epoch ms. */
  end: number;
  note: string;
  /** Logged by hand rather than by the live timer. */
  manual: boolean;
}

/** The single running timer. Elapsed time is always derived from startedAt. */
export interface ForgeActiveTimer {
  projectId: string;
  /** Epoch ms when the timer started. */
  startedAt: number;
  note: string;
}

/** Ordered project ids per column. */
export type ForgeBoardColumns = Record<ForgeStage, string[]>;

/** Editable fields accepted by createProject / updateProject. */
export interface ForgeProjectInput {
  name: string;
  description: string;
  techStack: string[];
  stage: ForgeStage;
  progress: number;
  autoProgress: boolean;
  links: ForgeLink[];
  onHold: boolean;
}
