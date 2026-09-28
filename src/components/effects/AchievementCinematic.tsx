// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Cinematic
// 4-second unlock sequence driven by useXPStore.recentUnlock:
// gold edge flash → vignette → a glowing orb descends → it bursts
// into the badge → the badge spins in 3D → title + description fade
// in → XP ticks up → gold confetti (canvas-confetti) → the badge flies
// up into the Dynamic Island (posted as an achievement notification)
// and the screen returns to normal. Unlocks that arrive together are
// queued (all but the last play in a quicker cut). Under reduced
// motion or lite mode, or with the cinematic switched off, a toast is
// shown instead.
//
// Mount once at the root: it also seeds the achievement catalogue into
// the XP store (so unlocks work at all) and unlocks the meta
// achievements (level milestones, collectors, completionist).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy } from 'lucide-react';
import { useXPStore } from '@/stores/useXPStore';
import { useOSStore } from '@/stores/useOSStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { Achievement } from '@/types/achievement';
import {
  useEffectsStore,
  holdCelebrations,
  DESKTOP_SETTLE_MS,
  type AchievementCelebration,
} from './useEffectsStore';
import { checkCollectionMilestones, checkLevelMilestones, seedAchievements } from './achievement-sync';
import { playAchievementChime } from './effects-sfx';
import {
  CATEGORY_LABEL,
  FX_DISPLAY_FONT,
  FX_Z,
  RARITY_STYLE,
  prefersReducedEffects,
  randRange,
  withAlpha,
  type Rarity,
} from './effects-utils';

const CINEMATIC_SECONDS = 4;
/** Time scale for cinematics that have more unlocks waiting behind them. */
const QUICK_SPEED = 0.62;
const GOLD = '#ffc940';
const GOLD_PALETTE = ['#ffd54a', '#ffc400', '#fff3c4', '#ffe082', '#ffb300'];

const VIGNETTE =
  'radial-gradient(ellipse at 50% 42%, rgba(4, 4, 10, 0.18) 0%, rgba(4, 4, 10, 0.62) 52%, rgba(2, 2, 6, 0.9) 100%)';
const EDGE_FLASH =
  'inset 0 0 160px 44px rgba(255, 196, 0, 0.85), inset 0 0 28px 8px rgba(255, 240, 200, 0.95)';
const RAYS =
  'repeating-conic-gradient(from 0deg, rgba(255, 214, 90, 0.22) 0deg 6deg, rgba(255, 214, 90, 0) 6deg 20deg)';
const RAY_MASK = 'radial-gradient(circle, #000 18%, transparent 70%)';

// ─── Routing (module level: shared by every mount) ───

/** Ids already routed this session: recentUnlock can be re-set, unlocks can't repeat. */
const routedIds = new Set<string>();

function announceAchievement(a: Achievement): void {
  useNotificationStore.getState().addNotification({
    type: 'achievement',
    title: `Achievement unlocked: ${a.title}`,
    message: `${a.icon} ${a.description} (+${a.xpReward} XP)`,
    icon: a.icon,
    autoDismiss: 6000,
  });
}

function releaseRecentUnlock(id: string): void {
  const xp = useXPStore.getState();
  if (xp.recentUnlock?.id === id) xp.clearRecentUnlock();
}

function routeUnlock(a: Achievement): void {
  if (routedIds.has(a.id)) return;
  routedIds.add(a.id);
  const fx = useEffectsStore.getState();
  if (!fx.achievementCinematic || prefersReducedEffects()) {
    announceAchievement(a);
    // Deferred: other recentUnlock subscribers (the creature) still see it this tick.
    window.setTimeout(() => releaseRecentUnlock(a.id), 0);
    return;
  }
  fx.enqueueCelebration({ kind: 'achievement', key: `achievement:${a.id}`, achievement: a });
}

function completeCinematic(key: string, a: Achievement): void {
  if (useEffectsStore.getState().current?.key !== key) return;
  announceAchievement(a);
  releaseRecentUnlock(a.id);
  useEffectsStore.getState().finishCelebration(key);
}

// ─── Confetti ───

function burstConfetti(): void {
  void confetti({
    particleCount: 70,
    spread: 360,
    startVelocity: 24,
    decay: 0.9,
    gravity: 0.6,
    ticks: 140,
    scalar: 0.7,
    shapes: ['circle'],
    colors: GOLD_PALETTE,
    origin: { x: 0.5, y: 0.42 },
    zIndex: FX_Z.confetti,
    disableForReducedMotion: true,
  });
}

