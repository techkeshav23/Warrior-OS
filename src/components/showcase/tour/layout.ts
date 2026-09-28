// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Guided Tour: layout maths
// Spotlight boxes and where the NEXUS card goes relative to them.
// Pure functions of viewport coordinates (readBox/readViewport read
// the DOM, so call those from effects and handlers only).
// ═══════════════════════════════════════════════════════════

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export type Placement = 'right' | 'left' | 'top' | 'bottom';

/** Minimum distance between the card and the viewport edge. */
const EDGE = 16;
/** Space between the card and the spotlight. */
const GAP = 18;
/** Taskbar height (h-12); centred cards stay clear of it. */
const TASKBAR = 48;
/** Below this width the card docks to the top or bottom edge instead. */
const NARROW = 640;

export function readViewport(): Size {
  if (typeof window === 'undefined') return { w: 1280, h: 800 };
  return { w: window.innerWidth, h: window.innerHeight };
}

/** The element's viewport box grown by `pad` on every side; null when it has no size. */
export function readBox(el: Element, pad: number): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
}

export function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5
  );
}

/**
 * Top-left corner for a `card`-sized panel next to `target`, trying
 * `prefs` in order and keeping it fully on screen. No target, or no
 * side with room → centred above the taskbar.
 */
export function placeCard(
  target: Box | null,
  card: Size,
  prefs: readonly Placement[],
  view: Size
): { x: number; y: number } {
  const maxX = Math.max(EDGE, view.w - card.w - EDGE);
  const maxY = Math.max(EDGE, view.h - card.h - EDGE);
  const clampX = (x: number) => Math.min(maxX, Math.max(EDGE, x));
  const clampY = (y: number) => Math.min(maxY, Math.max(EDGE, y));
  const centred = { x: clampX((view.w - card.w) / 2), y: clampY((view.h - TASKBAR - card.h) / 2) };

  if (!target) return centred;

  // Phones / narrow windows: dock to whichever edge is away from the target.
  if (view.w < NARROW) {
    const targetLow = target.y + target.h / 2 > view.h / 2;
    return {
      x: clampX((view.w - card.w) / 2),
      y: targetLow ? EDGE : clampY(view.h - TASKBAR - card.h - 12),
    };
  }

  const alongX = target.x + target.w / 2 - card.w / 2;
  const alongY = target.y + target.h / 2 - card.h / 2;

  for (const side of prefs) {
    if (side === 'right') {
      const x = target.x + target.w + GAP;
      if (x + card.w <= view.w - EDGE) return { x, y: clampY(alongY) };
    } else if (side === 'left') {
      const x = target.x - GAP - card.w;
      if (x >= EDGE) return { x, y: clampY(alongY) };
    } else if (side === 'top') {
      const y = target.y - GAP - card.h;
      if (y >= EDGE) return { x: clampX(alongX), y };
    } else {
      const y = target.y + target.h + GAP;
      if (y + card.h <= view.h - EDGE) return { x: clampX(alongX), y };
    }
  }

  return centred;
}
