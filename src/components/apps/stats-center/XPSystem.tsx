// ═══════════════════════════════════════════════════════════
// WARRIOR OS — XP System Widget
// Shows total XP and recent XP gains
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { useXPStore } from '@/stores/useXPStore';

function XPSystemInner() {
  const { xp, level } = useXPStore();
  const getLevelTitle = useXPStore((s) => s.getLevelTitle);
  const getXPForNextLevel = useXPStore((s) => s.getXPForNextLevel);

  return (
    <div className="p-4 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-purple-500/10">
      <p className="text-xs text-cyan-400/60 mb-1">Total XP</p>
      <motion.p
        className="text-3xl font-black text-cyan-300"
        key={xp}
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
      >
        {xp.toLocaleString()}
      </motion.p>
      <p className="text-xs text-white/40 mt-1">
        {getXPForNextLevel() - xp} XP to next level
      </p>
      <p className="text-[10px] text-white/30 mt-0.5">
        Lv.{level} — {getLevelTitle()}
      </p>
    </div>
  );
}

export const XPSystem = memo(XPSystemInner);
