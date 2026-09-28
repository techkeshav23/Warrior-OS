// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Code Lab Lines
// "Centurion Coder": 100 lines of code in Code Lab, counted from the
// snippet Code Lab already saves ('warrior-codelab'). Read-only —
// Code Lab itself is not modified.
// ═══════════════════════════════════════════════════════════

import { unlock } from './award';

export const CODE_LAB_APP_ID = 'code-editor';
/** Non-empty lines across the HTML, CSS and JS panes. */
export const CODE_LINES_TARGET = 100;

const CODE_LAB_STORAGE_KEY = 'warrior-codelab';
const SNIPPET_PARTS = ['html', 'css', 'js'] as const;

/** Non-empty lines in the saved Code Lab snippet (0 when there is none). */
export function codeLabLineCount(): number {
  if (typeof window === 'undefined') return 0;
  let saved: unknown = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(CODE_LAB_STORAGE_KEY) ?? 'null');
  } catch {
    return 0;
  }
  if (!saved || typeof saved !== 'object') return 0;
  let lines = 0;
  for (const part of SNIPPET_PARTS) {
    const code = (saved as Record<string, unknown>)[part];
    if (typeof code === 'string') lines += code.split('\n').filter((l) => l.trim() !== '').length;
  }
  return lines;
}

export function checkCodeLabLines(): void {
  if (codeLabLineCount() >= CODE_LINES_TARGET) unlock('code-100-lines');
}
