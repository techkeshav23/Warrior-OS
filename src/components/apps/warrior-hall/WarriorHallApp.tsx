// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Hall
// The owner's 3D warrior in its showroom: an orbitable hall stage
// (drag to orbit, scroll to zoom) and a bolted-on armor panel with the
// rank (level, XP to next), the tier ladder Recruit → Ascendant and what
// each tier forges onto the armor, streak aura and Reality Decay status,
// action buttons, and a tier preview (forceTier; back to live).
// Guests see the demo warrior at the demo level.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { Check, ChevronsUp, Flame, Hand, HeartCrack, Lock, Rotate3d, Shield, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { Badge, Button, Card, ProgressBar, Slider } from '@/components/ui';
import { ENGRAVED_LABEL } from '@/components/ui/armor';
import { cn } from '@/lib/utils';
import { getVisitorMode } from '@/lib/visitor';
import { useLiteMode } from '@/lib/lite-mode';
import { useXPStore } from '@/stores/useXPStore';
import { MAX_LEVEL, levelProgress, levelTitle, xpToNextLevel } from '@/components/effects/effects-utils';
import {
  WarriorStage,
  WARRIOR_TIERS,
  playWarriorAction,
  useWarriorActionStore,
  useWarriorModelStore,
  useWarriorProgress,
  type WarriorAction,
  type WarriorTier,
} from '@/components/warrior3d';

/** stageId of the hall stage (JARVIS / other apps can address it alone). */
export const WARRIOR_HALL_STAGE = 'warrior-hall';

const ACTIONS: { action: WarriorAction; label: string; icon: LucideIcon; variant: 'primary' | 'secondary' | 'ember' }[] = [
  { action: 'stance', label: 'Stance', icon: Shield, variant: 'secondary' },
  { action: 'punch', label: 'Punch', icon: Hand, variant: 'primary' },
  { action: 'powerup', label: 'Power up', icon: Zap, variant: 'ember' },
  { action: 'victory', label: 'Victory', icon: Trophy, variant: 'secondary' },
  { action: 'hurt', label: 'Hurt', icon: HeartCrack, variant: 'secondary' },
];

const ACTION_LABEL: Record<WarriorAction, string> = {
  idle: 'Idle',
  stance: 'Stance',
  punch: 'Punch',
  powerup: 'Power up',
  victory: 'Victory',
  hurt: 'Hurt',
};

/** What each tier forges onto the armor (the procedural set). */
const TIER_UNLOCKS: Record<WarriorTier, string> = {
  1: 'Plasma-cyan trim, plate armor, arc reactor',
  2: 'Ember trim, heavier pauldrons, armored gorget',
  3: 'Blazing trim, helmet crest, pauldron fins',
  4: 'Gold trim, brass accents, chest ring, light-ribbon cape',
  5: 'White-gold trim, halo ring, white-hot reactor',
};

const DECAY_STATUS: { label: string; detail: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }[] = [
  { label: 'Stable', detail: 'Armor at full glow', tone: 'success' },
  { label: 'Warming', detail: 'No visible damage yet', tone: 'neutral' },
  { label: 'Flicker', detail: 'Trim dims and flickers', tone: 'warning' },
  { label: 'Damaged', detail: 'Glitching armor, weaker aura', tone: 'warning' },
  { label: 'Heavy damage', detail: 'Hard flicker, aura fading', tone: 'danger' },
  { label: 'Critical', detail: 'Sparks and hard flicker, take a break', tone: 'danger' },
];

/** Streak days that light the aura (see lookForProgress). */
const AURA_DAYS = 3;

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 last:border-b-0">
      <span className="hud-label">{label}</span>
      <span className="min-w-0 truncate text-right text-ui text-fg">{children}</span>
    </div>
  );
}

