// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: data layer
// Notes (warrior-notes) → palace objects with inferred subject, GATE
// topic and object type; spaced-repetition review state (palace log +
// GATE Arena's warrior-revisions); palace progress + achievements.
// Pure TypeScript — no React, no three.js (the dream engine uses it).
// ═══════════════════════════════════════════════════════════

import type { GateSubject } from '@/types/gate';
import { getTopicsForSubject } from '@/data/gate-questions';
import { unlockPhase6Achievement } from '@/components/creature/osBridge';

// ─────────────────────────────────────────────────────────────
// Subjects + room themes
// ─────────────────────────────────────────────────────────────

/** Rooms are GATE subjects, plus a General archive for unmatched notes. */
export type PalaceSubject = GateSubject | 'General';
export type NoteObjectType = 'concept' | 'formula' | 'question';

export const GATE_SUBJECTS: GateSubject[] = [
  'DBMS',
  'OS',
  'CN',
  'TOC',
  'COA',
  'DAA',
  'Compiler Design',
  'Digital Logic',
  'Discrete Math',
  'Engineering Math',
  'C Programming',
  'Data Structures',
];

/** Visual style family for a room's furniture + props. */
export type RoomStyle =
  | 'library'
  | 'server'
  | 'network'
  | 'abstract'
  | 'warehouse'
  | 'laboratory'
  | 'lattice'
  | 'foundry'
  | 'forge'
  | 'bay'
  | 'observatory'
  | 'workshop'
  | 'archive';

export interface RoomTheme {
  subject: PalaceSubject;
  label: string;
  /** accent glow colour (hex) */
  accent: string;
  /** wall base colour (hex) */
  wall: string;
  /** floor colour (hex) */
  floor: string;
  /** furniture colour (shelves, racks, benches) */
  furniture: string;
  style: RoomStyle;
  /** short descriptive vibe used in labels */
  vibe: string;
}

export const ROOM_THEMES: Record<PalaceSubject, RoomTheme> = {
  DBMS: { subject: 'DBMS', label: 'DBMS Library', accent: '#4fc3f7', wall: '#3a2a1c', floor: '#2a1d12', furniture: '#6b4a2e', style: 'library', vibe: 'Dark library · wooden shelves · floating SQL' },
  OS: { subject: 'OS', label: 'OS Server Room', accent: '#00e676', wall: '#1b2226', floor: '#101518', furniture: '#1d2328', style: 'server', vibe: 'Server room · rack cabinets · blinking LEDs' },
  CN: { subject: 'CN', label: 'Network Lab', accent: '#7c4dff', wall: '#1d1d30', floor: '#131322', furniture: '#2b2b44', style: 'network', vibe: 'Network lab · glowing cables · routers' },
  TOC: { subject: 'TOC', label: 'Automata Space', accent: '#ff4081', wall: '#1e1426', floor: '#140d1a', furniture: '#3a2748', style: 'abstract', vibe: 'Abstract math space · floating automata' },
  'Data Structures': { subject: 'Data Structures', label: 'DS Warehouse', accent: '#ffab00', wall: '#2a2416', floor: '#1d190f', furniture: '#8a5a12', style: 'warehouse', vibe: 'Warehouse · stacked data structures' },
  DAA: { subject: 'DAA', label: 'Algo Laboratory', accent: '#ff5252', wall: '#241a1c', floor: '#181113', furniture: '#d7dde3', style: 'laboratory', vibe: 'Laboratory · sorting tubes' },
  'Discrete Math': { subject: 'Discrete Math', label: 'Discrete Hall', accent: '#18ffff', wall: '#15222a', floor: '#0e171c', furniture: '#26404b', style: 'lattice', vibe: 'Logic lattice · sets & graphs' },
  'Digital Logic': { subject: 'Digital Logic', label: 'Gate Foundry', accent: '#64ffda', wall: '#172422', floor: '#0f1817', furniture: '#2a3d39', style: 'foundry', vibe: 'Foundry · logic gates · circuit traces' },
  'Compiler Design': { subject: 'Compiler Design', label: 'Compiler Forge', accent: '#ffd740', wall: '#2a2214', floor: '#1c170d', furniture: '#4a3a1c', style: 'forge', vibe: 'Forge · parse trees · token blocks' },
  COA: { subject: 'COA', label: 'Architecture Bay', accent: '#40c4ff', wall: '#15202a', floor: '#0e161d', furniture: '#233444', style: 'bay', vibe: 'Bay · pipelines & caches' },
  'Engineering Math': { subject: 'Engineering Math', label: 'Math Observatory', accent: '#b388ff', wall: '#1f1a2c', floor: '#15111f', furniture: '#352c4d', style: 'observatory', vibe: 'Observatory · matrices & waves' },
  'C Programming': { subject: 'C Programming', label: 'C Workshop', accent: '#82b1ff', wall: '#181d2a', floor: '#10141d', furniture: '#2c3550', style: 'workshop', vibe: 'Workshop · memory cells & pointers' },
  General: { subject: 'General', label: 'General Archive', accent: '#b0bec5', wall: '#22262b', floor: '#171a1e', furniture: '#4a4f57', style: 'archive', vibe: 'Archive · everything else you wrote' },
};

