// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GATE Arena Deep Link
// 'warrior:gate-start-quiz' { subject?, mode? } → GateArenaApp jumps
// to the requested mode with the subject preselected
// ═══════════════════════════════════════════════════════════

import type { GateSubject } from '@/types/gate';
import { getAvailableSubjects } from '@/data/gate-questions';

export const GATE_START_QUIZ_EVENT = 'warrior:gate-start-quiz';

/** App ids whose windows render GateArenaApp. */
export const GATE_APP_IDS: readonly string[] = ['gate-prep', 'flashcards'];

export type GateArenaTab = 'quiz' | 'pyq' | 'mock' | 'formulas' | 'planner' | 'skill-tree' | 'revision';

export type GateLinkMode = 'quiz' | 'mock' | 'flashcards' | 'planner';

const GATE_LINK_MODES: readonly string[] = ['quiz', 'mock', 'flashcards', 'planner'];

export interface GateStartQuizDetail {
  subject?: string;
  mode?: GateLinkMode;
}

/** Validate an untrusted event detail. A missing detail means "open the quiz". */
export function parseGateStartQuiz(raw: unknown): GateStartQuizDetail | null {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object') return null;
  const { subject, mode } = raw as { subject?: unknown; mode?: unknown };
  const detail: GateStartQuizDetail = {};
  if (typeof subject === 'string' && subject.trim()) detail.subject = subject.trim().slice(0, 80);
  if (typeof mode === 'string' && GATE_LINK_MODES.includes(mode)) detail.mode = mode as GateLinkMode;
  return detail;
}

export function tabForMode(mode: GateLinkMode | undefined): GateArenaTab {
  switch (mode) {
    case 'mock':
      return 'mock';
    case 'flashcards':
      return 'formulas';
    case 'planner':
      return 'planner';
    default:
      return 'quiz';
  }
}

/** Abbreviations and full names people type (terminal, NEXUS, Hinglish shorthand). */
const SUBJECT_ALIASES: Record<string, GateSubject> = {
  os: 'OS',
  'operating system': 'OS',
  'operating systems': 'OS',
  dbms: 'DBMS',
  database: 'DBMS',
  databases: 'DBMS',
  'data base': 'DBMS',
  'database management system': 'DBMS',
  'database management systems': 'DBMS',
  cn: 'CN',
  network: 'CN',
  networks: 'CN',
  networking: 'CN',
  'computer network': 'CN',
  'computer networks': 'CN',
  toc: 'TOC',
  automata: 'TOC',
  'theory of computation': 'TOC',
  coa: 'COA',
  co: 'COA',
  architecture: 'COA',
  'computer architecture': 'COA',
  'computer organization': 'COA',
  'computer organization & architecture': 'COA',
  'computer organization and architecture': 'COA',
  daa: 'DAA',
  algo: 'DAA',
  algos: 'DAA',
  algorithm: 'DAA',
  algorithms: 'DAA',
  'design & analysis of algorithms': 'DAA',
  'design and analysis of algorithms': 'DAA',
  cd: 'Compiler Design',
  compiler: 'Compiler Design',
  compilers: 'Compiler Design',
  dl: 'Digital Logic',
  digital: 'Digital Logic',
  'digital electronics': 'Digital Logic',
  dm: 'Discrete Math',
  discrete: 'Discrete Math',
  'discrete maths': 'Discrete Math',
  'discrete mathematics': 'Discrete Math',
  em: 'Engineering Math',
  engineering: 'Engineering Math',
  math: 'Engineering Math',
  maths: 'Engineering Math',
  'engineering maths': 'Engineering Math',
  'engineering mathematics': 'Engineering Math',
  c: 'C Programming',
  'c lang': 'C Programming',
  'c language': 'C Programming',
  ds: 'Data Structures',
  dsa: 'Data Structures',
  'data structure': 'Data Structures',
};

/** Map free text ("dbms", "Operating Systems", "discrete math quiz") to a GATE subject. */
export function resolveGateSubject(input: string | null | undefined): GateSubject | null {
  if (!input) return null;
  const phrase = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!phrase) return null;
  const subjects = getAvailableSubjects();
  const known = (s: GateSubject | undefined): GateSubject | null =>
    s && subjects.includes(s) ? s : null;

  // Whole phrase: exact subject name, then alias.
  const exact = subjects.find((s) => s.toLowerCase() === phrase);
  if (exact) return exact;
  const alias = known(SUBJECT_ALIASES[phrase]);
  if (alias) return alias;

  // A multi-word subject name or alias inside the phrase ("data structures quiz").
  for (const s of subjects) {
    const name = s.toLowerCase();
    if (name.includes(' ') && phrase.includes(name)) return s;
  }
  for (const [text, subject] of Object.entries(SUBJECT_ALIASES)) {
    if (text.includes(' ') && phrase.includes(text) && known(subject)) return subject;
  }

  // Any single word that names a subject ("dbms mock").
  for (const word of phrase.split(' ')) {
    const byName = subjects.find((s) => s.toLowerCase() === word);
    if (byName) return byName;
    const byAlias = known(SUBJECT_ALIASES[word]);
    if (byAlias) return byAlias;
  }
  return null;
}
