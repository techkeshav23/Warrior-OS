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
import { LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Skeleton } from './Divider';
import { EmptyState } from './EmptyState';

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
      <EmptyState
        role="alert"
        className={cn('h-full', className)}
        icon={TriangleAlert}
        tone="danger"
        title={label ? `${label} failed to load` : 'This app failed to load'}
        description="Check your connection, then try again."
        actions={
          retry ? (
            <Button variant="secondary" size="sm" leadingIcon={RotateCw} onClick={retry}>
              Retry
            </Button>
          ) : undefined
        }
      />
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
        <Skeleton className="h-7 w-24 chamfer-sm" />
        <Skeleton className="h-7 flex-1 chamfer-sm opacity-60" />
        <Skeleton className="size-7 chamfer-sm" />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Sidebar skeleton (container query: hidden in narrow windows) */}
        <div className="hidden w-1/4 min-w-[96px] flex-col gap-2 @md:flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-7 chamfer-sm opacity-70" />
          ))}
        </div>

        {/* Content card skeleton */}
        <div className="armor-panel chamfer-md flex min-w-0 flex-1 flex-col gap-3 p-4">
          <Skeleton className="h-4 w-1/3" />
          {LINE_WIDTHS.map((width) => (
            <Skeleton key={width} className={width} />
          ))}
          <div className="mt-auto grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} shape="block" className="h-12 chamfer-sm opacity-70" />
            ))}
          </div>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-center gap-2 text-xs text-fg-subtle">
        <LoaderCircle size={14} strokeWidth={2} aria-hidden className="animate-spin text-accent" />
        {label ? `Loading ${label}…` : 'Loading app…'}
      </div>
    </div>
  );
}

export const AppLoading = memo(AppLoadingInner);
