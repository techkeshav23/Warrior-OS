// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Cinematic
// Routes every unlock from useXPStore.recentUnlock by rarity:
// - rare / epic / legendary → the ≈3.4-second cinematic (FORGE HUD: gold
//   + ember on deep ink): warm edge flash → vignette → a forge-spark
//   descends → it bursts into the medallion → the medallion turns once
//   in 3D → title + description rise in → XP ticks up → confetti → the
//   medallion flies up into the Dynamic Island (posted as an achievement
//   notification). Unlocks that arrive together are queued (all but the
//   last play in a quicker cut).
// - common / uncommon (and every rarity with the cinematic switched off,
//   under reduced motion or in lite mode) → the compact achievement
//   toast (achievements/AchievementToast), logged in the notification
//   center without a second toast.
// The cinematic never takes the OS hostage: it sits below the start
// menu, palette, menus, notifications and dialogs (FX_Z), lets every
// click through except on the medallion (click it or press Esc to skip)
// and its confetti canvas ignores the pointer.
//
// Mount once at the root: it also seeds the achievement catalogue into
// the XP store (so unlocks work at all), unlocks the meta achievements
// (level milestones, collectors, completionist) and renders the toast
// layer.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy } from 'lucide-react';
import { EMBER, FG, PLASMA, STATUS } from '@/styles/tokens';
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
import {
  AchievementToastLayer,
  holdAchievementToasts,
  showAchievementToast,
} from '@/components/achievements/AchievementToast';
import { playAchievementChime } from './effects-sfx';
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  FX_DISPLAY_FONT,
  FX_Z,
  RARITY_STYLE,
  prefersReducedEffects,
  randRange,
  withAlpha,
  type Rarity,
} from './effects-utils';

/** Timeline length at speed 1 (every beat below is in these seconds). */
const CINEMATIC_SECONDS = 4;
/** Normal playback speed: the full cut runs ≈3.4 s. */
const BASE_SPEED = 0.85;
/** Time scale for cinematics that have more unlocks waiting behind them. */
const QUICK_SPEED = 0.62;
const GOLD = STATUS.gold;
/** Confetti: gold and ember, a little warm white, one plasma glint. */
const GOLD_PALETTE = [STATUS.gold, EMBER[300], EMBER[400], '#ffe9a8', FG.base];

const VIGNETTE =
  'radial-gradient(ellipse at 50% 42%, rgba(4, 6, 11, 0.2) 0%, rgba(4, 6, 11, 0.64) 52%, rgba(4, 6, 11, 0.9) 100%)';
const EDGE_FLASH =
  'inset 0 0 150px 30px rgba(245, 192, 74, 0.42), inset 0 0 26px 4px rgba(255, 178, 122, 0.55)';
const RAYS =
  'repeating-conic-gradient(from 0deg, rgba(245, 192, 74, 0.16) 0deg 4deg, rgba(245, 192, 74, 0) 4deg 18deg)';
const RAY_MASK = 'radial-gradient(circle, #000 20%, transparent 68%)';

// ─── Routing (module level: shared by every mount) ───

/** Ids already routed this session: recentUnlock can be re-set, unlocks can't repeat. */
const routedIds = new Set<string>();

/** Rarities loud enough for the full-screen cinematic; the rest get the toast. */
const CINEMATIC_RARITIES: ReadonlySet<Rarity> = new Set<Rarity>(['rare', 'epic', 'legendary']);

/**
 * Log the unlock in the notification center. `alreadyShown`: the
 * achievement toast is on screen, so the entry is filed as read and the
 * generic toast stack doesn't show the same unlock a second time.
 */
function announceAchievement(a: Achievement, alreadyShown = false): void {
  const notifications = useNotificationStore.getState();
  const id = notifications.addNotification({
    type: 'achievement',
    title: `Achievement unlocked: ${a.title}`,
    message: `${a.description} (+${a.xpReward} XP)`,
    icon: a.icon,
    autoDismiss: 6000,
  });
  if (alreadyShown) notifications.markAsRead(id);
}

function releaseRecentUnlock(id: string): void {
  const xp = useXPStore.getState();
  if (xp.recentUnlock?.id === id) xp.clearRecentUnlock();
}

