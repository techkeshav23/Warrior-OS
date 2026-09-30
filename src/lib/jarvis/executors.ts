// ═══════════════════════════════════════════════════════════
// WARRIOR OS — JARVIS tool executors (browser)
//
// Runs the functions declared in ./tools.ts against the owner's live
// data and the OS, and returns a small JSON result for the model:
// { ok: true, ...data } or { ok: false, error }. Never throws.
// Reuses the same stores / helpers the apps and NEXUS use, so every
// write looks exactly like one made by hand (XP, achievements, open
// windows re-reading their data).
// ═══════════════════════════════════════════════════════════

'use client';

import { getLastKnownWeather, getLocalWeather } from '@/lib/weather';
import { useReminderStore, type Reminder } from '@/stores/useReminderStore';
import { JARVIS_TOOL_NAMES } from './tools';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNexusStore } from '@/stores/useNexusStore';
import { useXPStore } from '@/stores/useXPStore';
import { useJarvisStore } from '@/stores/useJarvisStore';
import {
  cardAnswerText,
  collectDueCards,
  deckCards,
  normalizeCardInput,
  useLearningStore,
} from '@/stores/useLearningStore';
import { CALENDAR_CATEGORY_COLORS, REMINDER_OPTIONS, useCalendarStore } from '@/stores/useCalendarStore';
import {
  MAX_EXPENSE_AMOUNT,
  MAX_EXPENSE_NOTE_LENGTH,
  monthKeyOfDate,
  resolveMonthBudget,
  sumExpenses,
  useExpenseStore,
} from '@/stores/useExpenseStore';
import {
  FORGE_STAGES,
  effectiveProgress,
  useProjectForgeStore,
} from '@/stores/useProjectForgeStore';
import { resolveAppId } from '@/data/app-registry';
import { buildNexusContext, describePomodoro, formatClock, getLearningInsights, pomodoroRemainingMs } from '@/lib/nexus/context';
import { checkHabitToday, findHabit, guessExpenseCategory, listHabits } from '@/lib/nexus/quick-actions';
import { openOrFocusApp } from '@/lib/nexus/windows';
import { emitWarriorEvent, WARRIOR_EVENTS, type WarriorTrainingStartDetail } from '@/lib/nexus/events';
import { announceStorageWrite } from '@/lib/storage-sync';
import { applyWallpaperToWorkspace, cycleWallpaperId, randomWallpaperId, wallpaperIds } from '@/lib/wallpaper-cycle';
import { WALLPAPERS, wallpaperLabel } from '@/components/apps/settings/wallpapers';
import { deckTargetLabel, resolveDeckTarget } from '@/components/apps/training-grounds/deep-link';
import { parseStoredHabits } from '@/components/apps/habit-forge/streak';
import { currentStreak } from '@/components/achievements/day-streak';
import { collectStudyDays } from '@/components/achievements/study-streak';
import { utcDayKey } from '@/components/achievements/award';
import { rewardNoteCreated } from '@/components/apps/notes-archive/note-rewards';
import { plainSnippet, plainText } from '@/components/apps/notes-archive/markdown';
import {
  expandOccurrences,
  isValidDateKey,
  shiftDateKey,
  toDateKey,
} from '@/components/apps/calendar/calendar-utils';
import { checkCalendarPlannerAchievement } from '@/components/apps/calendar/calendar-achievements';
import type { CalendarEventCategory, CalendarOccurrence } from '@/types/calendar';
import type { ExpenseCategory } from '@/types/expense';
import type { ForgeStage } from '@/types/project-forge';
import type { NexusTrainingMode } from '@/types/nexus';
import type { WorkspaceId } from '@/types/workspace';
import { playWarriorAction, useWarriorActionStore } from '@/components/warrior3d/store';
import type { WarriorAction } from '@/components/warrior3d/types';

type ToolArgs = Record<string, unknown>;
type ToolResult = Record<string, unknown>;

const LIST_CAP = 50;
const SNIPPET = 160;
const NOTE_READ_MAX = 8000;

// ═══════════════════════════════════════════════════════════
// Small helpers
// ═══════════════════════════════════════════════════════════

function ok(data: ToolResult = {}): ToolResult {
  return { ok: true, ...data };
}

function fail(error: string): ToolResult {
  return { ok: false, error };
}

/** Trimmed string arg (numbers accepted), capped at `max`. */
function argStr(args: ToolArgs, key: string, max: number): string {
  const v = args[key];
  const s = typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  return s.trim().slice(0, max);
}

/** Finite number arg (numeric strings accepted), or null. */
function argNum(args: ToolArgs, key: string): number | null {
  const v = args[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/[,₹\s]/g, '')) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Integer arg clamped to [min, max], `fallback` when missing / invalid. */
function argInt(args: ToolArgs, key: string, fallback: number, min: number, max: number): number {
  const n = argNum(args, key);
  if (n === null) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** One line of text, whitespace collapsed, capped with an ellipsis. */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Lower-case words only, for loose name matching. */
function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#]+/gu, ' ')
    .trim();
}

function todayKey(): string {
  return toDateKey(new Date());
}

