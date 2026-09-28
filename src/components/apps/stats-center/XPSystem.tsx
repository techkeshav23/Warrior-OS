// ═══════════════════════════════════════════════════════════
// WARRIOR OS — XP System Widget
// Shows total XP and the XP still needed for the next level
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { useXPStore } from '@/stores/useXPStore';
import { MAX_LEVEL, levelTitle, xpToNextLevel } from '@/components/effects/effects-utils';

function XPSystemInner() {
  // Derive from primitives: store getter calls during render can be
  // memoised into stale values by the React Compiler.
  const xp = useXPStore((s) => s.xp);
  const level = useXPStore((s) => s.level);
  const toNext = xpToNextLevel(xp, level);

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
        {level >= MAX_LEVEL ? 'Max level reached' : `${toNext.toLocaleString()} XP to next level`}
      </p>
      <p className="text-[10px] text-white/30 mt-0.5">
        Lv.{level} — {levelTitle(level)}
      </p>
    </div>
  );
}

export const XPSystem = memo(XPSystemInner);
