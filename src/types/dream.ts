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
  | 'idle' // no activity yesterday
  | 'void'; // 3+ days offline — deep concerned void

/**
 * A visual motif rendered as drifting objects in the scene. Kept as
 * string ids so the renderer can switch on them without assets.
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
 * Static theme definition (see data/dream-themes.ts) — the palette,
 * motifs, glowing text snippets and narration pool of a subject.
 */
export interface DreamTheme {
  key: DreamThemeKey;
  label: string; // human readable subject name for narration
  objects: DreamObjectKind[]; // visual motifs to drift through the scene
  color: string; // primary accent hex
  ambientColor: string; // deep background hex (fog / void tint)
  ambient: string; // ambience label (e.g. 'digital-hum')
  narration: string[]; // theme narration lines
  textSnippets: string[]; // glowing text fragments (SQL, code, states…)
}

/** Element categories from spec 6.5. */
export type DreamElementType = 'floating-object' | 'particle' | 'text';

/** How an element moves on top of its drift. */
export type DreamAnimation =
  | 'drift' // slow float
  | 'spin' // rotates in place (process diagrams, clocks)
  | 'pulse' // breathes in size / glow
  | 'sort' // bars re-arrange (sorting)
  | 'travel' // packets moving along a path
  | 'twinkle' // stars flicker
  | 'rise'; // dust / embers float upwards

/** One element of a dream scene (spec 6.5 DreamElement). */
export interface DreamElement {
  id: string;
  type: DreamElementType;
  /**
   * floating-object → its DreamObjectKind,
   * text → the glowing text itself,
   * particle → '' (a mote of light).
   */
  content: string;
  /** Normalised position 0..1 in scene space. */
  position: { x: number; y: number };
  /** Drift velocity in scene units / second. */
  velocity: { x: number; y: number };
  /** Base size in px. */
  size: number;
  /** Rotation in degrees + spin speed (deg/sec). */
  rotation: number;
  spin: number;
  /** 0..1 opacity multiplier. */
  opacity: number;
  /** Animation phase offset so elements don't pulse in lockstep. */
  phase: number;
  animation: DreamAnimation;
  /** Theme that produced this element (colour + context). */
  subjectTheme: DreamThemeKey;
  /** Leaves a fading particle trail behind it. */
  trail: boolean;
}

/**
 * Aggregated snapshot of what the warrior did "yesterday" (UTC day key,
 * matching the habit/routine keys used across the OS). Built from the
 * quiz history, notes, habit logs, projects and the creature's activity
 * log (XP + focus minutes). Never throws; empty data → zeros.
 */
export interface DreamActivity {
  /** UTC day key being recapped. */
  recapDay: string;
  /** GATE subjects touched yesterday (quizzes + notes), strongest first. */
  subjects: { subject: string; count: number }[];
  /** Quiz submissions yesterday. */
  quizzesTaken: number;
  /** Questions answered yesterday. */
  questionsAnswered: number;
  /** Accuracy yesterday 0..1, null when no questions. */
  accuracy: number | null;
  /** Focused hours in study apps yesterday. */
  studyHours: number;
  /** Focused hours in build apps yesterday. */
  codingHours: number;
  /** XP earned yesterday. */
  xpEarned: number;
  /** Notes created or edited yesterday. */
  notesTouched: number;
  /** Projects touched yesterday (names). */
  projectsWorkedOn: string[];
  /** Did the user write/run code yesterday. */
  codedYesterday: boolean;
  /** Habit + routine items completed yesterday. */
  habitsCompleted: number;
  /** Activity streak length as of yesterday (0 = none). */
  streak: number;
  /** True when a streak ended because yesterday was empty. */
  streakBroken: boolean;
  /** Days between today and the last day with any presence/activity. */
  daysSinceActive: number;
  /** True when nothing at all happened before today (first-ever session). */
  firstEver: boolean;
  /** True when yesterday had real activity. */
  hadActivity: boolean;
}

/**
 * Fully resolved, render-ready dream (spec 6.5 DreamScene).
 * DreamEngine produces this; the renderer + narration consume it.
 */
export interface DreamScene {
  themeKey: DreamThemeKey;
  label: string;
  /** Deep background colour. */
  bgColor: string;
  /** Accent / glow colour (the subject's accent). */
  primaryColor: string;
  /** Ambience label, e.g. 'digital-hum'. */
  ambientText: string;
  /** Full narration text (1–2 sentences). */
  narration: string;
  /** Narration split into display lines. */
  narrationLines: string[];
  /** Total dream duration in ms (renderer + narration honour this). */
  duration: number;
  /** Concrete scene elements. */
  elements: DreamElement[];
  /** Intensity 0..1 — scales element count, glow, particle density. */
  intensity: number;
  /** GATE subjects represented in this dream. */
  subjects: string[];
  /** The raw activity snapshot this scene was derived from. */
  activity: DreamActivity;
}

/** Props for the top-level orchestrator used as the OS "dream" phase. */
export interface DreamSequenceProps {
  /** Called once when the dream finishes (or is skipped / not needed). */
  onComplete: () => void;
  /** Optional override scene (previews / testing). */
  scene?: DreamScene;
  /** When true, allow click/Escape/Space/Enter to skip. Default true. */
  skippable?: boolean;
}

/** Which phase a page load should start in (spec 6.68). */
export type DreamBootPhase = 'dream' | 'boot' | 'lock';

/** Persisted record of dreams seen (drives dream achievements). */
export interface DreamJournal {
  v: 1;
  /** UTC day keys on which a dream was seen (unique). */
  dreamDays: string[];
  /** Distinct GATE subjects that appeared in dreams. */
  subjects: string[];
  /** Distinct theme keys seen. */
  themes: string[];
  /** Dreams seen in total (including repeats on the same day). */
  total: number;
}
