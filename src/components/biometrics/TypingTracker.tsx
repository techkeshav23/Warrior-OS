// ═══════════════════════════════════════════════════════════
// WARRIOR OS — TypingTracker
// Invisible mount-once component that runs the global typing-
// biometrics hook. Honors the "Typing biometrics" setting: when it
// is off, no listeners are attached and nothing is measured.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { useTypingBiometrics } from '@/hooks/useTypingBiometrics';
import { useSettingsStore } from '@/stores/useSettingsStore';

function TypingTrackerInner() {
  const enabled = useSettingsStore((s) => s.biometricsEnabled);
  useTypingBiometrics(enabled);
  return null;
}

export const TypingTracker = memo(TypingTrackerInner);
