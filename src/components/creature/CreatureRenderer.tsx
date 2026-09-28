// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Renderer
// The living sprite that sits just above the taskbar (right side).
// Mood-driven overlays: sparkles (happy/dance), ZzZ (sleeping),
// nom crumbs (eating), shiver handled by EvolutionVisual.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { EvolutionVisual } from './CreatureEvolution';
import type { CreatureVitals } from './CreatureEngine';

interface CreatureRendererProps {
  vitals: CreatureVitals;
  onClick: () => void;
}

// Base glyph size in px, scaled by the stage multiplier.
const BASE_SIZE = 26;

function Sparkles({ color }: { color: string }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute pointer-events-none text-[10px]"
          style={{ color, left: `${20 + i * 25}%`, top: '5%' }}
          initial={{ opacity: 0, y: 4, scale: 0.6 }}
          animate={{ opacity: [0, 1, 0], y: -14, scale: [0.6, 1, 0.6] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
        >
          ✦
        </motion.span>
      ))}
    </>
  );
}

function SleepZs() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute pointer-events-none font-mono text-text-secondary"
          style={{ right: '6%', top: '0%', fontSize: 9 + i * 3 }}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: -18 - i * 4, x: 6 + i * 3 }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.5 }}
        >
          z
        </motion.span>
      ))}
    </>
  );
}

function CreatureRendererInner({ vitals, onClick }: CreatureRendererProps) {
  const { stageInfo, form, formInfo, mood, stage, hasGoldenAura } = vitals;
  const name = useCreatureStore((s) => s.name);
  const size = Math.round(BASE_SIZE * stageInfo.scale);

  const title = `${name} · ${formInfo.name} (${stageInfo.label})`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'relative flex items-end justify-center',
        'transition-transform duration-150 hover:scale-110 active:scale-95',
        'focus:outline-none'
      )}
      style={{ width: size * 1.8, height: 48 }}
    >
      <div className="relative flex items-center justify-center h-full w-full">
        <EvolutionVisual
          form={form}
          stage={stage}
          mood={mood}
          size={size}
          goldenAura={hasGoldenAura}
        />

        <AnimatePresence>
          {(mood === 'happy' || mood === 'dance') && (
            <motion.div
              key="sparkles"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Sparkles color={formInfo.accent} />
            </motion.div>
          )}
          {mood === 'sleeping' && (
            <motion.div
              key="sleep"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SleepZs />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </button>
  );
}

export const CreatureRenderer = memo(CreatureRendererInner);
