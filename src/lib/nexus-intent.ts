// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Local Intent Parser
//
// Fast deterministic path that handles common commands ("open notes",
// "study mode", "kya streak hai") WITHOUT a Gemini round-trip.
// Saves cost + latency for the 80% case. Falls through to AI for anything
// non-trivial or conversational.
// ═══════════════════════════════════════════════════════════

import { APP_REGISTRY } from '@/data/app-registry';
import type { GateSubject } from '@/types/gate';
import { getAvailableSubjects } from '@/data/gate-questions';

export type LocalIntent =
  | { type: 'open_app'; appId: string; appName: string }
  | { type: 'switch_workspace'; workspaceId: 'study' | 'build' | 'chill' }
  | { type: 'study_mode' }
  | { type: 'chill_mode' }
  | { type: 'start_quiz'; subject?: GateSubject }
  | { type: 'show_stats' }
  | { type: 'clear_chat' }
  | { type: 'none' };               // means: hand off to AI

interface ParseContext {
  /** Recognized GATE subject names — derived once for speed */
  subjects: string[];
}

let cachedCtx: ParseContext | null = null;
function ctx(): ParseContext {
  if (!cachedCtx) {
    cachedCtx = { subjects: getAvailableSubjects() };
  }
  return cachedCtx;
}

/**
 * Strip noise + lowercase. Keep this cheap — runs on every keystroke
 * if we ever surface live suggestions later.
 */
function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/[?!.,]+$/g, '');
}

/**
 * Pure synchronous parser. Order matters: more specific patterns first.
 */
export function parseLocalIntent(rawInput: string): LocalIntent {
  const input = normalize(rawInput);
  if (input.length === 0) return { type: 'none' };

  // ─── Modes (highest specificity) ───
  if (/\b(study|focus|padh)[\s-]?mode\b/.test(input) || input === 'study' || input === 'focus') {
    return { type: 'study_mode' };
  }
  if (/\b(chill|relax|break|aram)[\s-]?mode\b/.test(input) || input === 'chill' || input === 'relax') {
    return { type: 'chill_mode' };
  }

  // ─── Workspace switching ───
  const wsMatch = input.match(/^(?:switch to|go to|open)?\s*(study|build|chill)\s*(?:workspace|space)?$/);
  if (wsMatch) {
    return { type: 'switch_workspace', workspaceId: wsMatch[1] as 'study' | 'build' | 'chill' };
  }

  // ─── Quiz starts (with optional subject) ───
  const quizMatch = input.match(/^(?:start|begin|le|do|karaa?|chal)?\s*(?:a\s+)?quiz(?:\s+(?:in|on|of|for))?\s*(.+)?$/);
  if (quizMatch) {
    const subjectHint = quizMatch[1]?.trim();
    if (subjectHint) {
      const match = matchSubject(subjectHint);
      if (match) return { type: 'start_quiz', subject: match as GateSubject };
    }
    return { type: 'start_quiz' };
  }

  // ─── Stats / progress queries ───
  if (/\b(stats|progress|score|streak|level|kya haal|kahaa(n)? hu)\b/.test(input)) {
    return { type: 'show_stats' };
  }

  // ─── Clear / reset chat ───
  if (input === 'clear' || input === 'reset' || /^(clear|reset)\s+(chat|history|conversation)$/.test(input)) {
    return { type: 'clear_chat' };
  }

  // ─── Open <app> ───
  // "open notes", "kholo terminal", "launch gate prep", etc.
  const openMatch = input.match(
    /^(?:open|launch|start|kholo|chalu kar|chala|start kar)\s+(.+)$/
  );
  if (openMatch) {
    const target = openMatch[1].trim();
    const app = matchApp(target);
    if (app) return { type: 'open_app', appId: app.id, appName: app.name };
  }

  // No fast-path match — caller should fall back to AI chat.
  return { type: 'none' };
}

/**
 * Fuzzy-match a user phrase to an app id. Generous: prefers any token overlap.
 */
function matchApp(phrase: string): { id: string; name: string } | null {
  const p = phrase.toLowerCase();
  // Exact id/name match wins
  for (const app of APP_REGISTRY) {
    if (app.id === p || app.name.toLowerCase() === p) {
      return { id: app.id, name: app.name };
    }
  }
  // Substring / token overlap
  for (const app of APP_REGISTRY) {
    const name = app.name.toLowerCase();
    if (p.includes(name) || name.includes(p)) {
      return { id: app.id, name: app.name };
    }
  }
  // Aliases — common names users might type
  const aliases: Record<string, string> = {
    notes: 'notes',
    note: 'notes',
    gate: 'gate-prep',
    quiz: 'gate-prep',
    'gate prep': 'gate-prep',
    arena: 'gate-prep',
    habits: 'study-planner',
    habit: 'study-planner',
    terminal: 'terminal',
    term: 'terminal',
    music: 'music-player',
    beats: 'music-player',
    settings: 'settings',
    setting: 'settings',
    stats: 'warrior-profile',
    profile: 'warrior-profile',
    nexus: 'nexus-ai',
    ai: 'nexus-ai',
  };
  const aliasHit = aliases[p];
  if (aliasHit) {
    const app = APP_REGISTRY.find((a) => a.id === aliasHit);
    if (app) return { id: app.id, name: app.name };
  }
  return null;
}

/**
 * Fuzzy-match a phrase to a GATE subject. Used by quiz intent.
 */
function matchSubject(phrase: string): string | null {
  const p = phrase.toLowerCase();
  for (const subj of ctx().subjects) {
    if (subj.toLowerCase() === p) return subj;
  }
  for (const subj of ctx().subjects) {
    if (p.includes(subj.toLowerCase()) || subj.toLowerCase().includes(p)) return subj;
  }
  // Common abbreviations / hindi shorthand
  const aliases: Record<string, string> = {
    os: 'OS',
    'operating system': 'OS',
    'operating systems': 'OS',
    dbms: 'DBMS',
    database: 'DBMS',
    'data base': 'DBMS',
    cn: 'CN',
    network: 'CN',
    networking: 'CN',
    toc: 'TOC',
    automata: 'TOC',
    coa: 'COA',
    architecture: 'COA',
    daa: 'DAA',
    algorithms: 'DAA',
    algo: 'DAA',
    compiler: 'Compiler Design',
    'digital logic': 'Digital Logic',
    digital: 'Digital Logic',
    discrete: 'Discrete Math',
    'discrete math': 'Discrete Math',
    math: 'Engineering Math',
    maths: 'Engineering Math',
    c: 'C Programming',
    'c programming': 'C Programming',
    ds: 'Data Structures',
    'data structure': 'Data Structures',
    'data structures': 'Data Structures',
  };
  const hit = aliases[p];
  if (hit && ctx().subjects.includes(hit)) return hit;
  return null;
}
