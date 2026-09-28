// ═══════════════════════════════════════════════════════════
// WARRIOR OS — LockScreen Component
// Parallax lock screen with biometric-style unlock animation,
// live clock and current weather (fails silently when offline).
// Shows the machine's owner and offers two ways in:
//   • owner  — type a password + Enter (any password unlocks)
//   • guest  — "Explore as Guest" for portfolio visitors
// Both run the same unlock cinematic and record the visitor mode.
//
// Test hooks: [data-lock-screen] (data-state="locked|unlocking",
// data-visitor-mode once chosen), [data-testid="lock-password"],
// [data-testid="lock-unlock"], [data-testid="lock-guest"].
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useRef, memo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Eye, Lock, Shield, Zap } from 'lucide-react';
import { useParallax } from '@/hooks/useParallax';
import { useClock } from '@/hooks/useClock';
import { GlitchText } from '@/components/ui/GlitchText';
import { WeatherIcon } from '@/components/apps/weather/WeatherIcon';
import { getQuoteOfDay } from '@/data/quotes';
import { useXPStore } from '@/stores/useXPStore';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { getLocalWeather, type WeatherData } from '@/lib/weather';
import { cn } from '@/lib/utils';
import { OWNER } from '@/config/owner';
import { setVisitorMode, type VisitorMode } from '@/lib/visitor';
import { getOwnerInitials } from '@/components/showcase/OwnerCard';

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

// Unlock cinematic timing (ms): biometric scan, then the shatter/exit.
const SCAN_MS = 1200;
const SHATTER_MS = 800;

// ─── Clock: ticks every second without re-rendering the whole screen ───
function LockClockInner() {
  const clock = useClock();
  return (
    <>
      <h1 className="text-7xl [@media(max-height:760px)]:text-5xl font-display font-bold text-text-primary tracking-wider">
        {clock.timeShort}
      </h1>
      <p className="text-text-secondary text-sm font-mono mt-2">
        {clock.date}
      </p>
    </>
  );
}

const LockClock = memo(LockClockInner);

// ─── Weather: temp + icon. Never prompts for location (uses a saved
// city or an existing permission, else the default city) and renders
// nothing at all if the weather service is unavailable. ───
function LockWeatherInner() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

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
    <div className="h-7 mt-3 flex items-center justify-center">
      {weather && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-mono text-text-secondary max-w-[20rem]"
          title={weather.description}
        >
          <WeatherIcon code={weather.icon} className="w-4 h-4 shrink-0" />
          <span className="text-text-primary">{weather.temp}°C</span>
          <span className="capitalize truncate">{weather.condition}</span>
          <span className="truncate">· {weather.city}</span>
        </motion.div>
      )}
    </div>
  );
}

const LockWeather = memo(LockWeatherInner);

