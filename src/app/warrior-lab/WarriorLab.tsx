// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Lab (client)
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useSyncExternalStore } from 'react';
import { Activity, Flame, Hand, Shield, Swords, Trophy, Zap } from 'lucide-react';
import { Badge, Button, Card, SegmentedControl, Slider, Switch } from '@/components/ui';
import { useLiteMode } from '@/lib/lite-mode';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  WarriorStage,
  WARRIOR_MODEL_URL,
  WARRIOR_TIERS,
  playWarriorAction,
  useWarriorActionStore,
  useWarriorModel,
  useWarriorProgress,
  type WarriorAction,
  type WarriorBaseAction,
  type WarriorTier,
} from '@/components/warrior3d';

const ACTIONS: { action: WarriorAction; label: string; icon: typeof Swords }[] = [
  { action: 'idle', label: 'Idle', icon: Activity },
  { action: 'stance', label: 'Stance', icon: Shield },
  { action: 'punch', label: 'Punch', icon: Hand },
  { action: 'powerup', label: 'Power up', icon: Zap },
  { action: 'victory', label: 'Victory', icon: Trophy },
  { action: 'hurt', label: 'Hurt', icon: Swords },
];

type DecayChoice = 'live' | '0' | '2' | '3' | '5';

const noopSubscribe = () => () => {};
/** False during SSR + hydration: persisted stores may differ from the server render. */
function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const STATUS_TEXT: Record<string, string> = {
  idle: 'Checking…',
  checking: 'Checking…',
  loading: 'Loading GLB…',
  glb: 'GLB loaded',
  placeholder: 'Placeholder',
  error: 'Placeholder (GLB failed)',
};