// ─────────────────────────────────────────────────────────────
// Subject / topic / type inference
// ─────────────────────────────────────────────────────────────

const SUBJECT_TAG_ALIASES: Record<GateSubject, string[]> = {
  DBMS: ['dbms', 'db', 'database', 'databases', 'sql'],
  OS: ['os', 'operating-system', 'operating system', 'operating systems'],
  CN: ['cn', 'network', 'networks', 'networking', 'computer networks'],
  TOC: ['toc', 'automata', 'theory of computation'],
  COA: ['coa', 'co', 'computer organization', 'architecture'],
  DAA: ['daa', 'algo', 'algos', 'algorithm', 'algorithms'],
  'Compiler Design': ['cd', 'compiler', 'compilers', 'compiler design'],
  'Digital Logic': ['dl', 'dld', 'digital', 'digital logic'],
  'Discrete Math': ['dm', 'discrete', 'discrete math', 'discrete maths'],
  'Engineering Math': ['em', 'math', 'maths', 'engineering math', 'engineering maths'],
  'C Programming': ['c', 'clang', 'c programming'],
  'Data Structures': ['ds', 'dsa', 'data structure', 'data structures'],
};

const SUBJECT_KEYWORDS: Record<GateSubject, string[]> = {
  DBMS: ['database', 'sql', 'normalization', 'normal form', 'bcnf', '3nf', 'transaction', 'acid', 'serializab', 'er model', 'er diagram', 'relational', 'b+ tree', 'indexing', 'functional dependenc', 'foreign key', 'primary key'],
  OS: ['operating system', 'process', 'thread', 'scheduling', 'deadlock', 'semaphore', 'mutex', 'paging', 'page fault', 'virtual memory', 'segmentation', 'banker', 'critical section', 'context switch', 'disk scheduling', 'file system', 'tlb'],
  CN: ['network', 'tcp', 'udp', 'ip address', 'ipv4', 'ipv6', 'routing', 'router', 'osi', 'subnet', 'dns', 'http', 'congestion', 'sliding window', 'data link', 'mac address', 'ethernet', 'packet', 'handshake', 'csma'],
  TOC: ['automata', 'dfa', 'nfa', 'regular expression', 'regular language', 'grammar', 'turing', 'pushdown', 'context free', 'context-free', 'pumping lemma', 'decidab', 'chomsky'],
  COA: ['pipeline', 'pipelining', 'cache', 'cpu', 'memory hierarchy', 'instruction', 'alu', 'addressing mode', 'microprogram', 'hazard', 'computer organization', 'interrupt', 'dma'],
  DAA: ['algorithm', 'sorting', 'quicksort', 'merge sort', 'greedy', 'dynamic programming', 'complexity', 'big o', 'divide and conquer', 'dijkstra', 'master theorem', 'recurrence', 'backtracking', 'knapsack', 'kruskal', 'prim'],
  'Compiler Design': ['compiler', 'parser', 'parsing', 'lexer', 'lexical', 'll(1)', 'lr(0)', 'slr', 'lalr', 'syntax directed', 'three address', 'intermediate code', 'code generation', 'code optimization', 'first and follow', 'symbol table'],
  'Digital Logic': ['logic gate', 'boolean', 'k-map', 'kmap', 'karnaugh', 'flip flop', 'flip-flop', 'multiplexer', 'decoder', 'combinational', 'sequential circuit', 'counter', 'digital logic', 'number system', "2's complement", 'twos complement'],
  'Discrete Math': ['discrete', 'set theory', 'graph theory', 'combinatorics', 'propositional', 'predicate', 'group theory', 'lattice', 'induction', 'pigeonhole', 'permutation', 'poset'],
  'Engineering Math': ['matrix', 'matrices', 'eigen', 'calculus', 'probability', 'integral', 'derivative', 'linear algebra', 'statistics', 'determinant', 'differential', 'random variable'],
  'C Programming': ['c programming', 'pointer', 'malloc', 'calloc', 'struct', 'printf', 'scanf', 'c language', 'preprocessor', '#include', 'storage class'],
  'Data Structures': ['data structure', 'stack', 'queue', 'linked list', 'binary tree', 'bst', 'avl', 'heap', 'hashing', 'hash table', 'trie', 'graph traversal', 'bfs', 'dfs'],
};

