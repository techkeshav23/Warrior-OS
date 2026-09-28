// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Journal
// Remembers which dreams were seen (localStorage 'warrior-dream-journal')
// and unlocks the dream achievements:
//   Dreamer       — first dream
//   Lucid         — dreams on 30 different days
//   Nightmare     — the void / idle dream
//   Dream Walker  — dreams about 5+ different things (activity kinds,
//                   decks studied)
// ═══════════════════════════════════════════════════════════

import type { DreamJournal, DreamScene } from '@/types/dream';
import { isDreamThemeKey } from '@/data/dream-themes';
import { unlockPhase6Achievement } from '@/components/creature/osBridge';

export const DREAM_JOURNAL_KEY = 'warrior-dream-journal';

export const DREAM_ACHIEVEMENT_IDS = {
  dreamer: 'dream-first',
  lucid: 'dream-lucid',
  nightmare: 'dream-nightmare',
  walker: 'dream-walker',
} as const;

const LUCID_DAYS = 30;
const WALKER_MOTIFS = 5;
const MAX_DAYS_KEPT = 400;
const MAX_MOTIFS_KEPT = 200;

function emptyJournal(): DreamJournal {
  return { v: 2, dreamDays: [], motifs: [], themes: [], total: 0 };
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function loadDreamJournal(): DreamJournal {
  if (typeof window === 'undefined') return emptyJournal();
  try {
    const raw = window.localStorage.getItem(DREAM_JOURNAL_KEY);
    if (!raw) return emptyJournal();
    const p = JSON.parse(raw) as Record<string, unknown>;
    // v1 kept a list of study-subject names; those no longer exist as
    // themes, so they carry over as one 'decks' motif (they were study).
    const motifs = p.v === 2 ? strings(p.motifs) : strings(p.subjects).length > 0 ? ['decks'] : [];
    return {
      v: 2,
      dreamDays: strings(p.dreamDays),
      motifs,
      themes: strings(p.themes).filter(isDreamThemeKey),
      total: typeof p.total === 'number' && p.total > 0 ? p.total : 0,
    };
  } catch {
    return emptyJournal();
  }
}

function saveDreamJournal(journal: DreamJournal): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DREAM_JOURNAL_KEY, JSON.stringify(journal));
  } catch {
    /* ignore */
  }
}

/** Re-apply every dream achievement whose condition is met (idempotent). */
export function reconcileDreamAchievements(journal: DreamJournal = loadDreamJournal()): void {
  if (journal.total >= 1) unlockPhase6Achievement(DREAM_ACHIEVEMENT_IDS.dreamer);
  if (journal.themes.includes('void') || journal.themes.includes('idle')) {
    unlockPhase6Achievement(DREAM_ACHIEVEMENT_IDS.nightmare);
  }
  if (journal.dreamDays.length >= LUCID_DAYS) unlockPhase6Achievement(DREAM_ACHIEVEMENT_IDS.lucid);
  if (journal.motifs.length >= WALKER_MOTIFS) unlockPhase6Achievement(DREAM_ACHIEVEMENT_IDS.walker);
}

// A scene object is recorded once even if an effect runs twice (StrictMode).
const recorded = new WeakSet<DreamScene>();

/** Record that a dream started playing; unlocks achievements immediately. */
export function recordDreamSeen(scene: DreamScene): DreamJournal {
  if (recorded.has(scene)) return loadDreamJournal();
  recorded.add(scene);
  const journal = loadDreamJournal();
  const day = new Date().toISOString().slice(0, 10);
  if (!journal.dreamDays.includes(day)) journal.dreamDays.push(day);
  if (journal.dreamDays.length > MAX_DAYS_KEPT) journal.dreamDays = journal.dreamDays.slice(-MAX_DAYS_KEPT);
  for (const m of scene.motifs) {
    if (!journal.motifs.includes(m)) journal.motifs.push(m);
  }
  if (journal.motifs.length > MAX_MOTIFS_KEPT) journal.motifs = journal.motifs.slice(-MAX_MOTIFS_KEPT);
  if (!journal.themes.includes(scene.themeKey)) journal.themes.push(scene.themeKey);
  journal.total += 1;
  saveDreamJournal(journal);
  reconcileDreamAchievements(journal);
  return journal;
}
