// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Windows Types
// Ghosts of closed application windows
// ═══════════════════════════════════════════════════════════

import type { Position, Size } from './window';

/** Lifecycle state of a single phantom. */
export type PhantomLifecycle = 'drifting' | 'resurrecting' | 'dissolving';

/** @deprecated Alias kept for older imports; use {@link PhantomLifecycle}. */
export type PhantomStatus = PhantomLifecycle;

/** Progress of the DOM snapshot that backs a phantom's afterimage. */
export type PhantomSnapshotStatus = 'pending' | 'ready' | 'unavailable';

/** Scroll offset of one scrolled element inside the closed window. */
export interface PhantomScrollEntry {
  /** Child-index path from the window content root to the element. */
  path: number[];
  tag: string;
  top: number;
  left: number;
}

/** Value of one non-sensitive form field inside the closed window. */
export interface PhantomFieldEntry {
  /** Child-index path from the window content root to the field. */
  path: number[];
  tag: 'input' | 'textarea' | 'select';
  /** Input type (text, search, number, range…); empty for textarea/select. */
  type: string;
  value: string;
}

/**
 * Restorable state captured from the window at close time.
 * Password / payment / one-time-code fields are never captured.
 */
export interface PhantomWindowData {
  scroll: PhantomScrollEntry[];
  fields: PhantomFieldEntry[];
  wasMaximized: boolean;
  /** Pre-maximize geometry, so a maximized window restores correctly later. */
  restoreBounds?: { position: Position; size: Size };
}

/**
 * A phantom is the lingering ghost of a window that was just closed.
 * `snapshot` is an object URL of the rasterised window DOM (SVG
 * foreignObject → canvas → image blob). It is revoked when the
 * phantom leaves the store, so it never outlives the ghost.
 */
export interface PhantomWindow {
  id: string;
  /** Object URL of the captured window image, or null until/unless ready. */
  snapshot: string | null;
  snapshotStatus: PhantomSnapshotStatus;
  /** appId to resurrect via the app store */
  appId: string;
  /** workspace the window lived in, used when relaunching */
  workspaceId: string;
  title: string;
  icon: string;
  /** last-known on-screen position (window-layer coordinates) */
  position: Position;
  /** last-known size */
  size: Size;
  /** accent hex used for glow + dissolve particles */
  accent: string;
  /** epoch ms the phantom was born */
  createdAt: number;
  /** current lifecycle stage */
  state: PhantomLifecycle;
  /** scroll + form state captured at close */
  windowData: PhantomWindowData;
}

/** @deprecated Alias kept for older imports; use {@link PhantomWindow}. */
export type Phantom = PhantomWindow;

/** Tunables for the phantom system. */
export interface PhantomConfig {
  /** How long an unclicked phantom drifts before it dissolves (ms). */
  lifetimeMs: number;
  /** Duration of the pixel-particle dissolve (ms). */
  fadeDuration: number;
  /** Max simultaneous phantoms; the oldest expires first. */
  maxPhantoms: number;
}

/** Config used to spawn a phantom from a vanished window. */
export interface PhantomSpawn {
  appId: string;
  workspaceId: string;
  title: string;
  icon: string;
  position: Position;
  size: Size;
  accent?: string;
  windowData?: PhantomWindowData;
  /** True when a DOM snapshot is being rendered for this phantom. */
  snapshotPending?: boolean;
}

/** Lifetime counters (persisted) used for phantom achievements. */
export interface PhantomStats {
  spawned: number;
  resurrected: number;
  dissolved: number;
}
