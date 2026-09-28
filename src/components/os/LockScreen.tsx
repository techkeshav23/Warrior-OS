// ═══════════════════════════════════════════════════════════
// WARRIOR OS — LockScreen Component
// FORGE HUD lock screen over the Deep Space wallpaper: display clock
// and date, a status strip (level, streak, weather), and a glass unlock
// card with the owner's identity. Two ways in:
//   • owner  — type a password + Enter (any password unlocks)
//   • guest  — "Explore as Guest" for portfolio visitors
// Both run the same scan → exit cinematic and record the visitor mode.
//
// Test hooks: [data-lock-screen] (data-state="locked|unlocking",
// data-visitor-mode once chosen), [data-testid="lock-password"],
// [data-testid="lock-unlock"], [data-testid="lock-guest"].
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, Eye, Flame, Lock, ScanFace, ShieldCheck, Sparkles } from 'lucide-react';
import { WeatherIcon } from '@/components/apps/weather/WeatherIcon';
import { getQuoteOfDay } from '@/data/quotes';
import { useXPStore } from '@/stores/useXPStore';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { getLocalWeather, type WeatherData } from '@/lib/weather';
import { useLiteMode } from '@/lib/lite-mode';
import { cn } from '@/lib/utils';
import { OWNER } from '@/config/owner';
import { setVisitorMode, type VisitorMode } from '@/lib/visitor';
import { OwnerAvatar } from '@/components/showcase/OwnerCard';
import { BrandMark } from '@/components/showcase/BrandMark';
import { useHabits } from '@/components/widgets/hooks';
import { computeStreak, utcDayKey } from '@/components/widgets/widget-data';

// The creature sprite (canvas painters) is a lazy client-only chunk; the
// creature barrel would also drag the stats popup and recharts into the
// bundle that paints boot and lock.
const CreatureLockBadge = dynamic(
  () => import('@/components/creature/CreatureStatusBadges').then((m) => m.CreatureLockBadge),
  { ssr: false }
);

interface LockScreenProps {
  /** Called when the unlock cinematic ends, with the mode the visitor chose. */
  onUnlock: (mode: VisitorMode) => void;
}

// Unlock cinematic timing (ms): biometric scan, then the exit.
const SCAN_MS = 1200;
const SHATTER_MS = 800;

const EASE = [0.16, 1, 0.3, 1] as const;

/** Calms the centre column over the wallpaper. */
const SCRIM =
  'radial-gradient(ellipse 60% 58% at 50% 50%, color-mix(in oklab, var(--color-ink-950) 58%, transparent), color-mix(in oklab, var(--color-ink-950) 22%, transparent) 60%, transparent 85%)';

// ─── Clock: ticks on its own, without re-rendering the whole screen ───
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function LockClockInner() {
  const now = useNow(1000);
  const hours = now.getHours();
  const h12 = hours % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const period = hours < 12 ? 'AM' : 'PM';
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayMonth = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.22em] text-fg-muted">
        {weekday}
        <span className="mx-2 text-fg-faint">/</span>
        {dayMonth}
      </p>
      <h1
        className={cn(
          'mt-3 flex items-start font-display font-medium leading-none text-fg tabular',
          'text-[112px] tracking-[-0.02em] [@media(max-height:760px)]:text-[84px]'
        )}
        style={{ textShadow: '0 2px 40px color-mix(in oklab, var(--color-ink-950) 60%, transparent)' }}
        aria-label={`${h12}:${minutes} ${period}`}
      >
        <span>{h12}</span>
        <span className="mx-1 text-fg-muted/70">:</span>
        <span>{minutes}</span>
        <span className="ml-3 mt-3 font-mono text-sm font-medium tracking-[0.16em] text-fg-subtle">{period}</span>
      </h1>
    </div>
  );
}

const LockClock = memo(LockClockInner);

// ─── Status strip: level, streak, weather ───
const CHIP =
  'inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border border-line-strong bg-ink-950/55 px-2.5 text-xs text-fg-muted backdrop-blur-md lite:backdrop-blur-none';