function celebrationConfetti(rarity: Rarity): void {
  const colors = [...GOLD_PALETTE, RARITY_STYLE[rarity].color];
  const count = { common: 60, uncommon: 80, rare: 110, epic: 140, legendary: 180 }[rarity];
  const base = {
    colors,
    shapes: ['circle', 'star'] as confetti.Shape[],
    scalar: 0.9,
    gravity: 0.85,
    decay: 0.91,
    ticks: 260,
    zIndex: FX_Z.confetti,
    disableForReducedMotion: true,
  };
  void confetti({ ...base, particleCount: count, spread: 100, angle: 90, startVelocity: 42, origin: { x: 0.5, y: 0.5 } });
  if (rarity === 'epic' || rarity === 'legendary') {
    const side = Math.round(count / 2);
    void confetti({ ...base, particleCount: side, spread: 55, angle: 60, startVelocity: 55, origin: { x: 0, y: 0.75 } });
    void confetti({ ...base, particleCount: side, spread: 55, angle: 120, startVelocity: 55, origin: { x: 1, y: 0.75 } });
  }
}

// ─── Visual pieces ───

interface Spark {
  dx: number;
  dy: number;
  size: number;
  color: string;
  delay: number;
}

function makeSparks(rarity: Rarity): Spark[] {
  const accent = RARITY_STYLE[rarity].color;
  const count = 22;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + randRange(-0.15, 0.15);
    const dist = randRange(110, 220);
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: randRange(3, 6.5),
      color: i % 3 === 0 ? accent : GOLD_PALETTE[i % GOLD_PALETTE.length],
      delay: randRange(0, 0.07),
    };
  });
}

interface BadgeFaceProps {
  achievement: Achievement;
  side: 'front' | 'back';
  gleamDelay: number;
  gleamDuration: number;
}

function BadgeFace({ achievement, side, gleamDelay, gleamDuration }: BadgeFaceProps) {
  const rarity = RARITY_STYLE[achievement.rarity];
  return (
    <div
      className="absolute inset-0 rounded-full p-[5px]"
      style={{
        background: rarity.gradient,
        boxShadow: `0 0 34px ${rarity.glow}, 0 0 90px rgba(255, 196, 0, 0.35)`,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: side === 'back' ? 'rotateY(180deg)' : undefined,
      }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 28%, #34344a 0%, #14141f 55%, #07070c 100%)',
          boxShadow: `inset 0 0 22px ${rarity.glow}`,
        }}
      >
        {side === 'front' ? (
          <span
            className="select-none text-6xl leading-none"
            style={{ filter: `drop-shadow(0 0 10px ${rarity.glow})` }}
          >
            {achievement.icon}
          </span>
        ) : (
          <Trophy className="h-14 w-14" style={{ color: GOLD, filter: 'drop-shadow(0 0 10px rgba(255, 196, 0, 0.7))' }} />
        )}
        {side === 'front' && (
          <motion.div
            className="absolute inset-y-0 w-10"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))',
              skewX: -20,
            }}
            initial={{ x: -140 }}
            animate={{ x: 140 }}
            transition={{ delay: gleamDelay, duration: gleamDuration, ease: 'easeInOut' }}
          />
        )}
      </div>
    </div>
  );
}

// ─── One cinematic ───

interface CinematicRunProps {
  celebration: AchievementCelebration;
  quick: boolean;
}

