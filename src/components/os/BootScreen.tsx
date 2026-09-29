// ═══════════════════════════════════════════════════════════
// WARRIOR OS — BootScreen Component
// FORGED ARMOR boot: an ember point strikes → "WARRIOR" assembles from
// particles and ember sparks → the shield mark, a mono boot log on a
// riveted forged plate with cut status tags and a slanted, heating
// segment bar → a soft bloom hands over to the lock screen. ≈5.4 s end to end (was ≈6 s).
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BOOT_MESSAGES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ParticleAssembly } from '@/components/effects/ParticleAssembly';
import { BrandMark } from '@/components/showcase/BrandMark';
import { OWNER } from '@/config/owner';

interface BootScreenProps {
  onComplete: () => void;
}

interface BootLine {
  time: string;
  message: string;
  status: string;
}

// ─── Boot log: the system messages plus the owner's signature, slotted
// in just before the final READY line. ───
function buildBootLog(): BootLine[] {
  const lines: BootLine[] = [...BOOT_MESSAGES];
  const last = lines.length - 1;
  if (last < 1) return lines;
  const time = ((parseFloat(lines[last - 1].time) + parseFloat(lines[last].time)) / 2).toFixed(3);
  lines.splice(last, 0, {
    time,
    message: `Owner signature: ${OWNER.name} (@${OWNER.handle})`,
    status: 'VERIFIED',
  });
  return lines;
}

const BOOT_LOG = buildBootLog();

// The log takes the same total time as before the owner line was added.
const LOG_TICK_MS = Math.floor((120 * BOOT_MESSAGES.length) / BOOT_LOG.length);

// Lines that fit the log panel; older lines scroll off the top.
const VISIBLE_LOG_LINES = 11;

/** Cells in the segmented progress bar. */
const SEGMENTS = 32;

const EASE = [0.16, 1, 0.3, 1] as const;

type BootPhase = 'void' | 'particle' | 'log' | 'flash' | 'done';

/** Status tag colours: OK = healthy, VERIFIED = the owner (ember), READY = the machine. */
const ENGRAVED = 'engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle';

const STATUS_TONE: Record<string, string> = {
  OK: 'text-success ring-success/30 bg-success/8',
  VERIFIED: 'text-ember-300 ring-ember-500/40 bg-ember-500/12',
  READY: 'text-accent ring-accent/40 bg-accent/12',
};

/** Faint HUD grid, fading out from the centre. */
const GRID: CSSProperties = {
  backgroundImage:
    'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
  backgroundSize: '56px 56px',
  backgroundPosition: 'center center',
  maskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, black, transparent 75%)',
  WebkitMaskImage: 'radial-gradient(ellipse 55% 50% at 50% 50%, black, transparent 75%)',
  opacity: 0.55,
};

const CORE_GLOW =
  'radial-gradient(ellipse 45% 38% at 50% 50%, color-mix(in oklab, var(--color-ember-600) 9%, transparent), transparent 70%)';

const LOG_MASK: CSSProperties = {
  maskImage: 'linear-gradient(to bottom, transparent 0, black 28px, black 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 28px, black 100%)',
};

