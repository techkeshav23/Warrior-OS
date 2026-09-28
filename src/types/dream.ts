// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Types
// NEXUS Dreams: daily cinematic recap of yesterday's activity
// ═══════════════════════════════════════════════════════════

import type { GateSubject } from './gate';

/**
 * All theme keys a dream can resolve to. Real GATE subjects plus
 * synthetic edge-case keys for non-study activity and empty days.
 */
export type DreamThemeKey =
  | GateSubject
  | 'project' // shipped/worked on projects
  | 'code' // code-lab / building
  | 'exam' // heavy mixed study (exam-prep vibe)
  | 'mixed' // multiple subjects, no clear winner
  | 'idle' // some presence but nothing logged
  | 'void'; // 3+ days offline — deep concerned void

/**
 * A single visual motif rendered as drifting objects in the scene.
 * Kept as string ids so the renderer can switch on them without a
 * hard dependency on a specific asset system.
 */
export type DreamObjectKind =
  | 'floating-table'
  | 'sql-query-text'
  | 'er-diagram-web'
  | 'database-cylinder'
  | 'process-diagram'
  | 'gantt-bar'
  | 'network-packet'
  | 'router-node'
  | 'automaton-state'
  | 'transition-arrow'
  | 'sorting-bar'
  | 'tree-node'
  | 'linked-list'
  | 'logic-gate'
  | 'binary-stream'
  | 'circuit-trace'
  | 'set-venn'
  | 'graph-edge'
  | 'matrix-grid'
  | 'integral-symbol'
  | 'code-block'
  | 'terminal-line'
  | 'brace-glyph'
  | 'kanban-card'
  | 'rocket'
  | 'checkmark-orb'
  | 'exam-sheet'
  | 'clock-orb'
  | 'star-cluster'
  | 'nebula-swirl'
  | 'void-particles'
  | 'distant-stars'
  | 'dark-fog';

/**
 * Static theme definition (see dream-themes.ts) — the palette + motifs
 * + a pool of narration lines associated with a subject/edge-case.
 */
export interface DreamTheme {
  key: DreamThemeKey;
  label: string; // human readable subject name for narration
  objects: DreamObjectKind[]; // visual motifs to drift through the scene
  color: string; // primary accent hex
  ambientColor: string; // deep background hex (fog / void tint)
  ambient: string; // ambience label (e.g. 'digital-hum') — decorative
  narration: string[]; // fallback narration lines for this theme
}

/**
 * Aggregated snapshot of what the warrior did "yesterday", built by
 * DreamEngine from localStorage. All numbers default to 0 / empty when
 * nothing was found — never throws.
 */
export interface DreamActivity {
  /** Subjects studied yesterday with a rough intensity (quiz count). */
  subjects: { subject: string; count: number }[];
  /** Total quizzes/attempts recorded yesterday. */
  quizzesTaken: number;
  /** Approx focused hours yesterday (heuristic, may be fractional). */
  studyHours: number;
  /** Projects touched (name list) yesterday. */
  projectsWorkedOn: string[];
  /** Did the user write/run code yesterday. */
  codedYesterday: boolean;
  /** Habit/routine items completed yesterday. */
  habitsCompleted: number;
  /** Current streak length in days (0 = none). */
  streak: number;
  /** True when the previous streak looks freshly broken. */
  streakBroken: boolean;
  /** Days since the last recorded activity (0 = active yesterday/today). */
  daysSinceActive: number;
  /** True when we found literally no historical activity at all. */
  firstEver: boolean;
}

/** A single drifting object instance placed in the scene. */
export interface DreamSceneObject {
  id: string;
  kind: DreamObjectKind;
  /** Normalised start position 0..1 in scene space. */
  x: number;
  y: number;
  /** Drift velocity (scene units / sec). */
  vx: number;
  vy: number;
  /** Base size in px. */
  size: number;
  /** Rotation in degrees + spin speed (deg/sec). */
  rotation: number;
  spin: number;
  /** 0..1 opacity multiplier. */
  opacity: number;
  /** Optional glowing label text (SQL, code, etc.). */
  text?: string;
  /** Animation phase offset so objects don't pulse in lockstep. */
  phase: number;
}

/**
 * Fully resolved, render-ready dream. DreamEngine produces this and
 * hands it to the renderer + narration.
 */
export interface DreamScene {
  themeKey: DreamThemeKey;
  label: string;
  primaryColor: string;
  ambientColor: string;
  ambient: string;
  /** Concrete drifting objects to render. */
  objects: DreamSceneObject[];
  /** Ordered narration lines chosen for this specific dream. */
  narration: string[];
  /** Total dream duration in ms (renderer + narration honour this). */
  durationMs: number;
  /** Intensity 0..1 — scales object count, glow, particle density. */
  intensity: number;
  /** The raw activity snapshot this scene was derived from. */
  activity: DreamActivity;
}

/** Props for the top-level orchestrator used as the OS "dream" phase. */
export interface DreamSequenceProps {
  /** Called once when the dream finishes (or is skipped). */
  onComplete: () => void;
  /** Optional override scene (mainly for previews / testing). */
  scene?: DreamScene;
  /** When true, allow click/Escape to skip. Default true. */
  skippable?: boolean;
}
