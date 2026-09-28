// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS say (sender side of 'warrior:nexus-say')
// Cross-feature contract: write the detail to sessionStorage under
// 'warrior:pending:' + eventName (so a listener that mounts later
// still gets it), then dispatch a window CustomEvent. The NEXUS
// listener shows it through the OS notification / Dynamic Island.
// SSR-safe: a no-op outside the browser.
// ═══════════════════════════════════════════════════════════

export const NEXUS_SAY_EVENT = 'warrior:nexus-say';

export type NexusSayTone = 'info' | 'success' | 'warning' | 'danger';

export interface NexusSayDetail {
  text: string;
  tone?: NexusSayTone;
}

/** Make NEXUS speak a line. */
export function nexusSay(text: string, tone: NexusSayTone = 'info'): void {
  if (typeof window === 'undefined') return;
  const detail: NexusSayDetail = { text, tone };
  try {
    window.sessionStorage.setItem(`warrior:pending:${NEXUS_SAY_EVENT}`, JSON.stringify(detail));
  } catch {
    /* storage disabled / quota — the live event below still fires */
  }
  window.dispatchEvent(new CustomEvent<NexusSayDetail>(NEXUS_SAY_EVENT, { detail }));
}
