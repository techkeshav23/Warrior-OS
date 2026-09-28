// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Reactions
// Bridges OS events → creature moods. Renders nothing.
//
// Signals it listens to (all optional, none required to exist):
//   • useXPStore.recentUnlock  → achievement unlock → excited spin (dance)
//   • useXPStore.xp increases  → XP gained → eating "nom"
//   • CustomEvent 'warrior:creature' with { detail: { type, kind, amount } }
//     types: quiz-complete | quiz-perfect | streak-break | window-open |
//             study-milestone | activity  (kind: 'study' | 'code')
//   • user pointer/keyboard activity → wakes the creature
//
// Other features can trigger reactions with:
//   window.dispatchEvent(new CustomEvent('warrior:creature',
//     { detail: { type: 'quiz-perfect' } }))
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useCreatureStore } from '@/stores/useCreatureStore';
import type { CreatureMood } from '@/types/creature';

/** Detail payload accepted by the 'warrior:creature' custom event. */
export interface CreatureEventDetail {
  type:
    | 'quiz-complete'
    | 'quiz-perfect'
    | 'streak-break'
    | 'window-open'
    | 'study-milestone'
    | 'activity';
  kind?: 'study' | 'code';
  amount?: number;
}

export function CreatureReactions() {
  const setMood = useCreatureStore((s) => s.setMood);
  const registerActivity = useCreatureStore((s) => s.registerActivity);
  const grantGoldenAura = useCreatureStore((s) => s.grantGoldenAura);
  const markActive = useCreatureStore((s) => s.markActive);

  const prevXP = useRef<number>(useXPStore.getState().xp);
  const prevUnlockId = useRef<string | null>(
    useXPStore.getState().recentUnlock?.id ?? null
  );

  // ─── XP store subscription: XP gains + achievement unlocks ───
  useEffect(() => {
    const unsub = useXPStore.subscribe((state) => {
      // Achievement unlock → excited spin.
      const unlockId = state.recentUnlock?.id ?? null;
      if (unlockId && unlockId !== prevUnlockId.current) {
        setMood('dance', 4000);
        prevUnlockId.current = unlockId;
      } else if (!unlockId) {
        prevUnlockId.current = null;
      }

      // XP increase → eating animation.
      if (state.xp > prevXP.current) {
        markActive();
        // Don't override a dance/celebration in progress.
        const current = useCreatureStore.getState().mood;
        if (current === 'idle' || current === 'sleeping' || current === 'sad') {
          setMood('eating', 2200);
        }
      }
      prevXP.current = state.xp;
    });
    return unsub;
  }, [setMood, markActive]);

  // ─── Custom OS events ───
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CreatureEventDetail>).detail;
      if (!detail) return;
      markActive();

      switch (detail.type) {
        case 'quiz-complete':
          setMood('happy', 2500);
          break;
        case 'quiz-perfect':
          setMood('dance', 4500);
          break;
        case 'streak-break':
          setMood('sad', undefined); // sticky until next positive event
          break;
        case 'window-open':
          setMood('curious', 1800);
          break;
        case 'study-milestone':
          // 5+ hour study → golden aura for the rest of the day.
          grantGoldenAura();
          setMood('dance', 4500);
          break;
        case 'activity':
          if (detail.kind) registerActivity(detail.kind, detail.amount ?? 1);
          break;
      }
    };

    window.addEventListener('warrior:creature', handler as EventListener);
    return () =>
      window.removeEventListener('warrior:creature', handler as EventListener);
  }, [setMood, grantGoldenAura, registerActivity, markActive]);

  // ─── Wake on user activity (throttled) ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let last = 0;
    const wake = () => {
      const now = Date.now();
      if (now - last < 5000) {
        // still mark lastActiveAt occasionally to reset idle timer
        if (now - last < 1000) return;
      }
      last = now;
      markActive();
    };
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [markActive]);

  return null;
}

/** Small typed helper other features can import to fire a reaction. */
export function dispatchCreatureEvent(detail: CreatureEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CreatureEventDetail>('warrior:creature', { detail }));
}

// Keep the mood type referenced for consumers importing from this module.
export type { CreatureMood };