const topicCache = new Map<GateSubject, string[]>();

function topicsFor(subject: GateSubject): string[] {
  let topics = topicCache.get(subject);
  if (!topics) {
    try {
      topics = getTopicsForSubject(subject);
    } catch {
      topics = [];
    }
    topicCache.set(subject, topics);
  }
  return topics;
}

function hasWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

export interface NoteLike {
  title?: string;
  content?: string;
  tags?: string[];
}

/**
 * Best-matching GATE subject + topic for a note. Tags weigh most, then
 * the title, then the body. Notes with no clear signal go to 'General'
 * (never an arbitrary subject).
 */
export function inferNoteSubject(note: NoteLike): { subject: PalaceSubject; topic: string | null } {
  const title = (note.title ?? '').toLowerCase();
  const content = (note.content ?? '').toLowerCase().slice(0, 6000);
  const tags = (note.tags ?? []).map((t) => t.toLowerCase().trim().replace(/^#/, ''));

  let best: GateSubject | null = null;
  let bestScore = 0;
  let bestTopic: string | null = null;

  for (const subject of GATE_SUBJECTS) {
    let score = 0;
    if (tags.some((t) => SUBJECT_TAG_ALIASES[subject].includes(t))) score += 12;
    if (hasWord(title, subject.toLowerCase())) score += 6;
    for (const kw of SUBJECT_KEYWORDS[subject]) {
      if (title.includes(kw)) score += 3;
      if (tags.some((t) => t.includes(kw))) score += 3;
      if (content.includes(kw)) score += 1;
    }
    let topic: string | null = null;
    let topicScore = 0;
    for (const t of topicsFor(subject)) {
      const tl = t.toLowerCase();
      const s = (title.includes(tl) ? 4 : 0) + (tags.includes(tl) ? 4 : 0) + (content.includes(tl) ? 1 : 0);
      if (s > topicScore) {
        topicScore = s;
        topic = t;
      }
    }
    score += topicScore;
    if (score > bestScore) {
      bestScore = score;
      best = subject;
      bestTopic = topic;
    }
  }

  if (!best || bestScore < 2) return { subject: 'General', topic: null };
  return { subject: best, topic: bestTopic };
}

/** cube = concept, scroll = formula, sphere = question (spec 6.25). */
export function inferNoteType(note: NoteLike): NoteObjectType {
  const title = (note.title ?? '').toLowerCase().trim();
  const content = note.content ?? '';
  const lower = content.toLowerCase();
  if (
    title.endsWith('?') ||
    /^(q\s*[:.)\d]|question|pyq)/.test(title) ||
    /\bpyq\b|\bgate\s?(19|20)\d\d\b/.test(title)
  ) {
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

// ─────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────

export const NOTES_KEY = 'warrior-notes';

export interface PalaceNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  subject: PalaceSubject;
  topic: string | null;
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
    const tags = Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string') : [];
    const createdAt = validIso(n.createdAt) ?? validIso(n.updatedAt) ?? EPOCH_ISO;
    const updatedAt = validIso(n.updatedAt) ?? createdAt;
    const { subject, topic } = inferNoteSubject({ title, content, tags });
    out.push({
      id: n.id,
      title,
      content,
      tags,
      createdAt,
      updatedAt,
      subject,
      topic,
      type: inferNoteType({ title, content, tags }),
    });
  }
  return out;
}

export function loadPalaceNotes(): PalaceNote[] {
  return parsePalaceNotes(readNotesRaw());
}

// ─────────────────────────────────────────────────────────────
// Spaced repetition
// ─────────────────────────────────────────────────────────────

export const PALACE_REVISIONS_KEY = 'warrior-palace-revisions';
export const GATE_REVISIONS_KEY = 'warrior-revisions';
const DAY_MS = 86_400_000;
const MAX_INTERVAL_DAYS = 30;

/** Palace-side review schedule of a single note. */
export interface PalaceRevisionEntry {
  lastRevised: string; // ISO
  interval: number; // days until next review
  count: number; // times revised in the palace
}

export type PalaceRevisionLog = Record<string, PalaceRevisionEntry>;

/** GATE Arena topic revision entry (read-only here). */
export interface GateRevisionEntry {
  subject: string;
  topic: string;
  lastRevised: string;
  interval: number;
}

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

/** GATE Arena's topic schedule (subject + topic → last revised + interval). */
export function loadGateRevisions(): GateRevisionEntry[] {
  const data = readJSONKey(GATE_REVISIONS_KEY);
  if (!Array.isArray(data)) return [];
  return data.filter(
    (e): e is GateRevisionEntry =>
      Boolean(e) &&
      typeof e === 'object' &&
      typeof (e as GateRevisionEntry).subject === 'string' &&
      typeof (e as GateRevisionEntry).topic === 'string' &&
      validIso((e as GateRevisionEntry).lastRevised) !== null &&
      typeof (e as GateRevisionEntry).interval === 'number'
  );
}

export type RecencyBucket = 'today' | 'week' | 'month' | 'stale';

export interface NoteReview {
  /** Most recent touch: note edit, palace revision or GATE topic revision. */
  lastTouched: number;
  intervalDays: number;
  dueAt: number;
  isDue: boolean;
  overdueDays: number;
  recency: RecencyBucket;
  /** Where the schedule came from. */
  source: 'palace' | 'gate' | 'note';
  /** Revised in the palace within the last 24h. */
  revisedToday: boolean;
}

function findGateEntry(note: PalaceNote, gate: GateRevisionEntry[]): GateRevisionEntry | undefined {
  if (!note.topic) return undefined;
  return gate.find((g) => g.subject === note.subject && g.topic === note.topic);
}

/**
 * Review state of a note. Writing/editing a note counts as a touch;
 * the first review is due one day later (same rule as GATE Arena's
 * spaced repetition), and each revision doubles the interval (max 30d).
 */
export function computeNoteReview(
  note: PalaceNote,
  log: PalaceRevisionLog,
  gate: GateRevisionEntry[],
  now: number
): NoteReview {
  const palace = log[note.id];
  const gateEntry = findGateEntry(note, gate);
  const touches = [Date.parse(note.updatedAt)];
  if (palace) touches.push(Date.parse(palace.lastRevised));
  if (gateEntry) touches.push(Date.parse(gateEntry.lastRevised));
  const lastTouched = Math.max(...touches.filter((t) => !Number.isNaN(t)), 0);
  const intervalDays = palace ? palace.interval : gateEntry ? Math.max(1, gateEntry.interval) : 1;
  const dueAt = lastTouched + intervalDays * DAY_MS;
  const age = (now - lastTouched) / DAY_MS;
  const recency: RecencyBucket = age < 1 ? 'today' : age < 7 ? 'week' : age < 30 ? 'month' : 'stale';
  const palaceTs = palace ? Date.parse(palace.lastRevised) : Number.NaN;
  return {
    lastTouched,
    intervalDays,
    dueAt,
    isDue: now >= dueAt,
    overdueDays: Math.max(0, Math.floor((now - dueAt) / DAY_MS)),
    recency,
    source: palace ? 'palace' : gateEntry ? 'gate' : 'note',
    revisedToday: !Number.isNaN(palaceTs) && now - palaceTs < DAY_MS,
  };
}

/**
 * Record a palace revision: next interval doubles (capped at 30 days).
 * `counted` is false when the note was already revised in the last 24h
 * (the Curator counter only counts one revision per note per day).
 */
export function markNoteRevised(
  note: PalaceNote,
  log: PalaceRevisionLog,
  gate: GateRevisionEntry[],
  now: number
): { log: PalaceRevisionLog; counted: boolean } {
  const review = computeNoteReview(note, log, gate, now);
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
  v: 1;
  /** Room keys already built (new keys animate brick by brick). */
  builtRooms: string[];
  /** GATE subjects whose room was ever visited. */
  visitedSubjects: string[];
  /** Revisions counted toward "Curator". */
  revisions: number;
  /** Entered (pointer-locked) at least once. */
  entered: boolean;
}

export function loadPalaceProgress(): PalaceProgress {
  const data = readJSONKey(PALACE_PROGRESS_KEY);
  const d = (data && typeof data === 'object' ? data : {}) as Partial<PalaceProgress>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    v: 1,
    builtRooms: strings(d.builtRooms),
    visitedSubjects: strings(d.visitedSubjects),
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

/** Re-apply every palace achievement whose condition is already met (idempotent). */
export function reconcilePalaceAchievements(progress: PalaceProgress, objectCount: number): void {
  if (progress.entered) unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.architect);
  if (objectCount >= GRAND_LIBRARY_OBJECTS) unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.grandLibrary);
  if (progress.revisions >= CURATOR_REVISIONS) unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.curator);
  if (GATE_SUBJECTS.every((s) => progress.visitedSubjects.includes(s))) {
    unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.wisdom);
  }
}
