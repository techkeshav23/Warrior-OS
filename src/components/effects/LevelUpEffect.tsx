// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Level Up Effect
// Detects a level increase in useXPStore and plays: the XP bar fills
// to max → white-cyan flash + shockwave → the old level number blows
// away while the new one scales up with a glow → the new title and the
// fresh bar for the next level. Shares the celebration queue with the
// achievement cinematic (an unlock that causes a level-up plays
// first). Toast instead under reduced motion or when switched off.
// Mount once at the root.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useXPStore } from '@/stores/useXPStore';
import { useOSStore } from '@/stores/useOSStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import {
  useEffectsStore,
  holdCelebrations,
  DESKTOP_SETTLE_MS,
  type LevelUpCelebration,
} from './useEffectsStore';
import { playLevelUpSound } from './effects-sfx';
import {
  FX_DISPLAY_FONT,
  FX_Z,
  MAX_LEVEL,
  levelProgress,
  levelTitle,
  prefersReducedMotion,
  xpToNextLevel,
} from './effects-utils';

/** When the bar hits 100 % and the flash fires (s). */
const FLASH_AT = 1.0;
const TOTAL_SECONDS = 2.9;
const BAR_GRADIENT = 'linear-gradient(90deg, #22d3ee 0%, #7b61ff 100%)';

function announceLevelUp(fromLevel: number, toLevel: number): void {
  const title = levelTitle(toLevel);
  const jump = toLevel - fromLevel;
  useNotificationStore.getState().addNotification({
    type: 'success',
    title: `Level up! Lv.${toLevel} ${title}`,
    message: jump > 1 ? `+${jump} levels. You are now a ${title}.` : `You are now a ${title}.`,
    icon: '⬆️',
  });
}

function finishLevelUp(key: string): void {
  useEffectsStore.getState().finishCelebration(key);
}

let levelUpCounter = 0;

function nextLevelUpKey(level: number): string {
  levelUpCounter += 1;
  return `levelup:${level}:${levelUpCounter}`;
}

