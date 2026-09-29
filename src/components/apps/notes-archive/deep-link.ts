// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Notes Deep Link
// 'warrior:notes-search' { query } → NotesApp opens search with it
// 'warrior:notes-new' {} → NotesApp creates a blank note and selects it
// ═══════════════════════════════════════════════════════════

export const NOTES_SEARCH_EVENT = 'warrior:notes-search';
export const NOTES_NEW_EVENT = 'warrior:notes-new';

/** App ids whose windows render NotesApp. */
export const NOTES_APP_IDS: readonly string[] = ['notes'];

const MAX_QUERY_LENGTH = 200;

export interface NotesSearchDetail {
  /** Empty string = open an empty search box. */
  query: string;
}

/** Validate an untrusted event detail. */
export function parseNotesSearch(raw: unknown): NotesSearchDetail | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const query = (raw as { query?: unknown }).query;
  if (typeof query !== 'string') return null;
  return { query: query.trim().slice(0, MAX_QUERY_LENGTH) };
}

/** 'warrior:notes-new' carries no data yet; kept as an object for later fields. */
export type NotesNewDetail = Record<string, never>;

/** Validate an untrusted event detail. */
export function parseNotesNew(raw: unknown): NotesNewDetail | null {
  return typeof raw === 'object' && raw !== null ? {} : null;
}
