// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Evolution (visual forms)
// Renders the creature body for the 3 evolution forms:
//   Scholar Phoenix / Code Serpent / Warrior Dragon
// Pure presentational: emoji glyph + framer/CSS effects, no assets.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { CREATURE_FORMS } from '@/stores/useCreatureStore';
import { cn } from '@/lib/utils';
import type { CreatureForm, CreatureMood, CreatureStage } from '@/types/creature';

interface EvolutionVisualProps {
  form: CreatureForm;
  stage: CreatureStage;
  mood: CreatureMood;
  /** Base font-size in px for the glyph (scaled by stage). */
  size: number;
  goldenAura: boolean;
}

// Glyph per (form, stage). Egg is form-agnostic; later stages gain detail.
const FORM_GLYPHS: Record<CreatureForm, Partial<Record<CreatureStage, string>>> = {
  phoenix: {
    baby: '🐣',
    teen: '🐦',
    adult: '🦅',
    legendary: '🔥',
    mythic: '🦅',
  },
  serpent: {
    baby: '🐛',
    teen: '🐍',
    adult: '🐉',
    legendary: '🐲',
    mythic: '🐍',
  },
  dragon: {
    baby: '🦎',
    teen: '🐊',
    adult: '🐉',
    legendary: '🐲',
    mythic: '🐉',
  },
};

const STAGE_FALLBACK: Record<CreatureStage, string> = {
  egg: '🥚',
  baby: '🐣',
  teen: '🐦',
  adult: '🐉',
  legendary: '🐲',
  mythic: '✨',
};

function glyphFor(form: CreatureForm, stage: CreatureStage): string {
  if (stage === 'egg') return STAGE_FALLBACK.egg;
  return FORM_GLYPHS[form][stage] ?? STAGE_FALLBACK[stage];
}

// Ambient decoration emoji per form, orbiting the body on higher stages.
const FORM_MOTIF: Record<CreatureForm, string> = {
  phoenix: '📖', // floating formulas / book wings
  serpent: '💾', // binary rain / circuitry
  dragon: '🛡️', // armor plating
};

function EvolutionVisualInner({
  form,
  stage,
  mood,
  size,
  goldenAura,
}: EvolutionVisualProps) {
  const glyph = glyphFor(form, stage);
  const accent = CREATURE_FORMS[form].accent;
  const showMotif = stage === 'adult' || stage === 'legendary' || stage === 'mythic';
  const intensity =
    stage === 'mythic' ? 1 : stage === 'legendary' ? 0.8 : stage === 'adult' ? 0.55 : 0.3;

  const auraColor = goldenAura ? '#ffab00' : accent;
  const auraStrength = goldenAura ? 1 : intensity;

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size * 1.6, height: size * 1.6 }}
    >
      {/* Aura / glow */}
      <motion.div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 1.5,
          height: size * 1.5,
          background: `radial-gradient(circle, ${auraColor}55 0%, transparent 70%)`,
          filter: 'blur(6px)',
        }}
        animate={{
          opacity: mood === 'sad' ? 0.15 : [0.35 * auraStrength, 0.7 * auraStrength, 0.35 * auraStrength],
          scale: mood === 'dance' ? [1, 1.25, 1] : [1, 1.08, 1],
        }}
        transition={{ duration: mood === 'dance' ? 0.6 : 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Orbiting motif on advanced stages */}
      {showMotif && mood !== 'sleeping' && mood !== 'sad' && (
        <>
          <motion.div
            aria-hidden
            className="absolute text-xs pointer-events-none"
            style={{ fontSize: size * 0.32, opacity: 0.7 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <span style={{ display: 'inline-block', transform: `translateX(${size * 0.7}px)` }}>
              {FORM_MOTIF[form]}
            </span>
          </motion.div>
        </>
      )}

      {/* Body glyph */}
      <motion.span
        role="img"
        aria-label={CREATURE_FORMS[form].name}
        className={cn('relative z-[1] leading-none')}
        style={{
          fontSize: size,
          filter:
            mood === 'sad'
              ? 'grayscale(0.7) brightness(0.6)'
              : goldenAura
                ? `drop-shadow(0 0 8px #ffab00)`
                : `drop-shadow(0 0 ${4 + intensity * 6}px ${accent})`,
        }}
        animate={
          mood === 'sad'
            ? { x: [-1.5, 1.5, -1.5], y: 0, rotate: 0, scale: 1 }
            : mood === 'dance'
              ? { rotate: [0, 360], scale: [1, 1.15, 1] }
              : mood === 'happy'
                ? { y: [0, -size * 0.35, 0], scale: 1, rotate: 0 }
                : mood === 'eating'
                  ? { scale: [1, 1.18, 0.95, 1], rotate: 0, y: 0 }
                  : mood === 'sleeping'
                    ? { rotate: [0, 4, 0], scale: 1, y: 0 }
                    : mood === 'curious'
                      ? { rotate: [0, -12, 12, 0], scale: 1, y: 0 }
                      : // idle → breathing
                        { scale: [1, 1.05, 1], y: 0, rotate: 0 }
        }
        transition={{
          duration:
            mood === 'sad'
              ? 0.18
              : mood === 'dance'
                ? 0.8
                : mood === 'happy'
                  ? 0.45
                  : mood === 'eating'
                    ? 0.4
                    : mood === 'curious'
                      ? 0.6
                      : mood === 'sleeping'
                        ? 3.5
                        : 2.6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {glyph}
      </motion.span>
    </div>
  );
}

export const EvolutionVisual = memo(EvolutionVisualInner);
