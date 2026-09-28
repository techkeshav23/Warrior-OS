// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DecayRepair
// After a break completes: cracks animate closed, vignette/colors fade
// back to normal, NEXUS confirms restoration, and a 50 XP bonus is
// awarded for taking the break. Renders a brief "Systems restored"
// flourish, then calls onDone.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useXPStore } from '@/stores/useXPStore';
import { useNotificationStore } from '@/stores/useNotificationStore';

const REPAIR_XP = 50;
const REPAIR_DURATION_MS = 3200; // matches crack-close + vignette fade

interface DecayRepairProps {
  /** Called when the repair sequence completes. */
  onDone: () => void;
}

export function DecayRepair({ onDone }: DecayRepairProps) {
  const awardedRef = useRef(false);

  useEffect(() => {
    if (awardedRef.current) return;
    awardedRef.current = true;

    // Award XP + NEXUS restoration message once.
    useXPStore.getState().addXP(REPAIR_XP, 'decay-break');
    useNotificationStore.getState().addNotification({
      type: 'system',
      title: 'NEXUS',
      message: 'Systems restored. Ready for battle. (+50 XP)',
      icon: '🛡️',
      autoDismiss: 6000,
    });

    const id = setTimeout(onDone, REPAIR_DURATION_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none flex items-center justify-center"
      style={{ zIndex: 958 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: REPAIR_DURATION_MS / 1000, times: [0, 0.15, 0.7, 1] }}
    >
      <div className="text-center">
        <motion.p
          className="font-display text-2xl text-accent-success text-glow-sm"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Systems restored
        </motion.p>
        <p className="text-text-secondary text-sm mt-2">
          Ready for battle. +50 XP
        </p>
      </div>
    </motion.div>
  );
}
