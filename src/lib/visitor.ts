// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Visitor Mode
// ═══════════════════════════════════════════════════════════
// Who is using Warrior OS in this browser: the owner, or a portfolio visitor
// exploring as a guest. Chosen on the lock screen and remembered per browser.

export type VisitorMode = 'owner' | 'guest';

const STORAGE_KEY = 'warrior-os-visitor-mode';

export function getVisitorMode(): VisitorMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'owner' || value === 'guest' ? value : null;
  } catch {
    return null;
  }
}

export function setVisitorMode(mode: VisitorMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked (private windows, site-data settings). The OS
    // still works; it just won't remember the choice.
  }
}
