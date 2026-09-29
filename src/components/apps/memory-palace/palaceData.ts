// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: data layer
// Pure TypeScript — no React, no three.js, no store imports (only
// types), so it stays cheap to share:
//   • notes (Notes Archive 'warrior-notes') → PalaceNote with folder,
//     tags and an object shape inferred from the content
//   • knowledge objects (PalaceItem): notes, deck cards, projects
//   • review state: the palace revision log for notes, Training
//     Grounds spaced repetition (useLearningStore reviews) for cards
//     and for notes linked to a deck/topic by tag or folder
//   • room themes by content type (notes · decks · projects)
//   • palace progress + achievements
// ═══════════════════════════════════════════════════════════

import type { CardKind, CardReview, Deck } from '@/types/learning';
import { unlockPhase6Achievement } from '@/components/creature/osBridge';
import { EMBER, FG, PLASMA, STATUS, VIZ } from '@/styles/tokens';
import { ROOM_ACCENTS } from './palaceTheme';

// ─────────────────────────────────────────────────────────────
// Content types + room themes
// ─────────────────────────────────────────────────────────────

/** What a room holds: your notes, one of your decks, or your projects. */
export type PalaceContentType = 'notes' | 'deck' | 'projects';

/** Visual style family of a room's furniture + props (per content type). */
export type RoomStyle =
  // notes
  | 'library'
  | 'observatory'
  | 'lattice'
  | 'network'
  | 'archive'
  // decks
  | 'laboratory'
  | 'vault'
  | 'orbit'
  // projects
  | 'forge'
  | 'workshop'
  | 'depot'
  | 'pipeline';

export interface RoomTheme {
  contentType: PalaceContentType;
  style: RoomStyle;
  /** Style name, e.g. 'Library'. */
  label: string;
  /** accent glow colour (hex) */
  accent: string;
  /** wall base colour (hex) */
  wall: string;
  /** floor colour (hex) */
  floor: string;
  /** furniture colour (shelves, racks, benches) */
  furniture: string;
  /** short descriptive vibe used in labels */
  vibe: string;
}

type StyleBase = Omit<RoomTheme, 'contentType' | 'style'>;

export const ROOM_STYLES: Record<RoomStyle, StyleBase> = {
  library: { label: 'Library', accent: VIZ[6], wall: '#33291f', floor: '#241c14', furniture: '#5e4630', vibe: 'Library · wooden shelves · your words in the air' },
  observatory: { label: 'Observatory', accent: VIZ[2], wall: '#1d1b2c', floor: '#14121f', furniture: '#312c49', vibe: 'Observatory · star charts · ideas in orbit' },
  lattice: { label: 'Idea Crystal', accent: PLASMA[300], wall: '#152029', floor: '#0e161d', furniture: '#243a47', vibe: 'Idea crystal · connected thoughts' },
  network: { label: 'Link Web', accent: VIZ[5], wall: '#1a1e30', floor: '#121522', furniture: '#283048', vibe: 'Link web · notes joined by threads of light' },
  archive: { label: 'Archive', accent: FG.muted, wall: '#20252d', floor: '#161a21', furniture: '#454d5a', vibe: 'Archive · everything not filed yet' },
  laboratory: { label: 'Mastery Lab', accent: PLASMA[400], wall: '#1f1b20', floor: '#161216', furniture: '#d3dae3', vibe: 'Mastery lab · each tube fills as a topic sticks' },
  vault: { label: 'Card Vault', accent: STATUS.success, wall: '#1a2127', floor: '#0f1519', furniture: '#1c232a', vibe: 'Card vault · recall lights (red = due)' },
  orbit: { label: 'Review Loop', accent: VIZ[4], wall: '#1d1526', floor: '#130e1a', furniture: '#372848', vibe: 'Review loop · recall nodes in orbit' },
  forge: { label: 'Forge', accent: EMBER[400], wall: '#281f15', floor: '#1b150e', furniture: '#46361d', vibe: 'Forge · ideas hammered into things' },
  workshop: { label: 'Workshop', accent: VIZ[5], wall: '#181d2a', floor: '#10141d', furniture: '#2c3550', vibe: 'Workshop · benches and blueprints' },
  depot: { label: 'Depot', accent: VIZ[6], wall: '#282216', floor: '#1c180f', furniture: '#7d5414', vibe: 'Depot · crates of shipped and shipping work' },
  pipeline: { label: 'Pipeline', accent: PLASMA[500], wall: '#15202a', floor: '#0e161d', furniture: '#233444', vibe: 'Pipeline · ideas → build → test → ship' },
};

