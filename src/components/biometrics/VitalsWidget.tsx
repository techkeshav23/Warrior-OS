// ═══════════════════════════════════════════════════════════
// WARRIOR OS — VitalsWidget (FORGE HUD)
// Draggable riveted armor-window HUD with 4 semantic vital bars (Energy,
// Focus, Fatigue, Stress). Values arrive every ~5 s from the
// biometrics store; bars glide smoothly and pulse-glow on a >20-point
// jump. Collapsible, remembers where you dragged it, and opens the
// weekly biometric history in a dialog.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence, useMotionValue, useReducedMotion } from 'framer-motion';
import {
  Activity,
  BatteryLow,
  ChevronDown,
  ChevronUp,
  Crosshair,
  GripHorizontal,
  HeartPulse,
  History,
  Keyboard,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { WorkspaceLayer } from '@/components/ghost/WorkspaceLayer';
import { BiometricHistory } from './BiometricHistory';
import type { BiometricChannel } from '@/types/biometrics';

interface VitalConfig {
  key: BiometricChannel;
  label: string;
  icon: LucideIcon;
  /** Semantic fill (token var) + matching text class. */
  color: string;
  text: string;
}

const VITALS: VitalConfig[] = [
  { key: 'energy', label: 'Energy', icon: Zap, color: 'var(--color-plasma-400)', text: 'text-plasma-400' },
  { key: 'focus', label: 'Focus', icon: Crosshair, color: 'var(--color-success)', text: 'text-success' },
  { key: 'fatigue', label: 'Fatigue', icon: BatteryLow, color: 'var(--color-warning)', text: 'text-warning' },
  { key: 'stress', label: 'Stress', icon: HeartPulse, color: 'var(--color-danger)', text: 'text-danger' },
];

/** A reading older than this is shown as "idle". */
const LIVE_WINDOW_MS = 15_000;
/** Same column width as the desktop widgets below it. */
const WIDGET_WIDTH = 240;
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
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-fg-muted">
          <Icon size={14} strokeWidth={1.9} aria-hidden className={config.text} />
          <span>{config.label}</span>
        </span>
        <span className="tabular font-mono font-medium text-fg">{Math.round(value)}%</span>
      </div>
      <div
        className="relative h-2 w-full overflow-hidden bg-steel-950 shadow-[inset_0_1px_0_rgb(0_0_0/0.7),inset_0_-1px_0_rgb(255_255_255/0.07)] [clip-path:polygon(3px_0,100%_0,calc(100%-3px)_100%,0_100%)]"
        role="meter"
        aria-label={config.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <motion.div
          className="h-full"
          style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${config.color} 65%, transparent), ${config.color})` }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
        {pulse > 0 && (
          <motion.span
            key={pulse}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: `inset 0 0 8px 2px color-mix(in srgb, ${config.color} 80%, transparent)` }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        )}
      </div>
    </div>
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
  const reduceMotion = useReducedMotion();

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

  // Rendered inside the workspace face (WorkspaceLayer): above the desktop
  // icons, below every app window, like the other desktop widgets.
  return (
    <>
      <WorkspaceLayer>
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
              'armor-window rivets group pointer-events-auto absolute cursor-grab select-none active:cursor-grabbing [--cut:12px] [--rivet-inset:6px]',
              'transition-[box-shadow] duration-180 ease-out-quint active:ember-edge',
              className
            )}
            style={{ top: ANCHOR_TOP, right: ANCHOR_RIGHT, width: WIDGET_WIDTH, x, y }}
            whileDrag={reduceMotion ? undefined : { scale: 1.015 }}
          >
            {/* Header / drag handle */}
            <div className="flex h-10 items-center justify-between gap-2 pl-4 pr-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <Activity size={14} strokeWidth={1.9} aria-hidden className="shrink-0 text-accent" />
                <span className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Vitals</span>
                <Badge tone={isLive ? 'success' : 'neutral'} size="sm" dot pulse={isLive}>
                  {isLive ? 'Live' : 'Idle'}
                </Badge>
              </span>
              <span className="flex shrink-0 items-center">
                <GripHorizontal
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden
                  className="mr-0.5 text-fg-faint opacity-0 transition-opacity duration-120 group-hover:opacity-100"
                />
                <IconButton
                  icon={History}
                  size="xs"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setHistoryOpen(true)}
                  aria-label="Open biometric history"
                  tooltip="Weekly focus pattern"
                  tooltipSide="bottom"
                />
                <IconButton
                  icon={collapsed ? ChevronDown : ChevronUp}
                  size="xs"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setCollapsed(!collapsed)}
                  aria-label={collapsed ? 'Expand vitals' : 'Collapse vitals'}
                />
              </span>
            </div>

            {collapsed ? (
              <div className="grid grid-cols-4 gap-1 px-3 pb-3">
                {VITALS.map((v) => {
                  const Icon = v.icon;
                  return (
                    <span
                      key={v.key}
                      className="chamfer-xs bevel flex items-center justify-center gap-1 bg-steel-900 py-1 font-mono text-xs"
                      title={v.label}
                    >
                      <Icon size={12} strokeWidth={2} aria-hidden className={v.text} />
                      <span className="tabular text-fg">{Math.round(current[v.key])}</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 pb-3">
                <div className="flex flex-col gap-3">
                  {VITALS.map((v) => (
                    <VitalBar key={v.key} config={v} value={current[v.key]} />
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 font-mono text-2xs text-fg-subtle">
                  {lastUpdated === null ? (
                    <span className="flex items-center gap-1.5">
                      <Keyboard size={12} strokeWidth={2} aria-hidden />
                      Type to read your state…
                    </span>
                  ) : (
                    <>
                      <span className="tabular">
                        <span className="text-fg-muted">{metrics.wpm}</span> wpm
                      </span>
                      <span className="tabular">
                        <span className="text-fg-muted">{metrics.errorRate}%</span> fixes
                      </span>
                      <span className="tabular">
                        <span className="text-fg-muted">{metrics.pauseAvg}</span> ms gap
                      </span>
                    </>
                  )}
                </div>

                <AnimatePresence>
                  {streak && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-1.5 text-center text-xs font-medium text-success"
                    >
                      {streak}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </WorkspaceLayer>

      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Biometric history"
        description="Hourly averages of your typing rhythm: when you focus best."
        icon={History}
        size="xl"
        className="h-[min(680px,88vh)]"
      >
        <BiometricHistory />
      </Dialog>
    </>
  );
}

export const VitalsWidget = memo(VitalsWidgetInner);