export function BootScreen({ onComplete }: BootScreenProps) {
  const [phase, setPhase] = useState<BootPhase>('void');
  const [logIndex, setLogIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  // ─── Phase 0: Void → Particle Assembly ───
  useEffect(() => {
    const timer = setTimeout(() => setPhase('particle'), 420);
    return () => clearTimeout(timer);
  }, []);

  // ─── System Log Phase ───
  useEffect(() => {
    if (phase !== 'log') return;
    let flashTimer: ReturnType<typeof setTimeout>;

    const interval = setInterval(() => {
      setLogIndex((prev) => {
        const next = prev + 1;
        setProgress(Math.round((next / BOOT_LOG.length) * 100));
        if (next >= BOOT_LOG.length) {
          clearInterval(interval);
          flashTimer = setTimeout(() => setPhase('flash'), 360);
        }
        return next;
      });
    }, LOG_TICK_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(flashTimer);
    };
  }, [phase]);

  // ─── Flash Transition ───
  useEffect(() => {
    if (phase !== 'flash') return;
    const timer = setTimeout(() => {
      setPhase('done');
      onCompleteRef.current();
    }, 600);
    return () => clearTimeout(timer);
  }, [phase]);

  const visible = BOOT_LOG.slice(Math.max(0, logIndex - VISIBLE_LOG_LINES), logIndex);
  const current = BOOT_LOG[Math.min(logIndex, BOOT_LOG.length) - 1];
  const filled = Math.round((progress / 100) * SEGMENTS);
  const ready = progress >= 100;

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-ink-950 text-fg"
      style={{ zIndex: 'var(--z-boot)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      aria-busy={phase !== 'done'}
    >
      {/* ─── Backdrop: core glow + HUD grid ─── */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: CORE_GLOW }} />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={GRID}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'void' ? 0 : 0.55 }}
        transition={{ duration: 1.2, ease: EASE }}
      />

      {/* ─── Corner readouts ─── */}
      <AnimatePresence>
        {phase !== 'void' && (
          <motion.div
            key="corners"
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className="absolute left-6 top-5 hud-label">WOS / Boot sequence</p>
            <p className="absolute right-6 top-5 hud-label tabular">
              T+{current ? current.time : '0.000'}s
            </p>
            <p className="absolute bottom-5 left-6 hud-label text-fg-faint">Forged armor · v4.0</p>
            <p className="absolute bottom-5 right-6 hud-label text-fg-faint">
              {OWNER.shortName}&apos;s system
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Void: an ember point strikes into a hairline ─── */}
      <AnimatePresence>
        {phase === 'void' && (
          <motion.div key="void" className="absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-ember-200"
              style={{ boxShadow: '0 0 18px 2px color-mix(in oklab, var(--color-ember-400) 75%, transparent)' }}
              initial={{ width: 2, height: 2, opacity: 0 }}
              animate={{ width: [2, 4, 4, 220], height: [2, 4, 4, 1], opacity: [0, 1, 1, 0.9] }}
              transition={{ duration: 0.42, times: [0, 0.3, 0.6, 1], ease: 'easeOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Particle Assembly Phase ─── */}
      {phase === 'particle' && (
        <ParticleAssembly
          text="WARRIOR"
          from="random"
          sparkRatio={0.14}
          durationMs={1750}
          holdMs={380}
          className="absolute inset-0 w-full h-full"
          onComplete={() => setPhase('log')}
        />
      )}

      {/* ─── System Log Phase ─── */}
      <AnimatePresence>
        {(phase === 'log' || phase === 'flash') && (
          <motion.div
            key="log"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative w-full max-w-[560px] px-6"
          >
            {/* Mark + wordmark */}
            <div className="mb-7 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0.86, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <BrandMark size={52} glow />
              </motion.div>
              <p className="mt-4 font-display text-2xl font-semibold tracking-[0.34em] text-fg">
                WARRIOR<span className="ml-[0.5em] text-accent">OS</span>
              </p>
              <p className={cn('mt-2', ENGRAVED)}>v4.0 · The Living World</p>
            </div>

            {/* System log */}
            <div className="armor-drop">
            <div className="armor-panel rivets chamfer-tl-br px-5 py-3 [--cut:12px] [--rivet-inset:7px]">
              <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
                <span className={ENGRAVED}>System log</span>
                <span className="font-mono text-2xs text-fg-subtle tabular">
                  {String(Math.min(logIndex, BOOT_LOG.length)).padStart(2, '0')}/{BOOT_LOG.length}
                </span>
              </div>
              <div className="h-[220px] overflow-hidden font-mono text-xs" style={LOG_MASK}>
                <div className="flex h-full flex-col justify-end gap-0.5">
                  {visible.map((msg, i) => {
                    const latest = i === visible.length - 1;
                    return (
                      <motion.div
                        key={msg.time + msg.message}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.18, ease: EASE }}
                        className="flex h-[18px] shrink-0 items-center gap-3"
                      >
                        <span className="w-12 shrink-0 text-fg-faint tabular">{msg.time}</span>
                        <span
                          className={cn('min-w-0 flex-1 truncate', latest ? 'text-fg' : 'text-fg-muted')}
                          title={msg.message}
                        >
                          {msg.message}
                        </span>
                        <span
                          className={cn(
                            'chamfer-xs inline-flex h-4 shrink-0 items-center px-1.5 text-[10px] font-medium tracking-[0.08em] ring-1 ring-inset [--cut:3px]',
                            STATUS_TONE[msg.status] ?? STATUS_TONE.OK
                          )}
                        >
                          {msg.status}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>

            {/* Segmented progress */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className={ENGRAVED}>{ready ? 'Systems online' : 'Initializing systems'}</span>
                <span className="font-display text-sm font-semibold text-fg tabular">{progress}%</span>
              </div>
              <div
                className="flex gap-[3px]"
                role="progressbar"
                aria-label="Boot progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                {Array.from({ length: SEGMENTS }, (_, i) => {
                  const on = i < filled;
                  const edge = on && i === filled - 1 && !ready;
                  return (
                    <span
                      key={i}
                      className={cn(
                        // Slanted forged segments; lit ones show their slice of
                        // the forge-heat gradient (iron → ember → white-hot).
                        'h-2 flex-1 transition-[opacity,filter] duration-180 ease-out-quint',
                        '[clip-path:polygon(3px_0,100%_0,calc(100%-3px)_100%,0_100%)]',
                        on ? 'forge-heat' : 'bg-steel-700',
                        edge && 'brightness-125'
                      )}
                      style={
                        on
                          ? {
                              backgroundSize: `${SEGMENTS * 100}% 100%`,
                              backgroundPosition: `${(i / (SEGMENTS - 1)) * 100}% 0`,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
              <p className="mt-3 text-center text-xs text-fg-subtle">
                {ready ? (
                  <>
                    <span className="text-fg">{OWNER.shortName}&apos;s system</span> is ready
                  </>
                ) : (
                  'Loading components…'
                )}
              </p>
            </div>

            {/* Owner signature */}
            <p className="mt-8 flex items-center justify-center gap-2 font-mono text-2xs uppercase tracking-[0.18em] text-fg-faint">
              <span className="h-px w-8 bg-line-strong" aria-hidden />
              <span>
                Forged by <span className="text-fg-muted">{OWNER.name}</span>
              </span>
              <span className="size-1 rounded-full bg-ember-400" aria-hidden />
              <span className="normal-case tracking-normal text-fg-subtle">@{OWNER.handle}</span>
              <span className="h-px w-8 bg-line-strong" aria-hidden />
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Plasma bloom: hand-over to the lock screen ─── */}
      <AnimatePresence>
        {phase === 'flash' && (
          <motion.div
            key="flash"
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, var(--color-fg) 0%, color-mix(in oklab, var(--color-ember-300) 70%, transparent) 30%, color-mix(in oklab, var(--color-ink-950) 90%, transparent) 75%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ duration: 0.6, times: [0, 0.3, 1] }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
