// ═══════════════════════════════════════════════════════════
// WARRIOR OS — MoodShift
// Event-driven music modifications over whatever is playing:
//   achievement unlocked  → major chord swell + octave up for 3 s
//   streak broken         → minor chord shift + tempo slows for 5 s
//   level up              → triumphant brass-like FM chord + rising arpeggio
//   decay stage increase  → dissonant cluster + the pitch drops
//                           (20 cents per stage until the OS is repaired)
// Sources: useXPStore (level / recentUnlock), useDecayStore (stage),
// and the 'warrior:creature' event with type 'streak-break'.
// Listeners attach once however many <MoodShift /> are mounted.
// Renders nothing.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { applyMoodShift, refCounted, setDecayDetune } from '@/lib/procedural-music/engine';

function attachMoodShift(): () => void {
  // Start in tune with the current decay stage.
  setDecayDetune(useDecayStore.getState().decayStage);

  const unsubXP = useXPStore.subscribe((s, prev) => {
    if (s.level > prev.level) {
      applyMoodShift('levelup');
    } else if (s.recentUnlock && s.recentUnlock !== prev.recentUnlock) {
      applyMoodShift('achievement');
    }
  });

  const unsubDecay = useDecayStore.subscribe((s, prev) => {
    if (s.decayStage === prev.decayStage) return;
    if (s.decayStage > prev.decayStage) applyMoodShift('decay-increase');
    setDecayDetune(s.decayStage);
  });

  const onCreature = (e: Event) => {
    const detail = (e as CustomEvent<{ type?: string } | undefined>).detail;
    if (detail?.type === 'streak-break') applyMoodShift('streak-broken');
  };
  window.addEventListener('warrior:creature', onCreature);

  return () => {
    unsubXP();
    unsubDecay();
    window.removeEventListener('warrior:creature', onCreature);
  };
}

const retainMoodShift = refCounted(attachMoodShift);

export function MoodShift(): null {
  useEffect(() => retainMoodShift(), []);
  return null;
}
