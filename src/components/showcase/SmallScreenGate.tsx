// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Small Screen Gate
// Phones and narrow windows get a cinematic "desktop experience"
// screen (owner card + a lightweight animated teaser) instead of
// the full OS. "Continue anyway" is remembered for the tab.
//
//   <SmallScreenGate>{theWholeOS}</SmallScreenGate>
//
// • Renders nothing until the viewport is known (SSR + first client
//   frame), then either the gate or `children`.
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
import { ArrowRight, Check, Link2, Monitor } from 'lucide-react';
import { OWNER } from '@/config/owner';
import { GlitchText } from '@/components/ui/GlitchText';
import { cn } from '@/lib/utils';
import { OwnerCard } from './OwnerCard';

export const SMALL_SCREEN_MIN_WIDTH = 1024;
export const SMALL_SCREEN_STORAGE_KEY = 'warrior-os-small-screen-continue';

export interface SmallScreenGateProps {
  /** The OS. Rendered when the screen is big enough or after "Continue anyway". */
  children?: ReactNode;
  /** Viewports narrower than this (CSS px) see the gate. Default 1024. */
  minWidth?: number;
  /** sessionStorage key remembering "Continue anyway" for this tab. */
  storageKey?: string;
  /** Called after the visitor picks "Continue anyway". */
  onContinue?: () => void;
}

type GateState = 'pending' | 'gate' | 'pass';

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

/** True when this browser should see the gate (ignores "Continue anyway"). */
export function isSmallScreen(minWidth: number = SMALL_SCREEN_MIN_WIDTH): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < minWidth || isTouchOnlyPhone();
}

function readGateState(minWidth: number, key: string): GateState {
  if (shownThisLoad.has(key) || hasContinued(key)) return 'pass';
  return isSmallScreen(minWidth) ? 'gate' : 'pass';
}

const noopSubscribe = () => () => {};
const readHasFinePointer = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: fine)').matches;

