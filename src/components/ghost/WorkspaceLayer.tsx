// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspace layer portal
// Renders its children inside the current workspace face
// ([data-workspace-face], see WorkspaceManager), so desktop-level
// overlays stack like the desktop widgets: above the icon grid, below
// every app window (the window layer sits at --z-window in the same
// face). Faces are swapped on each workspace switch; the portal follows
// (its children remount, so keep long-lived state outside or persist
// it). Falls back to rendering in place while no face exists.
// ═══════════════════════════════════════════════════════════

'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const ROOT = '[data-workspace-root]';
const FACE = '[data-workspace-face]';

function subscribe(onChange: () => void): () => void {
  let observer: MutationObserver | null = null;
  const watch = () => {
    observer?.disconnect();
    const root = document.querySelector(ROOT);
    observer = new MutationObserver(() => {
      // Narrow the watch to the workspace root once it exists.
      if (!root && document.querySelector(ROOT)) watch();
      onChange();
    });
    observer.observe(root ?? document.body, { childList: true, subtree: !root });
  };
  watch();
  return () => observer?.disconnect();
}

function getFace(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`${ROOT} ${FACE}`);
}

function getServerFace(): HTMLElement | null {
  return null;
}

export function WorkspaceLayer({ children }: { children: ReactNode }) {
  const face = useSyncExternalStore(subscribe, getFace, getServerFace);
  return face ? createPortal(children, face) : <>{children}</>;
}
