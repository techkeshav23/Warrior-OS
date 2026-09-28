// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Phantom Layer
// Single mountable component: runs the engine (close detection)
// and renders the drifting ghost cards. Mount once in the
// desktop phase of page.tsx, near the other desktop overlays.
// ═══════════════════════════════════════════════════════════

'use client';

import { PhantomEngine } from './PhantomEngine';
import { PhantomRenderer } from './PhantomRenderer';

function PhantomLayerInner() {
  return (
    <>
      <PhantomEngine />
      <PhantomRenderer />
    </>
  );
}

export const PhantomLayer = PhantomLayerInner;
