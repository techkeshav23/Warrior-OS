// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Pending Cross-Feature Events
// Delivery rule for the cross-app deep links (Training Grounds
// start-quiz, 'warrior:notes-search', 'warrior:nexus-say'): the sender
// stores the detail as JSON in sessionStorage under
// 'warrior:pending:<event>', then dispatches a window CustomEvent. A
// window that mounts later consumes the pending copy; a mounted window
// reacts to the live event.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export const PENDING_EVENT_PREFIX = 'warrior:pending:';

/** Validates an untrusted event detail; returns null to ignore it. */
export type DetailParser<T> = (raw: unknown) => T | null;

function pendingKey(eventName: string): string {
  return PENDING_EVENT_PREFIX + eventName;
}

function clearPendingEvent(eventName: string): void {
  try {
    window.sessionStorage.removeItem(pendingKey(eventName));
  } catch {
    /* storage blocked */
  }
}

/** Read and remove the pending copy of `eventName`, if there is one. SSR-safe. */
export function consumePendingEvent<T>(eventName: string, parse: DetailParser<T>): T | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(pendingKey(eventName));
    if (raw !== null) window.sessionStorage.removeItem(pendingKey(eventName));
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return parse(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** Sender side: store the pending copy, then dispatch the live event. SSR-safe. */
export function sendPendingEvent<T>(eventName: string, detail: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(pendingKey(eventName), JSON.stringify(detail));
  } catch {
    /* storage blocked: mounted listeners still receive the live event */
  }
  window.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
}

/** Tokens of mounted listeners per event name, oldest first. */
const mountedListeners = new Map<string, object[]>();

function newestListener(eventName: string): object | undefined {
  const list = mountedListeners.get(eventName);
  return list ? list[list.length - 1] : undefined;
}

function visibleWindowCount(appIds: readonly string[]): number {
  const { windows } = useWindowStore.getState();
  const { activeWorkspaceId } = useWorkspaceStore.getState();
  return windows.filter(
    (w) => appIds.includes(w.appId) && w.workspaceId === activeWorkspaceId && !w.isMinimized
  ).length;
}

export interface PendingEventListenerOptions<T> {
  eventName: string;
  parse: DetailParser<T>;
  /** App ids whose windows render this listener; used to pick the window that answers. */
  appIds: readonly string[];
  /** Runs in a microtask or event callback, never during render, so setState is safe. */
  onEvent: (detail: T) => void;
}

/**
 * Listener side of the contract, for app components.
 * - On mount the pending copy is consumed by the most recently mounted
 *   window only, so a freshly launched window wins over older ones.
 * - While mounted, live events are handled by the newest window. If a window
 *   of the app has just been opened but has not mounted yet, the live event
 *   is left pending for it.
 * Listeners are removed on unmount.
 */
export function usePendingEventListener<T>({
  eventName,
  parse,
  appIds,
  onEvent,
}: PendingEventListenerOptions<T>): void {
  const onEventRef = useRef(onEvent);
  const parseRef = useRef(parse);
  const appIdsRef = useRef(appIds);
  useEffect(() => {
    onEventRef.current = onEvent;
    parseRef.current = parse;
    appIdsRef.current = appIds;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = {};
    mountedListeners.set(eventName, [...(mountedListeners.get(eventName) ?? []), token]);
    let active = true;

    // Pending copy: decided once every window mounting in this commit has registered.
    queueMicrotask(() => {
      if (!active || newestListener(eventName) !== token) return;
      const detail = consumePendingEvent(eventName, parseRef.current);
      if (detail !== null) onEventRef.current(detail);
    });

    const handleLive = (event: Event) => {
      if (newestListener(eventName) !== token) return;
      const listenerCount = mountedListeners.get(eventName)?.length ?? 0;
      // A just-launched window of this app has not mounted yet; it consumes the pending copy.
      if (visibleWindowCount(appIdsRef.current) > listenerCount) return;
      clearPendingEvent(eventName);
      const detail = parseRef.current((event as CustomEvent<unknown>).detail);
      if (detail !== null) onEventRef.current(detail);
    };
    window.addEventListener(eventName, handleLive);

    return () => {
      active = false;
      window.removeEventListener(eventName, handleLive);
      const remaining = (mountedListeners.get(eventName) ?? []).filter((t) => t !== token);
      if (remaining.length > 0) mountedListeners.set(eventName, remaining);
      else mountedListeners.delete(eventName);
    };
  }, [eventName]);
}
