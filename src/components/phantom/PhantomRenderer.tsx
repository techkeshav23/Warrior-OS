// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Renderer
// Draws the ghosts of closed windows on the desktop layer — above
// the wallpaper and icons, below every real window. The layer is
// portalled into the window manager's own container (same stacking
// context and coordinates as the windows, z-index under them); if
// that container can't be found it falls back to an overlay.
// Each ghost: the captured window image at 30 % opacity with a
// blue-white tint, slow upward drift (2 px/s), accent edge glow and
// a soft blur + brightness "ghost" filter. Click → resurrect;
// after 8 s → pixel dissolve (timers live in PhantomEngine).
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  usePhantomStore,
  PHANTOM_LIFETIME_MS,
  PHANTOM_DRIFT_PX_PER_S,
} from '@/stores/usePhantomStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { usePhantomResurrect } from './PhantomResurrect';
import { PhantomDissolve } from './PhantomDissolve';
import type { PhantomWindow } from '@/types/phantom';

/** The WindowManager container is the only element styled with the window z-index token. */
const WINDOW_LAYER_SELECTOR = '[style*="--z-window"]';
const END_DRIFT = -(PHANTOM_LIFETIME_MS / 1000) * PHANTOM_DRIFT_PX_PER_S;

function subscribeToDom(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
const noopSubscribe = () => () => {};
function getWindowLayer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(WINDOW_LAYER_SELECTOR);
}
function getServerWindowLayer(): HTMLElement | null {
  return null;
}

interface GhostCardProps {
  phantom: PhantomWindow;
  onResurrect: (phantom: PhantomWindow) => void;
}

function GhostCard({ phantom, onResurrect }: GhostCardProps) {
  const { size, position, accent, icon, title, state, snapshot, createdAt } = phantom;
  // Resume the drift where it is if this card (re)mounts mid-life.
  const [drift] = useState(() => {
    const elapsed = Math.min(PHANTOM_LIFETIME_MS, Math.max(0, Date.now() - createdAt));
    return {
      from: -(elapsed / 1000) * PHANTOM_DRIFT_PX_PER_S,
      seconds: Math.max(0.1, (PHANTOM_LIFETIME_MS - elapsed) / 1000),
    };
  });

  return (
    <motion.button
      type="button"
      onClick={() => onResurrect(phantom)}
      className="group pointer-events-auto absolute overflow-hidden rounded-[var(--radius-lg)] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        border: `1px solid ${accent}66`,
        boxShadow: `0 0 26px ${accent}70, inset 0 0 36px rgba(190,215,255,0.12)`,
        background: 'rgba(160,190,255,0.06)',
      }}
      initial={{ opacity: 0, y: drift.from, scale: 0.985 }}
      animate={{ opacity: state === 'resurrecting' ? 0 : 0.3, y: END_DRIFT, scale: 1 }}
      whileHover={{ opacity: state === 'drifting' ? 0.45 : 0 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{
        opacity: { duration: 0.45 },
        scale: { duration: 0.45 },
        y: { duration: drift.seconds, ease: 'linear' },
      }}
      aria-label={`Resurrect ${title}`}
      title={`Resurrect ${title}`}
    >
      {snapshot ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${snapshot}")`,
            backgroundSize: '100% 100%',
            filter: 'blur(0.6px) brightness(1.18) saturate(0.7)',
          }}
        />
      ) : (
        // No image (minimised / capture unsupported): a ghost of the chrome.
        <div aria-hidden className="absolute inset-0 flex flex-col">
          <div
            className="flex h-9 items-center gap-2 border-b border-white/10 px-3"
            style={{ background: `linear-gradient(90deg, ${accent}33, transparent)` }}
          >
            <span className="text-sm">{icon}</span>
            <span className="truncate font-mono text-xs text-white">{title}</span>
          </div>
          <div className="flex-1" style={{ background: 'rgba(15,15,25,0.6)' }} />
        </div>
      )}
      {/* Blue-white spectral tint */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(160deg, rgba(214,232,255,0.30), rgba(150,185,255,0.12) 60%, rgba(214,232,255,0.2))',
          mixBlendMode: 'screen',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
          Click to resurrect
        </span>
      </div>
    </motion.button>
  );
}

function DissolvingPhantom({ phantom }: { phantom: PhantomWindow }) {
  const removePhantom = usePhantomStore((s) => s.removePhantom);
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: phantom.position.x,
        top: phantom.position.y + END_DRIFT,
        width: phantom.size.width,
        height: phantom.size.height,
      }}
    >
      <PhantomDissolve phantom={phantom} onComplete={removePhantom} />
    </div>
  );
}

function PhantomRendererInner() {
  const phantoms = usePhantomStore((s) => s.phantoms);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { resurrect, flashOverlay } = usePhantomResurrect();
  const hasPhantoms = phantoms.length > 0;
  // Only watch the DOM while ghosts exist (a few seconds at a time).
  const host = useSyncExternalStore(
    hasPhantoms ? subscribeToDom : noopSubscribe,
    getWindowLayer,
    getServerWindowLayer
  );

  if (!hasPhantoms) return null;
  const visible = phantoms.filter((p) => p.workspaceId === activeWorkspaceId);

  const layer = (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: host ? 1 : 50 }}
      data-warrior-phantoms=""
    >
      <AnimatePresence>
        {visible.map((p) =>
          p.state === 'dissolving' ? (
            <DissolvingPhantom key={p.id} phantom={p} />
          ) : (
            <GhostCard key={p.id} phantom={p} onResurrect={resurrect} />
          )
        )}
      </AnimatePresence>
      {flashOverlay}
    </div>
  );

  return host ? createPortal(layer, host) : layer;
}

export const PhantomRenderer = PhantomRendererInner;
