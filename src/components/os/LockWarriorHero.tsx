// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Lock screen warrior hero
// The 3D warrior on its platform, standing in the space left of the
// unlock plate on wide screens (hidden under 900px). Loaded as its own
// client-only chunk and mounted only after the lock screen has painted
// and the browser is idle, so it never slows the unlock. Fades in once
// the figure is on stage; purely decorative (no pointer events, hidden
// from assistive tech). `paused` freezes rendering during the unlock.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { useLiteMode } from '@/lib/lite-mode';
import { WarriorStage } from '@/components/warrior3d/WarriorStage';
import { useWarriorActionStore } from '@/components/warrior3d/store';

export const LOCK_HERO_STAGE = 'lock-hero';

const WIDE_QUERY = '(min-width: 900px)';
/** Mount delay after the first paint (ms) — the idle callback may come sooner. */
const MOUNT_DELAY_MS = 450;
/** Show the stage anyway if no figure reports by then (fallback plate, slow GPU). */
const REVEAL_FALLBACK_MS = 2600;
/** Dissolve the stage's edges into the wallpaper (on top of the hero variant's own mask). */
const EDGE_MASK = 'radial-gradient(ellipse 50% 50% at 50% 50%, black 58%, transparent 100%)';

function subscribeWide(cb: () => void): () => void {
  const q = window.matchMedia(WIDE_QUERY);
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
}
const readWide = () => window.matchMedia(WIDE_QUERY).matches;

export function LockWarriorHero({ paused = false, className }: { paused?: boolean; className?: string }) {
  const wide = useSyncExternalStore(subscribeWide, readWide, () => false);
  const lite = useLiteMode();
  const [armed, setArmed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const figureReady = useWarriorActionStore((s) => s.current[LOCK_HERO_STAGE] !== undefined);

  // Mount after first paint + idle.
  useEffect(() => {
    if (!wide || armed) return;
    let idle = 0;
    const timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(() => setArmed(true), { timeout: 800 });
      else setArmed(true);
    }, MOUNT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      if (idle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idle);
    };
  }, [wide, armed]);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setTimedOut(true), REVEAL_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  if (!wide || !armed) return null;
  const visible = figureReady || lite || timedOut;

  return (
    <div
      aria-hidden
      data-lock-warrior=""
      className={cn(
        'pointer-events-none select-none transition-opacity duration-[1400ms] ease-out [&_*]:pointer-events-none!',
        visible ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
    >
      <WarriorStage variant="hero" stageId={LOCK_HERO_STAGE} paused={paused} className="h-full w-full" />
    </div>
  );
}

export default LockWarriorHero;
