// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement toast
// The compact unlock card for common and uncommon achievements (and for
// every rarity when the cinematic is off, under reduced motion or in
// lite mode): a rarity-rimmed medallion with the category glyph in gold,
// "Achievement unlocked", the title, the XP and the rarity, on popover
// glass lit by a little forge light.
//
// It sits bottom-centre above the workspace pill, in the toast layer
// (--z-notification, like the notification toasts at bottom-right and
// below dialogs), shifted right on narrow screens so it never lands on
// the start menu. It never covers the palette or a window's controls
// for long, and only the card itself takes clicks. Auto-dismisses after
// 5 s (paused on hover or focus). Several unlocks stack upward, three on
// screen at a time. Toasts wait for the desktop to settle and for any
// unlock cinematic that is playing.
//
//   showAchievementToast(achievement)    // routed by AchievementCinematic
//   <AchievementToastLayer />            // mounted by AchievementCinematic
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, type Ref } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from 'framer-motion';
import { Trophy, X } from 'lucide-react';
import { create } from 'zustand';
import type { Achievement } from '@/types/achievement';
import { useOSStore } from '@/stores/useOSStore';
import { useEffectsStore } from '@/components/effects/useEffectsStore';
import { CATEGORY_ICON, RARITY_STYLE, withAlpha } from '@/components/effects/effects-utils';
import { IconButton } from '@/components/ui/Button';
import { EASE_OUT_QUINT, STATUS } from '@/styles/tokens';

/** How long a toast stays up (the countdown pauses on hover / focus). */
const TOAST_MS = 5000;
/** Toasts on screen at once; later unlocks wait their turn. */
const MAX_VISIBLE = 3;

const GOLD = STATUS.gold;
const FACE =
  'radial-gradient(circle at 50% 30%, var(--color-ink-600) 0%, var(--color-ink-800) 58%, var(--color-ink-900) 100%)';
const FORGE_LIGHT =
  'radial-gradient(96px 64px at 34px 50%, color-mix(in oklab, var(--color-ember-500) 17%, transparent), transparent 75%)';
const GLEAM = 'linear-gradient(90deg, rgb(255 255 255 / 0), rgb(255 255 255 / 0.45), rgb(255 255 255 / 0))';
/**
 * Horizontal centre of the stack: the screen centre, but never so far
 * left that a card (400px) reaches the start menu (fixed at left 8px,
 * 460px wide), and never past the right edge.
 */
const STACK_CENTER = 'min(max(50%, 692px), calc(100% - 216px))';

// ─── Store (module level: shared by every mount) ───

interface ToastEntry {
  key: string;
  achievement: Achievement;
}

interface ToastState {
  toasts: ToastEntry[];
  /** True while the desktop settles (unlock shatter, first paint). */
  held: boolean;
}

const useToastStore = create<ToastState>()(() => ({ toasts: [], held: false }));

let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/** Queue the compact unlock card for `achievement` (each id shows once). */
export function showAchievementToast(achievement: Achievement): void {
  const key = `achievement-toast:${achievement.id}`;
  const { toasts } = useToastStore.getState();
  if (toasts.some((t) => t.key === key)) return;
  useToastStore.setState({ toasts: [...toasts, { key, achievement }] });
}

/** Keep toasts off screen for `ms` (e.g. while the desktop fades in). */
export function holdAchievementToasts(ms: number): void {
  if (typeof window === 'undefined') return;
  useToastStore.setState({ held: true });
  if (releaseTimer !== null) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    releaseTimer = null;
    useToastStore.setState({ held: false });
  }, Math.max(0, ms));
}

function dismissToast(key: string): void {
  const { toasts } = useToastStore.getState();
  if (!toasts.some((t) => t.key === key)) return;
  useToastStore.setState({ toasts: toasts.filter((t) => t.key !== key) });
}

// ─── Medallion ───

