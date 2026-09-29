// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Level Up Effect
// Detects a level increase in useXPStore and plays (FORGED ARMOR: a
// riveted forged plaque heating up from below, ember + gold, XP is
// warrior energy): the XP bar fills to max → a warm flash +
// shockwave → the old level number blows away while the new one forges
// in with an ember glow → the new title and the fresh bar for the next
// level. Shares the celebration queue with the
// achievement cinematic (an unlock that causes a level-up plays
// first). Toast instead under reduced motion or lite mode, or when
// switched off.
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
  prefersReducedEffects,
  xpToNextLevel,
} from './effects-utils';

/** When the bar hits 100 % and the flash fires (s). */
const FLASH_AT = 1.0;
const TOTAL_SECONDS = 2.9;
// forge-heat: cooling iron → ember → white-hot tip
const BAR_GRADIENT =
  'linear-gradient(90deg, #5c1a06 0%, #a3350a 22%, #d4520b 45%, #f76b15 64%, #ff8a3d 80%, #ffb27a 92%, #fff4e0 100%)';
const EMBER_GLOW = 'rgba(247, 107, 21, 0.55)';

function announceLevelUp(fromLevel: number, toLevel: number): void {
  const title = levelTitle(toLevel);
  const jump = toLevel - fromLevel;
  useNotificationStore.getState().addNotification({
    type: 'success',
    title: `Level up! Lv.${toLevel} ${title}`,
    message: jump > 1 ? `+${jump} levels. You are now a ${title}.` : `You are now a ${title}.`,
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
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(4, 6, 11, 0.05), rgba(4, 6, 11, 0.6) 75%)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: TOTAL_SECONDS, times: [0, 0.08, 0.85, 1] }}
      />

      {/* full-screen flash when the bar maxes out */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 28%, rgba(255, 250, 240, 0.9) 0%, rgba(255, 178, 122, 0.5) 26%, rgba(247, 107, 21, 0.18) 50%, rgba(4, 6, 11, 0) 75%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ delay: FLASH_AT, duration: 0.5, times: [0, 0.2, 1] }}
      />

      <motion.button
        type="button"
        aria-label="Dismiss level up"
        onClick={() => finishLevelUp(key)}
        // Unclipped carrier: the plaque's drop shadow + ember halo live here
        className="pointer-events-auto relative w-[min(88vw,380px)] cursor-pointer focus-ring"
        style={{
          filter: `drop-shadow(0 24px 30px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 22px ${EMBER_GLOW})`,
        }}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Forged plaque: riveted, cut top-left + bottom-right, heat rising from the base */}
        <span className="armor-popover rivets relative flex w-full flex-col items-center px-8 pb-6 pt-7 text-center [--cut-bl:0px] [--cut-tr:0px] [--cut:18px] [--rivet-inset:8px]">
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 55% at 50% 100%, rgba(247, 107, 21, 0.32), rgba(163, 53, 10, 0.12) 55%, transparent 80%)',
              boxShadow: 'inset 0 0 0 1px rgba(255, 138, 61, 0.35), inset 0 -2px 0 0 #ffb27a',
            }}
            initial={{ opacity: 0.35 }}
            animate={{ opacity: [0.35, 0.35, 1] }}
            transition={{ duration: FLASH_AT + 0.4, times: [0, FLASH_AT / (FLASH_AT + 0.4), 1] }}
          />
          {/* Notch tab hanging from the top edge */}
          <span
            aria-hidden
            className="notch absolute left-1/2 top-0 h-[5px] w-28 -translate-x-1/2 bg-linear-to-b from-ember-300 to-ember-600 [--notch:4px]"
          />
        <motion.span
          className="engraved relative block font-display text-xs font-semibold uppercase text-ember-300"
          initial={{ opacity: 0, letterSpacing: '0.14em' }}
          animate={{ opacity: 1, letterSpacing: '0.32em' }}
          transition={{ duration: 0.5 }}
        >
          Level up
        </motion.span>

        {/* Level number: old one blows away at the flash, new one scales up with a glow */}
        <span className="relative my-2 flex h-28 w-full items-center justify-center">
          {/* Octagonal shockwave (the forge seal) */}
          <motion.svg
            aria-hidden
            viewBox="0 0 100 100"
            className="absolute overflow-visible"
            style={{ width: 90, height: 90, filter: `drop-shadow(0 0 8px ${EMBER_GLOW})` }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1, 2.8] }}
            transition={{ delay: FLASH_AT, duration: 0.75, times: [0, 0.15, 1], ease: 'easeOut' }}
          >
            <polygon points="94.3,68.4 68.4,94.3 31.6,94.3 5.7,68.4 5.7,31.6 31.6,5.7 68.4,5.7 94.3,31.6" fill="none" stroke="var(--color-ember-300)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </motion.svg>
          <motion.span
            className="absolute text-7xl font-semibold text-fg-muted tabular"
            style={{ fontFamily: FX_DISPLAY_FONT }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: [1, 1, 0], scale: [1, 1.08, 0.4], filter: ['blur(0px)', 'blur(0px)', 'blur(8px)'] }}
            transition={{ duration: FLASH_AT + 0.15, times: [0, FLASH_AT / (FLASH_AT + 0.15), 1] }}
          >
            {fromLevel}
          </motion.span>
          <motion.span
            className="absolute text-7xl font-semibold text-fg tabular"
            style={{
              fontFamily: FX_DISPLAY_FONT,
              textShadow: '0 0 18px rgba(255, 138, 61, 0.75), 0 0 44px rgba(245, 192, 74, 0.35)',
            }}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: [0.3, 1.5, 1] }}
            transition={{ delay: FLASH_AT, duration: 0.6, times: [0, 0.55, 1], ease: 'easeOut' }}
          >
            {toLevel}
          </motion.span>
        </span>

        <motion.span
          className="relative block text-lg font-semibold uppercase tracking-[0.08em] text-fg"
          style={{ fontFamily: FX_DISPLAY_FONT }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: FLASH_AT + 0.2, duration: 0.35 }}
        >
          {title}
        </motion.span>
        {jump > 1 && (
          <motion.span
            className="relative mt-1 block font-mono text-2xs uppercase tracking-[0.14em] text-gold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: FLASH_AT + 0.3 }}
          >
            +{jump} levels
          </motion.span>
        )}

        {/* XP bar: fills to max, flashes, restarts for the new level */}
        <span className="relative mt-5 block h-2 w-full overflow-hidden bg-steel-950 shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_-1px_0_rgb(255_255_255/0.07)] [clip-path:polygon(4px_0,100%_0,calc(100%-4px)_100%,0_100%)]">
          <motion.span
            className="absolute inset-y-0 left-0 block"
            style={{ background: BAR_GRADIENT }}
            initial={{ width: `${fromProgress}%`, opacity: 1 }}
            animate={{ width: '100%', opacity: 0 }}
            transition={{
              width: { delay: 0.2, duration: FLASH_AT - 0.2, ease: [0.65, 0, 0.35, 1] },
              opacity: { delay: FLASH_AT + 0.05, duration: 0.2 },
            }}
          />
          <motion.span
            className="absolute inset-y-0 left-0 block"
            style={{ background: BAR_GRADIENT }}
            initial={{ width: '0%', opacity: 0 }}
            animate={{ width: `${toProgress}%`, opacity: 1 }}
            transition={{ delay: FLASH_AT + 0.2, duration: 0.6, ease: 'easeOut' }}
          />
        </span>
        <motion.span
          className="relative mt-2 block font-mono text-2xs text-fg-subtle tabular"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: FLASH_AT + 0.35 }}
        >
          {maxed ? 'MAX LEVEL REACHED' : `${toNext.toLocaleString()} XP to Lv.${toLevel + 1}`}
        </motion.span>
        </span>
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
      if (!fx.levelUpEffect || prefersReducedEffects()) {
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