/** Styles a room of each content type is drawn from (picked per room). */
export const CONTENT_STYLES: Record<PalaceContentType, RoomStyle[]> = {
  notes: ['library', 'observatory', 'lattice', 'network'],
  deck: ['laboratory', 'vault', 'orbit'],
  projects: ['forge', 'workshop', 'depot', 'pipeline'],
};

const NOTE_ACCENTS: readonly string[] = ROOM_ACCENTS.notes;
const PROJECT_ACCENTS: readonly string[] = ROOM_ACCENTS.projects;

/** Stable 32-bit FNV-1a hash (room styles, seeds). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Theme of one room: the style comes from its content type (picked by
 * the room key so neighbours differ), the accent from the content
 * itself when it has one (a deck's own colour).
 */
export function roomTheme(
  contentType: PalaceContentType,
  key: string,
  opts: { style?: RoomStyle; accent?: string } = {}
): RoomTheme {
  const h = hashString(key);
  const styles = CONTENT_STYLES[contentType];
  const style = opts.style ?? styles[h % styles.length];
  const base = ROOM_STYLES[style];
  const palette = contentType === 'notes' ? NOTE_ACCENTS : contentType === 'projects' ? PROJECT_ACCENTS : null;
  const accent = opts.accent ?? (palette && style !== 'archive' ? palette[(h >>> 5) % palette.length] : base.accent);
  return { contentType, style, ...base, accent };
}

// ─────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────

export type NoteObjectType = 'concept' | 'formula' | 'question';

export interface NoteLike {
  title?: string;
  content?: string;
  tags?: string[];
}

/** cube = concept, scroll = formula, sphere = question (spec 6.25). */
export function inferNoteType(note: NoteLike): NoteObjectType {
  const title = (note.title ?? '').toLowerCase().trim();
  const content = note.content ?? '';
  const lower = content.toLowerCase();
  if (title.endsWith('?') || /^(q\s*[:.)\d]|questions?\b|quiz\b|faq\b)/.test(title)) {
    return 'question';
  }
  const questionLines = content.split('\n').filter((l) => l.trim().endsWith('?')).length;
  if (questionLines >= 2) return 'question';
  if (
    /formula|equation|theorem|identity|\blaw\b|cheat ?sheet/.test(title) ||
    /\$[^$\n]+\$/.test(content) ||
    /(^|\n)\s*[a-z][\w()[\]]*\s*=\s*[^=\s]/i.test(content) ||
    lower.includes('formula')
  ) {
    return 'formula';
  }
  return 'concept';
}

export const NOTES_KEY = 'warrior-notes';

export interface PalaceNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  /** Folder the note is filed in, when the notes app provides one. */
  folder: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  type: NoteObjectType;
}

const EPOCH_ISO = new Date(0).toISOString();

function validIso(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

/** Raw notes string — cheap change detection for live palace growth. */
export function readNotesRaw(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(NOTES_KEY) ?? '';
  } catch {
    return '';
  }
}

function folderOf(n: Record<string, unknown>): string | null {
  const raw = typeof n.folder === 'string' ? n.folder : typeof n.folderName === 'string' ? n.folderName : '';
  const folder = raw.trim().slice(0, 60);
  return folder || null;
}