function routeUnlock(a: Achievement): void {
  if (routedIds.has(a.id)) return;
  routedIds.add(a.id);
  const fx = useEffectsStore.getState();
  if (!fx.achievementCinematic || prefersReducedEffects() || !CINEMATIC_RARITIES.has(a.rarity)) {
    showAchievementToast(a);
    announceAchievement(a, true);
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
    particleCount: 56,
    spread: 360,
    startVelocity: 22,
    decay: 0.9,
    gravity: 0.6,
    ticks: 130,
    scalar: 0.6,
    shapes: ['circle'],
    colors: GOLD_PALETTE,
    origin: { x: 0.5, y: 0.42 },
    zIndex: FX_Z.confetti,
    disableForReducedMotion: true,
  });
}

function celebrationConfetti(rarity: Rarity): void {
  const colors = [...GOLD_PALETTE, RARITY_STYLE[rarity].color, PLASMA[300]];
  const count = { common: 50, uncommon: 64, rare: 84, epic: 110, legendary: 140 }[rarity];
  const base = {
    colors,
    shapes: ['square', 'circle'] as confetti.Shape[],
    scalar: 0.75,
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
  const Glyph = CATEGORY_ICON[achievement.category] ?? Trophy;
  return (
    <div
      // Forged octagonal medallion: a rarity-metal rim around a steel face
      className="absolute inset-0 p-[4px] [clip-path:polygon(29.3%_0,70.7%_0,100%_29.3%,100%_70.7%,70.7%_100%,29.3%_100%,0_70.7%,0_29.3%)]"
      style={{
        background: rarity.gradient,
        boxShadow: `inset 0 1px 0 rgba(255, 244, 232, 0.55), inset 0 -2px 0 rgba(0, 0, 0, 0.45), inset 0 0 18px ${rarity.glow}`,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: side === 'back' ? 'rotateY(180deg)' : undefined,
      }}
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden [clip-path:polygon(29.3%_0,70.7%_0,100%_29.3%,100%_70.7%,70.7%_100%,29.3%_100%,0_70.7%,0_29.3%)]"
        style={{
          background: 'radial-gradient(circle at 50% 30%, #2f363f 0%, #15191e 58%, #07080a 100%)',
          boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 0 24px ${rarity.glow}`,
        }}
      >
        {/* inner engraved octagon + four rivets */}
        <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-[7px]">
          <polygon points="95.3,68.8 68.8,95.3 31.2,95.3 4.7,68.8 4.7,31.2 31.2,4.7 68.8,4.7 95.3,31.2" fill="none" stroke="rgba(245, 192, 74, 0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {[
            [50, 9],
            [91, 50],
            [50, 91],
            [9, 50],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill="#535c68" stroke="rgba(0, 0, 0, 0.6)" strokeWidth="0.8" />
          ))}
        </svg>
        {side === 'front' ? (
          <Glyph
            className="relative h-12 w-12"
            strokeWidth={1.5}
            style={{ color: GOLD, filter: 'drop-shadow(0 0 10px rgba(245, 192, 74, 0.55))' }}
          />
        ) : (
          <Trophy
            className="relative h-12 w-12"
            strokeWidth={1.5}
            style={{ color: GOLD, filter: 'drop-shadow(0 0 10px rgba(245, 192, 74, 0.55))' }}
          />
        )}
        {side === 'front' && (
          <motion.div
            className="absolute inset-y-0 w-10"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.4), rgba(255,255,255,0))',
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
  const [speed] = useState(() => (quick ? QUICK_SPEED : BASE_SPEED));
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
                background: 'linear-gradient(to top, rgba(255, 178, 122, 0.85), rgba(255, 178, 122, 0))',
                filter: 'blur(1px)',
              }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, #fffaf0 0%, #ffe9a8 28%, #f5c04a 50%, rgba(247, 107, 21, 0) 72%)',
                boxShadow: '0 0 28px 8px rgba(247, 107, 21, 0.45)',
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
                'radial-gradient(circle, rgba(255, 250, 240, 0.9) 0%, rgba(245, 192, 74, 0.55) 35%, rgba(247, 107, 21, 0) 70%)',
            }}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: [0, 1, 0], scale: [0.2, 1.5] }}
            transition={{ delay: s(1.02), duration: s(0.5) }}
          />
          {[GOLD, rarity.color].map((ring, i) => (
            <motion.svg
              key={ring + i}
              aria-hidden
              viewBox="0 0 100 100"
              className="absolute overflow-visible"
              style={{
                left: -50,
                top: -50,
                width: 100,
                height: 100,
                filter: `drop-shadow(0 0 6px ${ring})`,
              }}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0.95, 0], scale: [0.2, 4.2] }}
              transition={{ delay: s(1.04 + i * 0.09), duration: s(0.8), ease: 'easeOut' }}
            >
              <polygon points="95.3,68.8 68.8,95.3 31.2,95.3 4.7,68.8 4.7,31.2 31.2,4.7 68.8,4.7 95.3,31.2" fill="none" stroke={ring} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </motion.svg>
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
          <div className="absolute left-0 top-[92px] flex w-[min(90vw,520px)] -translate-x-1/2 flex-col items-center text-center">
            <motion.p
              className="flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-[0.32em]"
              style={{ color: GOLD }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: s(1.55), duration: s(0.35) }}
            >
              <span aria-hidden className="h-px w-6" style={{ background: 'rgba(245, 192, 74, 0.5)' }} />
              Achievement unlocked
              <span aria-hidden className="h-px w-6" style={{ background: 'rgba(245, 192, 74, 0.5)' }} />
            </motion.p>
            <motion.h2
              className="mt-3 text-2xl font-semibold tracking-[0.02em] text-fg sm:text-3xl"
              style={{ fontFamily: FX_DISPLAY_FONT, textShadow: '0 0 24px rgba(245, 192, 74, 0.28)' }}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: s(1.7), duration: s(0.45) }}
            >
              {a.title}
            </motion.h2>
            <motion.p
              className="mt-2 max-w-md text-sm text-fg-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: s(1.88), duration: s(0.4) }}
            >
              {a.description}
            </motion.p>
            <motion.div
              className="mt-4 flex flex-wrap items-center justify-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: s(1.95), duration: s(0.35) }}
            >
              <span
                className="chamfer-xs inline-flex h-5 items-center gap-1.5 px-2 font-mono text-2xs font-medium uppercase tracking-[0.08em] ring-1 ring-inset"
                style={{
                  color: rarity.color,
                  background: withAlpha(rarity.color, 0.12),
                  // ring colour via the Tailwind ring variable
                  ['--tw-ring-color' as string]: withAlpha(rarity.color, 0.35),
                }}
              >
                <span aria-hidden className="size-1.5 rotate-45" style={{ background: rarity.color }} />
                {rarity.label}
              </span>
              <span className="armor-plate chamfer-xs inline-flex h-5 items-center px-2 font-mono text-2xs font-medium uppercase tracking-[0.08em] text-fg-muted">
                {CATEGORY_LABEL[a.category]}
              </span>
              {a.hidden && (
                <span className="chamfer-xs inline-flex h-5 items-center bg-viz-3/12 px-2 font-mono text-2xs font-medium uppercase tracking-[0.08em] text-viz-3 ring-1 ring-inset ring-viz-3/30">
                  Secret
                </span>
              )}
            </motion.div>
            <motion.p
              className="mt-4 text-2xl font-semibold tabular"
              style={{ fontFamily: FX_DISPLAY_FONT, color: GOLD, textShadow: '0 0 16px rgba(245, 192, 74, 0.45)' }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: s(1.98), duration: s(0.3) }}
            >
              <motion.span>{xpLabel}</motion.span>
            </motion.p>
          </div>
        </motion.div>
      </div>

      {/* The medallion is the only thing that takes a click (skip); every
          other pixel of the overlay lets clicks through to the OS. */}
      <button
        type="button"
        aria-label={`Skip achievement ${a.title}`}
        title="Skip"
        onClick={() => completeCinematic(key, a)}
        className="pointer-events-auto absolute left-1/2 top-[42%] size-32 -translate-x-1/2 -translate-y-1/2 cursor-pointer bg-transparent focus-ring"
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
      if (state.phase === 'desktop' && prev.phase !== 'desktop') {
        holdCelebrations(DESKTOP_SETTLE_MS);
        holdAchievementToasts(DESKTOP_SETTLE_MS);
      }
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
      <AchievementToastLayer />
    </>
  );
}

export const AchievementCinematic = memo(AchievementCinematicInner);
