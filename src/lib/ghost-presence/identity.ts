// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: anonymous identity
// Each login session (browser tab) gets an anonymous Warrior#XXXX id,
// kept in sessionStorage so a reload keeps it while a new tab (another
// warrior at the campfire) gets its own. Nothing personal is shared.
// ═══════════════════════════════════════════════════════════

const SESSION_KEY = 'warrior-ghost-session-id';

/** Shape every anonymous id must have (also enforced by the RTDB rules). */
export const WARRIOR_ID_PATTERN = /^Warrior#\d{4}$/;

let cachedId: string | null = null;

export function makeWarriorId(): string {
  return `Warrior#${1000 + Math.floor(Math.random() * 9000)}`;
}

/** This session's anonymous id (created on first call). Browser only. */
export function getSessionWarriorId(): string {
  if (cachedId) return cachedId;
  let id: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(SESSION_KEY);
      if (stored && WARRIOR_ID_PATTERN.test(stored)) id = stored;
      if (!id) {
        id = makeWarriorId();
        window.sessionStorage.setItem(SESSION_KEY, id);
      }
    } catch {
      id = null;
    }
  }
  cachedId = id ?? makeWarriorId();
  return cachedId;
}
