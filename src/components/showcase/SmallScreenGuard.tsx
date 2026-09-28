// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Small Screen Guard
// Phones and narrow windows get a cinematic "desktop experience"
// screen (owner card + a lightweight animated teaser) instead of
// the full OS. "Continue anyway" is remembered for the tab.
//
//   <SmallScreenGuard>{theWholeOS}</SmallScreenGuard>
//
// • Renders nothing until the viewport is known (SSR + first client
//   frame), then either the guard notice or `children`.
// • Widening the window past `minWidth` launches the OS on its own.
// • Once the OS has been shown it stays shown for the page load, so
//   shrinking the window (devtools, split screen) never unmounts it.
// • No WebGL, no canvas: CSS + framer-motion only; honours
//   prefers-reduced-motion.
// ═══════════════════════════════════════════════════════════

'use client';

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, Check, Keyboard, Link2, Monitor } from 'lucide-react';
import { OWNER } from '@/config/owner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { OwnerCard } from './OwnerCard';
import { BrandMark } from './BrandMark';

export const SMALL_SCREEN_MIN_WIDTH = 1024;
export const SMALL_SCREEN_STORAGE_KEY = 'warrior-os-small-screen-continue';

export interface SmallScreenGuardProps {
  /** The OS. Rendered when the screen is big enough or after "Continue anyway". */
  children?: ReactNode;
  /** Viewports narrower than this (CSS px) see the guard notice. Default 1024. */
  minWidth?: number;
  /** sessionStorage key remembering "Continue anyway" for this tab. */
  storageKey?: string;
  /** Called after the visitor picks "Continue anyway". */
  onContinue?: () => void;
}

type GuardState = 'pending' | 'guard' | 'pass';

// ─── Viewport + "continue anyway" store ───
const listeners = new Set<() => void>();
/** Fallback when sessionStorage is blocked (private mode, site-data settings). */
const continuedInMemory = new Set<string>();
/** Keys whose OS has already been shown during this page load. */
const shownThisLoad = new Set<string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

function hasContinued(key: string): boolean {
  if (continuedInMemory.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function rememberContinue(key: string): void {
  continuedInMemory.add(key);
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Blocked storage: the in-memory flag still lets this visit through.
  }
  listeners.forEach((listener) => listener());
}

/** Touch-only device with a phone-sized screen (also catches "desktop
 *  site" mode, where the reported viewport can be wide). */
function isTouchOnlyPhone(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  const touchOnly =
    window.matchMedia('(pointer: coarse)').matches &&
    !window.matchMedia('(any-pointer: fine)').matches;
  if (!touchOnly) return false;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return shortSide > 0 && shortSide < 600;
}

/** True when this browser should see the guard notice (ignores "Continue anyway"). */
export function isSmallScreen(minWidth: number = SMALL_SCREEN_MIN_WIDTH): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < minWidth || isTouchOnlyPhone();
}

function readGuardState(minWidth: number, key: string): GuardState {
  if (shownThisLoad.has(key) || hasContinued(key)) return 'pass';
  return isSmallScreen(minWidth) ? 'guard' : 'pass';
}

const noopSubscribe = () => () => {};
const readHasFinePointer = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: fine)').matches;

