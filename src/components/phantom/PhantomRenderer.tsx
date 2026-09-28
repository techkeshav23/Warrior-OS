// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Renderer
// Draws the ghosts of closed windows on the desktop layer — above
// the wallpaper and icons, below every real window. The layer is
// portalled into the window manager's own container (same stacking
// context and coordinates as the windows, z-index under them); if
// that container can't be found it falls back to an overlay.
// Each ghost: the captured window image at ~34 % opacity, tinted and
// edge-lit in its app's hue, with faint hologram scanlines, a slow
// upward drift (2 px/s) and a soft blur "ghost" filter. Hover / focus
// brightens it and shows a glass "Click to resurrect" pill. Click →
// resurrect; after 8 s → pixel dissolve (timers live in PhantomEngine).
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { AppIcon } from '@/components/ui/AppIcon';
import { EASE_OUT_QUINT } from '@/styles/tokens';
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
  const { size, position, accent, appId, title, state, snapshot, createdAt } = phantom;
  // Resume the drift where it is if this card (re)mounts mid-life.
  const [drift] = useState(() => {
    const elapsed = Math.min(PHANTOM_LIFETIME_MS, Math.max(0, Date.now() - createdAt));
    return {
      from: -(elapsed / 1000) * PHANTOM_DRIFT_PX_PER_S,
      seconds: Math.max(0.1, (PHANTOM_LIFETIME_MS - elapsed) / 1000),
    };
  });
  const tint = (pct: number) => `color-mix(in oklab, ${accent} ${pct}%, transparent)`;

  return (
    <motion.button
      type="button"
      onClick={() => onResurrect(phantom)}
      className="group focus-ring pointer-events-auto absolute overflow-hidden rounded-window text-left"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        border: `1px solid ${tint(42)}`,
        boxShadow: `0 0 0 1px ${tint(10)}, 0 0 36px -6px ${tint(55)}, inset 0 0 44px ${tint(14)}`,
        background: tint(5),
      }}
      initial={{ opacity: 0, y: drift.from, scale: 0.985 }}
      animate={{ opacity: state === 'resurrecting' ? 0 : 0.34, y: END_DRIFT, scale: 1 }}
      whileHover={{ opacity: state === 'drifting' ? 0.55 : 0 }}
      whileFocus={{ opacity: state === 'drifting' ? 0.55 : 0 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{
        opacity: { duration: 0.45, ease: EASE_OUT_QUINT },
        scale: { duration: 0.45, ease: EASE_OUT_QUINT },
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
            filter: 'blur(0.6px) brightness(1.12) saturate(0.55)',
          }}
        />
      ) : (
        // No image (minimised / capture unsupported): a ghost of the chrome.
        <div aria-hidden className="absolute inset-0 flex flex-col bg-ink-900/70">
          <div
            className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line px-3"
            style={{ backgroundImage: `linear-gradient(90deg, ${tint(18)}, transparent 70%)` }}
          >
            <AppIcon appId={appId} size={20} />
            <span className="truncate text-ui font-medium text-fg">{title}</span>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 p-5">
            <span className="h-2 w-2/5 rounded-full bg-surface-active" />
            <span className="h-2 w-3/4 rounded-full bg-surface-hover" />
            <span className="h-2 w-3/5 rounded-full bg-surface-hover" />
          </div>
        </div>
      )}
      {/* Spectral tint in the app's hue */}
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage: `linear-gradient(160deg, color-mix(in oklab, var(--color-fg) 22%, transparent), ${tint(16)} 55%, color-mix(in oklab, var(--color-fg) 12%, transparent))`,
        }}
      />
      {/* Hologram scanlines */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0 2px, ${tint(9)} 2px 3px)`,
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center opacity-0 transition-opacity duration-180 ease-out-quint group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="glass-popover inline-flex h-8 items-center gap-2 rounded-full pl-2.5 pr-3.5 text-xs font-medium text-fg">
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden style={{ color: accent }} />
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
