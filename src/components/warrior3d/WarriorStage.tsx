// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: <WarriorStage />
// The drop-in component. Reads the owner's progression, decides between
// the 3D canvas and the static plate (lite mode / no WebGL / render
// error), loads the canvas client-side only, and pauses rendering
// while the stage is off-screen or the tab is hidden.
//
//   <WarriorStage variant="hero" />                     lock screen / pages
//   <WarriorStage variant="hall" stageId="hall" />      orbitable showroom
//   <WarriorStage variant="card" className="h-40" />    small, cheap
//
//   playWarriorAction('punch')            every stage
//   playWarriorAction('victory', 'hall')  only stageId="hall"
// ═══════════════════════════════════════════════════════════

'use client';

import { Component, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useLiteMode } from '@/lib/lite-mode';
import { lookForProgress, useWarriorProgress, type WarriorProgressOverrides } from './progress';
import { WarriorFallback } from './WarriorFallback';
import { useWarriorActionStore } from './store';
import type { WarriorBaseAction, WarriorProgress, WarriorVariant } from './types';

const WarriorCanvas = dynamic(() => import('./WarriorCanvas'), { ssr: false, loading: () => null });

export interface WarriorStageProps extends WarriorProgressOverrides {
  variant?: WarriorVariant;
  className?: string;
  /** Address this stage alone with playWarriorAction(action, stageId). */
  stageId?: string;
  /** The loop one-shots return to. Default: 'stance' (hero / hall), 'idle' (card). */
  baseAction?: WarriorBaseAction;
  /** Force the arc reactor's speaking state (previews); default follows NEXUS. */
  speaking?: boolean;
  /** Stop rendering (e.g. a hidden window) without unmounting. */
  paused?: boolean;
  /** Force the static plate (tests / previews). */
  forceFallback?: boolean;
}

// ─── Environment probes ───

let webglCache: boolean | null = null;
function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement('canvas');
    webglCache = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webglCache = false;
  }
  return webglCache;
}
const noopSubscribe = () => () => {};

const RM_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeRM(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const q = window.matchMedia(RM_QUERY);
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
}
function readRM(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(RM_QUERY).matches;
}

function subscribeHidden(cb: () => void): () => void {
  document.addEventListener('visibilitychange', cb);
  return () => document.removeEventListener('visibilitychange', cb);
}

// ─── Error boundary ───

class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') console.warn('[warrior3d] stage failed, showing fallback:', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ─── Stage ───

export function WarriorStage({
  variant = 'hero',
  className,
  stageId,
  baseAction,
  speaking,
  paused = false,
  forceFallback = false,
  forceTier,
  forceLevel,
  forceStreak,
  forceDecay,
}: WarriorStageProps) {
  const autoId = useId();
  const id = stageId ?? `warrior-${autoId}`;
  const progress: WarriorProgress = useWarriorProgress({ forceTier, forceLevel, forceStreak, forceDecay });
  const look = lookForProgress(progress);
  const lite = useLiteMode();
  const reducedMotion = useSyncExternalStore(subscribeRM, readRM, () => false);
  const webgl = useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
  const hidden = useSyncExternalStore(subscribeHidden, () => document.hidden, () => false);
  const [onScreen, setOnScreen] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // A stage that goes away stops counting as live for playWarriorAction callers.
  useEffect(() => () => useWarriorActionStore.getState().forget(id), [id]);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fallbackNote = lite ? 'Lite mode' : !webgl ? 'WebGL unavailable' : contextLost ? 'Graphics reset' : undefined;
  const fallback = <WarriorFallback progress={progress} variant={variant} note={fallbackNote} />;
  const use3D = !forceFallback && !lite && webgl && !contextLost;

  return (
    <div
      ref={box}
      className={cn(
        'overflow-hidden',
        variant === 'hero' && '[mask-image:radial-gradient(ellipse_75%_80%_at_50%_45%,black_55%,transparent_100%)]',
        className
      )}
      data-warrior-stage={id}
      data-warrior-variant={variant}
    >
      {use3D ? (
        <StageBoundary fallback={<WarriorFallback progress={progress} variant={variant} note="Render error" />}>
          <WarriorCanvas
            variant={variant}
            look={look}
            baseAction={baseAction ?? (variant === 'card' ? 'idle' : 'stance')}
            stageId={id}
            speaking={speaking}
            active={!paused && onScreen && !hidden}
            reducedMotion={reducedMotion}
            onContextLost={() => setContextLost(true)}
          />
        </StageBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}

export default WarriorStage;
