// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Barrel
// Only MemoryPalaceApp is needed by the app registry; it loads the
// three.js scene client-side. Data helpers are pure TS (no three.js,
// no store imports).
// ═══════════════════════════════════════════════════════════

export { MemoryPalaceApp, default } from './MemoryPalaceApp';
export {
  ROOM_STYLES,
  roomTheme,
  inferNoteType,
  loadPalaceNotes,
  buildDeckSchedules,
  computeNoteReview,
  computeCardReview,
  loadRevisionLog,
  PALACE_ACHIEVEMENT_IDS,
} from './palaceData';
export type {
  DeckTopicSchedule,
  NoteObjectType,
  PalaceContentType,
  PalaceItem,
  PalaceNote,
  PalaceReview,
  RoomTheme,
} from './palaceData';
