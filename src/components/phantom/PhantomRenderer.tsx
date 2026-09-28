// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Renderer
// Draws translucent drifting ghost cards on the desktop layer
// (above wallpaper, below real windows). Handles 8s lifetime,
// click-to-resurrect, and dissolve-to-particles on expiry.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSound } from '@/hooks/useSound';
import { SOUND_EFFECTS } from '@/lib/constants';
import {
  usePhantomStore,
  PHANTOM_LIFETIME_MS,
} from '@/stores/usePhantomStore';
import { usePhantomResurrect } from './PhantomResurrect';
import { PhantomDissolve } from './PhantomDissolve';
import type { Phantom } from '@/types/phantom';

function PhantomRendererInner() {
  const phantoms = usePhantomStore((s) => s.phantoms);
  const setStatus = usePhantomStore((s) => s.setStatus);
  const removePhantom = usePhantomStore((s) => s.removePhantom);
  const { resurrect, flashOverlay } = usePhantomResurrect();
  const { play } = useSound();

  // After PHANTOM_LIFETIME_MS, a drifting phantom starts dissolving.
  useEffect(() => {
    const timers: number[] = [];
    phantoms.forEach((p) => {
      if (p.status !== 'drifting') return;
      const remaining = Math.max(
        0,
        PHANTOM_LIFETIME_MS - (Date.now() - p.createdAt)
      );
      const t = window.setTimeout(() => {
        const live = usePhantomStore.getState().getPhantom(p.id);
        if (live && live.status === 'drifting') {
          usePhantomStore.getState().setStatus(p.id, 'dissolving');
          try {
            play(SOUND_EFFECTS.MINIMIZE, 0.4); // gentle whoosh
          } catch {
            /* best-effort */
          }
        }
      }, remaining);
      timers.push(t);
    });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
    // Re-run when the set of phantom ids/statuses changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phantoms.map((p) => `${p.id}:${p.status}`).join(','), play]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 50 }}
      aria-hidden
    >
      <AnimatePresence>
        {phantoms.map((phantom) =>
          phantom.status === 'dissolving' ? (
            <div
              key={phantom.id}
              className="absolute"
              style={{
                left: phantom.position.x,
                top: phantom.position.y,
              }}
            >
              <PhantomDissolve
                phantom={phantom}
                onComplete={(id) => removePhantom(id)}
              />
            </div>
          ) : (
            <GhostCard
              key={phantom.id}
              phantom={phantom}
              onClick={() => resurrect(phantom)}
              onHoverStatus={setStatus}
            />
          )
        )}
      </AnimatePresence>
      {flashOverlay}
    </div>
  );
}

interface GhostCardProps {
  phantom: Phantom;
  onClick: () => void;
  onHoverStatus: (id: string, status: Phantom['status']) => void;
}

function GhostCard({ phantom, onClick }: GhostCardProps) {
  const { size, position, accent, icon, title, status } = phantom;
  const [drift, setDrift] = useState(0);

  // Slow upward drift (~-2px/s) accumulated while alive.
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsedSec = (now - start) / 1000;
      setDrift(-2 * elapsedSec);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: status === 'resurrecting' ? 0 : 0.3, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl text-left',
        'border border-white/20'
      )}
      style={{
        left: position.x,
        top: position.y + drift,
        width: size.width,
        height: size.height,
        // Translucent, blue-white tinted ghost with edge glow + filter.
        background:
          'linear-gradient(135deg, rgba(200,225,255,0.10), rgba(180,200,255,0.04))',
        backdropFilter: 'blur(2px) brightness(1.15)',
        WebkitBackdropFilter: 'blur(2px) brightness(1.15)',
        boxShadow: `0 0 24px ${accent}55, inset 0 0 40px rgba(190,215,255,0.08)`,
        filter: 'blur(0.4px)',
      }}
      title={`Resurrect ${title}`}
    >
      {/* Faux titlebar */}
      <div
        className="flex items-center gap-2 border-b border-white/10 px-3 py-2"
        style={{ background: `linear-gradient(90deg, ${accent}22, transparent)` }}
      >
        <span className="text-base opacity-80" aria-hidden>
          {icon}
        </span>
        <span className="truncate text-xs font-medium text-white/70">
          {title}
        </span>
      </div>
      {/* Ghostly body with a resurrect hint */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
        <span className="text-3xl opacity-30" aria-hidden>
          👻
        </span>
        <span
          className="text-[11px] uppercase tracking-widest"
          style={{ color: accent }}
        >
          Click to resurrect
        </span>
      </div>
    </motion.button>
  );
}

export const PhantomRenderer = PhantomRendererInner;