function CinematicRun({ celebration, quick }: CinematicRunProps) {
  const { key, achievement: a } = celebration;
  const [speed] = useState(() => (quick ? QUICK_SPEED : 1));
  const [sparks] = useState(() => makeSparks(a.rarity));
  const xp = useMotionValue(0);
  const xpLabel = useTransform(xp, (v) => `+${Math.round(v)} XP`);
  const rarity = RARITY_STYLE[a.rarity];
  const s = (seconds: number) => seconds * speed;

  useEffect(() => {
    const timers: number[] = [];
    const at = (seconds: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, seconds * speed * 1000));
    };
    at(1.02, () => {
      burstConfetti();
      playAchievementChime(a.rarity);
    });
    at(2.05, () => celebrationConfetti(a.rarity));
    at(CINEMATIC_SECONDS, () => completeCinematic(key, a));
    const counter = animate(xp, a.xpReward, { delay: 2.0 * speed, duration: 0.9 * speed, ease: 'easeOut' });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') completeCinematic(key, a);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      counter.stop();
      window.removeEventListener('keydown', onKey);
    };
  }, [key, a, speed, xp]);

  return (
    <motion.div
      data-fx-ignore=""
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: FX_Z.cinematic }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* 1 · vignette: everything darkens */}
      <motion.div
        className="absolute inset-0"
        style={{ background: VIGNETTE }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: s(CINEMATIC_SECONDS), times: [0, 0.1, 0.84, 1], ease: 'easeInOut' }}
      />

      {/* 2 · gold flash on the screen edges */}
      <motion.div
        className="absolute inset-0"
        style={{ boxShadow: EDGE_FLASH }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.35, 0] }}
        transition={{ duration: s(0.8), times: [0, 0.18, 0.55, 1] }}
      />

      {/* Anchor at the badge centre */}
      <div className="absolute left-1/2 top-[42%] h-0 w-0">
        {/* Exit: the whole badge block flies up into the Dynamic Island */}
        <motion.div
          initial={{ y: '0vh', scale: 1, opacity: 1 }}
          animate={{ y: ['0vh', '0vh', '-39vh'], scale: [1, 1, 0.16], opacity: [1, 1, 0] }}
          transition={{ duration: s(CINEMATIC_SECONDS), times: [0, 0.82, 0.985], ease: 'easeIn' }}
        >
          {/* light rays behind the badge */}
          <motion.div
            className="absolute rounded-full"
            style={{
              left: -170,
              top: -170,
              width: 340,
              height: 340,
              background: RAYS,
              maskImage: RAY_MASK,
              WebkitMaskImage: RAY_MASK,
            }}
            initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
            animate={{ opacity: 0.85, scale: 1, rotate: 90 }}
            transition={{
              opacity: { delay: s(1.05), duration: s(0.6) },
              scale: { delay: s(1.05), duration: s(0.6) },
              rotate: { delay: s(1.05), duration: s(3), ease: 'linear' },
            }}
          />

          {/* 3 · the orb descends from above the screen */}
          <motion.div
            className="absolute"
            style={{ left: -20, top: -20, width: 40, height: 40 }}
            initial={{ y: '-62vh', opacity: 0, scale: 0.5 }}
            animate={{ y: ['-62vh', '0vh', '0vh'], opacity: [0, 1, 0], scale: [0.5, 1, 2.8] }}
            transition={{ delay: s(0.3), duration: s(0.78), times: [0, 0.86, 1], ease: 'easeIn' }}
          >
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: '50%',
                width: 3,
                height: 190,
                background: 'linear-gradient(to top, rgba(255, 214, 90, 0.9), rgba(255, 214, 90, 0))',
                filter: 'blur(1px)',
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, #ffffff 0%, #ffe9a8 30%, #ffc400 55%, rgba(255, 160, 0, 0) 72%)',
                boxShadow: '0 0 30px 10px rgba(255, 196, 0, 0.6)',
              }}
            />
          </motion.div>

          {/* 4 · the orb bursts: flash, shockwaves, sparks */}
          <motion.div
            className="absolute rounded-full"
            style={{
              left: -130,
              top: -130,
              width: 260,
              height: 260,
              background:
                'radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 214, 90, 0.7) 35%, rgba(255, 196, 0, 0) 70%)',
            }}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: [0, 1, 0], scale: [0.2, 1.5] }}
            transition={{ delay: s(1.02), duration: s(0.5) }}
          />
          {[GOLD, rarity.color].map((ring, i) => (
            <motion.div
              key={ring + i}
              className="absolute rounded-full"
              style={{
                left: -50,
                top: -50,
                width: 100,
                height: 100,
                border: `2px solid ${ring}`,
                boxShadow: `0 0 16px ${ring}`,
              }}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0.95, 0], scale: [0.2, 4.2] }}
              transition={{ delay: s(1.04 + i * 0.09), duration: s(0.8), ease: 'easeOut' }}
            />
          ))}
          {sparks.map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: -p.size / 2,
                top: -p.size / 2,
                width: p.size,
                height: p.size,
                background: p.color,
                boxShadow: `0 0 8px ${p.color}`,
              }}
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{ x: p.dx, y: p.dy, opacity: [0, 1, 0] }}
              transition={{ delay: s(1.03 + p.delay), duration: s(0.75), ease: 'easeOut' }}
            />
          ))}

          {/* 5 · the badge appears from the burst and spins once in 3D */}
          <div className="absolute" style={{ left: -64, top: -64, width: 128, height: 128, perspective: 900 }}>
            <motion.div
              className="relative h-full w-full"
              style={{ transformStyle: 'preserve-3d' }}
              initial={{ scale: 0, rotateY: 0 }}
              animate={{ scale: [0, 1.22, 1], rotateY: 360 }}
              transition={{
                scale: { delay: s(1.06), duration: s(0.5), times: [0, 0.6, 1], ease: 'easeOut' },
                rotateY: { delay: s(1.3), duration: s(1.05), ease: [0.45, 0, 0.2, 1] },
              }}
            >
              <BadgeFace achievement={a} side="front" gleamDelay={s(2.45)} gleamDuration={s(0.7)} />
              <BadgeFace achievement={a} side="back" gleamDelay={0} gleamDuration={0} />
            </motion.div>
          </div>

          {/* 6 · title, description, XP */}
          <div className="absolute left-0 top-[88px] flex w-[min(90vw,520px)] -translate-x-1/2 flex-col items-center text-center">
            <motion.p
              className="font-mono text-[11px] font-bold uppercase tracking-[0.42em]"
              style={{ color: GOLD, textShadow: '0 0 12px rgba(255, 196, 0, 0.6)' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: s(1.55), duration: s(0.35) }}
            >
              Achievement Unlocked
            </motion.p>
            <motion.h2
              className="mt-2 text-2xl font-black sm:text-3xl"
              style={{ fontFamily: FX_DISPLAY_FONT, color: '#fff6dc', textShadow: '0 0 18px rgba(255, 196, 0, 0.55)' }}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: s(1.7), duration: s(0.45) }}
            >
              {a.title}
            </motion.h2>
            <motion.p
              className="mt-2 max-w-md text-sm text-white/75"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: s(1.88), duration: s(0.4) }}
            >
              {a.description}
            </motion.p>
            <motion.div
              className="mt-3 flex flex-wrap items-center justify-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: s(1.95), duration: s(0.35) }}
            >
              <span
                className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  color: rarity.color,
                  borderColor: withAlpha(rarity.color, 0.45),
                  background: withAlpha(rarity.color, 0.12),
                }}
              >
                {rarity.label}
              </span>
              <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
                {CATEGORY_LABEL[a.category]}
              </span>
              {a.hidden && (
                <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                  Secret
                </span>
              )}
            </motion.div>
            <motion.p
              className="mt-3 font-mono text-2xl font-black"
              style={{ color: GOLD, textShadow: '0 0 14px rgba(255, 196, 0, 0.65)' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: s(1.98), duration: s(0.3) }}
            >
              <motion.span>{xpLabel}</motion.span>
            </motion.p>
          </div>
        </motion.div>
      </div>

      {/* Click the badge or text to dismiss early (the rest of the screen stays usable) */}
      <button
        type="button"
        aria-label={`Dismiss achievement ${a.title}`}
        onClick={() => completeCinematic(key, a)}
        className="pointer-events-auto absolute left-1/2 top-[42%] h-[330px] w-[min(90vw,520px)] -translate-x-1/2 -translate-y-[90px] cursor-pointer bg-transparent"
      />
    </motion.div>
  );
}