/** Parse notes from a raw warrior-notes string (real notes only, no seeds). */
export function parsePalaceNotes(raw: string): PalaceNote[] {
  let data: unknown;
  try {
    data = JSON.parse(raw || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: PalaceNote[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const n = item as Record<string, unknown>;
    if (typeof n.id !== 'string') continue;
    const title = typeof n.title === 'string' && n.title.trim() ? n.title.trim() : 'Untitled';
    const content = typeof n.content === 'string' ? n.content : '';
    const tags = Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : [];
    const createdAt = validIso(n.createdAt) ?? validIso(n.updatedAt) ?? EPOCH_ISO;
    const updatedAt = validIso(n.updatedAt) ?? createdAt;
    out.push({
      id: n.id,
      title,
      content,
      tags,
      folder: folderOf(n),
      createdAt,
      updatedAt,
      type: inferNoteType({ title, content, tags }),
    });
  }
  return out;
}

export function loadPalaceNotes(): PalaceNote[] {
  return parsePalaceNotes(readNotesRaw());
}

/** Lower-case, no '#', punctuation → single spaces ("React-Hooks" → "react hooks"). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────
// Knowledge objects + room groups
// ─────────────────────────────────────────────────────────────

export type PalaceItemKind = 'note' | 'card' | 'project';

/** cube / scroll / sphere for notes, an index card for deck cards, a crystal for projects. */
export type ObjectShape = NoteObjectType | 'card' | 'project';

export interface PalaceCardInfo {
  deckId: string;
  deckName: string;
  topicId: string;
  topicName: string;
  cardKind: CardKind;
  /** The correct answer as text (flashcards: the back side). */
  answer: string;
  explanation: string | null;
  /** Options of choice cards (null otherwise). */
  options: string[] | null;
  /** Indexes of the correct options (choice cards). */
  correct: number[] | null;
}

export interface PalaceProjectInfo {
  /** Project Forge stage: ideas · building · testing · shipped. */
  stage: string;
  /** 0–100. */
  progress: number;
  tasksDone: number;
  tasksTotal: number;
  techStack: string[];
  onHold: boolean;
}

/** One object on a palace shelf: a note, a deck card or a project. */
export interface PalaceItem {
  /** Unique across kinds: 'note:<id>', 'card:<id>', 'project:<id>'. */
  id: string;
  kind: PalaceItemKind;
  /** Id of the note / card / project it stands for. */
  sourceId: string;
  title: string;
  /** Markdown shown in the hologram: note body, card prompt or project description. */
  body: string;
  tags: string[];
  /** Short caption: '#tag' / folder, 'Deck › Topic', project stage. */
  context: string;
  shape: ObjectShape;
  /** Room group the item belongs to. */
  groupKey: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
  card?: PalaceCardInfo;
  project?: PalaceProjectInfo;
}

/** A named 0..1 value drawn by data-driven decor (topic mastery, stage share). */
export interface RoomLevel {
  label: string;
  value: number;
}

/**
 * Everything that becomes a room (or, when big, several): a note folder,
 * a shared note tag, a deck, the projects, or an empty starter room.
 */
export interface PalaceGroup {
  /** 'folder:…', 'tag:…', 'notes:loose', 'deck:<id>', 'projects', 'starter:…'. */
  key: string;
  contentType: PalaceContentType;
  label: string;
  /** Forced room style (starter rooms, loose notes). */
  style?: RoomStyle;
  /** Accent override (a deck's own colour). */
  accent?: string;
  items: PalaceItem[];
  /** Floating words for the decor: note titles, topic names, project names. */
  words: string[];
  /** Empty room shown until the user has content of this type. */
  starter?: boolean;
  /** Sign text of an empty starter room. */
  hint?: string;
  /** Epoch ms of the group's first item — rooms keep their places as the palace grows. */
  since: number;
}

/** Live values drawn by a room's decor. */
export interface RoomDecorData {
  words: string[];
  /** Topic mastery (decks) or share of projects per stage (projects). */
  levels: RoomLevel[];
  /** Share of the room's objects due for review (0..1). */
  dueRatio: number;
  /** Share of never-studied cards (0..1). */
  newRatio: number;
}

// ─────────────────────────────────────────────────────────────
// Spaced repetition / review state
// ─────────────────────────────────────────────────────────────

export const PALACE_REVISIONS_KEY = 'warrior-palace-revisions';
const DAY_MS = 86_400_000;
const MAX_INTERVAL_DAYS = 30;

/** Palace-side review schedule of a single note. */
export interface PalaceRevisionEntry {
  lastRevised: string; // ISO
  interval: number; // days until next review
  count: number; // times revised in the palace
}

export type PalaceRevisionLog = Record<string, PalaceRevisionEntry>;

function readJSONKey(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function loadRevisionLog(): PalaceRevisionLog {
  const data = readJSONKey(PALACE_REVISIONS_KEY);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: PalaceRevisionLog = {};
  for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const e = v as Record<string, unknown>;
    const lastRevised = validIso(e.lastRevised);
    if (!lastRevised) continue;
    out[id] = {
      lastRevised,
      interval: typeof e.interval === 'number' && e.interval > 0 ? e.interval : 1,
      count: typeof e.count === 'number' && e.count > 0 ? e.count : 1,
    };
  }
  return out;
}

export function saveRevisionLog(log: PalaceRevisionLog): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PALACE_REVISIONS_KEY, JSON.stringify(log));
  } catch {
    /* quota — ignore */
  }
}

