// ═══════════════════════════════════════════════════════════
// WARRIOR OS — VitalsWidget
// Draggable glass HUD with 4 color-coded vital bars (Energy, Focus,
// Fatigue, Stress). Values arrive every ~5 s from the biometrics
// store; bars spring smoothly and pulse-glow on a >20-point jump.
// Collapsible, remembers where you dragged it, and opens the
// weekly biometric history.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { Activity, ChevronDown, ChevronUp, History, X, GripHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { BiometricHistory } from './BiometricHistory';
import type { BiometricChannel } from '@/types/biometrics';

interface VitalConfig {
  key: BiometricChannel;
  label: string;
  icon: string;
  bar: string; // fill color (hex)
  track: string; // lighter step of the same hue for the unfilled track
  glow: string;
}

const VITALS: VitalConfig[] = [
  { key: 'energy', label: 'Energy', icon: '⚡', bar: '#00f0ff', track: 'rgba(0,240,255,0.12)', glow: 'rgba(0,240,255,0.75)' },
  { key: 'focus', label: 'Focus', icon: '🎯', bar: '#00e676', track: 'rgba(0,230,118,0.12)', glow: 'rgba(0,230,118,0.75)' },
  { key: 'fatigue', label: 'Fatigue', icon: '💤', bar: '#ffab00', track: 'rgba(255,171,0,0.12)', glow: 'rgba(255,171,0,0.75)' },
  { key: 'stress', label: 'Stress', icon: '😤', bar: '#ff1744', track: 'rgba(255,23,68,0.12)', glow: 'rgba(255,23,68,0.75)' },
];

/** A reading older than this is shown as "idle". */
const LIVE_WINDOW_MS = 15_000;
const WIDGET_WIDTH = 232;
const ANCHOR_TOP = 80;
const ANCHOR_RIGHT = 24;