// ─── Guard ───
export function SmallScreenGuard({
  children,
  minWidth = SMALL_SCREEN_MIN_WIDTH,
  storageKey = SMALL_SCREEN_STORAGE_KEY,
  onContinue,
}: SmallScreenGuardProps) {
  const state = useSyncExternalStore<GuardState>(
    subscribe,
    () => readGuardState(minWidth, storageKey),
    () => 'pending'
  );

  // Latch: once the OS is on screen, keep it there for this page load.
  useEffect(() => {
    if (state === 'pass') shownThisLoad.add(storageKey);
  }, [state, storageKey]);

  const handleContinue = useCallback(() => {
    rememberContinue(storageKey);
    onContinue?.();
  }, [storageKey, onContinue]);

  if (state === 'pending') return null;

  return (
    <>
      {state === 'pass' && children}
      <AnimatePresence>
        {state === 'guard' && (
          <SmallScreenNotice key="small-screen-guard" minWidth={minWidth} onContinue={handleContinue} />
        )}
      </AnimatePresence>
    </>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

// ─── Notice screen ───
const SmallScreenNotice = memo(function SmallScreenNotice({
  minWidth,
  onContinue,
}: {
  minWidth: number;
  onContinue: () => void;
}) {
  const canWiden = useSyncExternalStore(noopSubscribe, readHasFinePointer, () => false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const handleCopyLink = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      // No clipboard access: fall back to the native share sheet if there is one.
      try {
        await navigator.share?.({ title: 'Warrior OS', url });
      } catch {
        /* dismissed */
      }
    }
  }, []);

  return (
    <motion.main
      data-small-screen-guard=""
      aria-labelledby="small-screen-guard-title"
      className="fixed inset-0 overflow-y-auto overscroll-contain bg-ink-950 text-fg scrollbar-thin"
      style={{ zIndex: 'calc(var(--z-boot) + 1)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ─── Background: the Deep Space wallpaper, dimmed for reading ─── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="wos-deep-space">
          <div className="wos-deep-space__aurora" />
          <div className="wos-deep-space__field" />
        </div>
        <div className="absolute inset-0 bg-ink-950/45" />
      </div>

      {/* ─── Content ─── */}
      <motion.div
        className="relative mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-7 px-5 py-10 text-center"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
      >
        {/* Brand */}
        <motion.div variants={itemVariants} className="flex items-center gap-3">
          <BrandMark size={32} />
          <div className="text-left leading-tight">
            <p className="font-display text-sm font-semibold tracking-[0.28em] text-fg">WARRIOR OS</p>
            <p className="mt-0.5 hud-label">{OWNER.shortName}&apos;s system · v4.0</p>
          </div>
        </motion.div>

        {/* Teaser */}
        <motion.div variants={itemVariants} className="w-full">
          <DesktopTeaser />
        </motion.div>

        {/* Message */}
        <motion.div variants={itemVariants} className="space-y-3">
          <p className="inline-flex h-6 items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 font-mono text-2xs font-medium uppercase tracking-[0.12em] text-accent">
            <Monitor className="size-3.5" strokeWidth={1.75} aria-hidden />
            Best on a big screen
          </p>
          <h1 id="small-screen-guard-title" className="text-2xl font-semibold text-fg">
            Warrior OS is a desktop experience
          </h1>
          <p className="text-sm text-fg-muted">
            A full sci-fi operating system that runs in your browser: draggable windows, a
            command palette, procedural music, a digital companion and more, built for a big
            screen, a keyboard and a mouse.
          </p>
          <p className="text-xs text-fg-subtle">
            Open it on a laptop or desktop (<span className="font-mono text-fg-muted tabular">{minWidth}px+</span>{' '}
            wide) for the full experience.
            {canWiden && <span className="mt-1 block">Or widen this window and it launches on its own.</span>}
          </p>
        </motion.div>

        {/* Creator */}
        <motion.div variants={itemVariants} className="w-full">
          <OwnerCard layout="stacked" eyebrow="Built by" className="w-full" />
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVariants} className="flex w-full flex-col items-center gap-3">
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              trailingIcon={ArrowRight}
              onClick={onContinue}
              data-testid="small-screen-continue"
              className="sm:flex-1"
            >
              Continue anyway
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leadingIcon={copied ? <Check className="text-success" strokeWidth={2} aria-hidden /> : Link2}
              onClick={handleCopyLink}
              data-testid="small-screen-copy-link"
              className="sm:flex-1"
            >
              <span aria-live="polite">{copied ? 'Link copied' : 'Copy link for later'}</span>
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Keyboard className="size-3.5" strokeWidth={1.75} aria-hidden />
            Heads up: parts of the OS expect a keyboard and mouse.
          </p>
        </motion.div>
      </motion.div>

    </motion.main>
  );
});

// ─── Teaser: a looping miniature of the desktop ───
// One 8s cycle: boot mark → three windows open in turn → fade → repeat.
const CYCLE = 8;

/** Miniature Deep Space: plasma aurora top-left, ember dawn bottom-right. */
const TEASER_WALLPAPER =
  'radial-gradient(ellipse 60% 55% at 18% 18%, color-mix(in oklab, var(--color-plasma-400) 14%, transparent), transparent 70%), radial-gradient(ellipse 70% 45% at 85% 110%, color-mix(in oklab, var(--color-ember-500) 22%, transparent), transparent 70%), linear-gradient(180deg, var(--color-ink-900), var(--color-ink-950))';

function DesktopTeaser() {
  const reduceMotion = useReducedMotion();
  const animated = !reduceMotion;

  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-[16/10] w-full max-w-sm overflow-hidden rounded-card border border-line-strong bg-ink-900 shadow-e3"
    >
      {/* Wallpaper */}
      <div className="absolute inset-0" style={{ background: TEASER_WALLPAPER }} />

      {/* Dynamic island */}
      <div className="absolute left-1/2 top-1.5 h-2 w-14 -translate-x-1/2 rounded-full border border-line-strong bg-ink-950/80" />

      {/* Desktop icons */}
      <div className="absolute left-2 top-5 space-y-1.5">
        {['text-plasma-400', 'text-viz-3', 'text-success', 'text-ember-400'].map((c) => (
          <div key={c} className={cn('flex size-3 items-center justify-center rounded-[28%] border border-line-strong bg-ink-800', c)}>
            <span className="size-1 rounded-full bg-current" />
          </div>
        ))}
      </div>

      {/* Boot mark */}
      {animated && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0, 0], scale: [0.9, 1, 1, 1.08, 1.08] }}
          transition={{ duration: CYCLE, times: [0, 0.03, 0.1, 0.15, 1], repeat: Infinity, ease: 'easeOut' }}
        >
          <BrandMark size={28} glow />
        </motion.div>
      )}

      {/* Windows */}
      <TeaserWindow title="Terminal" className="left-[14%] top-[17%] h-[44%] w-[46%]" appearAt={0.17} animated={animated}>
        <div className="space-y-1">
          {[0.85, 0.55, 0.7].map((w, i) => (
            <motion.div
              key={i}
              className="h-[3px] origin-left rounded-full bg-success/70"
              style={{ width: `${w * 100}%` }}
              initial={animated ? { scaleX: 0 } : false}
              animate={animated ? { scaleX: [0, 0, 1, 1] } : undefined}
              transition={
                animated
                  ? { duration: CYCLE, times: [0, 0.22 + i * 0.05, 0.27 + i * 0.05, 1], repeat: Infinity }
                  : undefined
              }
            />
          ))}
          <div className="flex items-center gap-1">
            <span className="h-[3px] w-2 rounded-full bg-accent/80" />
            <span className="h-2 w-[3px] bg-accent motion-safe:animate-pulse-soft" />
          </div>
        </div>
      </TeaserWindow>

      <TeaserWindow title="WarBeats" className="right-[7%] top-[26%] h-[40%] w-[38%]" appearAt={0.33} animated={animated}>
        <div className="flex h-8 items-end justify-center gap-[3px]">
          {[0.9, 0.6, 1.1, 0.75, 1.3, 0.8, 1].map((d, i) => (
            <motion.span
              key={i}
              className="w-[4px] origin-bottom rounded-sm bg-linear-to-t from-viz-3 to-plasma-400"
              style={{ height: '100%' }}
              initial={animated ? { scaleY: 0.3 } : false}
              animate={animated ? { scaleY: [0.25, 1, 0.45, 0.8, 0.3] } : { scaleY: 0.35 + (i % 3) * 0.2 }}
              transition={animated ? { duration: d, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' } : undefined}
            />
          ))}
        </div>
      </TeaserWindow>

      <TeaserWindow title="Habit Forge" className="bottom-[15%] left-[30%] h-[33%] w-[40%]" appearAt={0.49} animated={animated}>
        <div className="space-y-1.5">
          {[0.9, 0.65, 0.4].map((p, i) => (
            <div key={i} className="h-[3px] overflow-hidden rounded-full bg-line-strong">
              <motion.div
                className="h-full origin-left rounded-full bg-ember-400/85"
                style={{ width: `${p * 100}%` }}
                initial={animated ? { scaleX: 0 } : false}
                animate={animated ? { scaleX: [0, 0, 1, 1] } : undefined}
                transition={
                  animated
                    ? { duration: CYCLE, times: [0, 0.53 + i * 0.04, 0.6 + i * 0.04, 1], repeat: Infinity, ease: 'easeOut' }
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      </TeaserWindow>

      {/* Cursor */}
      {animated && (
        <motion.div
          className="absolute h-3 w-3 drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]"
          initial={{ left: '70%', top: '80%', opacity: 0 }}
          animate={{
            left: ['70%', '70%', '30%', '66%', '48%', '48%'],
            top: ['80%', '80%', '26%', '36%', '70%', '70%'],
            opacity: [0, 1, 1, 1, 1, 0],
          }}
          transition={{ duration: CYCLE, times: [0, 0.12, 0.2, 0.36, 0.52, 1], repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox="0 0 12 12" className="h-full w-full">
            <path d="M1 1 L1 10 L3.8 7.4 L6 11 L7.6 10.2 L5.4 6.7 L9 6.5 Z" fill="var(--color-fg)" stroke="var(--color-ink-950)" strokeWidth="0.8" />
          </svg>
        </motion.div>
      )}

      {/* Taskbar */}
      <div className="absolute inset-x-0 bottom-0 flex h-4 items-center justify-center gap-1 border-t border-line bg-ink-950/80">
        <span className="size-1.5 rounded-full bg-accent" />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="size-1.5 rounded-full bg-fg-faint" />
        ))}
      </div>

      {/* Scan sweep */}
      {animated && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-10 bg-linear-to-b from-transparent via-accent/8 to-transparent"
          initial={{ top: '-20%' }}
          animate={{ top: ['-20%', '110%'] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }}
        />
      )}
    </div>
  );
}

function TeaserWindow({
  title,
  className,
  appearAt,
  animated,
  children,
}: {
  title: string;
  className?: string;
  /** Point in the cycle (0–1) where the window opens. */
  appearAt: number;
  animated: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={cn(
        'absolute overflow-hidden rounded-[5px] border border-line-strong bg-ink-850/95 shadow-e2',
        className
      )}
      initial={animated ? { opacity: 0, scale: 0.85 } : false}
      animate={animated ? { opacity: [0, 0, 1, 1, 0], scale: [0.85, 0.85, 1, 1, 0.96] } : undefined}
      transition={
        animated
          ? { duration: CYCLE, times: [0, appearAt, appearAt + 0.05, 0.92, 1], repeat: Infinity, ease: 'easeOut' }
          : undefined
      }
    >
      <div className="flex h-3 items-center gap-[3px] border-b border-line bg-surface-2 px-1.5">
        <span className="size-1 rounded-full bg-fg-faint" />
        <span className="size-1 rounded-full bg-fg-faint" />
        <span className="size-1 rounded-full bg-fg-faint" />
        <span className="ml-1 truncate font-mono text-[6px] text-fg-muted">{title}</span>
      </div>
      <div className="p-1.5">{children}</div>
    </motion.div>
  );
}
