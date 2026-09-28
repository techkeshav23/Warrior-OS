// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Lite Mode
// ═══════════════════════════════════════════════════════════
// A lighter rendering profile for ordinary laptops. While it is active
// the wallpaper is CSS-only (no WebGL), the CRT / particle / cursor-trail
// canvases, the custom cursor, glass blur and the unlock glitch/shatter
// transitions are skipped. Everything functional keeps running.
//
// Settings → Performance: 'auto' (default) decides from the device — lite
// when the browser reports ≤ 4 GB of memory or ≤ 4 CPU threads, or the
// system asks for reduced motion — 'on' forces it, 'off' turns it off.
//
//   const lite = useLiteMode();       // components
//   if (isLiteModeActive()) { … }     // event handlers, effects, stores
//
// While lite mode is on, <html> carries a data-lite-mode attribute (set by
// the desktop page), so CSS can adapt too: html[data-lite-mode] .x { … }
//
// Hydration-safe: the hooks report "not lite" while React hydrates the
// server HTML, then switch to the real value on the first client render.

import { useMemo, useSyncExternalStore } from 'react';
import { useSettingsStore, type PerformanceMode } from '@/stores/useSettingsStore';

/** Auto lite mode at or below this much device memory (GB). */
export const LITE_MAX_MEMORY_GB = 4;
/** Auto lite mode at or below this many logical CPU threads. */
export const LITE_MAX_CPU_THREADS = 4;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** A device signal that makes Auto switch lite mode on. */
export type LiteSignal = 'memory' | 'cpu' | 'reduced-motion';

export interface DeviceProfile {
  /** navigator.deviceMemory in GB (Chromium only, capped at 8); null when unreported. */
  memoryGB: number | null;
  /** navigator.hardwareConcurrency; null when unreported. */
  cpuThreads: number | null;
  /** The operating system / browser asks for reduced motion. */
  reducedMotion: boolean;
}

export interface LiteModeStatus {
  /** The Settings → Performance choice. */
  mode: PerformanceMode;
  /** Lite mode is in effect right now. */
  active: boolean;
  /** Device signals Auto acts on — reported whatever the mode is. */
  signals: LiteSignal[];
  /** What this device reports; null until known (server render / hydration). */
  device: DeviceProfile | null;
}

// ─── Device signals: a tiny external store ───
// Memory and CPU never change during a visit; reduced motion can, so the
// store subscribes to that media query. The snapshot is a bit mask so
// React can compare it cheaply; UNKNOWN stands for "not in a browser".

const SIGNAL_BITS: Record<LiteSignal, number> = { memory: 1, cpu: 2, 'reduced-motion': 4 };
const UNKNOWN = -1;

let reducedMotionQuery: MediaQueryList | null | undefined;

function getReducedMotionQuery(): MediaQueryList | null {
  if (reducedMotionQuery === undefined) {
    try {
      reducedMotionQuery =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia(REDUCED_MOTION_QUERY)
          : null;
    } catch {
      reducedMotionQuery = null;
    }
  }
  return reducedMotionQuery;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** What the browser reports about this device; null outside the browser. */
export function readDeviceProfile(): DeviceProfile | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    memoryGB: positiveNumber(nav.deviceMemory),
    cpuThreads: positiveNumber(nav.hardwareConcurrency),
    reducedMotion: getReducedMotionQuery()?.matches ?? false,
  };
}

/** The signals Auto would act on for a device. */
export function liteSignalsFor(device: DeviceProfile): LiteSignal[] {
  const signals: LiteSignal[] = [];
  if (device.memoryGB !== null && device.memoryGB <= LITE_MAX_MEMORY_GB) signals.push('memory');
  if (device.cpuThreads !== null && device.cpuThreads <= LITE_MAX_CPU_THREADS) signals.push('cpu');
  if (device.reducedMotion) signals.push('reduced-motion');
  return signals;
}

function readSignalMask(): number {
  const device = readDeviceProfile();
  if (!device) return UNKNOWN;
  return liteSignalsFor(device).reduce((mask, signal) => mask | SIGNAL_BITS[signal], 0);
}

const readServerSignalMask = (): number => UNKNOWN;

function subscribeSignals(onChange: () => void): () => void {
  const query = getReducedMotionQuery();
  if (!query || typeof query.addEventListener !== 'function') return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function normalizeMode(mode: unknown): PerformanceMode {
  return mode === 'on' || mode === 'off' ? mode : 'auto';
}

function isActive(mode: PerformanceMode, mask: number): boolean {
  if (mask === UNKNOWN) return false;
  return mode === 'on' || (mode === 'auto' && mask !== 0);
}

// ─── Public API ───

/** True while lite mode is in effect. Re-renders when it changes. */
export function useLiteMode(): boolean {
  const mode = normalizeMode(useSettingsStore((s) => s.performanceMode));
  const mask = useSyncExternalStore(subscribeSignals, readSignalMask, readServerSignalMask);
  return isActive(mode, mask);
}

/** Lite mode plus the why — for Settings → Performance. */
export function useLiteModeStatus(): LiteModeStatus {
  const mode = normalizeMode(useSettingsStore((s) => s.performanceMode));
  const mask = useSyncExternalStore(subscribeSignals, readSignalMask, readServerSignalMask);
  return useMemo(() => {
    const device = mask === UNKNOWN ? null : readDeviceProfile();
    return {
      mode,
      active: isActive(mode, mask),
      signals: device ? liteSignalsFor(device) : [],
      device,
    };
  }, [mode, mask]);
}

/** Non-hook check for event handlers, effects and store code. */
export function isLiteModeActive(): boolean {
  return isActive(normalizeMode(useSettingsStore.getState().performanceMode), readSignalMask());
}