function Readout({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <span className="hud-label">{label}</span>
      <span className="font-mono text-ui text-fg" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function WarriorLab() {
  const [tierSlider, setTierSlider] = useState(0); // 0 = live
  const [streakOn, setStreakOn] = useState(false);
  const [decay, setDecay] = useState<DecayChoice>('live');
  const [speaking, setSpeaking] = useState(false);
  const [base, setBase] = useState<WarriorBaseAction>('stance');
  const model = useWarriorModel();
  const mounted = useMounted();
  const lite = useLiteMode();
  const setPerformanceMode = useSettingsStore((s) => s.setPerformanceMode);
  const current = useWarriorActionStore((s) => s.current);

  const forceTier = tierSlider > 0 ? (tierSlider as WarriorTier) : undefined;
  const forceStreak = streakOn ? 7 : undefined;
  const forceDecay = decay === 'live' ? undefined : Number(decay);
  const overrides = { forceTier, forceStreak, forceDecay };
  const progress = useWarriorProgress(overrides);
  const live = useWarriorProgress();
  const tierMeta = WARRIOR_TIERS[progress.tier - 1];

  const stageProps = { ...overrides, speaking: speaking || undefined, baseAction: base };

  return (
    <div className="h-screen select-text overflow-y-auto overflow-x-hidden bg-ink-950 text-fg scrollbar-thin">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 size-[640px] rounded-full bg-plasma-500/[0.06] blur-[120px]" />
        <div className="absolute -bottom-60 right-0 size-[720px] rounded-full bg-ember-600/[0.07] blur-[140px]" />
      </div>

      <div className="relative mx-auto flex max-w-[1560px] flex-col gap-5 px-6 py-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="hud-label text-plasma-400">Warrior OS · 3D avatar core</p>
            <h1 className="font-display text-2xl font-semibold uppercase tracking-[0.12em]">Warrior Lab</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="model-status">
            <span className="hud-label">Model status</span>
            <Badge tone={model.status === 'glb' ? 'success' : model.pending ? 'neutral' : 'warning'}>
              {STATUS_TEXT[model.status] ?? model.status}
            </Badge>
            <span className="font-mono text-2xs text-fg-subtle">{model.detail ?? WARRIOR_MODEL_URL}</span>
          </div>
        </header>

        {lite && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/[0.06] px-4 py-2.5">
            <p className="text-ui text-fg-muted">
              Lite mode is on for this device, so every stage shows its static plate instead of WebGL.
            </p>
            <Button size="sm" variant="secondary" onClick={() => setPerformanceMode('off')}>
              Render 3D anyway
            </Button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-5">
          {/* Hero */}
          <section className="col-span-12 flex flex-col gap-2 lg:col-span-7">
            <div className="flex items-center justify-between">
              <span className="hud-label">variant=&quot;hero&quot; · cinematic, no controls</span>
              <span className="font-mono text-2xs text-fg-subtle">action: {current['lab-hero'] ?? '—'}</span>
            </div>
            <div className="relative h-[560px] overflow-hidden rounded-md bg-[#031318]">
              <WarriorStage variant="hero" stageId="lab-hero" className="absolute inset-0" {...stageProps} />
              <div className="pointer-events-none absolute bottom-5 left-6">
                {mounted && (
                  <>
                    <p className="hud-label" style={{ color: tierMeta.trim }}>
                      {tierMeta.name} tier · Lv {progress.level}
                    </p>
                    <p className="font-display text-xl font-semibold uppercase tracking-[0.14em]">{progress.levelTitle}</p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Hall */}
          <section className="col-span-12 flex flex-col gap-2 lg:col-span-5">
            <div className="flex items-center justify-between">
              <span className="hud-label">variant=&quot;hall&quot; · orbit + zoom, shadows</span>
              <span className="font-mono text-2xs text-fg-subtle">action: {current['lab-hall'] ?? '—'}</span>
            </div>
            <div className="relative h-[560px] overflow-hidden rounded-md border border-line">
              <WarriorStage variant="hall" stageId="lab-hall" className="absolute inset-0" {...stageProps} />
            </div>
          </section>

          {/* Controls */}
          <Card className="col-span-12 lg:col-span-8" eyebrow="Controls" title="Drive the warrior" padding="md">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <span className="hud-label">Actions · playWarriorAction()</span>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIONS.map(({ action, label, icon }) => (
                    <Button
                      key={action}
                      variant={action === 'powerup' ? 'ember' : action === 'punch' ? 'primary' : 'secondary'}
                      size="sm"
                      leadingIcon={icon}
                      onClick={() => playWarriorAction(action)}
                      data-action={action}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <span className="hud-label mt-1">Base loop</span>
                <SegmentedControl<WarriorBaseAction>
                  value={base}
                  onChange={setBase}
                  size="sm"
                  aria-label="Base loop"
                  options={[
                    { value: 'stance', label: 'Stance' },
                    { value: 'idle', label: 'Idle' },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-4">
                <Slider
                  label="Armor tier (forceTier)"
                  value={tierSlider}
                  onValueChange={setTierSlider}
                  min={0}
                  max={5}
                  step={1}
                  showValue
                  formatValue={(v) => (v === 0 ? (mounted ? `Live (${WARRIOR_TIERS[live.tier - 1].name})` : 'Live') : `${v} · ${WARRIOR_TIERS[v - 1].name}`)}
                  tone="ember"
                />
                <div className="flex flex-col gap-1.5">
                  <span className="hud-label">Reality decay (forceDecay)</span>
                  <SegmentedControl<DecayChoice>
                    value={decay}
                    onChange={setDecay}
                    size="sm"
                    aria-label="Decay stage"
                    options={[
                      { value: 'live', label: 'Live' },
                      { value: '0', label: '0' },
                      { value: '2', label: '2' },
                      { value: '3', label: '3' },
                      { value: '5', label: '5' },
                    ]}
                  />
                </div>
                <Switch checked={streakOn} onCheckedChange={setStreakOn} label="Streak aura" description="Preview a 7-day streak" tone="ember" layout="row" />
                <Switch checked={speaking} onCheckedChange={setSpeaking} label="NEXUS speaking" description="Arc reactor pulses with the voice" layout="row" />
              </div>
            </div>
          </Card>

          {/* Card variant + readout */}
          <section className="col-span-12 grid grid-cols-2 gap-5 lg:col-span-4">
            <div className="flex flex-col gap-2">
              <span className="hud-label">variant=&quot;card&quot;</span>
              <div className="relative h-[260px] overflow-hidden rounded-md border border-line">
                <WarriorStage variant="card" stageId="lab-card" className="absolute inset-0" {...stageProps} />
              </div>
            </div>
            <Card eyebrow="Progress" padding="sm" className="self-start" aria-busy={!mounted}>
              {mounted ? (
                <>
                  <Readout label="Level" value={`${progress.level} · ${progress.levelTitle}`} />
                  <Readout label="Tier" value={`${progress.tier} · ${progress.tierName}`} tone={tierMeta.trim} />
                  <Readout
                    label="Streak"
                    value={
                      <span className="inline-flex items-center gap-1">
                        {progress.streakDays >= 3 && <Flame className="size-3 text-ember-400" />}
                        {progress.streakDays}d
                      </span>
                    }
                  />
                  <Readout label="Decay" value={progress.decayStage} tone={progress.decayStage >= 2 ? 'var(--color-danger)' : undefined} />
                  <Readout label="Live lvl" value={live.level} />
                </>
              ) : (
                <Readout label="Level" value="—" />
              )}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