function LockStatusInner() {
  const level = useXPStore((s) => s.level);
  const levelTitle = useXPStore((s) => s.getLevelTitle());
  const habits = useHabits();
  const [dayKey] = useState(() => utcDayKey(Date.now()));
  const streak = useMemo(() => computeStreak(habits, Date.parse(`${dayKey}T12:00:00Z`)).current, [habits, dayKey]);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Never prompts for location (uses a saved city or an existing
  // permission, else the default city); silently absent when offline.
  useEffect(() => {
    const controller = new AbortController();
    getLocalWeather({ allowPrompt: false, signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setWeather(data);
      })
      .catch(() => {
        /* lock screen fails silently: no key, offline, rate-limited... */
      });
    return () => controller.abort();
  }, []);

  return (
    <ul className="flex h-7 flex-wrap items-center justify-center gap-2" aria-label="Status">
      <li className={CHIP} title={`Level ${level} · ${levelTitle}`}>
        <Sparkles className="size-3.5 text-gold" strokeWidth={1.75} aria-hidden />
        <span className="font-mono font-medium text-fg tabular">Lv {level}</span>
        <span className="text-fg-subtle">{levelTitle}</span>
      </li>
      {streak > 0 && (
        <li className={CHIP} title={`${streak}-day streak`}>
          <Flame className="size-3.5 text-ember-400" strokeWidth={1.75} aria-hidden />
          <span className="font-mono font-medium text-fg tabular">{streak}</span>
          <span className="text-fg-subtle">day streak</span>
        </li>
      )}
      <AnimatePresence>
        {weather && (
          <motion.li
            key="weather"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: EASE }}
            className={cn(CHIP, 'max-w-[18rem]')}
            title={weather.description}
          >
            <WeatherIcon code={weather.icon} className="size-4 shrink-0" />
            <span className="font-mono font-medium text-fg tabular">{weather.temp}°</span>
            <span className="truncate capitalize text-fg-subtle">
              {weather.condition} · {weather.city}
            </span>
          </motion.li>
        )}
      </AnimatePresence>
    </ul>
  );
}

const LockStatus = memo(LockStatusInner);

