// ═══════════════════════════════════════════════════════════
// WARRIOR OS — TypingTracker
// Invisible mount-once component. Runs the global typing-biometrics
// hook. Mount exactly once (e.g. in page.tsx desktop phase).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { useTypingBiometrics } from '@/hooks/useTypingBiometrics';

function TypingTrackerInner() {
  useTypingBiometrics();
  return null;
}

export const TypingTracker = memo(TypingTrackerInner);