function ToastMedallion({ achievement, still }: { achievement: Achievement; still: boolean }) {
  const rarity = RARITY_STYLE[achievement.rarity] ?? RARITY_STYLE.common;
  const Glyph = CATEGORY_ICON[achievement.category] ?? Trophy;
  return (
    <motion.span
      aria-hidden
      className="relative flex size-10 shrink-0 rounded-full p-[2px]"
      style={{
        background: rarity.gradient,
        boxShadow: `0 0 0 1px ${withAlpha(GOLD, 0.3)}, 0 0 16px ${withAlpha(GOLD, 0.26)}`,
      }}
      initial={still ? false : { scale: 0.55, rotate: -24 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.06, duration: 0.42, ease: EASE_OUT_QUINT }}
    >
      <span
        className="relative flex size-full items-center justify-center overflow-hidden rounded-full"
        style={{ background: FACE, boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.1), inset 0 0 10px ${rarity.glow}` }}
      >
        <span className="absolute inset-[4px] rounded-full border" style={{ borderColor: withAlpha(GOLD, 0.26) }} />
        <Glyph
          size={18}
          strokeWidth={1.75}
          className="relative text-gold"
          style={{ filter: `drop-shadow(0 0 6px ${withAlpha(GOLD, 0.55)})` }}
        />
        {!still && (
          <motion.span
            className="absolute inset-y-0 w-3"
            style={{ background: GLEAM, skewX: -20 }}
            initial={{ x: -30 }}
            animate={{ x: 30 }}
            transition={{ delay: 0.38, duration: 0.6, ease: 'easeInOut' }}
          />
        )}
      </span>
    </motion.span>
  );
}

// ─── One toast ───

/** `ref` reaches the card so AnimatePresence (popLayout) can measure it on exit. */
function AchievementToastCard({ entry, ref }: { entry: ToastEntry; ref?: Ref<HTMLDivElement> }) {
  const a = entry.achievement;
  const reduceMotion = useReducedMotion() ?? false;
  const rarity = RARITY_STYLE[a.rarity] ?? RARITY_STYLE.common;
  const remaining = useMotionValue(1);
  const countdown = useRef<AnimationPlaybackControls | null>(null);

  // The countdown is the dismiss timer: it pauses while hovered / focused.
  useEffect(() => {
    const controls = animate(remaining, 0, {
      duration: TOAST_MS / 1000,
      ease: 'linear',
      onComplete: () => dismissToast(entry.key),
    });
    countdown.current = controls;
    return () => {
      controls.stop();
      countdown.current = null;
    };
  }, [entry.key, remaining]);

  const pause = () => countdown.current?.pause();
  const resume = () => countdown.current?.play();

  return (
    <motion.div
      ref={ref}
      layout={!reduceMotion}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0.16 } }
          : { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18, ease: EASE_OUT_QUINT } }
      }
      transition={{ duration: 0.26, ease: EASE_OUT_QUINT }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      data-achievement-toast={a.id}
      className="glass-popover pointer-events-auto relative flex w-[min(400px,calc(100vw-32px))] items-center gap-3 overflow-hidden rounded-card border-gold/25 py-2.5 pl-3 pr-2"
    >
      {/* forge light behind the medallion + warm top hairline */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-44" style={{ background: FORGE_LIGHT }} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-gold/55 to-transparent"
      />

      <ToastMedallion achievement={a} still={reduceMotion} />

      <div className="relative min-w-0 flex-1">
        <p className="hud-label text-gold">Achievement unlocked</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-fg" title={`${a.title}: ${a.description}`}>
          {a.title}
        </p>
      </div>

      <div className="relative flex shrink-0 flex-col items-end">
        <span className="tabular font-mono text-ui font-semibold leading-5 text-gold">
          +{a.xpReward}
          <span className="ml-1 text-2xs font-medium">XP</span>
        </span>
        <span
          className="font-mono text-2xs font-medium uppercase leading-4 tracking-[0.08em]"
          style={{ color: rarity.color }}
        >
          {rarity.label}
        </span>
      </div>

      <IconButton
        icon={X}
        size="xs"
        aria-label={`Dismiss achievement ${a.title}`}
        onClick={() => dismissToast(entry.key)}
        className="relative self-start"
      />

      {/* countdown hairline, gold into ember */}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-linear-to-r from-gold to-ember-500 opacity-70"
        style={{ scaleX: remaining }}
      />
    </motion.div>
  );
}

// ─── Layer ───

function AchievementToastLayerInner() {
  const toasts = useToastStore((s) => s.toasts);
  const held = useToastStore((s) => s.held);
  const onDesktop = useOSStore((s) => s.phase === 'desktop');
  // One loud moment at a time: wait for an unlock cinematic to finish.
  const cinematicOnScreen = useEffectsStore((s) => s.current?.kind === 'achievement');

  const ready = onDesktop && !held && !cinematicOnScreen;
  const visible = ready ? toasts.slice(0, MAX_VISIBLE) : [];
  const newest = visible[visible.length - 1]?.achievement;
  const announcement = newest
    ? `Achievement unlocked: ${newest.title}. ${newest.description}. Plus ${newest.xpReward} XP.`
    : '';

  return (
    <div
      data-fx-ignore=""
      className="pointer-events-none fixed bottom-28 flex -translate-x-1/2 flex-col-reverse items-center gap-2"
      style={{ left: STACK_CENTER, zIndex: 'var(--z-notification)' }}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <AnimatePresence mode="popLayout">
        {visible.map((entry) => (
          <AchievementToastCard key={entry.key} entry={entry} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Root-level stack of compact achievement toasts (mount once). */
export const AchievementToastLayer = memo(AchievementToastLayerInner);