const OWNER_INITIALS = getOwnerInitials(OWNER.name);

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [unlockMode, setUnlockMode] = useState<VisitorMode | null>(null);
  const [error, setError] = useState(false);
  const [shattered, setShattered] = useState(false);
  const isUnlocking = unlockMode !== null;

  const parallax = useParallax(0.3);
  const level = useXPStore((s) => s.level);
  const levelTitle = useXPStore((s) => s.getLevelTitle());
  // The creature exists once it was born on a first desktop session.
  const creatureKnown = useCreatureStore((s) => s.lastSyncedUserXP !== null);
  const quote = getQuoteOfDay();

  // useState initializer runs exactly once — the canonical pattern for
  // generating non-deterministic initial state without violating render purity.
  const [particles] = useState(() =>
    Array.from({ length: 30 }, () => ({
      size: Math.random() * 3 + 1,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 5,
    }))
  );

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

  return (
    <AnimatePresence>
      {!shattered ? (
        <motion.div
          className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
          style={{ zIndex: 'var(--z-boot)' }}
          data-lock-screen=""
          data-state={isUnlocking ? 'unlocking' : 'locked'}
          data-visitor-mode={unlockMode ?? undefined}
          exit={{
            scale: 1.1,
            opacity: 0,
            filter: 'blur(10px)',
          }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ─── Layer 0: Background ─── */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-[#050510] via-[#0a0a20] to-[#050510]"
            style={{
              transform: `translate(${parallax.x * -10}px, ${parallax.y * -10}px) scale(1.05)`,
            }}
          />

          {/* ─── Layer 1: Floating Particles ─── */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              transform: `translate(${parallax.x * -5}px, ${parallax.y * -5}px)`,
            }}
          >
            {particles.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-accent-primary/20"
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

          {/* ─── System mark (top-left) ─── */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-6 left-6 z-10 flex items-center gap-3"
          >
            <Shield className="w-5 h-5 text-accent-primary" aria-hidden />
            <div className="leading-tight">
              <p className="font-display text-xs font-bold tracking-[0.3em] text-text-primary">
                WARRIOR OS
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {OWNER.shortName}&apos;s system · v4.0
              </p>
            </div>
          </motion.div>

          {/* ─── Layer 2: Main Content ───
              Short laptop screens (≈720p browsers) get a tighter rhythm. */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-6 [@media(max-height:760px)]:gap-4"
            style={{
              transform: `translate(${parallax.x * 3}px, ${parallax.y * 3}px)`,
            }}
          >
            {/* Time */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <LockClock />
              <LockWeather />
            </motion.div>

            {/* Avatar Ring */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', damping: 15 }}
              className="relative"
            >
              {/* Rotating ring */}
              <div className="absolute inset-0 m-auto w-28 h-28 rounded-full border-2 border-accent-primary/30 animate-spin-slow" />
              <div className="absolute inset-0 m-auto w-32 h-32 rounded-full border border-accent-primary/10 animate-spin-slow"
                style={{ animationDirection: 'reverse', animationDuration: '12s' }}
              />

              {/* Avatar: owner initials */}
              <div className="relative w-24 h-24 rounded-full bg-surface border-2 border-accent-primary/40 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(0,240,255,0.18),transparent_65%)]" />
                <span
                  className="relative font-display font-bold text-3xl tracking-wider bg-gradient-to-br from-accent-primary to-accent-secondary bg-clip-text text-transparent"
                  aria-hidden
                >
                  {OWNER_INITIALS}
                </span>
              </div>

              {/* Level badge */}
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-accent-primary/20 border border-accent-primary/40 rounded-full px-3 py-0.5"
                title={`Level ${level} · ${levelTitle}`}
              >
                <span className="text-xs font-mono text-accent-primary font-bold">
                  Lv.{level}
                </span>
              </div>
            </motion.div>

            {/* Owner */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center"
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-text-muted mb-1.5">
                System owner
              </p>
              <GlitchText
                text={OWNER.name.toUpperCase()}
                className="text-xl font-display font-bold text-accent-primary tracking-wider"
                intensity="low"
              />
              <p className="text-xs font-mono mt-1.5">
                <span className="text-accent-primary/80">@{OWNER.handle}</span>
                {OWNER.tagline && (
                  <span className="text-text-muted"> · {OWNER.tagline}</span>
                )}
              </p>
              {/* Creature badge: its row is reserved up front, so nothing
                  shifts when the lazy sprite chunk arrives. */}
              {creatureKnown && (
                <div className="mt-2 flex min-h-6 items-center justify-center">
                  <CreatureLockBadge />
                </div>
              )}
            </motion.div>

            {/* Password Input / Unlock */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col items-center gap-3"
            >
              {!isUnlocking ? (
                <>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter to unlock..."
                      aria-label={`Password for ${OWNER.name}`}
                      data-testid="lock-password"
                      className={cn(
                        'w-64 h-10 pl-10 pr-4 rounded-full',
                        'bg-white/5 border border-white/10',
                        'text-text-primary text-sm font-mono',
                        'focus:outline-none focus:border-accent-primary/40',
                        'placeholder:text-text-muted',
                        'transition-all duration-200',
                        error && 'border-accent-danger animate-shake'
                      )}
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlock}
                    data-testid="lock-unlock"
                    className="text-text-muted text-xs font-mono hover:text-accent-primary transition-colors rounded focus-ring"
                  >
                    Click or press Enter to unlock
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3 w-64" aria-hidden>
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-muted">
                      or
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
                  </div>

                  {/* Guest access: the portfolio visitor's way in */}
                  <motion.button
                    type="button"
                    onClick={handleGuest}
                    data-testid="lock-guest"
                    aria-describedby="lock-guest-hint"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      'group relative w-64 h-11 rounded-full overflow-hidden',
                      'flex items-center justify-center gap-2',
                      'border border-accent-primary/50 bg-accent-primary/10 text-accent-primary',
                      'font-display text-xs font-bold uppercase tracking-[0.2em]',
                      'shadow-[0_0_24px_rgba(0,240,255,0.15)]',
                      'hover:bg-accent-primary/20 hover:border-accent-primary hover:shadow-[0_0_32px_rgba(0,240,255,0.35)]',
                      'transition-[background-color,border-color,box-shadow] duration-200',
                      'focus-ring'
                    )}
                  >
                    {/* Light sweep */}
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                      initial={{ x: '-120%' }}
                      animate={{ x: ['-120%', '320%'] }}
                      transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut', delay: 1.4 }}
                    />
                    <Eye className="relative w-4 h-4" aria-hidden />
                    <span className="relative">Explore as Guest</span>
                    <ArrowRight
                      className="relative w-4 h-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </motion.button>
                  <p id="lock-guest-hint" className="text-[10px] font-mono text-text-muted">
                    No password needed · everything stays in your browser
                  </p>
                </>
              ) : (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2"
                  role="status"
                  aria-live="polite"
                >
                  {/* Biometric scan ring */}
                  <div className="relative w-16 h-16">
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-accent-primary"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [1, 0.3, 1],
                      }}
                      transition={{ duration: 0.8, repeat: 1 }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {unlockMode === 'guest' ? (
                        <Eye className="w-6 h-6 text-accent-primary animate-pulse" />
                      ) : (
                        <Zap className="w-6 h-6 text-accent-primary animate-pulse" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-accent-primary animate-pulse">
                    {unlockMode === 'guest' ? 'Opening guest session...' : 'Authenticating...'}
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* Quote */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-text-muted text-xs font-mono text-center max-w-sm mt-4 [@media(max-height:760px)]:mt-0 [@media(max-height:700px)]:hidden italic"
            >
              &ldquo;{quote}&rdquo;
            </motion.p>
          </motion.div>

          {/* Vignette */}
          <div className="absolute inset-0 vignette pointer-events-none" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
