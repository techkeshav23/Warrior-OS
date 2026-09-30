// ═══════════════════════════════════════════════════════════
// WARRIOR OS — BiometricsLayer
// Single mount point for typing biometrics in the desktop phase:
//   <TypingTracker />  invisible global keystroke-timing listener
//   <VitalsWidget />   draggable glass HUD (Energy/Focus/Fatigue/Stress)
// Both components honour Settings → "Typing biometrics"; when off nothing is measured
// and nothing renders.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { TypingTracker } from './TypingTracker';
import { VitalsWidget } from './VitalsWidget';

interface BiometricsLayerProps {
  /** Show the Vitals HUD (the tracker keeps running either way). Default true. */
  showWidget?: boolean;
}

function BiometricsLayerInner({ showWidget = true }: BiometricsLayerProps) {
  return (
    <>
      <TypingTracker />
      {showWidget && <VitalsWidget />}
    </>
  );
}

export const BiometricsLayer = memo(BiometricsLayerInner);
