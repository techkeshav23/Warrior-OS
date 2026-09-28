// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: note → deck
// Reads the Notes Archive and turns one markdown note into topics and
// flashcards with plain heuristics (fully offline):
//   # / ## / ### headings                    → topics
//   Term: definition   (also " - ", " — ", " = ", " :: ")  → card
//   Q: question  then  A: answer             → card (multi-line answers too)
//   A line ending in "?" followed by text    → card
//   - Bullet with nested bullets             → card (bullet → its children)
//   Lead-in line ending in ":" + a list      → card (lead-in → the list)
//   Plain bullet list under a heading        → card ("Key points: heading")
//   Markdown tables                          → a card per row (first column → the rest)
// Code fences are skipped unless they belong to a question or answer.
// ═══════════════════════════════════════════════════════════

import type { DeckInput } from '@/types/learning';

// ─── Notes source ───

/** Notes Archive storage key (NotesApp saves a plain array of notes here). */
export const NOTES_STORAGE_KEY = 'warrior-notes';

export interface NoteSource {
  id: string;
  title: string;
  content: string;
  tags: string[];
  /** ISO timestamp ('' when unknown). */
  updatedAt: string;
}

function asRecordList(raw: unknown): Record<string, unknown>[] {
  let list: unknown = raw;
  // Also accept a zustand persist envelope: { state: { notes: [...] } }.
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const state = (raw as { state?: unknown }).state;
    list = state && typeof state === 'object' ? (state as { notes?: unknown }).notes : undefined;
  }
  return Array.isArray(list)
    ? list.filter((n): n is Record<string, unknown> => !!n && typeof n === 'object' && !Array.isArray(n))
    : [];
}

function isoOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  return '';
}

