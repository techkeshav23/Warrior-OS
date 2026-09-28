// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Types
// NEXUS Dreams: daily cinematic recap of yesterday's activity
// ═══════════════════════════════════════════════════════════

/**
 * What a day can be spent on. Each activity has a dream theme of its
 * own; yesterday's strongest one (by rough minutes) picks the dream.
 */
export type DreamActivityKey =
  | 'decks' // cards answered in Training Grounds (decks by name)
  | 'notes' // notes written or edited
  | 'project' // Project Forge work
  | 'code' // focused time in build apps
  | 'music' // procedural music played
  | 'habits' // habits + routine items checked off
  | 'focus'; // long focused time in the OS

/**
 * All theme keys a dream can resolve to: the activity themes plus
 * synthetic keys for big days, mixed days and empty days.
 */
export type DreamThemeKey =
  | DreamActivityKey
  | 'marathon' // an all-out day across several activities
  | 'mixed' // several activities, no clear winner
  | 'idle' // no activity yesterday
  | 'void'; // 3+ days offline — deep concerned void

/**
 * A visual motif rendered as drifting objects in the scene. Kept as
 * string ids so the renderer can switch on them without assets.
 */
export type DreamObjectKind =
  // decks
  | 'flash-card'
  | 'recall-ring'
  | 'checkmark-orb'
  // notes
  | 'note-page'
  | 'quill'
  | 'graph-edge'
  | 'tree-node'
  // projects
  | 'kanban-card'
  | 'rocket'
  | 'gantt-bar'
  // code
  | 'code-block'
  | 'terminal-line'
  | 'brace-glyph'
  | 'binary-stream'
  | 'circuit-trace'
  | 'sorting-bar'
  // music
  | 'music-note'
  | 'sound-wave'
  | 'equalizer'
  // habits
  | 'flame'
  | 'habit-grid'
  // focus
  | 'clock-orb'
  | 'hourglass'
  // mixed / idle / void
  | 'star-cluster'
  | 'nebula-swirl'
  | 'void-particles'
  | 'distant-stars'
  | 'dark-fog';

/**
 * Static theme definition (see data/dream-themes.ts) — the palette,
 * motifs, glowing text snippets and narration pool of an activity.
 */
export interface DreamTheme {
  key: DreamThemeKey;
  label: string; // shown in the corner: "NEXUS dream · <label>"
  objects: DreamObjectKind[]; // visual motifs to drift through the scene
  color: string; // primary accent hex
  ambientColor: string; // deep background hex (fog / void tint)
  ambient: string; // ambience label (e.g. 'recall-hum')
  narration: string[]; // theme narration lines
  textSnippets: string[]; // generic glowing fragments; the user's own names are mixed in
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
  theme: DreamThemeKey;
  /** Leaves a fading particle trail behind it. */
  trail: boolean;
}

/**
 * Aggregated snapshot of what the warrior did "yesterday" (UTC day key,
 * matching the habit/routine keys used across the OS). Built from
 * Training Grounds card attempts + quiz sessions, notes, habit logs,
 * Project Forge, procedural music and the creature's activity log (XP +
 * focus minutes). Never throws; empty data → zeros.
 */
export interface DreamActivity {
  /** UTC day key being recapped. */
  recapDay: string;
  /** Activity kinds of yesterday with a rough weight in minutes, strongest first. */
  activities: { key: DreamActivityKey; weight: number }[];
  /** Decks studied yesterday (the user's own deck names), most cards first. */
  decks: { id: string; name: string; cards: number }[];
  /** Cards / questions answered yesterday (quiz, mock, flashcards, reviews). */
  cardsReviewed: number;
  /** Quiz submissions yesterday. */
  quizzesTaken: number;
  /** Accuracy yesterday 0..1, null when nothing was answered. */
  accuracy: number | null;
  /** Focused hours in study apps yesterday. */
  studyHours: number;
  /** Focused hours in build apps yesterday. */
  codingHours: number;
  /** All focused hours in the OS yesterday. */
  focusHours: number;
  /** XP earned yesterday. */
  xpEarned: number;
  /** Notes created or edited yesterday. */
  notesTouched: number;
  /** Titles of those notes, latest first (capped). */
  noteTitles: string[];
  /** Projects touched yesterday (names). */
  projectsWorkedOn: string[];
  /** Hours logged on projects yesterday (Project Forge timer). */
  projectHours: number;
  /** Did the user write/run code yesterday. */
  codedYesterday: boolean;
  /** Procedural music moods played yesterday. */
  musicMoods: string[];
  /** Habit + routine items completed yesterday. */
  habitsCompleted: number;
  /** Names of the habits completed yesterday. */
  habitNames: string[];
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
  /** Accent / glow colour (the theme's accent). */
  primaryColor: string;
  /** Ambience label, e.g. 'recall-hum'. */
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
  /**
   * What this dream was about: activity keys plus 'deck:<id>' for each
   * deck studied (the journal counts distinct motifs for Dream Walker).
   */
  motifs: string[];
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
  /** 2: motifs replaced v1's study-subject list. */
  v: 2;
  /** UTC day keys on which a dream was seen (unique). */
  dreamDays: string[];
  /** Distinct motifs dreamed of (activity keys, 'deck:<id>'). */
  motifs: string[];
  /** Distinct theme keys seen. */
  themes: string[];
  /** Dreams seen in total (including repeats on the same day). */
  total: number;
}
