// ═══════════════════════════════════════════════════════════
// WARRIOR OS — localStorage Sync
// Apps that keep a whole list under one localStorage key (Notes, Files,
// Habit Forge) announce each write with a same-tab 'warrior:storage-sync'
// { key } event; the browser's 'storage' event covers other tabs. Every
// open window of the app re-reads the key, so two windows never clobber
// each other with a stale copy.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/stores/useNotificationStore';

export const STORAGE_SYNC_EVENT = 'warrior:storage-sync';

export interface StorageSyncDetail {
  key: string;
}

/** Tell same-tab listeners that `key` was just written. SSR-safe. */
export function announceStorageWrite(key: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<StorageSyncDetail>(STORAGE_SYNC_EVENT, { detail: { key } }));
}

let lastFullWarning = 0;

/** Warn (at most every 30 s) that a write was refused, e.g. storage is full. */
export function reportStorageFull(appName: string): void {
  const now = Date.now();
  if (now - lastFullWarning < 30_000) return;
  lastFullWarning = now;
  useNotificationStore.getState().addNotification({
    type: 'error',
    title: `${appName} could not save`,
    message: 'Browser storage is full or blocked. Your last change was not kept.',
  });
}

/**
 * Run `onChange` whenever `key` may have been written elsewhere: another
 * tab ('storage'), another window in this tab (STORAGE_SYNC_EVENT, or a
 * synthetic StorageEvent) or while this tab was in the background (focus).
 * The callback should compare the raw value it last saw and skip no-ops.
 */
export function useStorageSync(key: string, onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const run = () => onChangeRef.current();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) run();
    };
    const onSync = (e: Event) => {
      if ((e as CustomEvent<StorageSyncDetail>).detail?.key === key) run();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(STORAGE_SYNC_EVENT, onSync);
    window.addEventListener('focus', run);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(STORAGE_SYNC_EVENT, onSync);
      window.removeEventListener('focus', run);
    };
  }, [key]);
}