// ─── Layer ───

function AchievementCinematicInner() {
  const current = useEffectsStore((s) => s.current);
  const waiting = useEffectsStore((s) => s.queue.length);

  useEffect(() => {
    // Without a seeded catalogue every unlockAchievement() is a silent no-op.
    seedAchievements();

    let metaTimer: number | null = null;
    const scheduleMetaCheck = () => {
      if (metaTimer !== null) return;
      metaTimer = window.setTimeout(() => {
        metaTimer = null;
        checkLevelMilestones();
        checkCollectionMilestones();
      }, 0);
    };
    // Conditions that became true while unlocks were still no-ops count now.
    scheduleMetaCheck();

    const unsubXP = useXPStore.subscribe((state, prev) => {
      if (state.recentUnlock && state.recentUnlock !== prev.recentUnlock) routeUnlock(state.recentUnlock);
      if (state.level > prev.level || state.achievements !== prev.achievements) scheduleMetaCheck();
    });
    const unsubOS = useOSStore.subscribe((state, prev) => {
      if (state.phase === 'desktop' && prev.phase !== 'desktop') holdCelebrations(DESKTOP_SETTLE_MS);
    });

    const pending = useXPStore.getState().recentUnlock;
    if (pending) routeUnlock(pending);

    return () => {
      unsubXP();
      unsubOS();
      if (metaTimer !== null) window.clearTimeout(metaTimer);
    };
  }, []);

  const achievement = current?.kind === 'achievement' ? current : null;

  return (
    <>
      <div data-fx-ignore="" className="sr-only" role="status" aria-live="polite">
        {achievement
          ? `Achievement unlocked: ${achievement.achievement.title}. ${achievement.achievement.description}. Plus ${achievement.achievement.xpReward} XP.`
          : ''}
      </div>
      <AnimatePresence>
        {achievement && <CinematicRun key={achievement.key} celebration={achievement} quick={waiting > 0} />}
      </AnimatePresence>
    </>
  );
}

export const AchievementCinematic = memo(AchievementCinematicInner);