// ─── Unlocking: scan ring + progress over SCAN_MS ───
function UnlockProgress({ mode }: { mode: VisitorMode }) {
  const guest = mode === 'guest';
  const Icon = guest ? ScanFace : ShieldCheck;
  return (
    <motion.div
      key="unlocking"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: EASE }}
      className="flex h-full flex-col items-center justify-center gap-4 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex size-16 items-center justify-center">
        <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="29" fill="none" stroke="var(--color-line-strong)" strokeWidth="2" />
          <motion.circle
            cx="32"
            cy="32"
            r="29"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: SCAN_MS / 1000, ease: [0.45, 0, 0.2, 1] }}
          />
        </svg>
        <span className="absolute inset-2 rounded-full bg-accent/10 motion-safe:animate-pulse-soft" aria-hidden />
        <Icon className="relative size-6 text-accent" strokeWidth={1.75} aria-hidden />
      </div>
      <div>
        <p className="text-sm font-medium text-fg">{guest ? 'Opening guest session…' : 'Authenticating…'}</p>
        <p className="mt-1 hud-label">{guest ? 'Preparing demo workspace' : 'Verifying owner signature'}</p>
      </div>
    </motion.div>
  );
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [unlockMode, setUnlockMode] = useState<VisitorMode | null>(null);
  const [error, setError] = useState(false);
  const [shattered, setShattered] = useState(false);
  const isUnlocking = unlockMode !== null;

  const lite = useLiteMode();
  const reduced = useReducedMotion() ?? false;
  // The creature exists once it was born on a first desktop session.
  const creatureKnown = useCreatureStore((s) => s.lastSyncedUserXP !== null);
  const [quote] = useState(getQuoteOfDay);
  const rootRef = useRef<HTMLDivElement>(null);

  // Pointer parallax through CSS variables (--lx / --ly, -1…1): no React
  // re-render per move. Unset (lite mode, reduced motion) → no offset.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || lite || reduced) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const onMove = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth) * 2 - 1;
      y = (e.clientY / window.innerHeight) * 2 - 1;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty('--lx', x.toFixed(3));
        root.style.setProperty('--ly', y.toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [lite, reduced]);

  // Guards against double unlocks (Enter mashing, Enter + click) and
  // cancels the cinematic if the lock screen unmounts mid-way.
  const unlockStartedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const beginUnlock = useCallback(
    (mode: VisitorMode) => {
      if (unlockStartedRef.current) return;
      unlockStartedRef.current = true;
      setVisitorMode(mode);
      setUnlockMode(mode);
      setError(false);

      // Biometric scan simulation
      timersRef.current.push(
        setTimeout(() => {
          setShattered(true);
          timersRef.current.push(setTimeout(() => onUnlock(mode), SHATTER_MS));
        }, SCAN_MS)
      );
    },
    [onUnlock]
  );

  // Owner path: any password unlocks.
  const handleUnlock = useCallback(() => beginUnlock('owner'), [beginUnlock]);
  const handleGuest = useCallback(() => beginUnlock('guest'), [beginUnlock]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleUnlock();
      }
    },
    [handleUnlock]
  );

  const rise = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2, delay } }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: EASE },
        };

  return (
    <AnimatePresence>
      {!shattered ? (
        <motion.div
          ref={rootRef}
          className="fixed inset-0 overflow-hidden bg-ink-950 text-fg"
          style={{ zIndex: 'var(--z-boot)' }}
          data-lock-screen=""
          data-state={isUnlocking ? 'unlocking' : 'locked'}
          data-visitor-mode={unlockMode ?? undefined}
          exit={{
            scale: 1.04,
            opacity: 0,
            filter: 'blur(8px)',
          }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          {/* ─── Wallpaper: Deep Space, with a gentle two-depth parallax ─── */}
          <div
            className="wos-deep-space"
            aria-hidden="true"
            style={{ '--wp-mx': 'var(--lx, 0)', '--wp-my': 'var(--ly, 0)' } as CSSProperties}
          >
            <div className="wos-deep-space__aurora" />
            <div className="wos-deep-space__field" />
          </div>
          {/* Legibility scrim: calm the centre column, deepen the edges */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-ink-950/70 to-transparent" />

          {/* ─── Top bar: system mark + visitor note ─── */}
          <motion.header
            {...rise(0.15)}
            className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5"
          >
            <div className="flex items-center gap-3">
              <BrandMark size={28} />
              <div className="leading-tight">
                <p className="font-display text-xs font-semibold tracking-[0.28em] text-fg">WARRIOR OS</p>
                <p className="mt-0.5 hud-label">{OWNER.shortName}&apos;s system · v4.0</p>
              </div>
            </div>
            <p className="hidden items-center gap-2 font-mono text-2xs uppercase tracking-[0.14em] text-fg-subtle sm:flex">
              <span className="size-1.5 rounded-full bg-success motion-safe:animate-pulse-soft" aria-hidden />
              Secure session · local only
            </p>
          </motion.header>

          {/* ─── Centre column ─── */}
          <div
            className={cn(
              'relative z-10 flex h-full flex-col items-center justify-center gap-8 px-4',
              '[@media(max-height:760px)]:gap-5'
            )}
            style={{ transform: 'translate3d(calc(var(--lx, 0) * 4px), calc(var(--ly, 0) * 3px), 0)' }}
          >
            <motion.div {...rise(0.1)} className="flex flex-col items-center gap-5 [@media(max-height:760px)]:gap-3">
              <LockClock />
              <LockStatus />
            </motion.div>

            {/* ─── Unlock card ─── */}
            <motion.section
              {...rise(0.25)}
              aria-label={`Sign in to ${OWNER.shortName}'s system`}
              className="relative w-full max-w-[380px] rounded-sheet glass-window hud-corners p-6 [@media(max-height:760px)]:p-5"
              style={{ '--hud-corner-inset': '8px' } as CSSProperties}
            >
              {/* Owner identity */}
              <div className="flex items-center gap-4">
                <OwnerAvatar size="md" />
                <div className="min-w-0 flex-1">
                  <p className="hud-label">System owner</p>
                  <p className="mt-0.5 truncate text-lg font-semibold text-fg" title={OWNER.name}>
                    {OWNER.name}
                  </p>
                  <p className="truncate text-xs text-fg-subtle" title={OWNER.tagline}>
                    <span className="font-mono text-accent">@{OWNER.handle}</span>
                    {OWNER.tagline && <span> · {OWNER.tagline}</span>}
                  </p>
                </div>
              </div>
              {/* Creature badge: its row is reserved up front, so nothing
                  shifts when the lazy sprite chunk arrives. */}
              {creatureKnown && (
                <div className="mt-3 flex min-h-6 items-center">
                  <CreatureLockBadge />
                </div>
              )}

              <div className="mt-5 h-px bg-line" aria-hidden />

              {/* Password / guest — or the scan while unlocking (same height: no jump) */}
              <div className="mt-5 min-h-[164px]">
                <AnimatePresence mode="wait" initial={false}>
                  {!isUnlocking ? (
                    <motion.div
                      key="form"
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="flex flex-col"
                    >
                      <div
                        className={cn(
                          'group relative flex h-11 items-center rounded-card border bg-ink-950/60',
                          'transition-[border-color,box-shadow] duration-120 ease-out-quint',
                          'focus-within:border-accent/70 focus-within:ring-3 focus-within:ring-accent/15',
                          error ? 'border-danger/60 animate-shake' : 'border-line-strong hover:border-fg-faint'
                        )}
                      >
                        <Lock
                          className="pointer-events-none absolute left-3.5 size-4 text-fg-subtle transition-colors duration-120 group-focus-within:text-accent"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Password"
                          aria-label={`Password for ${OWNER.name}`}
                          aria-invalid={error || undefined}
                          data-testid="lock-password"
                          className={cn(
                            'h-full w-full min-w-0 rounded-card bg-transparent pl-10 pr-12 text-sm text-fg',
                            'placeholder:text-fg-subtle outline-none focus-visible:outline-none'
                          )}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleUnlock}
                          data-testid="lock-unlock"
                          aria-label="Unlock"
                          title="Unlock (Enter)"
                          className={cn(
                            'absolute right-1.5 flex size-8 items-center justify-center rounded-control',
                            'bg-accent text-accent-fg inset-shadow-[0_1px_0_rgb(255_255_255/0.28)]',
                            'transition-[filter,box-shadow] duration-120 ease-out-quint',
                            'hover:brightness-110 hover:shadow-glow active:brightness-95 focus-ring'
                          )}
                        >
                          <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                      <p className="mt-2 flex items-center justify-between text-xs text-fg-subtle">
                        <span>Owner sign-in</span>
                        <span className="flex items-center gap-1.5">
                          Press
                          <kbd className="inline-flex h-5 items-center rounded-[5px] border border-line-strong bg-surface-2 px-1.5 font-mono text-2xs text-fg-muted">
                            Enter
                          </kbd>
                        </span>
                      </p>

                      {/* Divider */}
                      <div className="my-4 flex items-center gap-3" aria-hidden>
                        <span className="h-px flex-1 bg-line" />
                        <span className="hud-label text-fg-faint">or</span>
                        <span className="h-px flex-1 bg-line" />
                      </div>

                      {/* Guest access: the portfolio visitor's way in */}
                      <button
                        type="button"
                        onClick={handleGuest}
                        data-testid="lock-guest"
                        aria-describedby="lock-guest-hint"
                        className={cn(
                          'group relative flex h-11 w-full items-center gap-3 overflow-hidden rounded-card px-3.5',
                          'border border-accent/30 bg-accent/8 text-left text-fg',
                          'transition-[background-color,border-color,box-shadow] duration-120 ease-out-quint',
                          'hover:border-accent/55 hover:bg-accent/14 hover:shadow-glow active:bg-accent/20 focus-ring'
                        )}
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-accent/15 text-accent">
                          <Eye className="size-4" strokeWidth={1.75} aria-hidden />
                        </span>
                        <span className="flex-1 text-sm font-medium">Explore as Guest</span>
                        <ArrowRight
                          className="size-4 text-accent transition-transform duration-180 ease-out-quint group-hover:translate-x-0.5"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </button>
                      <p id="lock-guest-hint" className="mt-2 text-center text-xs text-fg-subtle">
                        No password needed · everything stays in your browser
                      </p>
                    </motion.div>
                  ) : (
                    <UnlockProgress key="progress" mode={unlockMode ?? 'owner'} />
                  )}
                </AnimatePresence>
              </div>
            </motion.section>

            {/* Quote */}
            <motion.figure
              {...rise(0.5)}
              className="max-w-md text-center [@media(max-height:700px)]:hidden"
            >
              <blockquote className="text-sm text-fg-muted">&ldquo;{quote}&rdquo;</blockquote>
              <figcaption className="mt-1.5 hud-label text-fg-faint">Quote of the day</figcaption>
            </motion.figure>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
