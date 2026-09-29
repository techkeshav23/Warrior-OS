// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Visitor Mode
// ═══════════════════════════════════════════════════════════
// Who is using Warrior OS in this browser: the owner, or a portfolio visitor
// exploring as a guest. Chosen on the lock screen and remembered per browser.

export type VisitorMode = 'owner' | 'guest';

const STORAGE_KEY = 'warrior-os-visitor-mode';
/**
 * Set (ISO timestamp) once the owner has unlocked in this browser. It
 * outlives a later guest unlock, so guest-only extras (the demo seed) can
 * tell that the saved data is the owner's. Settings → Showcase's reset
 * erases it with every other Warrior OS key.
 */
const OWNER_HISTORY_KEY = 'warrior-os-owner-history';

export function getVisitorMode(): VisitorMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'owner' || value === 'guest' ? value : null;
  } catch {
    return null;
  }
}

/** True when the owner has used Warrior OS in this browser (now or before a guest unlock). */
export function hasOwnerHistory(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(OWNER_HISTORY_KEY) !== null ||
      window.localStorage.getItem(STORAGE_KEY) === 'owner'
    );
  } catch {
    return false;
  }
}

export function setVisitorMode(mode: VisitorMode): void {
  if (typeof window === 'undefined') return;
  try {
    // Remember the owner before a guest unlock overwrites the mode (this also
    // covers browsers the owner used before the history key existed).
    if ((mode === 'owner' || getVisitorMode() === 'owner') && window.localStorage.getItem(OWNER_HISTORY_KEY) === null) {
      window.localStorage.setItem(OWNER_HISTORY_KEY, new Date().toISOString());
    }
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage can be blocked (private windows, site-data settings). The OS
    // still works; it just won't remember the choice.
  }
}
