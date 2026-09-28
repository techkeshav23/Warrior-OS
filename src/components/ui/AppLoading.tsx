// ═══════════════════════════════════════════════════════════
// WARRIOR OS — AppLoading
// Glass skeleton shown inside a window while a lazily loaded app's
// code arrives. Works directly as next/dynamic's `loading` component
// (it accepts that component's props) or with a label:
//   dynamic(() => import('...'), { ssr: false, loading: () => <AppLoading label="Code Lab" /> })
// Fades in after a short delay so fast loads never flash.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';

export interface AppLoadingProps {
  /** App name for the status line, e.g. "Code Lab" */
  label?: string;
  className?: string;
  // next/dynamic loading-component props (all optional)
  error?: Error | null;
  isLoading?: boolean;
  pastDelay?: boolean;
  timedOut?: boolean;
  retry?: () => void;
}

const LINE_WIDTHS = ['w-3/4', 'w-full', 'w-5/6', 'w-2/3'] as const;

function AppLoadingInner({ label, className, error, retry }: AppLoadingProps) {
  if (error) {
    return (
      <div
        role="alert"
        className={cn('flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center', className)}
      >
        <p className="font-mono text-xs text-accent-danger">
          {label ? `${label} failed to load.` : 'This app failed to load.'}
        </p>
        {retry && (
          <button
            type="button"
            onClick={retry}
            className="rounded-full border border-accent-primary/40 bg-accent-primary/10 px-4 py-1.5 font-mono text-xs text-accent-primary transition-colors hover:bg-accent-primary/20 focus-ring"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('@container flex h-full w-full flex-col gap-4 p-4', className)}
      // Delayed fade-in (fade-in-scale keyframes from styles/animations.css;
      // a scale stays inside the window, a translate could flash a scrollbar).
      style={{ animation: 'fade-in-scale 0.35s cubic-bezier(0.16, 1, 0.3, 1) 150ms both' }}
    >
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-24 animate-pulse rounded-md bg-white/10" />
        <div className="h-7 flex-1 animate-pulse rounded-md bg-white/5" style={{ animationDelay: '120ms' }} />
        <div className="h-7 w-7 animate-pulse rounded-md bg-white/10" style={{ animationDelay: '240ms' }} />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Sidebar skeleton (container query: hidden in narrow windows) */}
        <div className="hidden w-1/4 min-w-[96px] flex-col gap-2 @md:flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded-md bg-white/5"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>

        {/* Content card skeleton */}
        <div className="glass glass-border flex min-w-0 flex-1 flex-col gap-3 rounded-[var(--radius-md)] p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-accent-primary/15" />
          {LINE_WIDTHS.map((width, i) => (
            <div
              key={width}
              className={cn('h-3 animate-pulse rounded bg-white/10', width)}
              style={{ animationDelay: `${150 + i * 110}ms` }}
            />
          ))}
          <div className="mt-auto grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-white/5"
                style={{ animationDelay: `${300 + i * 120}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-center gap-2 font-mono text-[11px] text-text-secondary">
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin rounded-full border-2 border-accent-primary/30 border-t-accent-primary"
        />
        {label ? `Loading ${label}…` : 'Loading app…'}
      </div>
    </div>
  );
}

export const AppLoading = memo(AppLoadingInner);
