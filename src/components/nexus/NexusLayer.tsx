// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Layer (global drop-in)
// Mount once in the desktop phase. Hosts the suggestion engine +
// 'warrior:nexus-say' listener, the pomodoro driver, and the HUD
// (voice listening indicator + pomodoro pill, bottom-left above
// the taskbar) and the JARVIS orb (bottom-center, while voice is
// engaged). Leaving the desktop shuts the microphone down.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect } from 'react';
import { NexusSuggestions } from './NexusSuggestions';
import { NexusPomodoroEngine, NexusPomodoroPill } from './NexusPomodoro';
import { NexusVoiceIndicator, resumeWakeIfWanted, shutdownNexusVoice } from './NexusVoice';
import { JarvisOrb } from './JarvisOrb';

function NexusLayerInner() {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resumeWakeIfWanted();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      // No mic may stay open once the desktop (and its indicator) is gone.
      shutdownNexusVoice();
    };
  }, []);

  return (
    <>
      <NexusSuggestions />
      <NexusPomodoroEngine />
      <div
        className="pointer-events-none fixed bottom-15 left-3 flex flex-col items-start gap-2"
        style={{ zIndex: 'var(--z-dynamic-island)' }}
      >
        <NexusVoiceIndicator />
        <NexusPomodoroPill variant="hud" />
      </div>
      {/* Above the workspace dots (bottom-14); over achievement toasts while voice is live */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-26 flex justify-center max-sm:bottom-40"
        style={{ zIndex: 'calc(var(--z-notification) + 1)' }}
      >
        <JarvisOrb />
      </div>
    </>
  );
}

export const NexusLayer = memo(NexusLayerInner);
