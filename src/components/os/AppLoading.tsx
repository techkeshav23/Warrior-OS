// ═══════════════════════════════════════════════════════════
// WARRIOR OS — App Loading State (TASK 5.25)
// Shown inside a window while its lazily-loaded app chunk downloads.
// ═══════════════════════════════════════════════════════════

'use client';

import type { DynamicOptionsLoadingProps } from 'next/dynamic';

export function AppLoading({ error, isLoading, pastDelay }: DynamicOptionsLoadingProps) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-300"
      >
        <span className="text-2xl" aria-hidden>
          ⚠️
        </span>
        <p>This app failed to load.</p>
        <p className="text-xs text-white/50">Close the window and try again.</p>
      </div>
    );
  }
  if (isLoading && pastDelay === false) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full w-full flex-col gap-4 p-6"
    >
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300/80">
          Loading module…
        </span>
      </div>
      <div className="space-y-3" aria-hidden>
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-white/5" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}
