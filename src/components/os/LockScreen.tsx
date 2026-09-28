// ═══════════════════════════════════════════════════════════
// WARRIOR OS — LockScreen Component
// Parallax lock screen with biometric-style unlock animation,
// live clock and current weather (fails silently when offline).
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Shield, Zap } from 'lucide-react';
import { useParallax } from '@/hooks/useParallax';
import { useClock } from '@/hooks/useClock';
import { GlitchText } from '@/components/ui/GlitchText';
import { WeatherIcon } from '@/components/apps/weather/WeatherIcon';
import { getQuoteOfDay } from '@/data/quotes';
import { useXPStore } from '@/stores/useXPStore';
import { getLocalWeather, type WeatherData } from '@/lib/weather';
import { cn } from '@/lib/utils';
import { CreatureLockBadge } from '@/components/creature';

interface LockScreenProps {
  onUnlock: () => void;
}

// ─── Clock: ticks every second without re-rendering the whole screen ───
function LockClockInner() {
  const clock = useClock();
  return (
    <>
      <h1 className="text-7xl font-display font-bold text-text-primary tracking-wider">
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

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState(false);
  const [shattered, setShattered] = useState(false);

  const parallax = useParallax(0.3);
  const level = useXPStore((s) => s.level);
  const levelTitle = useXPStore((s) => s.getLevelTitle());
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

  const handleUnlock = useCallback(() => {
    setIsUnlocking(true);
    setError(false);

    // Biometric scan simulation
    setTimeout(() => {
      setShattered(true);
      setTimeout(() => {
        onUnlock();
      }, 800);
    }, 1200);
  }, [onUnlock]);

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

          {/* ─── Layer 2: Main Content ─── */}
          <motion.div
            className="relative z-10 flex flex-col items-center gap-6"
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

              {/* Avatar */}
              <div className="relative w-24 h-24 rounded-full bg-surface border-2 border-accent-primary/40 flex items-center justify-center overflow-hidden">
                <Shield className="w-10 h-10 text-accent-primary" />
              </div>

              {/* Level badge */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-accent-primary/20 border border-accent-primary/40 rounded-full px-3 py-0.5">
                <span className="text-xs font-mono text-accent-primary font-bold">
                  Lv.{level}
                </span>
              </div>
            </motion.div>

            {/* Name */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center"
            >
              <GlitchText
                text="WARRIOR"
                className="text-xl font-display font-bold text-accent-primary"
                intensity="low"
              />
              <p className="text-text-muted text-xs font-mono mt-1">
                {levelTitle}
              </p>
              <CreatureLockBadge className="mt-2" />
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
                    onClick={handleUnlock}
                    className="text-text-muted text-xs font-mono hover:text-accent-primary transition-colors"
                  >
                    Click or press Enter to unlock
                  </button>
                </>
              ) : (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2"
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
                      <Zap className="w-6 h-6 text-accent-primary animate-pulse" />
                    </div>
                  </div>
                  <span className="text-xs font-mono text-accent-primary animate-pulse">
                    Authenticating...
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* Quote */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-text-muted text-xs font-mono text-center max-w-sm mt-4 italic"
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
