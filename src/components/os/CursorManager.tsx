// ═══════════════════════════════════════════════════════════
// WARRIOR OS — CursorManager Component
// The FORGE HUD cursor set, applied as real CSS cursors (drawn by the
// browser: no lag, no double cursor, pixel-exact hotspots):
//   pointer-glow   default arrow            (hotspot 6 4)
//   crosshair      links, buttons, menus…   (hotspot 16 16)
//   grab           drag handles, cursor-grab / cursor-move (hotspot 16 16)
//   loading-hex    busy elements            (hotspot 6 4)
// Text fields keep the I-beam, window resize edges keep their native
// arrows and title bars keep the arrow, like a native OS. On top, a small accent ripple marks each click.
// Mounted only outside lite mode; unmounting restores native cursors.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';

const STYLE_ID = 'wos-cursor-set';

const ARROW = "url('/cursors/pointer-glow.svg') 6 4";
const RETICLE = "url('/cursors/crosshair.svg') 16 16";
const MOVE = "url('/cursors/grab.svg') 16 16";
const BUSY = "url('/cursors/loading-hex.svg') 6 4";

const INTERACTIVE = [
  'a[href]',
  'button:not(:disabled)',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'summary',
  'label[for]',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="range"]',
  'input[type="color"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="file"]',
].join(', ');

const TEXT_FIELDS =
  'input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="button"], [type="submit"], [type="reset"], [type="file"]), textarea, [contenteditable=""], [contenteditable="true"]';

// Base-layer defaults (element semantics), then utility-layer mappings so
// Tailwind cursor-* classes pick up the same set. Inline cursors (react-rnd
// resize edges) still win over both.
const CURSOR_CSS = `
@layer base {
  html, body { cursor: ${ARROW}, default; }
  :where(${INTERACTIVE}) { cursor: ${RETICLE}, pointer; }
  :where(button:disabled, [aria-disabled="true"]) { cursor: ${ARROW}, default; }
  :where(${TEXT_FIELDS}) { cursor: text; }
  :where([data-drag-handle]) { cursor: ${MOVE}, grab; }
  :where([aria-busy="true"]) { cursor: ${BUSY}, progress; }
}
@layer utilities {
  .cursor-default { cursor: ${ARROW}, default; }
  .cursor-pointer { cursor: ${RETICLE}, pointer; }
  .cursor-grab, .cursor-move { cursor: ${MOVE}, grab; }
  .cursor-grabbing, .active\\:cursor-grabbing:active { cursor: ${MOVE}, grabbing; }
  .cursor-wait, .cursor-progress { cursor: ${BUSY}, progress; }
}
`;

export function CursorManager() {
  const rippleRef = useRef<HTMLDivElement>(null);

  // Install the cursor set while mounted.
  useEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CURSOR_CSS;
      // Last in <head>: equal-specificity rules in the utilities layer win.
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById(STYLE_ID)?.remove();
    };
  }, []);

  // Click ripple: one element, restarted per press (no React renders).
  useEffect(() => {
    const ripple = rippleRef.current;
    if (!ripple || typeof ripple.animate !== 'function') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation: Animation | null = null;

    const onPointerDown = (e: PointerEvent) => {
      if (reduced.matches || e.button !== 0 || e.pointerType !== 'mouse') return;
      animation?.cancel();
      const at = `translate(${e.clientX}px, ${e.clientY}px)`;
      animation = ripple.animate(
        [
          { opacity: 0.85, transform: `${at} scale(0.25)` },
          { opacity: 0, transform: `${at} scale(1)` },
        ],
        { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    };

    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      animation?.cancel();
    };
  }, []);

  return (
    <div
      ref={rippleRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 -ml-4 -mt-4 size-8 rounded-full border-[1.5px] border-accent opacity-0 shadow-[0_0_12px_-2px_var(--accent)]"
      style={{ zIndex: 'var(--z-cursor)' }}
    />
  );
}
