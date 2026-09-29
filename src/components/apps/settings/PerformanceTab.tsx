// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Performance Tab
// Lite mode: Auto / On / Off, with a live explanation of why it is (or
// is not) active on this device, and what it changes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import {
  Accessibility,
  ChevronRight,
  Cpu,
  Feather,
  Gauge,
  MemoryStick,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { Badge, Card, SegmentedControl, Skeleton, renderIcon, type IconLike } from '@/components/ui';
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
import { SettingRow, SettingsCard, SettingsPage, SettingsSection } from './parts';

const MODES: { id: PerformanceMode; label: string; hint: string; icon: IconLike }[] = [
  { id: 'auto', label: 'Auto', hint: 'Auto decides from this device.', icon: Wand2 },
  { id: 'on', label: 'On', hint: 'Always lite, on any device.', icon: Feather },
  { id: 'off', label: 'Off', hint: 'Always full effects.', icon: Sparkles },
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
  const mode = MODES.find((m) => m.id === status.mode) ?? MODES[0];
  const statusIcon = !device ? Gauge : status.active ? Feather : Zap;

  return (
    <SettingsPage>
      {/* Live status */}
      <Card hud tone={status.active ? 'accent' : 'default'} role="status" aria-live="polite">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-card border',
              status.active ? 'border-accent/30 bg-accent/10 text-accent' : 'border-line-strong bg-ink-800 text-fg-muted'
            )}
          >
            {renderIcon(statusIcon, 20)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
            <p className="text-sm font-medium text-fg">{headline}</p>
            {note && <p className="text-xs text-fg-muted">{note}</p>}
          </div>
        </div>
      </Card>

      {/* Mode */}
      <SettingsSection
        title="Lite mode"
        description="A lighter profile for everyday laptops: the same apps and features, with the GPU-heavy effects switched off."
      >
        <SettingsCard>
          <SettingRow
            label="Mode"
            description={mode.hint}
            control={
              <SegmentedControl
                aria-label="Lite mode"
                value={status.mode}
                onChange={setPerformanceMode}
                options={MODES.map((m) => ({ value: m.id, label: m.label, icon: m.icon }))}
              />
            }
          />
        </SettingsCard>
      </SettingsSection>

      {/* Device */}
      <SettingsSection
        title="This device"
        description={`Auto switches lite mode on at ${LITE_MAX_MEMORY_GB} GB of memory or less, ${LITE_MAX_CPU_THREADS} CPU threads or fewer, or when your system asks for reduced motion.`}
      >
        <SettingsCard>
          <DeviceRow
            icon={MemoryStick}
            label="Memory"
            loading={!device}
            value={device?.memoryGB != null ? formatMemory(device.memoryGB) : 'Not reported by this browser'}
            trigger={signals.includes('memory')}
          />
          <DeviceRow
            icon={Cpu}
            label="CPU threads"
            loading={!device}
            value={device?.cpuThreads != null ? String(device.cpuThreads) : 'Not reported by this browser'}
            trigger={signals.includes('cpu')}
          />
          <DeviceRow
            icon={Accessibility}
            label="Reduced motion"
            loading={!device}
            value={device?.reducedMotion ? 'Requested' : 'Not requested'}
            trigger={signals.includes('reduced-motion')}
          />
        </SettingsCard>
      </SettingsSection>

      {/* What changes */}
      <SettingsSection title="What lite mode changes">
        <SettingsCard>
          <ul className="grid gap-x-6 gap-y-2.5 p-4 @xl:grid-cols-2">
            {LITE_CHANGES.map((change) => (
              <li key={change} className="flex gap-2 text-ui text-fg-muted">
                <ChevronRight size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {change}
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 px-4 py-3 text-xs text-fg-subtle">
            <ShieldCheck size={14} strokeWidth={1.75} className="mt-px shrink-0 text-success" aria-hidden />
            Unchanged: every app, Reality Decay, the creature, NEXUS, music, achievements and notifications.
          </p>
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function DeviceRow({
  icon,
  label,
  value,
  trigger,
  loading,
}: {
  icon: IconLike;
  label: string;
  value: string;
  trigger: boolean;
  loading: boolean;
}) {
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className="flex shrink-0 text-fg-subtle">{renderIcon(icon, 16)}</span>
      <span className="min-w-0 flex-1 text-ui text-fg-muted">{label}</span>
      {loading ? (
        <Skeleton className="h-3.5 w-24" />
      ) : (
        <span className="tabular flex items-center gap-2 text-right text-ui text-fg">
          {value}
          {trigger && (
            <Badge tone="accent" size="sm">
              Auto trigger
            </Badge>
          )}
        </span>
      )}
    </div>
  );
}

export const PerformanceTab = memo(PerformanceTabInner);
