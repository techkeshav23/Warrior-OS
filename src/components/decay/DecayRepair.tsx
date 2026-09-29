// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DecayRepair
// After a break completes the OS heals: the crack lines draw closed
// and the vignette + colour grade fade back to normal over ~3 s
// (DecayStages, driven by `repairing`), a restore sweep passes over
// the screen, particles return to full speed, NEXUS says "Systems
// restored. Ready for battle." and a +50 XP bonus is awarded for
// taking the break. Calls onDone when the sequence ends.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useXPStore } from '@/stores/useXPStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { nexusSay } from './nexus-say';
import { onDecayBreakCompleted } from './achievements';

export const REPAIR_XP = 50;
const REPAIR_DURATION_MS = 3200; // matches crack-close + vignette/grade fade

interface DecayRepairProps {
  /** Called when the repair sequence completes. */
  onDone: () => void;
}

export function DecayRepair({ onDone }: DecayRepairProps) {
  // Peek (not claim) so the flourish can show whether XP was earned.
  const [earnsXP] = useState(() => useDecayStore.getState().repairTicket?.reward ?? false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // One-shot rewards: the ticket can only be claimed once, so a double
  // effect run (StrictMode) or a remount never awards twice.
  useEffect(() => {
    const ticket = useDecayStore.getState().claimRepairTicket();
    if (!ticket) return;
    if (ticket.reward) useXPStore.getState().addXP(REPAIR_XP, 'decay-break');
    nexusSay(
      ticket.reward
        ? `Systems restored. Ready for battle. (+${REPAIR_XP} XP)`
        : 'Systems restored. Ready for battle.',
      'success'
    );
    onDecayBreakCompleted(ticket.reason);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => onDoneRef.current(), REPAIR_DURATION_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 958 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: REPAIR_DURATION_MS / 1000, times: [0, 0.12, 0.72, 1] }}
      aria-live="polite"
    >
      {/* Restore sweep: a soft band of light passes top → bottom */}
      <motion.div
        className="absolute inset-x-0 h-40"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, color-mix(in oklab, var(--color-plasma-400) 8%, transparent) 45%, color-mix(in oklab, var(--color-success) 11%, transparent) 55%, transparent 100%)',
        }}
        initial={{ top: '-20%' }}
        animate={{ top: '110%' }}
        transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden
      />
      <motion.div
        className="relative flex items-center gap-3 rounded-sheet glass-popover px-5 py-3.5"
        initial={{ scale: 0.96, opacity: 0, y: 6 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="flex size-9 items-center justify-center rounded-full border border-success/30 bg-success/12 text-success">
          <ShieldCheck className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="text-left">
          <p className="text-base font-semibold text-fg">Systems restored</p>
          <p className="text-ui text-fg-muted">
            Ready for battle.
            {earnsXP && <span className="ml-1.5 font-mono font-medium text-gold tabular">+{REPAIR_XP} XP</span>}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