function LevelUpRun({ celebration }: { celebration: LevelUpCelebration }) {
  const { key, fromLevel, toLevel, fromXP, toXP } = celebration;
  const fromProgress = levelProgress(fromXP, fromLevel);
  const toProgress = levelProgress(toXP, toLevel);
  const title = levelTitle(toLevel);
  const jump = toLevel - fromLevel;
  const maxed = toLevel >= MAX_LEVEL;
  const toNext = xpToNextLevel(toXP, toLevel);

  useEffect(() => {
    const sound = window.setTimeout(() => playLevelUpSound(), 150);
    const done = window.setTimeout(() => finishLevelUp(key), TOTAL_SECONDS * 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishLevelUp(key);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(sound);
      window.clearTimeout(done);
      window.removeEventListener('keydown', onKey);
    };
  }, [key]);

  return (
    <motion.div
      data-fx-ignore=""
      className="pointer-events-none fixed inset-0 flex items-start justify-center pt-[16vh]"
      style={{ zIndex: FX_Z.levelUp }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.2 }}
    >
      {/* soft dim so the panel reads over any wallpaper */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.55) 75%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: TOTAL_SECONDS, times: [0, 0.08, 0.85, 1] }}
      />

      {/* full-screen flash when the bar maxes out */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.95) 0%, rgba(0, 240, 255, 0.6) 28%, rgba(123, 97, 255, 0.25) 52%, rgba(0, 0, 0, 0) 75%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ delay: FLASH_AT, duration: 0.5, times: [0, 0.2, 1] }}
      />

      <motion.button
        type="button"
        aria-label="Dismiss level up"
        onClick={() => finishLevelUp(key)}
        className="pointer-events-auto relative flex w-[min(88vw,380px)] cursor-pointer flex-col items-center rounded-2xl border border-cyan-400/30 px-8 py-6 text-center"
        style={{
          background: 'rgba(8, 10, 20, 0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 0 40px rgba(0, 240, 255, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        }}
        initial={{ y: -16, scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        <motion.p
          className="font-mono text-[11px] font-bold uppercase tracking-[0.45em] text-cyan-300"
          style={{ textShadow: '0 0 12px rgba(0, 240, 255, 0.7)' }}
          initial={{ opacity: 0, letterSpacing: '0.2em' }}
          animate={{ opacity: 1, letterSpacing: '0.45em' }}
          transition={{ duration: 0.5 }}
        >
          Level Up
        </motion.p>

        {/* Level number: old one blows away at the flash, new one scales up with a glow */}
        <div className="relative my-2 flex h-28 w-full items-center justify-center">
          <motion.span
            className="absolute rounded-full border-2 border-cyan-300"
            style={{ width: 90, height: 90, boxShadow: '0 0 24px rgba(0, 240, 255, 0.8)' }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1, 2.8] }}
            transition={{ delay: FLASH_AT, duration: 0.75, times: [0, 0.15, 1], ease: 'easeOut' }}
          />
          <motion.span
            className="absolute text-7xl font-black text-white/80"
            style={{ fontFamily: FX_DISPLAY_FONT }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: [1, 1, 0], scale: [1, 1.08, 0.4], filter: ['blur(0px)', 'blur(0px)', 'blur(8px)'] }}
            transition={{ duration: FLASH_AT + 0.15, times: [0, FLASH_AT / (FLASH_AT + 0.15), 1] }}
          >
            {fromLevel}
          </motion.span>
          <motion.span
            className="absolute text-7xl font-black text-white"
            style={{
              fontFamily: FX_DISPLAY_FONT,
              textShadow: '0 0 18px rgba(0, 240, 255, 0.95), 0 0 44px rgba(123, 97, 255, 0.75)',
            }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: [0.3, 1.5, 1] }}
            transition={{ delay: FLASH_AT, duration: 0.6, times: [0, 0.55, 1], ease: 'easeOut' }}
          >
            {toLevel}
          </motion.span>
        </div>

        <motion.p
          className="text-lg font-bold text-white"
          style={{ fontFamily: FX_DISPLAY_FONT }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: FLASH_AT + 0.2, duration: 0.35 }}
        >
          {title}
        </motion.p>
        {jump > 1 && (
          <motion.p
            className="mt-0.5 font-mono text-[11px] text-purple-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: FLASH_AT + 0.3 }}
          >
            +{jump} levels
          </motion.p>
        )}

        {/* XP bar: fills to max, flashes, restarts for the new level */}
        <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: BAR_GRADIENT, boxShadow: '0 0 10px rgba(34, 211, 238, 0.7)' }}
            initial={{ width: `${fromProgress}%`, opacity: 1 }}
            animate={{ width: '100%', opacity: 0 }}
            transition={{
              width: { delay: 0.2, duration: FLASH_AT - 0.2, ease: [0.65, 0, 0.35, 1] },
              opacity: { delay: FLASH_AT + 0.05, duration: 0.2 },
            }}
          />
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: BAR_GRADIENT, boxShadow: '0 0 12px rgba(34, 211, 238, 0.85)' }}
            initial={{ width: '0%', opacity: 0 }}
            animate={{ width: `${toProgress}%`, opacity: 1 }}
            transition={{ delay: FLASH_AT + 0.2, duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <motion.p
          className="mt-2 font-mono text-[10px] text-white/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: FLASH_AT + 0.35 }}
        >
          {maxed ? 'MAX LEVEL REACHED' : `${toNext.toLocaleString()} XP to Lv.${toLevel + 1}`}
        </motion.p>
      </motion.button>
    </motion.div>
  );
}

function LevelUpEffectInner() {
  const current = useEffectsStore((s) => s.current);

  useEffect(() => {
    const unsubXP = useXPStore.subscribe((state, prev) => {
      if (state.level <= prev.level) return;
      const fx = useEffectsStore.getState();
      if (!fx.levelUpEffect || prefersReducedMotion()) {
        announceLevelUp(prev.level, state.level);
        return;
      }
      fx.enqueueCelebration({
        kind: 'levelup',
        key: nextLevelUpKey(state.level),
        fromLevel: prev.level,
        toLevel: state.level,
        fromXP: prev.xp,
        toXP: state.xp,
      });
    });
    const unsubOS = useOSStore.subscribe((state, prev) => {
      if (state.phase === 'desktop' && prev.phase !== 'desktop') holdCelebrations(DESKTOP_SETTLE_MS);
    });
    return () => {
      unsubXP();
      unsubOS();
    };
  }, []);

  const levelUp = current?.kind === 'levelup' ? current : null;

  return (
    <>
      <div data-fx-ignore="" className="sr-only" role="status" aria-live="polite">
        {levelUp ? `Level up! You reached level ${levelUp.toLevel}, ${levelTitle(levelUp.toLevel)}.` : ''}
      </div>
      <AnimatePresence>{levelUp && <LevelUpRun key={levelUp.key} celebration={levelUp} />}</AnimatePresence>
    </>
  );
}

export const LevelUpEffect = memo(LevelUpEffectInner);
