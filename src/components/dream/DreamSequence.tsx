// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Sequence (orchestrator)
// Drop-in for the OS "dream" phase:
//   phase === 'dream' → <DreamSequence onComplete={() => setPhase('lock')} />
// Builds yesterday's scene, plays the renderer + narration for 5s,
// records the dream (achievements), then DreamTransition fades to black
// and completes. Click / Esc / Space / Enter skip to the transition.
// First-ever users or a disabled "NEXUS Dreams" setting complete at once.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DreamScene, DreamSequenceProps } from '@/types/dream';
import { buildDreamActivity, buildDreamScene, dreamsEnabled } from './DreamEngine';
import { DreamRenderer } from './DreamRenderer';
import { DreamNarration } from './DreamNarration';
import { DreamTransition } from './DreamTransition';
import { recordDreamSeen } from './dreamJournal';

/** Decide once (lazy state initialiser) whether there is a dream to play. */
function decideScene(sceneProp?: DreamScene): DreamScene | null {
  if (sceneProp) return sceneProp;
  if (typeof window === 'undefined') return null;
  if (!dreamsEnabled()) return null;
  const activity = buildDreamActivity();
  if (activity.firstEver) return null;
  return buildDreamScene(new Date(), activity);
}

function DreamSequence({ onComplete, scene: sceneProp, skippable = true }: DreamSequenceProps) {
  const [scene] = useState<DreamScene | null>(() => decideScene(sceneProp));
  const [ending, setEnding] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  // Nothing to dream about → hand straight over.
  useEffect(() => {
    if (!scene) complete();
  }, [scene, complete]);

  // The dream has been seen: journal + dream achievements.
  useEffect(() => {
    if (scene) recordDreamSeen(scene);
  }, [scene]);

  // Timeline: play for the scene duration, then fade to black.
  useEffect(() => {
    if (!scene) return;
    const timer = setTimeout(() => setEnding(true), scene.duration);
    return () => clearTimeout(timer);
  }, [scene]);

  // Skip with Esc / Space / Enter.
  useEffect(() => {
    if (!scene || !skippable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setEnding(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, skippable]);

  if (!scene) {
    // Inert black backdrop so nothing flashes while handing over.
    return <div className="absolute inset-0 bg-ink-950" aria-hidden="true" />;
  }

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-ink-950"
      onClick={skippable ? () => setEnding(true) : undefined}
      role="presentation"
    >
      <DreamRenderer scene={scene} />
      <DreamNarration lines={scene.narrationLines} durationMs={scene.duration} color={scene.primaryColor} />
      <div className="pointer-events-none absolute left-8 top-6 z-20 flex items-center gap-2 hud-label text-fg-faint">
        <span aria-hidden className="size-1.5 rounded-full" style={{ background: scene.primaryColor }} />
        NEXUS dream <span aria-hidden>·</span> <span className="text-fg-subtle">{scene.label}</span>
      </div>
      {skippable && (
        <div className="pointer-events-none absolute bottom-6 right-8 z-20 flex items-center gap-2 text-xs text-fg-subtle">
          <kbd className="armor-plate chamfer-xs inline-flex h-5 items-center px-1.5 font-mono text-2xs text-fg-muted">
            Esc
          </kbd>
          to skip
        </div>
      )}
      <DreamTransition active={ending} onComplete={complete} />
    </div>
  );
}

export default DreamSequence;
export { DreamSequence };
