// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Level Progress Ring
// Visual ring showing progress toward next level
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { useXPStore } from '@/stores/useXPStore';

function LevelProgressInner() {
  const { level } = useXPStore();
  const getLevelProgress = useXPStore((s) => s.getLevelProgress);
  const getLevelTitle = useXPStore((s) => s.getLevelTitle);
  const progress = getLevelProgress();

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="p-4 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 flex flex-col items-center justify-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="6"
          />
          <motion.circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="url(#levelGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="levelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">{level}</span>
          <span className="text-[9px] text-white/40">LEVEL</span>
        </div>
      </div>
      <p className="text-xs text-white/60 mt-2">{getLevelTitle()}</p>
      <p className="text-[10px] text-white/30">{Math.round(progress)}% complete</p>
    </div>
  );
}

export const LevelProgress = memo(LevelProgressInner);
