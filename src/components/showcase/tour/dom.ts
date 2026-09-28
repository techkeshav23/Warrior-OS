// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Guided Tour: DOM helpers
// Finding what to spotlight (only when it is really on screen and
// not covered, e.g. by a window) and talking to the Ctrl+K command
// bar. Browser-only: call from effects and handlers, never in render.
// ═══════════════════════════════════════════════════════════

import { useCreatureStore } from '@/stores/useCreatureStore';

/** A CSS selector (every match is tried, in order) or a finder function. */
export type TargetSpec = string | (() => Element | null);

/** Everything the tour renders carries this attribute; hit tests skip it. */
export const TOUR_ROOT_SELECTOR = '[data-guided-tour]';

/**
 * The command bar's search input only exists while the bar is open
 * (CommandPalette: id + aria-label; `data-command-bar` for the future).
 */
const COMMAND_BAR_SELECTOR =
  '#warrior-command-palette-input, input[aria-label="Command palette"], [data-command-bar]';

/**
 * True when `el` has a size, overlaps the viewport and is the topmost
 * thing at its centre (ignoring the tour itself), so a window lying on
 * top of a desktop icon makes that icon "not visible".
 */
export function isTargetVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) return false;
  if (typeof document.elementsFromPoint !== 'function') return true;

  const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
  const y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
  const hit = document.elementsFromPoint(x, y).find((node) => !node.closest(TOUR_ROOT_SELECTOR));
  return hit === undefined || hit === el || el.contains(hit);
}

/** The first visible match of the first spec that has one; null → centred card. */
export function resolveTarget(specs: readonly TargetSpec[]): Element | null {
  for (const spec of specs) {
    let candidates: Element[];
    try {
      candidates =
        typeof spec === 'string'
          ? Array.from(document.querySelectorAll(spec))
          : [spec()].filter((el): el is Element => el !== null);
    } catch {
      continue; // bad selector / finder: try the next fallback
    }
    const visible = candidates.find(isTargetVisible);
    if (visible) return visible;
  }
  return null;
}

/**
 * The Warrior Creature's sprite button on the taskbar. It has no data
 * attribute, but its aria-label always starts with "<name> · ".
 */
export function findCreature(): Element | null {
  const name = useCreatureStore.getState().name;
  if (!name) return null;
  const prefix = `${name} · `;
  for (const button of Array.from(document.querySelectorAll('button[aria-label]'))) {
    if (button.getAttribute('aria-label')?.startsWith(prefix)) return button;
  }
  return null;
}

export function isCommandBarOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.querySelector(COMMAND_BAR_SELECTOR) !== null;
}

/**
 * Opens the command bar the way a person would: Ctrl+K on `document`,
 * where the page's shortcut hook listens (it treats Ctrl and ⌘ alike).
 */
export function sendCommandBarShortcut(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true })
  );
}
