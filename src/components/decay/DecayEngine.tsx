// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DecayEngine (master controller)
// Runs the continuous-study timer (first interaction after boot or a
// break starts it; 10 idle minutes pause it), reads useDecayStore and
// orchestrates the stage layers. On each stage increase NEXUS speaks
// through the 'warrior:nexus-say' event and decay achievements are
// checked. Stage 4 loops a faint heartbeat through Howler at 0.1
// volume; stage 5 force-opens BreakMode after a short grace so the
// cracks and the NEXUS order land first. Break → repair → restored.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useDecayStore } from '@/stores/useDecayStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useDecayEngine } from '@/hooks/useDecayEngine';
import { createSynthLoop } from '@/lib/procedural-music/synth-samples';
import { DecayStages } from './DecayStages';
import { BreakMode } from './BreakMode';
import { DecayRepair } from './DecayRepair';
import { nexusSay, type NexusSayTone } from './nexus-say';
import { onDecayStageReached, checkTheMachine } from './achievements';
import { installDecayDebug } from './debug';

/** Time between the stage-5 cracks appearing and the forced break. */
const FORCED_BREAK_GRACE_MS = 6_000;
/** Spec: heartbeat plays through Howler at 0.1 volume. */
const HEARTBEAT_VOLUME = 0.1;

function stageLine(stage: number, breakMinutes: number): { text: string; tone: NexusSayTone } | null {
  switch (stage) {
    case 1:
      return { text: 'Two hours of unbroken focus. The world is warming around you.', tone: 'info' };
    case 2:
      return { text: 'Something feels off… the world is slowing down.', tone: 'info' };
    case 3:
      return { text: 'Reality is burning at the edges. A pause would be wise.', tone: 'warning' };
    case 4:
      return { text: 'Warrior. Your focus is legendary. But your body is mortal.', tone: 'warning' };
    case 5:
      return { text: `${breakMinutes}-minute break. NOW.`, tone: 'danger' };
    default:
      return null;
  }
}

function DecayEngineInner() {
  useDecayEngine(); // interaction listeners + wall-clock ticker

  const enabled = useDecayStore((s) => s.enabled);
  const stage = useDecayStore((s) => s.decayStage);
  const minutes = useDecayStore((s) => s.continuousStudyMinutes);
  const thresholdOffset = useDecayStore((s) => s.thresholdOffset);
  const isOnBreak = useDecayStore((s) => s.isOnBreak);
  const isRepairing = useDecayStore((s) => s.isRepairing);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const accentColor = useSettingsStore((s) => s.accentColor);

  // ─── Dev/test hook: window.__warriorDecay (see ./debug) ───
  useEffect(() => installDecayDebug(), []);

  // ─── Resume a break that was in progress before a reload ───
  useEffect(() => {
    const s = useDecayStore.getState();
    if (s.breakEndsAt !== null && !s.isOnBreak && !s.isRepairing) s.resumePersistedBreak();
  }, []);

  // ─── Transitions: NEXUS lines, achievements, natural breaks ───
  useEffect(() => {
    const unsub = useDecayStore.subscribe((s, prev) => {
      if (!s.enabled) return;
      if (s.decayStage > prev.decayStage) {
        const line = stageLine(s.decayStage, s.breakDuration);
        if (line) nexusSay(line.text, line.tone);
        onDecayStageReached(s.decayStage);
      }
      if (s.stats.naturalBreaks > prev.stats.naturalBreaks) {
        nexusSay('Welcome back. That rest counted — reality has healed.', 'success');
        checkTheMachine();
      }
      if (s.daily.studyMinutes !== prev.daily.studyMinutes) checkTheMachine();
    });
    return unsub;
  }, []);

  // ─── Stage 5 force-triggers the break (after a short grace) ───
  useEffect(() => {
    if (!enabled || stage < 5 || isOnBreak || isRepairing) return;
    const id = window.setTimeout(() => useDecayStore.getState().triggerBreak(), FORCED_BREAK_GRACE_MS);
    return () => window.clearTimeout(id);
  }, [enabled, stage, isOnBreak, isRepairing]);

  // ─── Stage 4 heartbeat: Howler loop at 0.1 volume ───
  const heartbeatOn = enabled && soundEnabled && stage >= 4 && !isOnBreak && !isRepairing;
  useEffect(() => {
    if (!heartbeatOn) return;
    const howl = createSynthLoop('heartbeat', 0);
    if (!howl) return;
    howl.play();
    howl.fade(0, Math.min(HEARTBEAT_VOLUME, useSettingsStore.getState().soundVolume), 1500);
    const unsub = useSettingsStore.subscribe((s, prev) => {
      if (s.soundVolume !== prev.soundVolume) howl.volume(Math.min(HEARTBEAT_VOLUME, s.soundVolume));
    });
    return () => {
      unsub();
      howl.stop();
      howl.unload();
    };
  }, [heartbeatOn]);

  if (!enabled) return null;

  return (
    <>
      <DecayStages
        stage={stage}
        minutes={minutes}
        thresholdOffset={thresholdOffset}
        accentBase={accentColor}
        repairing={isRepairing}
      />

      <AnimatePresence>
        {isOnBreak && (
          <BreakMode key="break-mode" onComplete={() => useDecayStore.getState().completeBreak()} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRepairing && (
          <DecayRepair key="decay-repair" onDone={() => useDecayStore.getState().finishRepair()} />
        )}
      </AnimatePresence>
    </>
  );
}

export function DecayEngine() {
  return <DecayEngineInner />;
}