// ─── Gate ───
export function SmallScreenGate({
  children,
  minWidth = SMALL_SCREEN_MIN_WIDTH,
  storageKey = SMALL_SCREEN_STORAGE_KEY,
  onContinue,
}: SmallScreenGateProps) {
  const state = useSyncExternalStore<GateState>(
    subscribe,
    () => readGateState(minWidth, storageKey),
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
        {state === 'gate' && (
          <SmallScreenNotice key="small-screen-gate" minWidth={minWidth} onContinue={handleContinue} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Background particles (deterministic layout, CSS animation) ───
const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const rand = (n: number) => {
    const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    size: 1 + rand(1) * 2.5,
    left: rand(2) * 100,
    top: rand(3) * 100,
    duration: 7 + rand(4) * 8,
    delay: rand(5) * 5,
  };
});

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
      data-small-screen-gate=""
      aria-labelledby="small-screen-gate-title"
      className="fixed inset-0 overflow-y-auto overscroll-contain bg-[#050510] text-text-primary"
      style={{ zIndex: 'calc(var(--z-boot) + 1)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ─── Background ─── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050510] via-[#0a0a20] to-[#050510]" />
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-accent-secondary/15 blur-3xl" />
        <div className="absolute inset-0 opacity-40 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-accent-primary/25"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              top: `${p.top}%`,
              animation: `particle-float ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ─── Content ─── */}
      <motion.div
        className="relative mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-7 px-5 py-10 text-center"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
      >
        {/* Brand */}
        <motion.div variants={itemVariants} className="flex flex-col items-center gap-1">
          <GlitchText
            text="WARRIOR OS"
            className="font-display text-lg font-bold tracking-[0.3em] text-accent-primary text-glow-sm"
            intensity="low"
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
            {OWNER.shortName}&apos;s system · v4.0
          </p>
        </motion.div>

        {/* Teaser */}
        <motion.div variants={itemVariants} className="w-full">
          <DesktopTeaser />
        </motion.div>

        {/* Message */}
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-accent-primary/30 bg-accent-primary/10">
            <Monitor className="h-5 w-5 text-accent-primary" aria-hidden />
          </div>
          <h1
            id="small-screen-gate-title"
            className="font-display text-xl font-bold leading-snug tracking-wide text-text-primary sm:text-2xl"
          >
            Warrior OS is a <span className="text-accent-primary text-glow-sm">desktop experience</span>
          </h1>
          <p className="text-sm leading-relaxed text-text-secondary">
            A full sci-fi operating system that runs in your browser: draggable windows, a
            command palette, procedural music, a digital companion and more, built for a big
            screen, a keyboard and a mouse.
          </p>
          <p className="font-mono text-xs text-accent-primary/80">
            Open it on a laptop or desktop ({minWidth}px+ wide) for the full experience.
            {canWiden && (
              <span className="mt-1 block text-text-muted">
                Or widen this window and it launches on its own.
              </span>
            )}
          </p>
        </motion.div>

        {/* Creator */}
        <motion.div variants={itemVariants} className="w-full">
          <OwnerCard layout="stacked" eyebrow="Built by" className="w-full" />
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVariants} className="flex w-full flex-col items-center gap-3">
          <div className="flex w-full flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onContinue}
              data-testid="small-screen-continue"
              className={cn(
                'group flex h-11 flex-1 items-center justify-center gap-2 rounded-full',
                'border border-accent-primary/50 bg-accent-primary/10 text-accent-primary',
                'font-display text-xs font-bold uppercase tracking-[0.2em]',
                'shadow-[0_0_24px_rgba(0,240,255,0.15)] transition-[background-color,border-color,box-shadow]',
                'hover:border-accent-primary hover:bg-accent-primary/20 active:scale-[0.98] focus-ring'
              )}
            >
              Continue anyway
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              data-testid="small-screen-copy-link"
              className={cn(
                'flex h-11 flex-1 items-center justify-center gap-2 rounded-full',
                'border border-white/10 bg-white/5 font-mono text-xs text-text-secondary',
                'transition-colors hover:border-white/25 hover:text-text-primary active:scale-[0.98] focus-ring'
              )}
            >
              {copied ? (
                <Check className="h-4 w-4 text-accent-success" aria-hidden />
              ) : (
                <Link2 className="h-4 w-4" aria-hidden />
              )}
              <span aria-live="polite">{copied ? 'Link copied' : 'Copy link for later'}</span>
            </button>
          </div>
          <p className="font-mono text-[10px] text-text-muted">
            Heads up: parts of the OS expect a keyboard and mouse.
          </p>
        </motion.div>
      </motion.div>

      {/* CRT overlays */}
      <div aria-hidden className="pointer-events-none fixed inset-0 scanlines vignette" />
    </motion.main>
  );
});

// ─── Teaser: a looping miniature of the desktop ───
// One 8s cycle: boot mark → three windows open in turn → fade → repeat.
const CYCLE = 8;

function DesktopTeaser() {
  const reduceMotion = useReducedMotion();
  const animated = !reduceMotion;

  return (
    <div
      aria-hidden
      className="relative mx-auto aspect-[16/10] w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-[#07070f] shadow-[0_0_60px_rgba(0,240,255,0.12)]"
    >
      {/* Wallpaper */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(0,240,255,0.16),transparent_55%),radial-gradient(ellipse_at_80%_75%,rgba(123,97,255,0.22),transparent_55%)]" />
      <div className="absolute inset-0 opacity-50 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:14px_14px]" />

      {/* Dynamic island */}
      <div className="absolute left-1/2 top-1.5 h-2 w-14 -translate-x-1/2 rounded-full border border-white/10 bg-black/70" />

      {/* Desktop icons */}
      <div className="absolute left-2 top-5 space-y-1.5">
        {['bg-accent-primary/40', 'bg-accent-secondary/40', 'bg-accent-success/40', 'bg-accent-warning/40'].map((c) => (
          <div key={c} className={cn('h-3 w-3 rounded-[3px] border border-white/10', c)} />
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
          <span className="font-display text-sm font-bold tracking-[0.35em] text-accent-primary text-glow">
            WARRIOR
          </span>
        </motion.div>
      )}

      {/* Windows */}
      <TeaserWindow title="Terminal" className="left-[14%] top-[17%] h-[44%] w-[46%]" appearAt={0.17} animated={animated}>
        <div className="space-y-1">
          {[0.85, 0.55, 0.7].map((w, i) => (
            <motion.div
              key={i}
              className="h-[3px] origin-left rounded-full bg-accent-success/70"
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
            <span className="h-[3px] w-2 rounded-full bg-accent-primary/80" />
            <span className="h-2 w-[3px] bg-accent-primary animate-pulse" />
          </div>
        </div>
      </TeaserWindow>

      <TeaserWindow title="WarBeats" className="right-[7%] top-[26%] h-[40%] w-[38%]" appearAt={0.33} animated={animated}>
        <div className="flex h-8 items-end justify-center gap-[3px]">
          {[0.9, 0.6, 1.1, 0.75, 1.3, 0.8, 1].map((d, i) => (
            <motion.span
              key={i}
              className="w-[4px] origin-bottom rounded-sm bg-gradient-to-t from-accent-secondary to-accent-primary"
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
            <div key={i} className="h-[3px] overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full origin-left rounded-full bg-accent-warning/80"
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
          className="absolute h-3 w-3 drop-shadow-[0_0_4px_rgba(0,240,255,0.8)]"
          initial={{ left: '70%', top: '80%', opacity: 0 }}
          animate={{
            left: ['70%', '70%', '30%', '66%', '48%', '48%'],
            top: ['80%', '80%', '26%', '36%', '70%', '70%'],
            opacity: [0, 1, 1, 1, 1, 0],
          }}
          transition={{ duration: CYCLE, times: [0, 0.12, 0.2, 0.36, 0.52, 1], repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox="0 0 12 12" className="h-full w-full">
            <path d="M1 1 L1 10 L3.8 7.4 L6 11 L7.6 10.2 L5.4 6.7 L9 6.5 Z" fill="#e4e4ef" stroke="#050510" strokeWidth="0.8" />
          </svg>
        </motion.div>
      )}

      {/* Taskbar */}
      <div className="absolute inset-x-0 bottom-0 flex h-4 items-center justify-center gap-1 border-t border-white/10 bg-black/60">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-primary shadow-[0_0_6px_rgba(0,240,255,0.9)]" />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/25" />
        ))}
      </div>

      {/* Scan sweep */}
      {animated && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-accent-primary/10 to-transparent"
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
        'absolute overflow-hidden rounded-md border border-white/10 bg-[#0d0d18]/90 shadow-[0_8px_24px_rgba(0,0,0,0.5)]',
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
      <div className="flex h-3 items-center gap-[3px] border-b border-white/5 bg-white/[0.03] px-1.5">
        <span className="h-1 w-1 rounded-full bg-accent-danger/70" />
        <span className="h-1 w-1 rounded-full bg-accent-warning/70" />
        <span className="h-1 w-1 rounded-full bg-accent-success/70" />
        <span className="ml-1 truncate font-mono text-[6px] text-text-secondary">{title}</span>
      </div>
      <div className="p-1.5">{children}</div>
    </motion.div>
  );
}
