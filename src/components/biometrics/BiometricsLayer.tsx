// ═══════════════════════════════════════════════════════════
// WARRIOR OS — BiometricsLayer
// Single mount point for typing biometrics in the desktop phase:
//   <TypingTracker />  invisible global keystroke-timing listener
//   <VitalsWidget />   draggable glass HUD (Energy/Focus/Fatigue/Stress)
// plus optional Firestore mirroring of the hourly history (only when
// Firebase is configured and a user is signed in). Both components
// honour Settings → "Typing biometrics"; when off nothing is measured
// and nothing renders.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { TypingTracker } from './TypingTracker';
import { VitalsWidget } from './VitalsWidget';
import { startBiometricCloudSync } from './cloudSync';

interface BiometricsLayerProps {
  /** Show the Vitals HUD (the tracker keeps running either way). Default true. */
  showWidget?: boolean;
}

function BiometricsLayerInner({ showWidget = true }: BiometricsLayerProps) {
  const enabled = useSettingsStore((s) => s.biometricsEnabled);

  useEffect(() => {
    if (!enabled) return;
    return startBiometricCloudSync();
  }, [enabled]);

  return (
    <>
      <TypingTracker />
      {showWidget && <VitalsWidget />}
    </>
  );
}

export const BiometricsLayer = memo(BiometricsLayerInner);