function localIsoWithOffset(date: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return (
    `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  );
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  } catch {
    return 'local';
  }
}

/** Accepts "9:05", "09:05", "9.05" → "09:05"; null when not a 24h time. */
function cleanTime(raw: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Best match of `query` among named items: exact → prefix → contains → shared words. */
function bestByName<T>(items: readonly T[], query: string, nameOf: (item: T) => string): T | null {
  const q = norm(query);
  if (!q) return null;
  const named = items.map((item) => ({ item, name: norm(nameOf(item)) }));
  const exact = named.find((n) => n.name === q);
  if (exact) return exact.item;
  const prefix = named.find((n) => n.name.startsWith(q));
  if (prefix) return prefix.item;
  const contains = named.find((n) => n.name.includes(q) || (n.name.length >= 3 && q.includes(n.name)));
  if (contains) return contains.item;
  const words = q.split(' ').filter((w) => w.length >= 3);
  let best: T | null = null;
  let bestScore = 0;
  for (const n of named) {
    const nameWords = n.name.split(' ');
    const score = words.filter((w) => nameWords.some((nw) => nw.startsWith(w))).length;
    if (score > bestScore) {
      best = n.item;
      bestScore = score;
    }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════
// Notes (raw localStorage list, same shape as the Notes app)
// ═══════════════════════════════════════════════════════════

const NOTES_KEY = 'warrior-notes';
const MAX_NOTE_TITLE = 200;
const MAX_NOTE_CONTENT = 50_000;
const MAX_APPEND = 10_000;
const MAX_NOTE_TAGS = 12;

interface StoredNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  [key: string]: unknown;
}

/** Same normaliser as NotesApp's parseNotes (extra fields are kept). */
function loadNotes(): StoredNote[] {
  if (typeof window === 'undefined') return [];
  let data: unknown;
  try {
    data = JSON.parse(window.localStorage.getItem(NOTES_KEY) || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return data.flatMap((item, i): StoredNote[] => {
    if (typeof item !== 'object' || item === null) return [];
    const n = item as Partial<StoredNote>;
    return [
      {
        ...n,
        id: typeof n.id === 'string' && n.id ? n.id : `note-restored-${i}`,
        title: str(n.title),
        content: str(n.content),
        tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string') : [],
        createdAt: str(n.createdAt),
        updatedAt: str(n.updatedAt),
      },
    ];
  });
}

/** Persist the list and tell open Notes windows; false when storage refused it. */
function saveNotes(notes: StoredNote[]): boolean {
  try {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    return false;
  }
  announceStorageWrite(NOTES_KEY);
  return true;
}

function noteTime(note: StoredNote): number {
  const t = Date.parse(note.updatedAt || note.createdAt);
  return Number.isFinite(t) ? t : 0;
}

/** Note by id, else by title (exact → prefix → contains → shared words); newest wins ties. */
function findNote(notes: StoredNote[], ref: string): StoredNote | null {
  const byId = notes.find((n) => n.id === ref);
  if (byId) return byId;
  const newestFirst = [...notes].sort((a, b) => noteTime(b) - noteTime(a));
  return bestByName(newestFirst, ref, (n) => n.title);
}

function noteSummary(note: StoredNote): ToolResult {
  return {
    id: note.id,
    title: note.title || 'Untitled',
    tags: note.tags.slice(0, 10),
    updatedAt: note.updatedAt,
  };
}

/** A ~160-char plain-text window around the first query word found in the body. */
function noteSnippet(note: StoredNote, words: string[]): string {
  const body = plainText(note.content);
  const lower = body.toLowerCase();
  for (const w of words) {
    const at = lower.indexOf(w);
    if (at >= 0) {
      const start = Math.max(0, at - 50);
      const piece = body.slice(start, start + SNIPPET - 2);
      return `${start > 0 ? '…' : ''}${piece}${start + SNIPPET - 2 < body.length ? '…' : ''}`;
    }
  }
  return plainSnippet(note.content, note.title, SNIPPET);
}

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const tags = raw
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim().replace(/^#+/, '').replace(/\s+/g, '-').slice(0, 40))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_NOTE_TAGS);
}

function searchNotes(args: ToolArgs): ToolResult {
  const query = argStr(args, 'query', 200);
  if (!query) return fail('Give some words to search for.');
  const limit = argInt(args, 'limit', 8, 1, 25);
  const notes = loadNotes();
  if (notes.length === 0) return ok({ query, total: 0, results: [], note: 'The owner has no notes yet.' });
  const words = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 12);
  const phrase = query.toLowerCase();
  const scored: { note: StoredNote; score: number }[] = [];
  for (const note of notes) {
    const title = note.title.toLowerCase();
    const tags = note.tags.join(' ').toLowerCase();
    const body = note.content.toLowerCase();
    let score = 0;
    let matched = 0;
    for (const w of words) {
      const hit = (title.includes(w) ? 3 : 0) + (tags.includes(w) ? 2 : 0) + (body.includes(w) ? 1 : 0);
      if (hit > 0) matched += 1;
      score += hit;
    }
    if (matched === 0) continue;
    if (title.includes(phrase)) score += 5;
    else if (body.includes(phrase)) score += 2;
    score += matched === words.length ? 4 : 0;
    scored.push({ note, score });
  }
  scored.sort((a, b) => b.score - a.score || noteTime(b.note) - noteTime(a.note));
  return ok({
    query,
    total: scored.length,
    results: scored.slice(0, limit).map(({ note }) => ({ ...noteSummary(note), snippet: noteSnippet(note, words) })),
  });
}

function readNote(args: ToolArgs): ToolResult {
  const ref = argStr(args, 'note', 200);
  if (!ref) return fail('Say which note (id or title).');
  const note = findNote(loadNotes(), ref);
  if (!note) return fail(`No note matches "${ref}".`);
  const truncated = note.content.length > NOTE_READ_MAX;
  return ok({
    ...noteSummary(note),
    createdAt: note.createdAt,
    content: truncated ? `${note.content.slice(0, NOTE_READ_MAX)}\n…[truncated]` : note.content,
    length: note.content.length,
    truncated,
  });
}

function createNote(args: ToolArgs): ToolResult {
  const title = argStr(args, 'title', MAX_NOTE_TITLE).replace(/\s+/g, ' ');
  const content = argStr(args, 'content', MAX_NOTE_CONTENT);
  if (!title) return fail('The note needs a title.');
  if (!content) return fail('The note needs some content.');
  const notes = loadNotes();
  const ids = new Set(notes.map((n) => n.id));
  let stamp = Date.now();
  while (ids.has(`note-${stamp}`)) stamp += 1;
  const iso = new Date().toISOString();
  const note: StoredNote = {
    id: `note-${stamp}`,
    title,
    content,
    tags: cleanTags(args.tags),
    createdAt: iso,
    updatedAt: iso,
  };
  if (!saveNotes([note, ...notes])) return fail('Browser storage is full or blocked; the note was not saved.');
  rewardNoteCreated();
  return ok({ ...noteSummary(note), chars: content.length });
}

function appendToNote(args: ToolArgs): ToolResult {
  const ref = argStr(args, 'note', 200);
  const text = argStr(args, 'text', MAX_APPEND);
  if (!ref) return fail('Say which note (id or title).');
  if (!text) return fail('Nothing to append.');
  const notes = loadNotes();
  const target = findNote(notes, ref);
  if (!target) return fail(`No note matches "${ref}".`);
  const base = target.content.replace(/\s+$/, '');
  const content = (base ? `${base}\n\n${text}` : text).slice(0, MAX_NOTE_CONTENT);
  const updated: StoredNote = { ...target, content, updatedAt: new Date().toISOString() };
  const next = notes.map((n) => (n.id === target.id ? updated : n));
  if (!saveNotes(next)) return fail('Browser storage is full or blocked; the note was not changed.');
  return ok({ ...noteSummary(updated), appendedChars: text.length, length: content.length });
}

// ═══════════════════════════════════════════════════════════
// Learning (decks, cards)
// ═══════════════════════════════════════════════════════════

function listDecks(): ToolResult {
  const { decks } = useLearningStore.getState();
  const insights = new Map(getLearningInsights(Date.now()).decks.map((d) => [d.id, d] as const));
  let dueTotal = 0;
  const rows = decks.map((deck) => {
    const info = insights.get(deck.id);
    dueTotal += info?.due ?? 0;
    return {
      name: deck.name,
      cards: info?.total ?? deckCards(deck).length,
      due: info?.due ?? 0,
      new: info?.fresh ?? 0,
      mastery: info?.mastery ?? 0,
      topics: deck.topics.slice(0, 20).map((t) => ({ name: t.name, cards: t.cards.length })),
      ...(deck.topics.length > 20 ? { moreTopics: deck.topics.length - 20 } : {}),
    };
  });
  return ok({
    total: decks.length,
    dueNow: dueTotal,
    decks: rows.slice(0, LIST_CAP),
    ...(decks.length > LIST_CAP ? { truncated: true } : {}),
  });
}

function getDueCards(args: ToolArgs): ToolResult {
  const deckQuery = argStr(args, 'deck', 120);
  const limit = argInt(args, 'limit', 10, 1, 30);
  const { decks, reviews } = useLearningStore.getState();
  if (decks.length === 0) return fail('There are no decks yet.');
  const target = deckQuery ? resolveDeckTarget(deckQuery, decks) : null;
  if (deckQuery && !target) {
    return fail(`No deck or topic matches "${deckQuery}". Decks: ${decks.slice(0, 12).map((d) => d.name).join(', ')}.`);
  }
  const scope = {
    now: Date.now(),
    deckId: target?.deckId,
    topicId: target?.topicId ?? undefined,
  };
  const due = collectDueCards(decks, reviews, { ...scope, includeNew: false });
  // Nothing due: offer never-studied cards instead, clearly flagged.
  const pool = due.length > 0 ? due : collectDueCards(decks, reviews, { ...scope, includeNew: true });
  const cards = pool.slice(0, limit).map((c) => ({
    deck: c.deckName,
    topic: c.topicName,
    kind: c.card.kind,
    question: clip(c.card.prompt, 400),
    ...(c.card.kind === 'mcq' || c.card.kind === 'multi-select'
      ? { options: c.card.options.map((o) => clip(o, 120)) }
      : {}),
    answer: clip(cardAnswerText(c.card), 400),
    ...(c.card.explanation ? { explanation: clip(c.card.explanation, 240) } : {}),
    ...(c.review === null ? { new: true } : {}),
  }));
  return ok({
    scope: deckQuery ? deckTargetLabel(deckQuery, decks) : 'all decks',
    dueCount: due.length,
    ...(due.length === 0 ? { note: 'Nothing is due; these are new (never studied) cards.' } : {}),
    cards,
  });
}

function createFlashcards(args: ToolArgs): ToolResult {
  const deckName = argStr(args, 'deck', 80).replace(/\s+/g, ' ');
  const topicName = argStr(args, 'topic', 80).replace(/\s+/g, ' ');
  if (!deckName) return fail('Say which deck the cards go in.');
  if (!Array.isArray(args.cards) || args.cards.length === 0) return fail('No cards given.');
  const inputs = args.cards
    .slice(0, 30)
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const r = raw as Record<string, unknown>;
      const front = typeof r.front === 'string' ? r.front : typeof r.question === 'string' ? r.question : '';
      const back = typeof r.back === 'string' ? r.back : typeof r.answer === 'string' ? r.answer : '';
      return normalizeCardInput({ kind: 'flashcard', front: front.trim(), back: back.trim() });
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  const skipped = Math.min(args.cards.length, 30) - inputs.length;
  if (inputs.length === 0) return fail('None of the cards had both a front and a back.');

  const store = useLearningStore.getState();
  const norm1 = norm(deckName);
  const existing = store.decks.find((d) => norm(d.name) === norm1);
  let deckId: string;
  let topicLabel = topicName || 'General';
  let createdDeck = false;
  let createdTopic = false;
  let added = 0;

  if (!existing) {
    deckId = store.createDeck({ name: deckName, topics: [{ name: topicLabel, cards: inputs }] });
    createdDeck = true;
    const deck = useLearningStore.getState().getDeck(deckId);
    added = deck ? deckCards(deck).length : inputs.length;
  } else {
    deckId = existing.id;
    let topicId: string | null = null;
    if (topicName) {
      const topic = existing.topics.find((t) => norm(t.name) === norm(topicName));
      if (topic) {
        topicId = topic.id;
        topicLabel = topic.name;
      } else {
        const newId = store.addTopic(deckId, { name: topicName, cards: inputs });
        if (!newId) return fail('Could not add the topic to that deck.');
        createdTopic = true;
        const topic2 = useLearningStore.getState().getDeck(deckId)?.topics.find((t) => t.id === newId);
        added = topic2?.cards.length ?? inputs.length;
      }
    } else {
      topicLabel = existing.topics[0]?.name ?? 'General';
    }
    if (!createdTopic) {
      for (const input of inputs) {
        if (useLearningStore.getState().addCard(deckId, topicId, input)) added += 1;
      }
    }
  }
  const deck = useLearningStore.getState().getDeck(deckId);
  return ok({
    deck: deck?.name ?? deckName,
    topic: topicLabel,
    added,
    ...(skipped > 0 ? { skipped } : {}),
    createdDeck,
    createdTopic,
    deckCards: deck ? deckCards(deck).length : added,
  });
}

// ═══════════════════════════════════════════════════════════
// Habits
// ═══════════════════════════════════════════════════════════

function habitStreaks(): Map<string, number> {
  const out = new Map<string, number>();
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem('warrior-habits') || '[]');
    const today = utcDayKey();
    for (const h of parseStoredHabits(raw)) out.set(h.id, currentStreak(new Set(h.completions), today));
  } catch {
    /* unreadable list: no streaks */
  }
  return out;
}

function studyStreak(): number {
  try {
    return currentStreak(collectStudyDays());
  } catch {
    return 0;
  }
}

function listHabitsTool(): ToolResult {
  const habits = listHabits();
  const streaks = habitStreaks();
  return ok({
    total: habits.length,
    doneToday: habits.filter((h) => h.doneToday).length,
    studyStreakDays: studyStreak(),
    habits: habits.slice(0, LIST_CAP).map((h) => ({
      name: h.name,
      doneToday: h.doneToday,
      streakDays: streaks.get(h.id) ?? 0,
    })),
  });
}

function checkHabit(args: ToolArgs): ToolResult {
  const query = argStr(args, 'habit', 120);
  if (!query) return fail('Say which habit.');
  const habits = listHabits();
  if (habits.length === 0) return fail('There are no habits in Habit Forge yet.');
  const habit = findHabit(query, habits);
  if (!habit) {
    return fail(`No habit matches "${query}". Habits: ${habits.slice(0, 12).map((h) => h.name).join(', ')}.`);
  }
  if (habit.doneToday) {
    return ok({ habit: habit.name, alreadyDone: true, streakDays: habitStreaks().get(habit.id) ?? 0 });
  }
  const xpBefore = useXPStore.getState().xp;
  const result = checkHabitToday(habit.name);
  const done = listHabits().find((h) => h.id === habit.id)?.doneToday === true;
  if (!result.ok || !done) return fail('Could not save the habit (storage full or blocked).');
  return ok({
    habit: habit.name,
    alreadyDone: false,
    streakDays: habitStreaks().get(habit.id) ?? 1,
    studyStreakDays: studyStreak(),
    xpGained: Math.max(0, useXPStore.getState().xp - xpBefore),
  });
}

// ═══════════════════════════════════════════════════════════
// Calendar
// ═══════════════════════════════════════════════════════════

const MAX_EVENT_RANGE_DAYS = 62;

function occurrenceRow(occ: CalendarOccurrence): ToolResult {
  const e = occ.event;
  return {
    date: occ.date,
    time: e.time ?? 'all-day',
    title: e.title,
    category: e.category,
    ...(e.recurrence !== 'none' ? { repeats: e.recurrence } : {}),
    ...(e.notes ? { note: clip(e.notes, 120) } : {}),
  };
}

function eventsBetween(from: string, to: string): CalendarOccurrence[] {
  return expandOccurrences(useCalendarStore.getState().events, from, to);
}

function listEvents(args: ToolArgs): ToolResult {
  const today = todayKey();
  const fromRaw = argStr(args, 'from', 10);
  const toRaw = argStr(args, 'to', 10);
  if (fromRaw && !isValidDateKey(fromRaw)) return fail('"from" must be a real date as YYYY-MM-DD.');
  if (toRaw && !isValidDateKey(toRaw)) return fail('"to" must be a real date as YYYY-MM-DD.');
  const from = fromRaw || today;
  let to = toRaw || shiftDateKey(from, 7);
  if (to < from) return fail('"to" is before "from".');
  let clamped = false;
  const maxTo = shiftDateKey(from, MAX_EVENT_RANGE_DAYS);
  if (to > maxTo) {
    to = maxTo;
    clamped = true;
  }
  const list = eventsBetween(from, to);
  return ok({
    from,
    to,
    ...(clamped ? { note: `Range shortened to ${MAX_EVENT_RANGE_DAYS} days.` } : {}),
    total: list.length,
    events: list.slice(0, LIST_CAP).map(occurrenceRow),
    ...(list.length > LIST_CAP ? { truncated: true } : {}),
  });
}

const CALENDAR_CATEGORY_ALIASES: Readonly<Record<string, CalendarEventCategory>> = {
  study: 'study',
  exam: 'study',
  class: 'study',
  lecture: 'study',
  learning: 'study',
  revision: 'study',
  project: 'project',
  work: 'project',
  build: 'project',
  meeting: 'project',
  coding: 'project',
  personal: 'personal',
  health: 'personal',
  gym: 'personal',
  social: 'personal',
  family: 'personal',
  other: 'personal',
};

function calendarCategory(raw: string): CalendarEventCategory {
  const key = norm(raw).split(' ')[0] ?? '';
  return CALENDAR_CATEGORY_ALIASES[key] ?? 'personal';
}

/** The calendar offers fixed lead times; snap to the closest (0 → none). */
function nearestReminderOption(minutes: number): number | null {
  if (minutes <= 0) return null;
  const options = REMINDER_OPTIONS.filter((m) => m > 0);
  return options.reduce((best, m) => (Math.abs(m - minutes) < Math.abs(best - minutes) ? m : best), options[0]);
}

function addEvent(args: ToolArgs): ToolResult {
  const title = argStr(args, 'title', 80).replace(/\s+/g, ' ');
  const date = argStr(args, 'date', 10);
  if (!title) return fail('The event needs a title.');
  if (!isValidDateKey(date)) return fail('The date must be a real day as YYYY-MM-DD.');
  const startRaw = argStr(args, 'start_time', 8);
  const endRaw = argStr(args, 'end_time', 8);
  const start = startRaw ? cleanTime(startRaw) : null;
  if (startRaw && !start) return fail('start_time must be HH:MM (24h).');
  const end = endRaw ? cleanTime(endRaw) : null;
  if (endRaw && !end) return fail('end_time must be HH:MM (24h).');
  const category = calendarCategory(argStr(args, 'category', 40));
  const note = argStr(args, 'note', 280);
  // The calendar stores a start time only, so the end time goes into the notes.
  const notes = [end && start ? `Until ${end}.` : '', note].filter(Boolean).join(' ');
  const event = useCalendarStore.getState().addEvent({
    title,
    date,
    time: start,
    category,
    color: CALENDAR_CATEGORY_COLORS[category],
    recurrence: 'none',
    recurUntil: null,
    // Timed events get a heads-up (default 10 min) from the calendar's own reminders.
    reminderMinutes: start ? nearestReminderOption(argInt(args, 'remind_minutes_before', 10, 0, 1440)) : null,
    notes,
  });
  try {
    checkCalendarPlannerAchievement();
  } catch {
    /* achievements are a bonus */
  }
  return ok({
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time ?? 'all-day',
    ...(end && start ? { endTime: end } : {}),
    category: event.category,
  });
}

// ═══════════════════════════════════════════════════════════
// Expenses
// ═══════════════════════════════════════════════════════════

const EXPENSE_IDS: readonly ExpenseCategory[] = ['food', 'transport', 'books', 'entertainment', 'other'];

const EXPENSE_ALIASES: Readonly<Record<string, ExpenseCategory>> = {
  food: 'food',
  groceries: 'food',
  grocery: 'food',
  snacks: 'food',
  drinks: 'food',
  dining: 'food',
  restaurant: 'food',
  eating: 'food',
  travel: 'transport',
  transport: 'transport',
  transportation: 'transport',
  commute: 'transport',
  fuel: 'transport',
  petrol: 'transport',
  cab: 'transport',
  taxi: 'transport',
  books: 'books',
  book: 'books',
  study: 'books',
  education: 'books',
  course: 'books',
  courses: 'books',
  stationery: 'books',
  fun: 'entertainment',
  entertainment: 'entertainment',
  movies: 'entertainment',
  movie: 'entertainment',
  games: 'entertainment',
  gaming: 'entertainment',
  music: 'entertainment',
  subscriptions: 'entertainment',
  bills: 'other',
  rent: 'other',
  shopping: 'other',
  health: 'other',
  other: 'other',
  misc: 'other',
};

function expenseCategory(raw: string, note = ''): ExpenseCategory {
  const words = norm(raw).split(' ').filter(Boolean);
  for (const w of words) {
    if ((EXPENSE_IDS as readonly string[]).includes(w)) return w as ExpenseCategory;
    const alias = EXPENSE_ALIASES[w];
    if (alias) return alias;
  }
  return guessExpenseCategory(`${raw} ${note}`);
}

function monthSummary(monthKey: string): ToolResult {
  const { expenses, budgets } = useExpenseStore.getState();
  const inMonth = expenses.filter((e) => monthKeyOfDate(e.date) === monthKey);
  const spent = sumExpenses(inMonth);
  const budget = resolveMonthBudget(budgets, monthKey).amount;
  return {
    month: monthKey,
    spent,
    budget,
    left: Math.round((budget - spent) * 100) / 100,
    usedPct: budget > 0 ? Math.round((spent / budget) * 100) : 0,
  };
}

function listExpenses(args: ToolArgs): ToolResult {
  const monthRaw = argStr(args, 'month', 7);
  if (monthRaw && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthRaw)) return fail('month must be YYYY-MM.');
  const month = monthRaw || todayKey().slice(0, 7);
  const categoryRaw = argStr(args, 'category', 40);
  const category = categoryRaw ? expenseCategory(categoryRaw) : null;
  const all = useExpenseStore
    .getState()
    .expenses.filter((e) => monthKeyOfDate(e.date) === month)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
  const byCategory: Record<string, number> = {};
  for (const id of EXPENSE_IDS) {
    const total = sumExpenses(all.filter((e) => e.category === id));
    if (total > 0) byCategory[id] = total;
  }
  const list = category ? all.filter((e) => e.category === category) : all;
  return ok({
    currency: 'INR',
    ...monthSummary(month),
    byCategory,
    ...(category ? { category, categoryTotal: sumExpenses(list) } : {}),
    count: list.length,
    expenses: list.slice(0, LIST_CAP).map((e) => ({
      date: e.date,
      amount: e.amount,
      category: e.category,
      ...(e.note ? { note: e.note } : {}),
    })),
    ...(list.length > LIST_CAP ? { truncated: true } : {}),
  });
}

function addExpense(args: ToolArgs): ToolResult {
  const amount = argNum(args, 'amount');
  if (amount === null || amount <= 0) return fail('The amount must be a positive number.');
  if (amount > MAX_EXPENSE_AMOUNT) return fail(`Amounts above ${MAX_EXPENSE_AMOUNT} are not accepted.`);
  const note = argStr(args, 'note', MAX_EXPENSE_NOTE_LENGTH);
  const category = expenseCategory(argStr(args, 'category', 40), note);
  const dateRaw = argStr(args, 'date', 10);
  if (dateRaw && !isValidDateKey(dateRaw)) return fail('date must be a real day as YYYY-MM-DD.');
  const today = todayKey();
  const date = dateRaw || today;
  const store = useExpenseStore.getState();
  store.startTracking(today);
  const expense = store.addExpense({ amount, category, note, date });
  return ok({
    id: expense.id,
    amount: expense.amount,
    category: expense.category,
    ...(expense.note ? { note: expense.note } : {}),
    date: expense.date,
    currency: 'INR',
    monthToDate: monthSummary(monthKeyOfDate(expense.date)),
  });
}

// ═══════════════════════════════════════════════════════════
// Projects (Project Forge)
// ═══════════════════════════════════════════════════════════

const STAGE_ALIASES: Readonly<Record<string, ForgeStage | 'hold'>> = {
  idea: 'ideas',
  ideas: 'ideas',
  backlog: 'ideas',
  planned: 'ideas',
  todo: 'ideas',
  building: 'building',
  build: 'building',
  active: 'building',
  progress: 'building',
  doing: 'building',
  wip: 'building',
  testing: 'testing',
  test: 'testing',
  review: 'testing',
  qa: 'testing',
  shipped: 'shipped',
  ship: 'shipped',
  done: 'shipped',
  complete: 'shipped',
  completed: 'shipped',
  finished: 'shipped',
  hold: 'hold',
  paused: 'hold',
  parked: 'hold',
  onhold: 'hold',
};

function projectMs(projectId: string): number {
  const { sessions, archivedMs, activeTimer } = useProjectForgeStore.getState();
  let total = archivedMs[projectId] ?? 0;
  for (const s of sessions) if (s.projectId === projectId) total += Math.max(0, s.end - s.start);
  if (activeTimer?.projectId === projectId) total += Math.max(0, Date.now() - activeTimer.startedAt);
  return total;
}

function listProjects(args: ToolArgs): ToolResult {
  const store = useProjectForgeStore.getState();
  store.ensureMigrated();
  const { projects, activeTimer } = useProjectForgeStore.getState();
  const statusRaw = argStr(args, 'status', 40);
  let filter: ForgeStage | 'hold' | null = null;
  if (statusRaw) {
    const words = norm(statusRaw).split(' ');
    filter = STAGE_ALIASES[words.join('')] ?? words.map((w) => STAGE_ALIASES[w]).find(Boolean) ?? null;
    if (!filter) return fail(`Unknown status "${statusRaw}". Use ${FORGE_STAGES.join(', ')} or on-hold.`);
  }
  const list = projects
    .filter((p) => (filter === null ? true : filter === 'hold' ? p.onHold : p.stage === filter))
    .sort((a, b) => FORGE_STAGES.indexOf(a.stage) - FORGE_STAGES.indexOf(b.stage) || a.order - b.order);
  const byStage: Record<string, number> = {};
  for (const s of FORGE_STAGES) byStage[s] = projects.filter((p) => p.stage === s).length;
  return ok({
    total: projects.length,
    byStage,
    ...(filter ? { filter } : {}),
    ...(activeTimer
      ? { timerRunningOn: projects.find((p) => p.id === activeTimer.projectId)?.name ?? null }
      : {}),
    projects: list.slice(0, LIST_CAP).map((p) => ({
      name: p.name,
      status: p.stage,
      ...(p.onHold ? { onHold: true } : {}),
      progress: effectiveProgress(p),
      tasks: { done: p.tasks.filter((t) => t.done).length, total: p.tasks.length },
      hoursLogged: Math.round((projectMs(p.id) / 3_600_000) * 10) / 10,
      ...(p.description ? { description: clip(p.description, SNIPPET) } : {}),
      ...(p.techStack.length > 0 ? { tech: p.techStack.slice(0, 8) } : {}),
    })),
    ...(list.length > LIST_CAP ? { truncated: true } : {}),
  });
}

function addProject(args: ToolArgs): ToolResult {
  const name = argStr(args, 'name', 80).replace(/\s+/g, ' ');
  if (!name) return fail('The project needs a name.');
  const description = argStr(args, 'description', 1000);
  const store = useProjectForgeStore.getState();
  store.ensureMigrated();
  const duplicate = useProjectForgeStore.getState().projects.find((p) => norm(p.name) === norm(name));
  if (duplicate) return fail(`A project called "${duplicate.name}" already exists (status ${duplicate.stage}).`);
  const id = store.createProject({
    name,
    description,
    techStack: [],
    stage: 'ideas',
    progress: 0,
    autoProgress: false,
    links: [],
    onHold: false,
  });
  const project = useProjectForgeStore.getState().projects.find((p) => p.id === id);
  return ok({ name: project?.name ?? name, status: project?.stage ?? 'ideas' });
}

// ═══════════════════════════════════════════════════════════
// Overview
// ═══════════════════════════════════════════════════════════

function getOverview(): ToolResult {
  const now = new Date();
  const ctx = buildNexusContext({ detailed: true });
  const xp = useXPStore.getState();
  const habits = listHabits();
  const today = toDateKey(now);
  const todays = eventsBetween(today, today);
  const upcoming = eventsBetween(shiftDateKey(today, 1), shiftDateKey(today, 7));
  const { projects } = useProjectForgeStore.getState();
  const active = projects
    .filter((p) => p.stage !== 'shipped' && !p.onHold)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const pomodoro = useNexusStore.getState().pomodoro;
  return ok({
    now: localIsoWithOffset(now),
    weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
    timeZone: timeZone(),
    timeOfDay: ctx.timeOfDay,
    level: xp.level,
    levelTitle: xp.getLevelTitle(),
    xp: xp.xp,
    xpToNextLevel: xp.getXPForNextLevel(),
    studyStreakDays: studyStreak(),
    habits: {
      done: habits.filter((h) => h.doneToday).length,
      total: habits.length,
      pending: habits.filter((h) => !h.doneToday).slice(0, 10).map((h) => h.name),
    },
    cardsDue: ctx.dueCards ?? 0,
    ...(ctx.focusDeck ? { focusDeck: ctx.focusDeck } : {}),
    ...(ctx.lastQuizScore !== undefined ? { lastQuizScorePct: ctx.lastQuizScore } : {}),
    today: todays.slice(0, 15).map(occurrenceRow),
    upcoming: upcoming.slice(0, 10).map(occurrenceRow),
    ...(upcoming.length > 10 ? { upcomingMore: upcoming.length - 10 } : {}),
    spending: { currency: 'INR', ...monthSummary(today.slice(0, 7)) },
    projects: {
      active: active.length,
      shipped: projects.filter((p) => p.stage === 'shipped').length,
      top: active.slice(0, 5).map((p) => ({ name: p.name, status: p.stage, progress: effectiveProgress(p) })),
    },
    pomodoro: describePomodoro(pomodoro, now.getTime()) ?? 'not running',
    workspace: ctx.currentWorkspace,
    openApps: ctx.openApps,
    ...(ctx.summary ? { summary: ctx.summary } : {}),
  });
}

// ═══════════════════════════════════════════════════════════
// OS control
// ═══════════════════════════════════════════════════════════

const APP_ALIASES: Readonly<Record<string, string>> = {
  habits: 'study-planner',
  habit: 'study-planner',
  'habit forge': 'study-planner',
  planner: 'study-planner',
  stats: 'warrior-profile',
  profile: 'warrior-profile',
  progress: 'warrior-profile',
  'warrior hall': 'warrior-hall',
  hall: 'warrior-hall',
  avatar: 'warrior-hall',
  warrior: 'warrior-hall',
  armor: 'warrior-hall',
  expenses: 'expense-vault',
  expense: 'expense-vault',
  budget: 'expense-vault',
  money: 'expense-vault',
  files: 'file-manager',
  music: 'music-player',
  nexus: 'nexus-ai',
  code: 'code-editor',
  editor: 'code-editor',
  projects: 'project-tracker',
  'project forge': 'project-tracker',
  quiz: 'training-grounds',
  training: 'training-grounds',
  study: 'training-grounds',
  resume: 'resume-builder',
  cv: 'resume-builder',
  algorithms: 'algo-lab',
  notes: 'notes',
  cards: 'flashcards',
  calc: 'calculator',
  shell: 'terminal',
};

function resolveApp(query: string): { id: string; name: string } | null {
  const apps = useAppStore.getState().registeredApps;
  const raw = query.trim().toLowerCase();
  const byId = apps.find((a) => a.id === resolveAppId(raw));
  if (byId) return byId;
  const q = norm(raw).replace(/\s+app$/, '');
  const alias = APP_ALIASES[q];
  if (alias) {
    const app = apps.find((a) => a.id === alias);
    if (app) return app;
  }
  const byName = bestByName(apps, q, (a) => `${a.name}`) ?? bestByName(apps, q, (a) => a.id.replace(/-/g, ' '));
  return byName ?? null;
}

function openApp(args: ToolArgs): ToolResult {
  const query = argStr(args, 'app', 80);
  if (!query) return fail('Say which app to open.');
  const apps = useAppStore.getState().registeredApps;
  if (apps.length === 0) return fail('The desktop is not ready yet.');
  const app = resolveApp(query);
  if (!app) return fail(`No app matches "${query}".`);
  const result = openOrFocusApp(app.id);
  if (!result) return fail(`Could not open ${app.name}.`);
  return ok({
    app: app.id,
    name: app.name,
    action: result.created ? 'opened' : 'focused',
    ...(result.switchedWorkspace ? { switchedWorkspace: useWorkspaceStore.getState().activeWorkspaceId } : {}),
  });
}

const TRAINING_MODES: Readonly<Record<string, NexusTrainingMode>> = {
  quiz: 'quiz',
  review: 'flashcards',
  flashcards: 'flashcards',
  mock: 'mock',
  'mock test': 'mock',
  test: 'mock',
};

function startTraining(args: ToolArgs): ToolResult {
  const modeRaw = norm(argStr(args, 'mode', 20));
  const mode = TRAINING_MODES[modeRaw];
  if (!mode) return fail('mode must be quiz, review or mock.');
  const deckQuery = argStr(args, 'deck', 120);
  const { decks, reviews } = useLearningStore.getState();
  const label = deckQuery ? deckTargetLabel(deckQuery, decks) : null;
  const opened = openOrFocusApp('training-grounds');
  if (!opened) return fail('Training Grounds is not available.');
  // Unknown deck names still open the app; Training Grounds lets the owner pick.
  const detail: WarriorTrainingStartDetail = label ? { mode, subject: deckQuery } : { mode };
  emitWarriorEvent(WARRIOR_EVENTS.trainingStart, detail);
  const out: ToolResult = {
    mode: modeRaw === 'flashcards' ? 'review' : modeRaw === 'mock test' || modeRaw === 'test' ? 'mock' : modeRaw,
    deck: label ?? 'owner picks in the app',
    ...(deckQuery && !label
      ? { note: `No deck matches "${deckQuery}". Decks: ${decks.slice(0, 12).map((d) => d.name).join(', ') || 'none'}.` }
      : {}),
  };
  if (mode === 'flashcards') {
    const target = label ? resolveDeckTarget(deckQuery, decks) : null;
    out.dueCards = collectDueCards(decks, reviews, {
      includeNew: false,
      deckId: target?.deckId,
      topicId: target?.topicId ?? undefined,
    }).length;
  }
  return ok(out);
}

function pomodoro(args: ToolArgs): ToolResult {
  const action = norm(argStr(args, 'action', 10));
  const store = useNexusStore.getState();
  const p = store.pomodoro;
  if (action === 'stop') {
    if (p.phase === 'idle') return fail('No focus timer is running.');
    store.stopPomodoro();
    return ok({ state: 'stopped' });
  }
  if (action !== 'start') return fail('action must be start or stop.');
  const minutesGiven = argNum(args, 'minutes') !== null;
  const minutes = argInt(args, 'minutes', 25, 1, 180);
  if (p.phase === 'focus' && !minutesGiven) {
    if (p.pausedRemainingMs !== null) {
      store.resumePomodoro();
      return ok({ state: 'resumed', remaining: formatClock(p.pausedRemainingMs) });
    }
    return ok({ state: 'already running', remaining: formatClock(pomodoroRemainingMs(p, Date.now())) });
  }
  store.startPomodoro(minutes);
  const next = useNexusStore.getState().pomodoro;
  return ok({ state: 'started', focusMinutes: next.focusMinutes, breakMinutes: next.breakMinutes });
}

function setWallpaper(args: ToolArgs): ToolResult {
  const raw = argStr(args, 'wallpaper', 40).toLowerCase();
  if (!raw) return fail('Say which wallpaper (or "next" / "random").');
  const settings = useSettingsStore.getState();
  const ids = wallpaperIds();
  let target: string | null = null;
  if (raw === 'next') target = cycleWallpaperId(settings.wallpaper, 1);
  else if (raw === 'previous' || raw === 'prev' || raw === 'back') target = cycleWallpaperId(settings.wallpaper, -1);
  else if (raw === 'random' || raw === 'shuffle' || raw === 'surprise') target = randomWallpaperId(settings.wallpaper);
  else if (ids.includes(raw)) target = raw;
  else target = bestByName(WALLPAPERS, raw, (w) => `${w.label}`)?.id ?? null;
  if (!target || !ids.includes(target)) return fail(`Unknown wallpaper "${raw}". Options: ${ids.join(', ')}, next, random.`);
  applyWallpaperToWorkspace(target, 'nexus');
  return ok({
    wallpaper: target,
    label: wallpaperLabel(target),
    workspace: useWorkspaceStore.getState().activeWorkspaceId,
    ...(settings.adaptiveWallpaper ? { note: 'Adaptive wallpaper is on and may change it later.' } : {}),
  });
}

// ─── 3D warrior ───

const WARRIOR_MOVES: Readonly<Record<string, WarriorAction>> = {
  punch: 'punch',
  jab: 'punch',
  attack: 'punch',
  strike: 'punch',
  mukka: 'punch',
  powerup: 'powerup',
  'power up': 'powerup',
  power: 'powerup',
  charge: 'powerup',
  victory: 'victory',
  win: 'victory',
  celebrate: 'victory',
  hurt: 'hurt',
  hit: 'hurt',
  damage: 'hurt',
  stance: 'stance',
  guard: 'stance',
  fight: 'stance',
  idle: 'idle',
  rest: 'idle',
};
const WARRIOR_MOVE_LABEL: Readonly<Record<WarriorAction, string>> = {
  punch: 'punch',
  powerup: 'power up',
  victory: 'victory',
  hurt: 'hurt',
  stance: 'stance',
  idle: 'idle',
};
/** Must match WARRIOR_HALL_STAGE in the Warrior Hall app. */
const HALL_STAGE = 'warrior-hall';
const HALL_READY_TIMEOUT_MS = 12_000;

/** Play on the hall stage once it has mounted its warrior (3D only; lite mode never reports). */
function playWhenHallReady(action: WarriorAction): void {
  if (useWarriorActionStore.getState().current[HALL_STAGE]) {
    playWarriorAction(action, HALL_STAGE);
    return;
  }
  let timer = 0;
  const unsub = useWarriorActionStore.subscribe((s) => {
    if (!s.current[HALL_STAGE]) return;
    unsub();
    window.clearTimeout(timer);
    // One frame so the figure's action subscription is attached.
    window.setTimeout(() => playWarriorAction(action, HALL_STAGE), 50);
  });
  timer = window.setTimeout(unsub, HALL_READY_TIMEOUT_MS);
}

function warriorAction(args: ToolArgs): ToolResult {
  const raw = norm(argStr(args, 'action', 30)).replace(/[_-]+/g, ' ');
  const action = WARRIOR_MOVES[raw] ?? WARRIOR_MOVES[raw.replace(/\s+/g, '')];
  if (!action) return fail('action must be punch, powerup, victory, hurt, stance or idle.');
  const label = WARRIOR_MOVE_LABEL[action];
  if (document.querySelector('[data-warrior-stage]')) {
    playWarriorAction(action);
    return ok({ action, label });
  }
  const opened = openOrFocusApp('warrior-hall');
  if (!opened) return fail('Warrior Hall is not available.');
  playWhenHallReady(action);
  return ok({ action, label, opened: 'warrior-hall' });
}

function switchWorkspace(args: ToolArgs): ToolResult {
  const raw = argStr(args, 'workspace', 40);
  if (!raw) return fail('Say which workspace: study, build or chill.');
  const store = useWorkspaceStore.getState();
  const ws = store.workspaces.find((w) => w.id === raw.toLowerCase()) ?? bestByName(store.workspaces, raw, (w) => w.name);
  if (!ws) return fail(`No workspace "${raw}". Use study, build or chill.`);
  const id = ws.id as WorkspaceId;
  const already = store.activeWorkspaceId === id;
  if (!already) store.switchWorkspace(id);
  return ok({ workspace: id, name: ws.name, alreadyActive: already });
}

// ═══════════════════════════════════════════════════════════
// Memory
// ═══════════════════════════════════════════════════════════

const SECRET_RE =
  /\b(?:password|passcode|passwd|pwd|otp|pin code|cvv|api[\s_-]?key|secret key|private key|seed phrase|access token)\b|\b\d{12,19}\b|[A-Za-z0-9_\-]{32,}/i;

function remember(args: ToolArgs): ToolResult {
  const fact = argStr(args, 'fact', 300);
  if (!fact) return fail('Nothing to remember.');
  if (SECRET_RE.test(fact)) return fail('That looks like a secret (password, key or card number); not saved.');
  const before = useJarvisStore.getState().memory.length;
  const saved = useJarvisStore.getState().remember(fact);
  const after = useJarvisStore.getState().memory.length;
  return ok({ id: saved.id, fact: saved.fact, updatedExisting: after === before, total: after });
}

function forget(args: ToolArgs): ToolResult {
  const id = argStr(args, 'id', 80);
  if (!id) return fail('Give the memory id to delete.');
  const store = useJarvisStore.getState();
  let target = store.memory.find((m) => m.id === id);
  if (!target) {
    // The model sometimes passes the fact's words instead of its id.
    const matches = store.memory.filter((m) => m.fact.toLowerCase().includes(id.toLowerCase()));
    if (matches.length === 1) target = matches[0];
  }
  if (!target || !store.forget(target.id)) return fail(`No remembered fact with id "${id}".`);
  return ok({ id: target.id, forgotten: clip(target.fact, SNIPPET), total: useJarvisStore.getState().memory.length });
}

// ═══════════════════════════════════════════════════════════
// Dispatch
// ═══════════════════════════════════════════════════════════

// ─── Weather and reminders ───

async function getWeather(): Promise<ToolResult> {
  try {
    const { data, source } = await getLocalWeather({ forecast: true, signal: AbortSignal.timeout(8000) });
    return ok({
      city: data.city,
      source,
      now: { tempC: Math.round(data.temp), feelsLikeC: Math.round(data.feelsLike), condition: data.description || data.condition },
      todayMinC: Math.round(data.min),
      todayMaxC: Math.round(data.max),
      humidity: data.humidity,
      windKph: Math.round(data.windKph),
      next: data.forecast.slice(0, 4).map((f) => ({ ...f })),
    });
  } catch {
    const last = getLastKnownWeather();
    if (last) {
      return ok({
        city: last.city,
        stale: true,
        now: { tempC: Math.round(last.temp), condition: last.description || last.condition },
        observedAt: new Date(last.observedAt).toISOString(),
      });
    }
    return fail('Weather is unavailable right now.');
  }
}

function reminderView(r: Reminder): ToolResult {
  return { id: r.id, text: r.text, at: localIsoWithOffset(new Date(r.dueAt)).slice(0, 16) };
}

function setReminder(args: ToolArgs): ToolResult {
  const text = argStr(args, 'text', 200);
  if (!text) return fail('Say what to remind about.');
  let dueAt: number | null = null;
  const minutes = argNum(args, 'in_minutes');
  const at = argStr(args, 'at', 25);
  if (minutes !== null) {
    if (minutes < 1 || minutes > 60 * 24 * 60) return fail('in_minutes must be between 1 and 86400.');
    dueAt = Date.now() + Math.round(minutes) * 60_000;
  } else if (at) {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})$/.exec(at);
    if (!match) return fail('Use at as YYYY-MM-DDTHH:MM (local time).');
    const [, y, mo, d, h, mi] = match.map(Number);
    const date = new Date(y, mo - 1, d, h, mi);
    if (Number.isNaN(date.getTime())) return fail('That date-time is not valid.');
    dueAt = date.getTime();
  } else {
    return fail('Give in_minutes or at.');
  }
  if (dueAt < Date.now() - 60_000) return fail('That time is already past.');
  const reminder = useReminderStore.getState().addReminder(text, dueAt);
  if (!reminder) return fail('Could not save the reminder (too many pending?).');
  try {
    // Lets reminders show as system notifications while the tab is hidden.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
  } catch {
    // Not supported: in-OS toasts only.
  }
  return ok(reminderView(reminder));
}

function listReminders(): ToolResult {
  const pending = useReminderStore
    .getState()
    .reminders.filter((r) => r.firedAt === undefined)
    .sort((a, b) => a.dueAt - b.dueAt);
  return ok({ total: pending.length, reminders: pending.slice(0, LIST_CAP).map(reminderView) });
}

function cancelReminder(args: ToolArgs): ToolResult {
  const id = argStr(args, 'id', 60);
  if (!id) return fail('Give the reminder id (see list_reminders).');
  return useReminderStore.getState().cancelReminder(id) ? ok({ id }) : fail(`No upcoming reminder with id "${id}".`);
}

const EXECUTORS: Readonly<Record<string, (args: ToolArgs) => ToolResult | Promise<ToolResult>>> = {
  get_weather: getWeather,
  set_reminder: setReminder,
  list_reminders: listReminders,
  cancel_reminder: cancelReminder,
  get_overview: getOverview,
  search_notes: searchNotes,
  read_note: readNote,
  list_decks: listDecks,
  get_due_cards: getDueCards,
  list_habits: listHabitsTool,
  list_events: listEvents,
  list_expenses: listExpenses,
  list_projects: listProjects,
  create_note: createNote,
  append_to_note: appendToNote,
  add_expense: addExpense,
  add_event: addEvent,
  check_habit: checkHabit,
  create_flashcards: createFlashcards,
  add_project: addProject,
  open_app: openApp,
  start_training: startTraining,
  pomodoro,
  set_wallpaper: setWallpaper,
  warrior_action: warriorAction,
  switch_workspace: switchWorkspace,
  remember,
  forget,
};

/** Tool names this module can run (should equal JARVIS_TOOL_NAMES). */
export const JARVIS_EXECUTOR_NAMES: readonly string[] = Object.keys(EXECUTORS);

/**
 * Run one JARVIS tool call in the browser. Always resolves to a small
 * JSON object: { ok: true, ...data } or { ok: false, error }.
 */
export async function executeJarvisTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (typeof window === 'undefined') return fail('Tools only run in the browser.');
  const run = typeof name === 'string' && JARVIS_TOOL_NAMES.has(name) ? EXECUTORS[name] : undefined;
  if (!run) return fail(`Unknown tool "${String(name).slice(0, 60)}".`);
  const safeArgs: ToolArgs = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  try {
    return await run(safeArgs);
  } catch (err) {
    const reason = err instanceof Error && err.message ? `: ${clip(err.message, 120)}` : '';
    return fail(`Something went wrong running ${name}${reason}.`);
  }
}
