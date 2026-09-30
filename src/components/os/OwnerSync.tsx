'use client';

// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner Sync runner
// Renders nothing. In an owner session with a saved sync token it keeps
// this device in step with the owner's server copy (src/lib/sync): once
// on unlock, every minute, and whenever the tab is shown or hidden.
// Guest sessions never sync (they may hold demo data).
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { getVisitorMode } from '@/lib/visitor';
import { getSyncToken, syncNow } from '@/lib/sync/client';
import { refreshKeys } from '@/lib/sync/rehydrate';

const INTERVAL_MS = 60_000;

/** Start a sync round now, if this is an owner session with a token. */
export function runOwnerSync(): Promise<void> {
  if (getVisitorMode() !== 'owner' || !getSyncToken()) return Promise.resolve();
  return syncNow(refreshKeys);
}

export function OwnerSync() {
  useEffect(() => {
    void runOwnerSync();
    const timer = window.setInterval(() => void runOwnerSync(), INTERVAL_MS);
    const onVisibility = () => void runOwnerSync();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return null;
}