/**
 * Training Grounds schedule of a deck or one of its topics, derived from
 * useLearningStore reviews. A note whose tag or folder names the deck or
 * topic follows this schedule too (studying the cards refreshes the note).
 */
export interface DeckTopicSchedule {
  deckId: string;
  /** null = the whole deck. */
  topicId: string | null;
  /** Normalised deck / topic name notes are matched against. */
  name: string;
  /** 'Deck' or 'Deck › Topic'. */
  label: string;
  /** Latest review of any of its cards (epoch ms). */
  lastReviewedAt: number;
  /** Shortest current interval among its reviewed cards (days, ≥ 1). */
  intervalDays: number;
}

/** Schedules of every studied deck + topic. Pure: call inside useMemo. */
export function buildDeckSchedules(
  decks: readonly Deck[],
  reviews: Readonly<Record<string, CardReview>>
): DeckTopicSchedule[] {
  const out: DeckTopicSchedule[] = [];
  for (const deck of decks) {
    let deckLast = 0;
    let deckInterval = Infinity;
    for (const topic of deck.topics) {
      let last = 0;
      let interval = Infinity;
      for (const card of topic.cards) {
        const r = reviews[card.id];
        if (!r) continue;
        if (r.lastReviewedAt > last) last = r.lastReviewedAt;
        interval = Math.min(interval, Math.max(1, r.intervalDays));
      }
      if (last <= 0) continue;
      out.push({
        deckId: deck.id,
        topicId: topic.id,
        name: normalizeName(topic.name),
        label: `${deck.name} › ${topic.name}`,
        lastReviewedAt: last,
        intervalDays: interval,
      });
      deckLast = Math.max(deckLast, last);
      deckInterval = Math.min(deckInterval, interval);
    }
    if (deckLast > 0) {
      out.push({
        deckId: deck.id,
        topicId: null,
        name: normalizeName(deck.name),
        label: deck.name,
        lastReviewedAt: deckLast,
        intervalDays: deckInterval,
      });
    }
  }
  return out;
}

/** The deck/topic schedule a note is linked to by tag or folder (latest wins). */
export function findDeckSchedule(note: PalaceNote, schedules: readonly DeckTopicSchedule[]): DeckTopicSchedule | undefined {
  if (schedules.length === 0) return undefined;
  const names = new Set(note.tags.map(normalizeName));
  if (note.folder) names.add(normalizeName(note.folder));
  names.delete('');
  if (names.size === 0) return undefined;
  let best: DeckTopicSchedule | undefined;
  for (const s of schedules) {
    if (names.has(s.name) && (!best || s.lastReviewedAt > best.lastReviewedAt)) best = s;
  }
  return best;
}