function TierLadder({ liveTier, shownTier, parts }: { liveTier: WarriorTier; shownTier: WarriorTier; parts: boolean }) {
  return (
    <ol className="flex flex-col gap-1.5" aria-label="Armor tiers">
      {[...WARRIOR_TIERS].reverse().map((t) => {
        const earned = t.tier <= liveTier;
        const current = t.tier === liveTier;
        const shown = t.tier === shownTier;
        return (
          <li
            key={t.tier}
            className={cn(
              'chamfer-xs relative flex items-start gap-2.5 px-2.5 py-2',
              current ? 'bg-steel-700/70' : 'bg-steel-900/60',
              shown && !current && 'shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-ember-400)_55%,transparent)]'
            )}
            aria-current={current ? 'step' : undefined}
          >
            <span
              aria-hidden
              className="mt-1 size-2.5 shrink-0 rotate-45"
              style={{ background: t.trim, boxShadow: earned ? `0 0 8px ${t.trim}` : undefined, opacity: earned ? 1 : 0.35 }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn('font-display text-xs font-semibold uppercase tracking-[0.12em]', earned ? 'text-fg' : 'text-fg-subtle')}
                  style={current ? { color: t.trim } : undefined}
                >
                  {t.name}
                </span>
                <span className="tabular font-mono text-2xs text-fg-subtle">
                  Lv {t.minLevel}–{t.maxLevel}
                </span>
              </div>
              <p className={cn('mt-0.5 text-2xs leading-snug', earned ? 'text-fg-muted' : 'text-fg-faint')}>
                {parts ? TIER_UNLOCKS[t.tier] : `Trim and glow ${Math.round(t.glow * 100)}%`}
              </p>
            </div>
            <span className="mt-0.5 shrink-0" aria-label={earned ? 'Unlocked' : 'Locked'}>
              {earned ? (
                <Check className="size-3.5 text-success" strokeWidth={2} aria-hidden />
              ) : (
                <Lock className="size-3.5 text-fg-faint" strokeWidth={1.75} aria-hidden />
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function WarriorHallAppInner() {
  const [previewTier, setPreviewTier] = useState(0); // 0 = live
  const [guest] = useState(() => getVisitorMode() === 'guest');
  const lite = useLiteMode();
  const xp = useXPStore((s) => s.xp);
  const level = useXPStore((s) => s.level);
  const modelStatus = useWarriorModelStore((s) => s.status);
  const acting = useWarriorActionStore((s) => s.current[WARRIOR_HALL_STAGE]);

  const forceTier = previewTier > 0 ? (previewTier as WarriorTier) : undefined;
  const live = useWarriorProgress();
  const shown = useWarriorProgress({ forceTier });
  const liveInfo = WARRIOR_TIERS[live.tier - 1];
  const shownInfo = WARRIOR_TIERS[shown.tier - 1];
  const maxed = level >= MAX_LEVEL;
  const toNext = xpToNextLevel(xp, level);
  const nextTier = WARRIOR_TIERS[live.tier] ?? null;
  const decay = DECAY_STATUS[live.decayStage] ?? DECAY_STATUS[0];
  const auraOn = live.streakDays >= AURA_DAYS;

  return (
    <div className="@container h-full min-h-0 text-fg">
      <div className="flex h-full min-h-0 flex-col @[720px]:flex-row">
        {/* ─── Hall stage ─── */}
        <section className="relative min-h-[240px] min-w-0 flex-1 bg-[#031318]" aria-label="Warrior hall stage">
          <WarriorStage variant="hall" stageId={WARRIOR_HALL_STAGE} forceTier={forceTier} className="absolute inset-0" />
          {/* Overlays: never block the orbit controls */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-linear-to-b from-[#031318]/85 to-transparent p-4">
            <div className="min-w-0">
              <p className="hud-label" style={{ color: shownInfo.trim }}>
                {shownInfo.name} tier · Lv {shown.level}
              </p>
              <p className="truncate font-display text-xl font-semibold uppercase tracking-[0.14em]">{shown.levelTitle}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {guest && (
                <Badge tone="neutral" variant="outline" size="sm">
                  Demo warrior
                </Badge>
              )}
              {forceTier && (
                <Badge tone="ember" size="sm">
                  Preview
                </Badge>
              )}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            {/* Lite mode: the static plate carries its own caption. */}
            {lite ? (
              <span />
            ) : (
              <span className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.16em] text-fg-subtle">
                <Rotate3d className="size-3.5" strokeWidth={1.75} aria-hidden />
                Drag to orbit · scroll to zoom
              </span>
            )}
            <span className="font-mono text-2xs uppercase tracking-[0.16em] text-fg-subtle" aria-live="polite">
              {acting ? ACTION_LABEL[acting] : ''}
            </span>
          </div>
        </section>

        {/* ─── Armor panel ─── */}
        <aside
          className={cn(
            'scrollbar-thin flex max-h-[48%] w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-line bg-ink-950/50 p-3',
            '@[720px]:max-h-none @[720px]:w-[312px] @[720px]:border-l @[720px]:border-t-0'
          )}
          aria-label="Armor panel"
        >
          {/* Rank */}
          <Card rivets padding="md" role="region" aria-label="Rank">
            <div className="flex items-center justify-between gap-2">
              <p className={cn(ENGRAVED_LABEL, 'text-gold')}>{guest ? 'Demo rank' : 'Rank'}</p>
              <span className="chamfer-xs flex h-6 items-center gap-1 bg-steel-800 px-2" style={{ color: liveInfo.trim }}>
                <ChevronsUp className="size-3.5" strokeWidth={2} aria-hidden />
                <span className="font-display text-2xs font-semibold uppercase tracking-[0.14em]">{liveInfo.name}</span>
              </span>
            </div>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="tabular font-display text-3xl font-semibold leading-none">Lv {level}</span>
              <span className="truncate text-sm text-fg-muted">{levelTitle(level)}</span>
            </p>
            <ProgressBar
              className="mt-3"
              value={levelProgress(xp, level)}
              tone="gold"
              size="md"
              aria-label={maxed ? 'Max level' : `Progress to level ${level + 1}`}
            />
            <p className="mt-1.5 flex justify-between text-2xs text-fg-subtle">
              <span className="tabular font-mono">{xp.toLocaleString()} XP</span>
              <span>
                {maxed ? (
                  'Max level'
                ) : (
                  <>
                    <span className="tabular font-mono text-fg">{toNext.toLocaleString()}</span> XP to Lv {level + 1}
                  </>
                )}
              </span>
            </p>
            {nextTier && (
              <p className="mt-1 text-2xs text-fg-subtle">
                Next armor: <span style={{ color: nextTier.trim }}>{nextTier.name}</span> at Lv {nextTier.minLevel}
              </p>
            )}
          </Card>

          {/* Actions */}
          <Card eyebrow="Command" title="Actions" padding="md">
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map(({ action, label, icon, variant }) => (
                <Button
                  key={action}
                  variant={variant}
                  size="sm"
                  leadingIcon={icon}
                  onClick={() => playWarriorAction(action, WARRIOR_HALL_STAGE)}
                  data-warrior-action={action}
                  className={action === 'stance' ? 'col-span-2' : undefined}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Card>

          {/* Status: streak aura + decay */}
          <Card eyebrow="Condition" title="Streak and decay" padding="md">
            <StatRow label="Streak">
              <span className="inline-flex items-center gap-1">
                {auraOn && <Flame className="size-3.5 text-ember-400" strokeWidth={1.75} aria-hidden />}
                <span className="tabular font-mono">{live.streakDays}d</span>
              </span>
            </StatRow>
            <StatRow label="Aura">
              {auraOn ? (
                <span className="text-ember-300">Lit</span>
              ) : (
                <span className="text-fg-subtle">
                  {AURA_DAYS - live.streakDays} more day{AURA_DAYS - live.streakDays === 1 ? '' : 's'}
                </span>
              )}
            </StatRow>
            <StatRow label="Decay">
              <span className="inline-flex items-center gap-1.5">
                <Badge tone={decay.tone} size="sm">
                  {decay.label}
                </Badge>
                <span className="tabular font-mono text-2xs text-fg-subtle">{live.decayStage}/5</span>
              </span>
            </StatRow>
            <p className="mt-2 text-2xs text-fg-subtle">{decay.detail}</p>
          </Card>

          {/* Tier ladder + preview */}
          <Card
            eyebrow="Armory"
            title="Tier ladder"
            padding="md"
            actions={
              forceTier ? (
                <Button size="sm" variant="ghost" onClick={() => setPreviewTier(0)}>
                  Live
                </Button>
              ) : undefined
            }
          >
            <Slider
              label="Preview tier"
              value={previewTier}
              onValueChange={setPreviewTier}
              min={0}
              max={5}
              step={1}
              showValue
              formatValue={(v) => (v === 0 ? `Live · ${liveInfo.name}` : `${v} · ${WARRIOR_TIERS[v - 1].name}`)}
              tone="ember"
              wrapperClassName="mb-3"
            />
            <TierLadder liveTier={live.tier} shownTier={shown.tier} parts={modelStatus !== 'glb'} />
          </Card>
        </aside>
      </div>
    </div>
  );
}

export const WarriorHallApp = memo(WarriorHallAppInner);
