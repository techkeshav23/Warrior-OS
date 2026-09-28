// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Pseudocode Tokenizer
// Splits a pseudocode line into coloured tokens. Output is plain text
// pieces (rendered as React text, so it is always escaped).
// ═══════════════════════════════════════════════════════════

export type PseudoTokenKind = 'keyword' | 'action' | 'function' | 'number' | 'operator' | 'constant' | 'comment' | 'plain';

export interface PseudoToken {
  kind: PseudoTokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'procedure',
  'for',
  'each',
  'to',
  'downto',
  'do',
  'while',
  'loop',
  'if',
  'then',
  'else',
  'return',
  'and',
  'or',
  'not',
  'break',
  'stop',
  'in',
  'where',
  'of',
]);

const ACTIONS = new Set([
  'swap',
  'mark',
  'copy',
  'unlink',
  'link',
  'put',
  'find',
  'remove',
  'add',
  'follow',
  'insert',
  'delete',
  'backtrack',
]);

const CONSTANTS = new Set(['nil', 'true', 'false']);

// comment | number | identifier | whitespace | operator | anything else
const TOKEN_PATTERN = String.raw`(\/\/.*$)|(\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([←≤≥≠<>=+\-−×*/⌊⌋|∞])|(.)`;

function classify(match: RegExpExecArray): PseudoTokenKind {
  const [text, comment, num, word, , op] = match;
  if (comment !== undefined) return 'comment';
  if (num !== undefined) return 'number';
  if (word !== undefined) {
    if (KEYWORDS.has(word)) return 'keyword';
    if (ACTIONS.has(word)) return 'action';
    if (CONSTANTS.has(word)) return 'constant';
    return 'plain';
  }
  if (op !== undefined) return text === '∞' ? 'constant' : 'operator';
  return 'plain';
}

/** Tokenize one pseudocode line. Adjacent plain text is merged to keep the DOM small. */
export function tokenizePseudocode(line: string): PseudoToken[] {
  const raw: PseudoToken[] = [];
  const pattern = new RegExp(TOKEN_PATTERN, 'gu');
  for (;;) {
    const match = pattern.exec(line);
    if (match === null) break;
    raw.push({ kind: classify(match), text: match[0] });
  }

  // An identifier directly followed by "(" is a call: colour it as a function.
  for (let i = 0; i < raw.length - 1; i++) {
    const token = raw[i];
    if ((token.kind === 'plain' || token.kind === 'action') && /^[A-Za-z_]/.test(token.text) && raw[i + 1].text === '(') {
      raw[i] = { kind: 'function', text: token.text };
    }
  }

  const merged: PseudoToken[] = [];
  for (const token of raw) {
    const last = merged[merged.length - 1];
    if (last && last.kind === 'plain' && token.kind === 'plain') {
      merged[merged.length - 1] = { kind: 'plain', text: last.text + token.text };
    } else {
      merged.push(token);
    }
  }
  return merged;
}
