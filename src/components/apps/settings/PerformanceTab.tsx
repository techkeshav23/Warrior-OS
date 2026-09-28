// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Performance Tab
// Lite mode: Auto / On / Off, with a live explanation of why it is (or
// is not) active on this device, and what it changes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useSettingsStore, type PerformanceMode } from '@/stores/useSettingsStore';
import {
  LITE_MAX_CPU_THREADS,
  LITE_MAX_MEMORY_GB,
  useLiteModeStatus,
  type DeviceProfile,
  type LiteModeStatus,
  type LiteSignal,
} from '@/lib/lite-mode';

const MODES: { id: PerformanceMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Decide from this device' },
  { id: 'on', label: 'On', hint: 'Always lite' },
  { id: 'off', label: 'Off', hint: 'Always full effects' },
];

const LITE_CHANGES = [
  'CSS wallpaper instead of the WebGL shader',
  'No CRT scanlines, ambient particles or cursor trail',
  'System cursor instead of the custom one',
  'No glass blur behind windows and panels',
  'No glitch or shatter transition when unlocking',
  'Walking ghost warriors, the campfire and phantom windows are hidden',
];

// Chromium caps navigator.deviceMemory at 8.
const MEMORY_CAP_GB = 8;

function formatMemory(gb: number): string {
  return gb >= MEMORY_CAP_GB ? `${MEMORY_CAP_GB} GB or more` : `${gb} GB`;
}

/** "this device reports 4 GB of memory and 4 CPU threads, and your system asks for reduced motion" */
function describeSignals(signals: LiteSignal[], device: DeviceProfile): string {
  const hardware: string[] = [];
  if (signals.includes('memory') && device.memoryGB !== null) {
    hardware.push(`${formatMemory(device.memoryGB)} of memory`);
  }
  if (signals.includes('cpu') && device.cpuThreads !== null) {
    hardware.push(`${device.cpuThreads} CPU thread${device.cpuThreads === 1 ? '' : 's'}`);
  }
  const clauses: string[] = [];
  if (hardware.length > 0) clauses.push(`this device reports ${hardware.join(' and ')}`);
  if (signals.includes('reduced-motion')) clauses.push('your system asks for reduced motion');
  return clauses.join(', and ');
}

function explain({ mode, active, signals, device }: LiteModeStatus): { headline: string; note?: string } {
  if (!device) return { headline: 'Checking this device…' };
  const why = describeSignals(signals, device);

  if (mode === 'on') {
    return {
      headline: 'Lite mode is active because you switched it on.',
      note: why
        ? `Auto would pick it here too, because ${why}.`
        : 'On Auto, this device would get full effects.',
    };
  }
  if (mode === 'off') {
    return {
      headline: 'Lite mode is off because you switched it off, so full effects are running.',
      note: why ? `Auto would turn it on here, because ${why}.` : undefined,
    };
  }
  return active
    ? { headline: `Lite mode is active because ${why}.` }
    : { headline: 'Lite mode is off: this device looks capable, so full effects are running.' };
}

function PerformanceTabInner() {
  const status = useLiteModeStatus();
  const setPerformanceMode = useSettingsStore((s) => s.setPerformanceMode);
  const { headline, note } = explain(status);
  const { device, signals } = status;

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-bold text-white">Performance</h3>

      {/* Mode */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Lite mode</label>
        <p className="text-[11px] text-white/40">
          A lighter profile for everyday laptops: the same apps and features, with the
          GPU-heavy effects switched off.
        </p>
        <div role="group" aria-label="Lite mode" className="grid grid-cols-3 gap-2">
          {MODES.map((m) => {
            const selected = status.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPerformanceMode(m.id)}
                className={cn(
                  'p-3 rounded-lg border text-center transition-all',
                  selected
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                )}
              >
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-[10px] text-white/40">{m.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live status */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex gap-3 rounded-lg border p-3',
          status.active ? 'border-cyan-400/30 bg-cyan-400/10' : 'border-white/10 bg-white/5'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
            status.active ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-white/30'
          )}
        />
        <div className="space-y-1">
          <p className={cn('text-sm', status.active ? 'text-cyan-100' : 'text-white/80')}>{headline}</p>
          {note && <p className="text-[11px] text-white/50">{note}</p>}
        </div>
      </div>

      {/* Device */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">This device</label>
        <div className="space-y-2 text-xs">
          <DeviceRow
            label="Memory"
            value={
              device?.memoryGB != null ? formatMemory(device.memoryGB) : 'Not reported by this browser'
            }
            trigger={signals.includes('memory')}
          />
          <DeviceRow
            label="CPU threads"
            value={device?.cpuThreads != null ? String(device.cpuThreads) : 'Not reported by this browser'}
            trigger={signals.includes('cpu')}
          />
          <DeviceRow
            label="Reduced motion"
            value={device?.reducedMotion ? 'Requested' : 'Not requested'}
            trigger={signals.includes('reduced-motion')}
          />
        </div>
        <p className="text-[11px] text-white/40">
          Auto switches lite mode on at {LITE_MAX_MEMORY_GB} GB of memory or less,{' '}
          {LITE_MAX_CPU_THREADS} CPU threads or fewer, or when your system asks for reduced
          motion.
        </p>
      </section>

      {/* What changes */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">What lite mode changes</label>
        <ul className="space-y-1.5 text-xs text-white/60">
          {LITE_CHANGES.map((change) => (
            <li key={change} className="flex gap-2">
              <span aria-hidden className="text-cyan-400/70">›</span>
              {change}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-white/40">
          Unchanged: every app, Reality Decay, the creature, NEXUS, music, achievements and
          notifications.
        </p>
      </section>
    </div>
  );
}

function DeviceRow({ label, value, trigger }: { label: string; value: string; trigger: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 p-2 rounded bg-white/5">
      <span className="text-white/50">{label}</span>
      <span className="flex items-center gap-2 text-right text-white/70">
        {value}
        {trigger && (
          <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[10px] text-cyan-300">
            Auto trigger
          </span>
        )}
      </span>
    </div>
  );
}

export const PerformanceTab = memo(PerformanceTabInner);