/** Every saved note, most recently updated first. Never throws. */
export function loadNotes(): NoteSource[] {
  if (typeof window === 'undefined') return [];
  let raw: unknown;
  try {
    raw = JSON.parse(window.localStorage.getItem(NOTES_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
  return asRecordList(raw)
    .map((n, i) => ({
      id: typeof n.id === 'string' && n.id ? n.id : `note-${i}`,
      title: typeof n.title === 'string' && n.title.trim() ? n.title.trim() : 'Untitled note',
      content: typeof n.content === 'string' ? n.content : '',
      tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : [],
      updatedAt: isoOf(n.updatedAt),
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

// ─── Parsing ───

export interface ParsedCard {
  /** Stable within one parse (used for include/exclude in the preview). */
  id: string;
  front: string;
  back: string;
}

export interface ParsedTopic {
  name: string;
  cards: ParsedCard[];
}

export interface ParsedNote {
  topics: ParsedTopic[];
  cardCount: number;
}

const MAX_CARDS = 500;
const MAX_FRONT = 2000;
const MAX_BACK = 4000;
const GENERAL = 'General';

const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const BULLET = /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/;
const QUESTION = /^(?:[-*+]\s+)?(?:\*\*|__)?\s*(?:q|ques|question)\s*\d*\s*[:.)]\s*(?:\*\*|__)?\s*(.*)$/i;
const ANSWER = /^(?:[-*+]\s+)?(?:\*\*|__)?\s*(?:a|ans|answer)\s*[:.)]\s*(?:\*\*|__)?\s*(.*)$/i;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const TASK_BOX = /^\[[ xX]\]\s+/;

/** Separators between a term and its definition, most specific first. */
const SEPARATORS = [' :: ', ': ', ' — ', ' – ', ' - ', ' = ', ' -> ', ' → '];

/** "Note: …" and friends are labels, not terms worth a card. */
const LABEL_TERMS = new Set([
  'note', 'notes', 'nb', 'tip', 'tips', 'todo', 'to do', 'warning', 'important', 'example', 'examples',
  'source', 'sources', 'ref', 'refs', 'reference', 'references', 'link', 'links', 'see', 'see also',
  'date', 'time', 'status', 'update', 'edit', 'author', 'tags', 'summary', 'result', 'output', 'input',
]);

/** Markdown inline formatting → plain text (code spans keep their backticks). */
export function stripInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => alias || target)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,:;!?]|$)/g, '$1$2')
    .replace(/(^|[\s(])_(?!\s)([^_]+?)_(?=[\s).,:;!?]|$)/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Term: definition" (and the other separators) → its two halves, or null for prose. */
export function splitTermDefinition(text: string): { term: string; definition: string } | null {
  if (/^https?:\/\//i.test(text)) return null;
  let best: { index: number; sep: string } | null = null;
  for (const sep of SEPARATORS) {
    const index = text.indexOf(sep);
    if (index > 0 && (!best || index < best.index)) best = { index, sep };
  }
  if (!best) return null;
  const term = text.slice(0, best.index).trim();
  const definition = text.slice(best.index + best.sep.length).trim();
  if (!term || !definition) return null;
  const maxWords = best.sep === ': ' || best.sep === ' :: ' ? 8 : 6;
  if (term.length > 80 || term.split(/\s+/).length > maxWords) return null;
  if (/[.!?,;]$/.test(term) || /https?$/i.test(term)) return null;
  if (LABEL_TERMS.has(term.toLowerCase())) return null;
  if (/^(?:step|day|week|part|chapter|section|phase|lecture|lesson)\s*\d+$/i.test(term)) return null;
  return { term, definition };
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => stripInline(cell));
}

interface ListItem {
  text: string;
  children: string[];
  ordered: boolean;
  term?: string;
  definition?: string;
}

/** Turn a note into topics of front/back cards. */
export function parseNote(title: string, content: string): ParsedNote {
  const topics: ParsedTopic[] = [];
  const seen = new Set<string>();
  let count = 0;

  const ensureTopic = (name: string): ParsedTopic => {
    const found = topics.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
    const topic: ParsedTopic = { name, cards: [] };
    topics.push(topic);
    return topic;
  };

  let topic = ensureTopic(GENERAL);
  let sawHeading = false;
  let qa: { q: string[]; a: string[] | null } | null = null;
  let lead: string | null = null;
  let list: { items: ListItem[]; indent: number } | null = null;
  let table: { header: string[] | null; rows: string[][] } | null = null;
  let inFence = false;

  const addCard = (front: string, back: string) => {
    const f = front.trim().slice(0, MAX_FRONT);
    const b = back.trim().slice(0, MAX_BACK);
    if (!f || !b || count >= MAX_CARDS) return;
    const key = `${f.toLowerCase()}\u0000${b.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    topic.cards.push({ id: `c${count}`, front: f, back: b });
    count += 1;
  };

  const flushQA = () => {
    if (qa && qa.a) addCard(qa.q.join('\n'), qa.a.join('\n'));
    qa = null;
  };

  const flushList = () => {
    if (list) {
      const plain: ListItem[] = [];
      for (const item of list.items) {
        if (item.term && item.definition) addCard(item.term, [item.definition, ...item.children].join('\n'));
        else if (item.children.length > 0) addCard(item.text, item.children.join('\n'));
        else plain.push(item);
      }
      const lines = plain.map((item, i) => (item.ordered ? `${i + 1}. ${item.text}` : `• ${item.text}`));
      if (lead && plain.length >= 1) addCard(lead, lines.join('\n'));
      else if (plain.length >= 2) addCard(`Key points: ${topic.name === GENERAL ? title : topic.name}`, lines.join('\n'));
    }
    list = null;
    lead = null;
  };

  const flushTable = () => {
    if (table) {
      const header = table.header;
      for (const cells of table.rows) {
        const [front, ...rest] = cells;
        const values = rest
          .map((value, i) => (value && header && header.length > 2 && header[i + 1] ? `${header[i + 1]}: ${value}` : value))
          .filter(Boolean);
        if (front && values.length > 0) addCard(front, values.join('\n'));
      }
    }
    table = null;
  };

  const flushAll = () => {
    flushQA();
    flushList();
    flushTable();
  };

  const lines = content.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // ── Code fences: kept only inside a question or answer ──
    if (FENCE.test(rawLine)) {
      inFence = !inFence;
      if (qa) (qa.a ?? qa.q).push(trimmed);
      continue;
    }
    if (inFence) {
      if (qa) (qa.a ?? qa.q).push(rawLine.replace(/\s+$/, ''));
      continue;
    }

    // ── Blank line ──
    if (!trimmed) {
      if (qa?.a && qa.a.some((l) => l.trim())) flushQA();
      flushTable();
      continue; // lists and lead-ins survive blank lines (loose lists)
    }

    // ── Heading → topic ──
    const heading = HEADING.exec(rawLine);
    if (heading) {
      flushAll();
      const name = stripInline(heading[2]).replace(/[:\s]+$/, '').slice(0, 80);
      const isTitle = !sawHeading && name.toLowerCase() === title.trim().toLowerCase();
      sawHeading = true;
      if (name && !isTitle) topic = ensureTopic(name);
      continue;
    }

    // ── Tables ──
    if (TABLE_ROW.test(rawLine) || (table && TABLE_RULE.test(rawLine))) {
      if (!table) {
        flushQA();
        flushList();
        table = { header: null, rows: [] };
      }
      if (TABLE_RULE.test(rawLine)) {
        // The row above the rule was the header.
        if (!table.header && table.rows.length === 1) table.header = table.rows.pop() ?? null;
      } else {
        table.rows.push(tableCells(rawLine));
      }
      continue;
    }
    flushTable();

    // ── Q: / A: pairs ──
    const question = QUESTION.exec(trimmed);
    if (question) {
      flushQA();
      flushList();
      qa = { q: [stripInline(question[1])].filter(Boolean), a: null };
      continue;
    }
    if (qa) {
      const answer = ANSWER.exec(trimmed);
      if (answer) {
        qa.a = [stripInline(answer[1])].filter(Boolean);
        continue;
      }
      const bullet = BULLET.exec(rawLine);
      const text = bullet ? `${/\d/.test(bullet[2]) ? bullet[2] : '•'} ${stripInline(bullet[3])}` : stripInline(trimmed);
      (qa.a ?? qa.q).push(text);
      continue;
    }

    // ── Bullets ──
    const bullet = BULLET.exec(rawLine);
    if (bullet) {
      const indent = bullet[1].length;
      const text = stripInline(bullet[3].replace(TASK_BOX, ''));
      if (!text) continue;
      const ordered = /\d/.test(bullet[2]);
      if (!list) list = { items: [], indent };
      const last = list.items[list.items.length - 1];
      if (last && indent > list.indent) {
        last.children.push(`• ${text}`);
        continue;
      }
      if (last && last.ordered !== ordered) {
        // Switching between "1." and "-" starts a new list.
        flushList();
        list = { items: [], indent };
      }
      const split = splitTermDefinition(text);
      list.items.push({
        text,
        children: [],
        ordered,
        ...(split ? { term: split.term, definition: split.definition } : {}),
      });
      continue;
    }

    // ── Plain text ──
    if (list) {
      const last = list.items[list.items.length - 1];
      if (last && /^\s{2,}/.test(rawLine)) {
        // Lazy continuation of the last bullet.
        const extra = stripInline(trimmed);
        if (last.children.length > 0) last.children[last.children.length - 1] += ` ${extra}`;
        else if (last.definition) last.definition += ` ${extra}`;
        else last.text += ` ${extra}`;
        continue;
      }
      flushList();
    }
    const text = stripInline(trimmed);
    const split = splitTermDefinition(text);
    if (split) {
      lead = null;
      addCard(split.term, split.definition);
    } else if (text.endsWith('?') && text.length > 3) {
      // A question on its own line: the text below it is the answer.
      lead = null;
      qa = { q: [text], a: [] };
    } else if (text.endsWith(':') && text.length > 2) {
      lead = text.slice(0, -1).trim();
    } else {
      lead = null;
    }
  }
  flushAll();

  const kept = topics.filter((t) => t.cards.length > 0);
  return { topics: kept, cardCount: count };
}

/** The deck a parsed note becomes, keeping only the chosen cards. */
export function parsedNoteToDeckInput(
  parsed: ParsedNote,
  options: { name: string; description: string; icon: string; color?: string; tags: string[]; include: (cardId: string) => boolean }
): DeckInput {
  return {
    name: options.name,
    description: options.description,
    icon: options.icon,
    color: options.color,
    topics: parsed.topics
      .map((t) => ({
        name: t.name,
        cards: t.cards
          .filter((c) => options.include(c.id))
          .map((c) => ({ kind: 'flashcard' as const, prompt: c.front, back: c.back, tags: options.tags, difficulty: 'medium' as const })),
      }))
      .filter((t) => t.cards.length > 0),
  };
}
