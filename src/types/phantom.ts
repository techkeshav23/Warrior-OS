// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Windows Types
// Ghosts of closed application windows
// ═══════════════════════════════════════════════════════════

import type { Position, Size } from './window';

/** Lifecycle state of a single phantom */
export type PhantomStatus = 'drifting' | 'resurrecting' | 'dissolving';

/**
 * A phantom is the lingering ghost of a window that was just closed.
 * We do NOT snapshot the DOM (no html2canvas) — instead we keep the
 * last-known chrome (title/icon/appId) and render a stylized ghost card.
 */
export interface Phantom {
  id: string;
  /** appId to resurrect via the app store */
  appId: string;
  /** workspace the window lived in, used when relaunching */
  workspaceId: string;
  title: string;
  icon: string;
  /** last-known on-screen position */
  position: Position;
  /** last-known size */
  size: Size;
  /** accent hex used for glow + dissolve particles */
  accent: string;
  /** epoch ms the phantom was born */
  createdAt: number;
  /** current lifecycle stage */
  status: PhantomStatus;
}

/** Config used to spawn a phantom from a vanished window */
export interface PhantomSpawn {
  appId: string;
  workspaceId: string;
  title: string;
  icon: string;
  position: Position;
  size: Size;
  accent?: string;
}
