// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Barrel
// Only MemoryPalaceApp is needed by the app registry; it loads the
// three.js scene client-side. Data helpers are pure TS (no three.js).
// ═══════════════════════════════════════════════════════════

export { MemoryPalaceApp, default } from './MemoryPalaceApp';
export {
  ROOM_THEMES,
  inferNoteSubject,
  inferNoteType,
  loadPalaceNotes,
  computeNoteReview,
  loadRevisionLog,
  loadGateRevisions,
  PALACE_ACHIEVEMENT_IDS,
} from './palaceData';
export type { PalaceNote, NoteObjectType, NoteReview, RoomTheme, PalaceSubject } from './palaceData';