export type RecencyBucket = 'today' | 'week' | 'month' | 'stale';

/**
 * Where an object's schedule comes from: the palace log, a linked deck,
 * the note's own edits, a card's review, a never-studied card, a project.
 */
export type ReviewSource = 'palace' | 'deck' | 'note' | 'card' | 'new' | 'project';

export interface PalaceReview {
  /** Most recent touch: edit, palace revision or Training Grounds review. */
  lastTouched: number;
  intervalDays: number;
  /** Epoch ms (Infinity for projects, which are never due). */
  dueAt: number;
  isDue: boolean;
  /** A deck card that was never answered. */
  isNew: boolean;
  overdueDays: number;
  recency: RecencyBucket;
  source: ReviewSource;
  /** Revised (note) or reviewed (card) within the last 24h. */
  revisedToday: boolean;
}

function recencyOf(lastTouched: number, now: number): RecencyBucket {
  const age = (now - lastTouched) / DAY_MS;
  return age < 1 ? 'today' : age < 7 ? 'week' : age < 30 ? 'month' : 'stale';
}

/**
 * Review state of a note. Writing/editing a note counts as a touch, so
 * does studying a linked deck/topic; the first review is due one day
 * later, and each palace revision doubles the interval (max 30d).
 */
export function computeNoteReview(
  note: PalaceNote,
  log: PalaceRevisionLog,
  schedules: readonly DeckTopicSchedule[],
  now: number
): PalaceReview {
  const palace = log[note.id];
  const linked = findDeckSchedule(note, schedules);
  const touches = [Date.parse(note.updatedAt)];
  if (palace) touches.push(Date.parse(palace.lastRevised));
  if (linked) touches.push(linked.lastReviewedAt);
  const lastTouched = Math.max(...touches.filter((t) => !Number.isNaN(t)), 0);
  const intervalDays = palace ? palace.interval : linked ? Math.max(1, linked.intervalDays) : 1;
  const dueAt = lastTouched + intervalDays * DAY_MS;
  const palaceTs = palace ? Date.parse(palace.lastRevised) : Number.NaN;
  return {
    lastTouched,
    intervalDays,
    dueAt,
    isDue: now >= dueAt,
    isNew: false,
    overdueDays: Math.max(0, Math.floor((now - dueAt) / DAY_MS)),
    recency: recencyOf(lastTouched, now),
    source: palace ? 'palace' : linked ? 'deck' : 'note',
    revisedToday: !Number.isNaN(palaceTs) && now - palaceTs < DAY_MS,
  };
}

/** Review state of a deck card straight from its Training Grounds review. */
export function computeCardReview(
  card: Pick<PalaceItem, 'createdAt' | 'updatedAt'>,
  review: CardReview | undefined,
  now: number
): PalaceReview {
  if (review) {
    return {
      lastTouched: review.lastReviewedAt,
      intervalDays: Math.max(0, review.intervalDays),
      dueAt: review.dueAt,
      isDue: now >= review.dueAt,
      isNew: false,
      overdueDays: Math.max(0, Math.floor((now - review.dueAt) / DAY_MS)),
      recency: recencyOf(review.lastReviewedAt, now),
      source: 'card',
      revisedToday: now - review.lastReviewedAt < DAY_MS,
    };
  }
  const lastTouched = Math.max(card.createdAt, card.updatedAt, 0);
  return {
    lastTouched,
    intervalDays: 0,
    dueAt: lastTouched,
    isDue: false,
    isNew: true,
    overdueDays: 0,
    recency: recencyOf(lastTouched, now),
    source: 'new',
    revisedToday: false,
  };
}

/** Projects glow by recent activity; they are never due. */
export function computeProjectReview(updatedAt: number, now: number): PalaceReview {
  return {
    lastTouched: updatedAt,
    intervalDays: 0,
    dueAt: Number.POSITIVE_INFINITY,
    isDue: false,
    isNew: false,
    overdueDays: 0,
    recency: recencyOf(updatedAt, now),
    source: 'project',
    revisedToday: false,
  };
}

