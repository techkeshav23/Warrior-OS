// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useNow
// Ticking epoch-ms clock so render code never calls Date.now()
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useState } from 'react';

/** Current time in epoch ms, refreshed every `intervalMs`. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
