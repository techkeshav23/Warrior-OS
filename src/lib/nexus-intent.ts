// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Local Intent Parser
//
// Fast deterministic path that maps English + Hinglish commands
// ("open notes", "DBMS quiz", "notes on deadlock", "study mode",
// "pomodoro 50", "wallpaper aurora", "terminal band karo") to
// executable NexusCommands WITHOUT a Gemini round-trip. Anything
// conversational returns { type: 'none' } and falls through to AI.
//
// Pure + synchronous. The caller passes the registered app list
// (useAppStore.registeredApps) so apps added later are understood
// and this module never imports the app registry (no import cycle).
// ═══════════════════════════════════════════════════════════

import { WALLPAPER_OPTIONS } from '@/lib/constants';
import type { ExpenseCategory } from '@/types/expense';
import type { GateSubject } from '@/types/gate';
import type {
  NexusActionButton,
  NexusCommand,
  NexusGateMode,
  NexusWireAction,
  NexusWorkspaceId,
} from '@/types/nexus';

/** Minimal app shape the parser needs (AppDefinition satisfies it). */
export interface NexusAppRef {
  id: string;
  name: string;
}

export type LocalIntent =
  | NexusCommand
  | { type: 'multi'; commands: NexusCommand[] }
  | { type: 'help' }
  | { type: 'easter_egg'; reply: string }
  | { type: 'none' }; // means: hand off to AI