const noopSubscribe = () => () => {};
/** Hydration-safe "are we on the client" flag. */
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Re-render on an interval so relative times stay fresh. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatMinutes(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function VitalBar({ config, value }: { config: VitalConfig; value: number }) {
  // Derive the pulse from the value transition during render (no effect).
  const [prevValue, setPrevValue] = useState(value);
  const [pulse, setPulse] = useState(0);
  if (prevValue !== value) {
    setPrevValue(value);
    if (Math.abs(value - prevValue) > 20) setPulse((p) => p + 1);
  }
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden>{config.icon}</span>
          <span>{config.label}</span>
        </span>
        <span className="font-mono font-semibold text-text-primary">{Math.round(value)}%</span>
      </div>
      <div
        className="relative h-2 w-full rounded-full"
        style={{ background: config.track }}
        role="meter"
        aria-label={config.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: config.bar }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
        {pulse > 0 && (
          <motion.span
            key={pulse}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 12px 3px ${config.glow}` }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
  );
}

function HistoryPanel({ onClose }: { onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 'var(--z-modal)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-label="Biometric history"
        className="relative flex h-[min(560px,85vh)] w-[min(680px,94vw)] flex-col overflow-hidden rounded-xl border border-white/10"
        style={{ background: 'rgba(12, 12, 20, 0.95)', backdropFilter: 'blur(20px)' }}
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <History size={14} className="text-accent-primary" />
            Biometric History
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-text-primary"
            aria-label="Close biometric history"
          >
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <BiometricHistory />
        </div>
      </motion.div>
    </motion.div>
  );
}

function VitalsWidgetInner({ className }: { className?: string }) {
  const isClient = useIsClient();
  const enabled = useSettingsStore((s) => s.biometricsEnabled);
  const current = useBiometricsStore((s) => s.current);
  const metrics = useBiometricsStore((s) => s.metrics);
  const lastUpdated = useBiometricsStore((s) => s.lastUpdated);
  const flowSince = useBiometricsStore((s) => s.flowSince);
  const calmSince = useBiometricsStore((s) => s.calmSince);
  const collapsed = useBiometricsStore((s) => s.widgetCollapsed);
  const setCollapsed = useBiometricsStore((s) => s.setWidgetCollapsed);
  const setOffset = useBiometricsStore((s) => s.setWidgetOffset);
  const now = useNow(5_000);

  const constraintsRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Start from the remembered drag offset, clamped to the current viewport.
  const [initialOffset] = useState(() => {
    const stored = useBiometricsStore.getState().widgetOffset;
    if (typeof window === 'undefined') return stored;
    const maxLeft = window.innerWidth - WIDGET_WIDTH - ANCHOR_RIGHT;
    const maxDown = window.innerHeight - ANCHOR_TOP - 120;
    return {
      x: Math.max(-maxLeft, Math.min(ANCHOR_RIGHT - 8, stored.x)),
      y: Math.max(-ANCHOR_TOP + 8, Math.min(maxDown, stored.y)),
    };
  });
  const x = useMotionValue(initialOffset.x);
  const y = useMotionValue(initialOffset.y);

  if (!isClient || !enabled) return null;

  const isLive = lastUpdated !== null && now - lastUpdated <= LIVE_WINDOW_MS;
  const streak =
    flowSince !== null
      ? `In the zone · ${formatMinutes(now - flowSince)}`
      : calmSince !== null
        ? `Calm · ${formatMinutes(now - calmSince)}`
        : null;

  return (
    <>
      <div
        ref={constraintsRef}
        className="pointer-events-none fixed left-0 right-0 top-0 bottom-12"
        style={{ zIndex: 40 }}
      >
        <motion.div
          drag
          dragConstraints={constraintsRef}
          dragMomentum={false}
          dragElastic={0.04}
          onDragEnd={() => setOffset({ x: x.get(), y: y.get() })}
          className={cn(
            'glass glass-border pointer-events-auto absolute select-none rounded-xl shadow-lg',
            collapsed ? 'px-3 py-2' : 'p-3',
            className
          )}
          style={{ top: ANCHOR_TOP, right: ANCHOR_RIGHT, width: WIDGET_WIDTH, x, y }}
          whileDrag={{ scale: 1.02 }}
        >
          {/* Header / drag handle */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-text-primary">
              <GripHorizontal size={13} className="shrink-0 cursor-grab text-text-muted" />
              <Activity size={13} className="shrink-0 text-accent-primary" />
              Vitals
              <span
                className={cn(
                  'ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-medium uppercase tracking-wide',
                  isLive ? 'bg-accent-success/15 text-text-primary' : 'bg-white/5 text-text-muted'
                )}
              >
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', isLive ? 'bg-accent-success' : 'bg-text-muted')}
                  aria-hidden
                />
                {isLive ? 'live' : 'idle'}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setHistoryOpen(true)}
                className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-text-primary"
                aria-label="Open biometric history"
                title="Weekly focus pattern"
              >
                <History size={13} />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setCollapsed(!collapsed)}
                className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-text-primary"
                aria-label={collapsed ? 'Expand vitals' : 'Collapse vitals'}
              >
                {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              </button>
            </span>
          </div>

          {collapsed ? (
            <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-text-primary">
              {VITALS.map((v) => (
                <span key={v.key} className="flex items-center gap-1" title={v.label}>
                  <span aria-hidden>{v.icon}</span>
                  {Math.round(current[v.key])}
                </span>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {VITALS.map((v) => (
                  <VitalBar key={v.key} config={v} value={current[v.key]} />
                ))}
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2 font-mono text-[10px] text-text-muted">
                {lastUpdated === null ? (
                  <span>Start typing to read your state…</span>
                ) : (
                  <>
                    <span>{metrics.wpm} wpm</span>
                    <span>{metrics.errorRate}% fixes</span>
                    <span>{metrics.pauseAvg} ms gap</span>
                  </>
                )}
              </div>

              <AnimatePresence>
                {streak && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1.5 text-center text-[10px] font-medium text-text-secondary"
                  >
                    {streak}
                  </motion.p>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {historyOpen && <HistoryPanel key="bio-history" onClose={() => setHistoryOpen(false)} />}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

export const VitalsWidget = memo(VitalsWidgetInner);