/**
 * Record a palace revision of a note: next interval doubles (capped at
 * 30 days). `counted` is false when the note was already revised in the
 * last 24h (the Curator counter only counts one revision per note per day).
 */
export function markNoteRevised(
  note: PalaceNote,
  log: PalaceRevisionLog,
  schedules: readonly DeckTopicSchedule[],
  now: number
): { log: PalaceRevisionLog; counted: boolean } {
  const review = computeNoteReview(note, log, schedules, now);
  const prev = log[note.id];
  const next: PalaceRevisionEntry = {
    lastRevised: new Date(now).toISOString(),
    interval: Math.min(MAX_INTERVAL_DAYS, Math.max(1, review.intervalDays) * 2),
    count: (prev?.count ?? 0) + 1,
  };
  const updated: PalaceRevisionLog = { ...log, [note.id]: next };
  saveRevisionLog(updated);
  return { log: updated, counted: !review.revisedToday };
}

// ─────────────────────────────────────────────────────────────
// Palace progress (built rooms, visits, revisions) + achievements
// ─────────────────────────────────────────────────────────────

export const PALACE_PROGRESS_KEY = 'warrior-palace-state';

export interface PalaceProgress {
  v: 2;
  /** Build unit keys already built (new keys animate brick by brick). */
  builtRooms: string[];
  /** Room groups ever visited ('deck:…', 'tag:…', 'folder:…', 'projects'…). */
  visitedRooms: string[];
  /** Revisions counted toward "Curator". */
  revisions: number;
  /** Entered (pointer-locked) at least once. */
  entered: boolean;
}

/**
 * v1 → v2: v1 rooms were a fixed list that no longer exists, so v1 room
 * keys and visits ('visitedSubjects') are dropped; built corridor
 * extensions / wings / hall, the revision count and the entered flag
 * carry over.
 */
export function loadPalaceProgress(): PalaceProgress {
  const data = readJSONKey(PALACE_PROGRESS_KEY);
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    v: 2,
    builtRooms: d.v === 2 ? strings(d.builtRooms) : strings(d.builtRooms).filter((k) => /^(ext#\d+|wing#\d+|hall)$/.test(k)),
    visitedRooms: d.v === 2 ? strings(d.visitedRooms) : [],
    revisions: typeof d.revisions === 'number' && d.revisions > 0 ? d.revisions : 0,
    entered: d.entered === true,
  };
}

export function savePalaceProgress(progress: PalaceProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PALACE_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export const PALACE_ACHIEVEMENT_IDS = {
  architect: 'palace-architect',
  cartographer: 'memory-cartographer',
  grandLibrary: 'palace-grand-library',
  wisdom: 'palace-of-wisdom',
  curator: 'palace-curator',
  ghostOfKnowledge: 'ghost-of-knowledge',
} as const;

export const GRAND_LIBRARY_OBJECTS = 50;
export const CURATOR_REVISIONS = 100;
export const CARTOGRAPHER_ROOMS = 5;
/** "Palace of Wisdom" needs every room visited, in a palace of at least this many rooms. */
export const WISDOM_MIN_ROOMS = 5;

/**
 * Re-apply every palace achievement whose condition is already met
 * (idempotent). `roomGroups` = the palace's current (non-starter) rooms.
 */
export function reconcilePalaceAchievements(
  progress: PalaceProgress,
  objectCount: number,
  roomGroups: readonly string[]
): void {
  if (progress.entered) unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.architect);
  if (objectCount >= GRAND_LIBRARY_OBJECTS) unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.grandLibrary);
  if (progress.revisions >= CURATOR_REVISIONS) unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.curator);
  if (roomGroups.length >= WISDOM_MIN_ROOMS && roomGroups.every((g) => progress.visitedRooms.includes(g))) {
    unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.wisdom);
  }
}