export const NEXUS_GATE_SUBJECTS: readonly GateSubject[] = [
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

const JARVIS_REPLY = 'I prefer NEXUS. But I appreciate the compliment.';

// ─── Normalisation ───

const LEADING_FILLER_RE =
  /^(?:(?:(?:hey|ok|okay|hi|yo)\s+)?(?:nexus|warrior)\b[\s,:-]*|(?:please|pls|plz|kindly|bhai|yaar|zara|jaldi|abe|arre|arey|acha|accha|ok|okay)\b[\s,]*|(?:can|could|would|will)\s+(?:you|u)\s+(?:please\s+)?|(?:i\s+want\s+to|i\s+wanna|i\s+would\s+like\s+to|id\s+like\s+to|lets|let\s+us|help\s+me)\s+)/;
const TRAILING_FILLER_RE =
  /[\s,]+(?:please|pls|plz|yaar|bhai|na|zara|jaldi|now|abhi|right\s+now|for\s+me|quickly)$/;

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[“”"`‘’']/g, '')
    .replace(/[?!.;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFillers(text: string): string {
  let out = text;
  for (let i = 0; i < 5; i++) {
    const next = out.replace(LEADING_FILLER_RE, '').replace(TRAILING_FILLER_RE, '').trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// ─── Apps ───

/** Phrase → candidate app ids or lowercase names (first registered one wins). */
const APP_ALIASES: Record<string, readonly string[]> = {
  note: ['notes'],
  notes: ['notes'],
  notebook: ['notes'],
  'notes archive': ['notes'],
  gate: ['gate-prep'],
  'gate arena': ['gate-prep'],
  'gate prep': ['gate-prep'],
  arena: ['gate-prep'],
  pyq: ['gate-prep'],
  pyqs: ['gate-prep'],
  habit: ['study-planner'],
  habits: ['study-planner'],
  'habit forge': ['study-planner'],
  'habit tracker': ['study-planner'],
  routine: ['study-planner'],
  routines: ['study-planner'],
  flashcard: ['flashcards'],
  'flash cards': ['flashcards'],
  cards: ['flashcards'],
  palace: ['memory-palace'],
  'memory palace': ['memory-palace'],
  code: ['code-editor'],
  'code lab': ['code-editor'],
  'code editor': ['code-editor'],
  editor: ['code-editor'],
  ide: ['code-editor'],
  vscode: ['code-editor'],
  'vs code': ['code-editor'],
  project: ['project-forge', 'project-tracker', 'projects'],
  projects: ['project-forge', 'project-tracker', 'projects'],
  kanban: ['project-forge', 'project-tracker', 'projects'],
  'project forge': ['project-forge', 'project-tracker'],
  terminal: ['terminal'],
  term: ['terminal'],
  shell: ['terminal'],
  console: ['terminal'],
  cmd: ['terminal'],
  bash: ['terminal'],
  cli: ['terminal'],
  nexus: ['nexus-ai'],
  'nexus ai': ['nexus-ai'],
  ai: ['nexus-ai'],
  'ai assist': ['nexus-ai'],
  assistant: ['nexus-ai'],
  chat: ['nexus-ai'],
  settings: ['settings'],
  setting: ['settings'],
  preferences: ['settings'],
  config: ['settings'],
  'control panel': ['settings'],
  file: ['file-manager'],
  files: ['file-manager'],
  'file manager': ['file-manager'],
  explorer: ['file-manager'],
  'file explorer': ['file-manager'],
  calc: ['calculator'],
  calculator: ['calculator'],
  music: ['music-player'],
  'music player': ['music-player'],
  warbeats: ['music-player'],
  beats: ['music-player'],
  song: ['music-player'],
  songs: ['music-player'],
  gaana: ['music-player'],
  gaane: ['music-player'],
  lofi: ['music-player'],
  'lo-fi': ['music-player'],
  player: ['music-player'],
  weather: ['weather'],
  mausam: ['weather'],
  profile: ['warrior-profile'],
  'warrior profile': ['warrior-profile'],
  'stats center': ['warrior-profile'],
  achievements: ['warrior-profile'],
  algo: ['algo-lab', 'algo lab'],
  'algo lab': ['algo-lab', 'algo lab'],
  algorithms: ['algo-lab', 'algo lab'],
  visualizer: ['algo-lab', 'algo lab'],
  'algorithm visualizer': ['algo-lab', 'algo lab'],
  expense: ['expense-vault', 'expense vault', 'expenses'],
  expenses: ['expense-vault', 'expense vault', 'expenses'],
  'expense vault': ['expense-vault', 'expense vault'],
  budget: ['expense-vault', 'expense vault', 'expenses'],
  kharcha: ['expense-vault', 'expense vault', 'expenses'],
  calendar: ['calendar'],
  schedule: ['calendar'],
  events: ['calendar'],
};

function cleanAppPhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/\b(?:the|my|app|apps|application|window|wala|waala|vala|wali|waali)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findByIdOrName(apps: readonly NexusAppRef[], candidate: string): NexusAppRef | undefined {
  return apps.find((a) => a.id === candidate || a.name.toLowerCase() === candidate);
}

/** Resolve a phrase to a registered app: exact → alias → substring → token overlap. */
export function matchApp(phrase: string, apps: readonly NexusAppRef[]): NexusAppRef | null {
  const p = cleanAppPhrase(phrase);
  if (!p) return null;

  for (const app of apps) {
    const name = app.name.toLowerCase();
    if (app.id === p || name === p || app.id.replace(/-/g, ' ') === p) return app;
  }

  const aliasTargets = APP_ALIASES[p];
  if (aliasTargets) {
    for (const target of aliasTargets) {
      const app = findByIdOrName(apps, target);
      if (app) return app;
    }
  }

  if (p.length >= 3) {
    for (const app of apps) {
      const name = app.name.toLowerCase();
      if (name.includes(p) || (name.length >= 4 && p.includes(name))) return app;
    }
  }

  const tokens = p.split(' ').filter((t) => t.length >= 3);
  let best: NexusAppRef | null = null;
  let bestScore = 0;
  for (const app of apps) {
    const appTokens = new Set([...app.name.toLowerCase().split(/[\s-]+/), ...app.id.split('-')]);
    const score = tokens.filter((t) => appTokens.has(t)).length;
    if (score > bestScore) {
      best = app;
      bestScore = score;
    }
  }
  return best;
}

/** Exact-only app match (id, name or alias) — used for bare one-word commands. */
function matchAppExact(phrase: string, apps: readonly NexusAppRef[]): NexusAppRef | null {
  const p = cleanAppPhrase(phrase);
  if (!p) return null;
  for (const app of apps) {
    if (app.id === p || app.name.toLowerCase() === p || app.id.replace(/-/g, ' ') === p) return app;
  }
  const aliasTargets = APP_ALIASES[p];
  if (aliasTargets) {
    for (const target of aliasTargets) {
      const app = findByIdOrName(apps, target);
      if (app) return app;
    }
  }
  return null;
}

// ─── GATE subjects ───

const SUBJECT_ALIASES: ReadonlyArray<readonly [string, GateSubject]> = [
  ['design and analysis of algorithms', 'DAA'],
  ['theory of computation', 'TOC'],
  ['database management system', 'DBMS'],
  ['database management', 'DBMS'],
  ['computer organization', 'COA'],
  ['computer organisation', 'COA'],
  ['computer architecture', 'COA'],
  ['engineering mathematics', 'Engineering Math'],
  ['discrete mathematics', 'Discrete Math'],
  ['digital electronics', 'Digital Logic'],
  ['operating systems', 'OS'],
  ['operating system', 'OS'],
  ['computer networks', 'CN'],
  ['computer network', 'CN'],
  ['engineering maths', 'Engineering Math'],
  ['engineering math', 'Engineering Math'],
  ['programming in c', 'C Programming'],
  ['data structures', 'Data Structures'],
  ['data structure', 'Data Structures'],
  ['compiler design', 'Compiler Design'],
  ['discrete maths', 'Discrete Math'],
  ['discrete math', 'Discrete Math'],
  ['digital logic', 'Digital Logic'],
  ['c programming', 'C Programming'],
  ['c language', 'C Programming'],
  ['c lang', 'C Programming'],
  ['architecture', 'COA'],
  ['networking', 'CN'],
  ['networks', 'CN'],
  ['network', 'CN'],
  ['databases', 'DBMS'],
  ['database', 'DBMS'],
  ['automata', 'TOC'],
  ['algorithms', 'DAA'],
  ['algorithm', 'DAA'],
  ['compilers', 'Compiler Design'],
  ['compiler', 'Compiler Design'],
  ['discrete', 'Discrete Math'],
  ['digital', 'Digital Logic'],
  ['maths', 'Engineering Math'],
  ['math', 'Engineering Math'],
  ['rdbms', 'DBMS'],
  ['dbms', 'DBMS'],
  ['sql', 'DBMS'],
  ['toc', 'TOC'],
  ['coa', 'COA'],
  ['daa', 'DAA'],
  ['algo', 'DAA'],
  ['dsa', 'Data Structures'],
  ['dld', 'Digital Logic'],
  ['os', 'OS'],
  ['cn', 'CN'],
  ['co', 'COA'],
  ['cd', 'Compiler Design'],
  ['dl', 'Digital Logic'],
  ['dm', 'Discrete Math'],
  ['em', 'Engineering Math'],
  ['ds', 'Data Structures'],
];

const SUBJECT_MATCHERS: ReadonlyArray<{ re: RegExp; subject: GateSubject }> = [
  // Canonical names first, then aliases (already ordered longest → shortest).
  ...NEXUS_GATE_SUBJECTS.map((subject) => ({
    re: new RegExp(`\\b${escapeRegExp(subject.toLowerCase())}\\b`),
    subject,
  })),
  ...SUBJECT_ALIASES.map(([alias, subject]) => ({
    re: new RegExp(`\\b${escapeRegExp(alias)}\\b`),
    subject,
  })),
];

/** Find a GATE subject mentioned anywhere in the text. */
function findSubject(text: string): { subject: GateSubject; rest: string } | null {
  const lower = text.toLowerCase();
  for (const { re, subject } of SUBJECT_MATCHERS) {
    if (re.test(lower)) return { subject, rest: lower.replace(re, ' ') };
  }
  return null;
}

/** Resolve a free-text subject (from AI targets) to a canonical GATE subject. */
export function matchSubject(phrase: string): GateSubject | null {
  const p = phrase.trim().toLowerCase();
  if (!p) return null;
  if (p === 'c') return 'C Programming';
  return findSubject(p)?.subject ?? null;
}

// ─── Wallpapers ───

const WALLPAPER_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['void minimal', 'void'],
  ['star field', 'starfield'],
  ['northern lights', 'aurora'],
  ['fluid simulation', 'fluid'],
  ['cyberpunk rain', 'matrix'],
  ['neural network', 'neural'],
  ['starfield', 'starfield'],
  ['cyberpunk', 'matrix'],
  ['minimal', 'void'],
  ['nebula', 'nebula'],
  ['galaxy', 'nebula'],
  ['aurora', 'aurora'],
  ['liquid', 'fluid'],
  ['matrix', 'matrix'],
  ['hacker', 'matrix'],
  ['neural', 'neural'],
  ['neurons', 'neural'],
  ['stars', 'starfield'],
  ['space', 'starfield'],
  ['fluid', 'fluid'],
  ['black', 'void'],
  ['dark', 'void'],
  ['void', 'void'],
  ['rain', 'matrix'],
];

const VALID_WALLPAPERS: readonly string[] = WALLPAPER_OPTIONS.map((w) => w.id);

/** Resolve a wallpaper id or name mentioned in the text. */
export function matchWallpaper(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [alias, id] of WALLPAPER_ALIASES) {
    if (new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(lower) && VALID_WALLPAPERS.includes(id)) return id;
  }
  return null;
}

export function wallpaperName(id: string): string {
  return WALLPAPER_OPTIONS.find((w) => w.id === id)?.name ?? id;
}

// ─── Rule helpers ───

const WORKSPACES: readonly NexusWorkspaceId[] = ['study', 'build', 'chill'];

function toMinutes(value: string | undefined, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

/** Words that may surround a command without changing its meaning. */
const COMMAND_NOISE = new Set([
  'a', 'an', 'the', 'my', 'me', 'on', 'in', 'of', 'for', 'about', 'some', 'quick', 'short', 'random',
  'start', 'begin', 'take', 'do', 'give', 'run', 'launch', 'open', 'play', 'new', 'one', 'another',
  'le', 'lo', 'lao', 'de', 'karo', 'kar', 'kara', 'karwa', 'shuru', 'chal', 'chalo', 'chalu',
  'ka', 'ki', 'ke', 'se', 'pe', 'par', 'mein', 'ek', 'aur', 'lets', 'now', 'abhi', 'today', 'aaj',
  'please', 'pls', 'with', 'to', 'i', 'want', 'need', 'test', 'round', 'session', 'set', 'full',
]);

function leftoverWords(text: string, removePatterns: RegExp[]): string[] {
  let rest = text;
  for (const re of removePatterns) rest = rest.replace(re, ' ');
  return rest
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !COMMAND_NOISE.has(w));
}

// ─── Individual rules ───

function parsePomodoro(text: string): NexusCommand | null {
  if (!/\b(?:pomodoro|pomodoros|pomo|focus\s+timer|focus\s+session|timer)\b/.test(text)) return null;
  // Must look like a command ("stop the timer"), not a question ("what is a timer interrupt").
  const leftovers = leftoverWords(text, [
    /\b(?:pomodoros?|pomo|focus\s+timer|focus\s+session|timer)\b/g,
    /\b(?:stop|cancel|end|kill|band|bandh|khatam|rok|roko|reset|pause|hold|resume|continue|unpause|focus|break|minute|minutes|mins|min)\b/g,
    /\d{1,3}\s*\/\s*\d{1,2}/g,
    /\b\d{1,3}\s*m?\b/g,
  ]);
  if (leftovers.length > 1) return null;
  if (/\b(?:stop|cancel|end|kill|band|bandh|khatam|rok|roko|reset)\b/.test(text)) return { type: 'stop_pomodoro' };
  if (/\b(?:pause|hold)\b/.test(text)) return { type: 'pause_pomodoro' };
  if (/\b(?:resume|continue|unpause)\b/.test(text)) return { type: 'resume_pomodoro' };
  const pair = /(\d{1,3})\s*\/\s*(\d{1,2})/.exec(text);
  if (pair) {
    return {
      type: 'start_pomodoro',
      focusMinutes: toMinutes(pair[1], 1, 180),
      breakMinutes: toMinutes(pair[2], 1, 60),
    };
  }
  const breakMatch = /(\d{1,2})\s*(?:m|min|mins|minutes?)?\s+break\b/.exec(text);
  const withoutBreak = breakMatch ? text.replace(breakMatch[0], ' ') : text;
  const focusMatch = /(\d{1,3})\s*(?:m|min|mins|minutes?)?\b/.exec(withoutBreak);
  return {
    type: 'start_pomodoro',
    focusMinutes: toMinutes(focusMatch?.[1], 1, 180),
    breakMinutes: toMinutes(breakMatch?.[1], 1, 60),
  };
}

function parseModes(text: string): NexusCommand | null {
  if (
    /\b(?:study|focus|padhai|padh|padhna|deep\s*work)\s*-?\s*mode\b/.test(text) ||
    /^(?:study|focus|padhai|padhai\s+shuru(?:\s+kar(?:o|te\s+hai)?)?|study\s+time|study\s+kar(?:te\s+hai|na\s+hai)?|padhna\s+hai|time\s+to\s+study|(?:start|begin)\s+(?:studying|study\s+session))$/.test(text)
  ) {
    return { type: 'study_mode' };
  }
  if (
    /\b(?:chill|relax|relaxing|break|aaram|aram|rest)\s*-?\s*mode\b/.test(text) ||
    /^(?:chill|relax|chill\s+kar(?:te\s+hai|na\s+hai)?|aaram|aaram\s+karna\s+hai|time\s+to\s+chill)$/.test(text)
  ) {
    return { type: 'chill_mode' };
  }
  return null;
}

function parseTakeBreak(text: string): NexusCommand | null {
  if (
    /^(?:take\s+(?:a\s+)?(?:short\s+)?break|start\s+(?:a\s+)?break|break\s+(?:le|lena|lena\s+hai|time|chahiye)|i\s+need\s+a\s+break|need\s+a\s+break|breathing(?:\s+exercise)?|breathe|breathing\s+break)$/.test(
      text
    )
  ) {
    return { type: 'take_break' };
  }
  return null;
}

function parseChatManagement(text: string): NexusCommand | null {
  if (
    /^(?:clear|reset|wipe|saaf)(?:\s+(?:the\s+)?(?:chat|history|conversation|screen))?(?:\s+kar(?:o|do)?)?$/.test(text) ||
    /^(?:chat|history|conversation)\s+(?:clear|saaf|reset)(?:\s+kar(?:o|do)?)?$/.test(text)
  ) {
    return { type: 'clear_chat' };
  }
  if (/^(?:new|naya|nayi|fresh|start\s+(?:a\s+)?new)\s+(?:chat|conversation|thread)$/.test(text)) {
    return { type: 'new_chat' };
  }
  return null;
}

const WALLPAPER_ALIAS_WORDS_RE = new RegExp(
  `\\b(?:${WALLPAPER_ALIASES.map(([alias]) => escapeRegExp(alias)).join('|')})\\b`,
  'g'
);

function parseWallpaper(text: string): NexusCommand | null {
  if (!/\b(?:wallpaper|wallpapers|background|wall\s+paper|bg)\b/.test(text)) return null;
  const leftovers = leftoverWords(text, [
    /\b(?:wallpapers?|background|wall\s+paper|bg)\b/g,
    /\b(?:change|set|switch|make|use|put|next|different|shuffle|badlo|badal|badle|laga|lagao|it)\b/g,
    WALLPAPER_ALIAS_WORDS_RE,
  ]);
  if (leftovers.length > 1) return null;
  const id = matchWallpaper(text.replace(/\b(?:wallpapers?|background|bg)\b/g, ' '));
  return id ? { type: 'change_wallpaper', wallpaperId: id } : { type: 'change_wallpaper' };
}

function parseWorkspace(text: string): NexusCommand | null {
  const ws =
    /^(?:(?:switch|go|move|jump|take\s+me)\s+)?(?:to\s+)?(?:the\s+)?(study|build|chill)\s+(?:workspace|space|desktop)(?:\s+(?:pe|par|mein)(?:\s+(?:chalo|chal|jao))?)?$/.exec(text) ??
    /^(?:switch|go|move|jump)\s+to\s+(study|build|chill)$/.exec(text) ??
    /^workspace\s+(study|build|chill)$/.exec(text);
  if (ws) return { type: 'switch_workspace', workspaceId: ws[1] as NexusWorkspaceId };
  const numbered = /^(?:workspace|desktop)\s+([123])$/.exec(text);
  if (numbered) return { type: 'switch_workspace', workspaceId: WORKSPACES[Number(numbered[1]) - 1] };
  return null;
}

const NOTE_QUERY_STOP = new Set(['my', 'all', 'the', 'mere', 'meri', 'mera', 'apne', 'apni', 'saare', 'sare', 'some']);

function cleanQuery(query: string): string {
  return query
    .replace(/^(?:for|about|on|regarding|related\s+to|of)\s+/, '')
    .replace(/\s+(?:please|pls)$/, '')
    .trim();
}

function parseNotesSearch(text: string): NexusCommand | null {
  // "search notes" with no query → open Notes with its search panel.
  if (/^(?:search|find|dhundh(?:o)?|dhoondh(?:o)?)\s+(?:in\s+)?(?:my\s+)?notes?$/.test(text) || /^notes?\s+search$/.test(text)) {
    return { type: 'search_notes', query: '' };
  }
  const patterns: RegExp[] = [
    /^(?:search|find|look\s+for|look\s+up|dhundh(?:o)?|dhoondh(?:o)?|khoj(?:o)?)\s+(?:in\s+|through\s+)?(?:my\s+)?notes?\s+(?:for\s+|about\s+|on\s+|regarding\s+|with\s+)?(.+)$/,
    /^(?:search|find|look\s+for|look\s+up|dhundh(?:o)?|dhoondh(?:o)?)\s+(.+?)\s+(?:in|from|inside)\s+(?:my\s+)?notes?$/,
    /^(?:(?:show|open|get|pull\s+up|find)\s+(?:me\s+)?)?(?:my\s+)?notes?\s+(?:on|about|for|regarding|related\s+to|of)\s+(.+)$/,
    /^notes?\s+(?:search|find|me\s+dhundh(?:o)?)\s+(.+)$/,
    /^(.+?)\s+(?:ke|ki|ka|wale|waale|vale)\s+notes?(?:\s+(?:dikhao|dikha|khol(?:o)?|open\s+kar(?:o)?|search\s+kar(?:o)?|dhundh(?:o)?))?$/,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const query = cleanQuery(m[1]);
      if (query && !NOTE_QUERY_STOP.has(query)) return { type: 'search_notes', query };
    }
  }
  // "open my OS notes" → search "os"
  const topical = /^(?:open|show|get|pull\s+up)\s+(?:me\s+)?(?:my\s+)?(.+?)\s+notes?$/.exec(text);
  if (topical) {
    const query = cleanQuery(topical[1]);
    if (query && !NOTE_QUERY_STOP.has(query) && wordCount(query) <= 4) return { type: 'search_notes', query };
  }
  // Generic "search deadlock" — notes are the only searchable store.
  const generic = /^(?:search|find|dhundh(?:o)?|dhoondh(?:o)?|khoj(?:o)?)\s+(?:for\s+)?(.+)$/.exec(text);
  if (generic) {
    const query = cleanQuery(generic[1]);
    if (query && wordCount(query) <= 4 && !/^(?:the|how|what|why|out|a|an|me)\b/.test(query)) {
      return { type: 'search_notes', query };
    }
  }
  return null;
}

function parseStats(text: string): NexusCommand | null {
  if (
    /^(?:show\s+(?:me\s+)?|open\s+|check\s+)?(?:my\s+)?(?:stats|statistics|progress|level|xp|streak|score|scores)(?:\s+(?:dikhao|dikha|batao|bata|check))?$/.test(text) ||
    /^(?:mera|meri|my)\s+(?:stats|progress|level|streak|xp)(?:\s+(?:kya\s+hai|dikhao|batao))?$/.test(text) ||
    /\b(?:kya\s+haal(?:\s+hai)?|kahan\s+(?:hu|hoon|hun|tak\s+pahuncha)|kaha\s+hu|progress\s+report|how\s+am\s+i\s+doing)\b/.test(text)
  ) {
    return { type: 'show_stats' };
  }
  return null;
}

function parseGate(text: string): NexusCommand | null {
  const mock = /\bmock(?:\s+tests?)?\b/;
  const flash = /\b(?:flash\s*cards?|formula\s*cards?|formulas?|formulae|revision\s+cards?)\b/;
  const planner = /\b(?:gate\s+planner|study\s+plan(?:ner)?)\b/;
  const quiz = /\b(?:quiz|quizzes|test\s+me|practice|practise|pyqs?|mcqs?)\b/;

  let mode: NexusGateMode | null = null;
  let keyword: RegExp | null = null;
  if (mock.test(text)) {
    mode = 'mock';
    keyword = mock;
  } else if (flash.test(text)) {
    mode = 'flashcards';
    keyword = flash;
  } else if (planner.test(text)) {
    mode = 'planner';
    keyword = planner;
  } else if (quiz.test(text)) {
    mode = 'quiz';
    keyword = quiz;
  }
  if (!mode || !keyword) return null;

  const found = findSubject(text);
  const base = found ? found.rest : text;
  const leftovers = leftoverWords(base, [new RegExp(keyword.source, 'g'), /\bgate\b/g, /\barena\b/g]);
  let subject: string | undefined = found?.subject;
  if (!subject && leftovers.length === 1 && leftovers[0] === 'c') {
    subject = 'C Programming';
    leftovers.length = 0;
  }
  // Must look like a command, not a question that happens to contain "practice".
  if (leftovers.length > 2) return null;
  return subject ? { type: 'start_quiz', mode, subject } : { type: 'start_quiz', mode };
}

function parseCloseAll(text: string): NexusCommand | null {
  if (
    /^(?:close|shut|band\s+kar(?:o|do)?)\s+(?:all|everything|sab|sab\s+kuch|saari|sari)(?:\s+(?:windows?|apps?))?$/.test(text) ||
    /^(?:sab|saari|sari|all)\s+(?:windows?|apps?\s+)?(?:band|close)(?:\s+kar(?:o|do|de)?)?$/.test(text) ||
    /^close\s+all\s+(?:the\s+)?(?:windows|apps)$/.test(text)
  ) {
    return { type: 'close_all' };
  }
  return null;
}

// ─── Expenses + habits ───

const CATEGORY_KEYWORDS: ReadonlyArray<readonly [RegExp, ExpenseCategory]> = [
  [/\b(?:food|lunch|dinner|breakfast|snacks?|chai|tea|coffee|khana|nashta|mess|canteen|zomato|swiggy|pizza|burger|maggi|juice|grocer(?:y|ies)|fruits?|milk|doodh)\b/, 'food'],
  [/\b(?:transport|travel|auto|rickshaw|bus|metro|train|uber|ola|rapido|cab|taxi|petrol|diesel|fuel|ticket|parking)\b/, 'transport'],
  [/\b(?:books?|kitab|notes|course|courses|stationery|pens?|pencils?|xerox|photocopy|prints?|printout|notebooks?|test\s+series|udemy|coursera)\b/, 'books'],
  [/\b(?:entertainment|movies?|film|netflix|prime|hotstar|spotify|games?|gaming|party|outing|concert|youtube\s+premium)\b/, 'entertainment'],
];

/** Guess the Expense Vault category from free text. */
export function guessExpenseCategory(text: string): ExpenseCategory {
  const lower = text.toLowerCase();
  for (const [re, category] of CATEGORY_KEYWORDS) if (re.test(lower)) return category;
  return 'other';
}

const EXPENSE_NOTE_NOISE_RE =
  /\b(?:rs\.?|rupees?|rupaye|rupay|inr|bucks|on|for|in|ka|ki|ke|pe|par|me|mein|expense|kharcha|spent|kharch|paid|diya|diye|add|log|kiya|kiye|today|aaj)\b/g;

function parseExpense(text: string): NexusCommand | null {
  const m =
    /^(?:add|log|record|note)\s+(?:an?\s+)?(?:expense|kharcha|spend(?:ing)?)\s+(?:of\s+)?(?:rs\.?\s*|₹\s*|inr\s*)?(\d+(?:\.\d{1,2})?)\b\s*(.*)$/.exec(text) ??
    /^(?:expense|kharcha)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d{1,2})?)\b\s*(.*)$/.exec(text) ??
    /^(?:spent|paid|kharch(?:e|a)?)\s+(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d{1,2})?)\b\s*(.*)$/.exec(text) ??
    /^(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d{1,2})?)\s*(?:rs|rupees?|rupaye)?\s+(.*?)\s+(?:pe|par|me|mein)\s+(?:kharch(?:e|a)?|spent|diye|lage)(?:\s+(?:kiye|kiya|hue|huye))?$/.exec(text) ??
    /^(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d{1,2})?)\s*(?:rs|rupees?|rupaye)?\s+(?:kharch(?:e|a)?|spent)\s*(.*)$/.exec(text);
  if (!m) return null;
  const amount = Number.parseFloat(m[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rest = m[2] ?? '';
  const note = rest.replace(EXPENSE_NOTE_NOISE_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return { type: 'add_expense', amount, category: guessExpenseCategory(rest), note };
}

function parseHabit(text: string, habits: readonly string[]): NexusCommand | null {
  const explicit = /\bhabits?\b/.test(text);
  if (habits.length === 0 && !explicit) return null;
  const m =
    /^(?:check|tick|mark|complete|done)\s+(?:off\s+)?(?:the\s+)?(?:habit\s+)?(.+?)(?:\s+(?:habit|as\s+done|done|for\s+today|today))*$/.exec(text) ??
    /^habit\s+(?:done|check|complete)\s+(.+)$/.exec(text) ??
    /^(.+?)\s+(?:habit\s+)?(?:done|ho\s+gaya|ho\s+gayi|kar\s+liya|kar\s+li|complete)(?:\s+(?:today|aaj))?$/.exec(text);
  if (!m) return null;
  const habit = m[1].replace(/\b(?:habit|my|the|aaj|today)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!habit || wordCount(habit) > 5) return null;
  // Without the word "habit", only fire for a real habit name (so "check if a graph is bipartite" reaches the AI).
  const lowerNames = habits.map((h) => h.toLowerCase());
  const known = lowerNames.some((n) => n === habit || n.startsWith(habit) || (habit.length >= 4 && n.includes(habit)));
  if (!explicit && !known) return null;
  return { type: 'check_habit', habit };
}

function parseAppCommand(text: string, apps: readonly NexusAppRef[]): NexusCommand | null {
  // close
  const close =
    /^(?:close|quit|exit|kill|shut(?:\s+down)?)\s+(.+)$/.exec(text) ??
    /^(.+?)\s+(?:band|bandh|close)(?:\s+kar(?:o|do|de)?)?$/.exec(text);
  if (close) {
    const app = matchApp(close[1], apps);
    if (app) return { type: 'close_app', appId: app.id, appName: app.name };
  }

  // focus
  const focus = /^(?:focus(?:\s+on)?|switch\s+to|go\s+to|bring\s+up|bring\s+back|show(?:\s+me)?|dikhao)\s+(.+)$/.exec(text);
  if (focus) {
    const app = matchApp(focus[1], apps);
    if (app) return { type: 'focus_app', appId: app.id, appName: app.name };
  }

  // play music
  if (/^(?:play|chala(?:o)?|bajao|baja|put\s+on)\s+(?:some\s+)?(?:music|songs?|gaane?|gaana|lofi|lo-fi|beats)\b/.test(text)) {
    const app = matchAppExact('music', apps);
    if (app) return { type: 'open_app', appId: app.id, appName: app.name };
  }

  // open (English verb-first)
  const open =
    /^(?:open|launch|start|run|kholo|khol|chalu\s+kar(?:o)?|chala(?:o)?|start\s+kar(?:o)?|fire\s+up|boot(?:\s+up)?)\s+(?:(?:a|an|the|my)\s+)?(?:(new|another|naya|nayi|ek\s+aur)\s+)?(.+)$/.exec(text);
  if (open) {
    const app = matchApp(open[2], apps);
    if (app) return { type: 'open_app', appId: app.id, appName: app.name, ...(open[1] ? { newWindow: true } : {}) };
  }

  // open (Hinglish verb-last: "notes kholo", "music chala do", "code lab chalu karo")
  const openHi =
    /^(?:(new|another|naya|nayi|ek\s+aur)\s+)?(.+?)\s+(?:kholo|khol(?:\s+(?:do|de|dena))?|(?:open|chalu|start)\s+kar(?:o|do|de)?(?:\s+(?:do|de))?|chala(?:o)?(?:\s+(?:do|de))?|laga(?:o)?(?:\s+(?:do|de))?|bajao|baja(?:\s+(?:do|de))?)$/.exec(text);
  if (openHi) {
    const app = matchApp(openHi[2], apps);
    if (app) return { type: 'open_app', appId: app.id, appName: app.name, ...(openHi[1] ? { newWindow: true } : {}) };
  }

  // focus (Hinglish verb-last: "weather dikhao", "terminal samne lao")
  const focusHi = /^(.+?)\s+(?:dikhao|dikha(?:\s+(?:do|de))?|samne\s+lao|upar\s+lao)$/.exec(text);
  if (focusHi) {
    const app = matchApp(focusHi[1], apps);
    if (app) return { type: 'focus_app', appId: app.id, appName: app.name };
  }

  // bare app name ("terminal", "notes")
  if (wordCount(text) <= 3) {
    const app = matchAppExact(text, apps);
    if (app) return { type: 'open_app', appId: app.id, appName: app.name };
  }
  return null;
}

/** Parse exactly one command (no multi-action splitting). */
function parseSingle(text: string, apps: readonly NexusAppRef[], habits: readonly string[]): LocalIntent {
  if (!text) return { type: 'none' };
  if (/^(?:help|commands|command\s+list|what\s+can\s+(?:you|u)\s+do|kya\s+(?:kya\s+)?kar\s+sakta\s+hai|madad|options)$/.test(text)) {
    return { type: 'help' };
  }
  if (/\bjarvis\b/.test(text)) return { type: 'easter_egg', reply: JARVIS_REPLY };

  return (
    parsePomodoro(text) ??
    parseTakeBreak(text) ??
    parseModes(text) ??
    parseChatManagement(text) ??
    parseExpense(text) ??
    parseWallpaper(text) ??
    parseWorkspace(text) ??
    parseNotesSearch(text) ??
    parseStats(text) ??
    parseGate(text) ??
    parseCloseAll(text) ??
    parseAppCommand(text, apps) ??
    parseHabit(text, habits) ?? { type: 'none' }
  );
}

const SPLIT_RE = /\s*(?:,|;|&|\band\s+then\b|\bthen\b|\band\b|\baur\s+phir\b|\baur\b|\bphir\b|\bfir\b|\bplus\b)\s*/;

/** True when the intent is a single executable command (not multi/help/easter-egg/none). */
export function isCommandIntent(intent: LocalIntent): intent is NexusCommand {
  return intent.type !== 'none' && intent.type !== 'multi' && intent.type !== 'help' && intent.type !== 'easter_egg';
}

/**
 * Pure synchronous parser. Returns a command, a multi-command list
 * ("open notes and start a DBMS quiz"), help/easter-egg replies, or
 * { type: 'none' } when the caller should ask the AI instead.
 */
export function parseLocalIntent(
  rawInput: string,
  apps: readonly NexusAppRef[] = [],
  habits: readonly string[] = []
): LocalIntent {
  const normalized = normalize(rawInput);
  if (!normalized) return { type: 'none' };
  const text = stripFillers(normalized);
  if (!text) return { type: 'none' };

  // Multi-action: every part must be a command on its own.
  if (SPLIT_RE.test(text)) {
    const parts = text
      .split(SPLIT_RE)
      .map((part) => stripFillers(part))
      .filter(Boolean);
    if (parts.length >= 2 && parts.length <= 4) {
      const intents = parts.map((part) => parseSingle(part, apps, habits));
      if (intents.every(isCommandIntent)) {
        return { type: 'multi', commands: intents as NexusCommand[] };
      }
    }
  }
  return parseSingle(text, apps, habits);
}

// ─── Descriptions + AI action resolution ───

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Short human label for a command (buttons, palette rows). */
export function describeCommand(command: NexusCommand): string {
  switch (command.type) {
    case 'open_app':
      return command.newWindow ? `New ${command.appName} window` : `Open ${command.appName}`;
    case 'focus_app':
      return `Focus ${command.appName}`;
    case 'close_app':
      return `Close ${command.appName}`;
    case 'close_all':
      return 'Close all windows here';
    case 'switch_workspace':
      return `Go to ${titleCase(command.workspaceId)} workspace`;
    case 'search_notes':
      return `Search notes: "${command.query}"`;
    case 'start_quiz': {
      const subject = command.subject ? `${command.subject} ` : '';
      if (command.mode === 'mock') return `${subject}mock test`.trim().replace(/^./, (c) => c.toUpperCase());
      if (command.mode === 'flashcards') return `${subject}flashcards`.trim().replace(/^./, (c) => c.toUpperCase());
      if (command.mode === 'planner') return 'GATE study planner';
      return command.subject ? `${command.subject} quiz` : 'GATE quiz';
    }
    case 'study_mode':
      return 'Study mode';
    case 'chill_mode':
      return 'Chill mode';
    case 'change_wallpaper':
      return command.wallpaperId ? `Wallpaper: ${wallpaperName(command.wallpaperId)}` : 'Next wallpaper';
    case 'start_pomodoro':
      return command.focusMinutes ? `Start ${command.focusMinutes} min pomodoro` : 'Start pomodoro';
    case 'pause_pomodoro':
      return 'Pause pomodoro';
    case 'resume_pomodoro':
      return 'Resume pomodoro';
    case 'stop_pomodoro':
      return 'Stop pomodoro';
    case 'show_stats':
      return 'Show stats';
    case 'take_break':
      return 'Take a break';
    case 'clear_chat':
      return 'Clear chat';
    case 'new_chat':
      return 'New chat';
    case 'add_expense':
      return `Log ₹${command.amount} expense (${command.category}${command.note ? `: ${command.note}` : ''})`;
    case 'check_habit':
      return `Check habit: ${command.habit}`;
  }
}

/** Human label for any local intent (palette preview). */
export function describeIntent(intent: LocalIntent): string {
  if (intent.type === 'none') return '';
  if (intent.type === 'help') return 'Show what NEXUS can do';
  if (intent.type === 'easter_egg') return 'Ask NEXUS';
  if (intent.type === 'multi') return intent.commands.map(describeCommand).join(' + ');
  return describeCommand(intent);
}

/** Resolve an AI wire action into an executable command (null if unusable). */
export function resolveWireCommand(wire: NexusWireAction, apps: readonly NexusAppRef[]): NexusCommand | null {
  const target = wire.target?.trim() ?? '';
  switch (wire.type) {
    case 'open_app':
    case 'close_app':
    case 'focus_app': {
      const app = target ? matchApp(target, apps) : null;
      if (!app) return null;
      if (wire.type === 'close_app') return { type: 'close_app', appId: app.id, appName: app.name };
      if (wire.type === 'focus_app') return { type: 'focus_app', appId: app.id, appName: app.name };
      return { type: 'open_app', appId: app.id, appName: app.name };
    }
    case 'search_notes':
      return target ? { type: 'search_notes', query: target.slice(0, 100) } : null;
    case 'start_quiz':
    case 'start_mock_test':
    case 'open_flashcards': {
      const mode: NexusGateMode =
        wire.type === 'start_mock_test' ? 'mock' : wire.type === 'open_flashcards' ? 'flashcards' : 'quiz';
      const subject = target ? matchSubject(target) : null;
      return subject ? { type: 'start_quiz', mode, subject } : { type: 'start_quiz', mode };
    }
    case 'study_mode':
      return { type: 'study_mode' };
    case 'chill_mode':
      return { type: 'chill_mode' };
    case 'change_wallpaper': {
      const id = target ? matchWallpaper(target) : null;
      return id ? { type: 'change_wallpaper', wallpaperId: id } : { type: 'change_wallpaper' };
    }
    case 'start_pomodoro': {
      const minutes = toMinutes(/\d{1,3}/.exec(target)?.[0], 1, 180);
      return minutes ? { type: 'start_pomodoro', focusMinutes: minutes } : { type: 'start_pomodoro' };
    }
    case 'stop_pomodoro':
      return { type: 'stop_pomodoro' };
    case 'switch_workspace': {
      const ws = WORKSPACES.find((w) => target.toLowerCase().includes(w));
      return ws ? { type: 'switch_workspace', workspaceId: ws } : null;
    }
    case 'show_stats':
      return { type: 'show_stats' };
    case 'take_break':
      return { type: 'take_break' };
    case 'ask':
      return null;
  }
}

/** Resolve an AI wire action into a button (ask prompts or commands). */
export function resolveWireButton(wire: NexusWireAction, apps: readonly NexusAppRef[]): NexusActionButton | null {
  if (wire.type === 'ask') {
    const prompt = wire.target?.trim();
    if (!prompt) return null;
    const label = wire.label ?? (prompt.length > 32 ? `${prompt.slice(0, 31)}…` : prompt);
    return { kind: 'ask', label, prompt: prompt.slice(0, 500) };
  }
  const command = resolveWireCommand(wire, apps);
  if (!command) return null;
  return { kind: 'command', label: wire.label ?? describeCommand(command), command };
}

/** Stable identity for de-duplicating commands. */
export function commandKey(command: NexusCommand): string {
  return JSON.stringify(command);
}
