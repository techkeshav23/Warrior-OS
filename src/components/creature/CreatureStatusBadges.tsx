// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature status badges
// Drop-ins for OS chrome owned by other features:
//   • <CreatureIslandBadge/> + useCreatureIslandSignal() — the creature's
//     mood in the Dynamic Island (sad creature = amber warning)
//   • <CreatureLockBadge/> — creature level next to the user level on
//     the lock screen
// Both read the persisted creature store; no engine needs to be mounted.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CREATURE_MOOD_META, getStageInfo, useCreatureStore } from '@/stores/useCreatureStore';
import type { CreatureForm, CreatureMood, CreatureStage } from '@/types/creature';
import { CreatureCanvas } from './CreatureRenderer';

export type CreatureIslandTone = 'warning' | 'success' | 'info';

export interface CreatureIslandSignal {
  /** True when the island should surface the creature. */
  visible: boolean;
  tone: CreatureIslandTone;
  text: string;
  name: string;
  mood: CreatureMood;
  stage: CreatureStage;
  form: CreatureForm;
  goldenAura: boolean;
}

/** Tone → FORGE HUD token classes (text + LED). */
const TONE_TEXT: Record<CreatureIslandTone, string> = {
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-accent',
};
const TONE_LED: Record<CreatureIslandTone, string> = {
  warning: 'bg-warning',
  success: 'bg-success',
  info: 'bg-accent',
};

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * What the Dynamic Island should show about the creature. Sad →
 * amber warning (stays until the creature is fed); celebrating moods →
 * a short success pulse. Otherwise invisible.
 */
export function useCreatureIslandSignal(): CreatureIslandSignal {
  const name = useCreatureStore((s) => s.name);
  const mood = useCreatureStore((s) => s.mood);
  const stage = useCreatureStore((s) => s.stage);
  const form = useCreatureStore((s) => s.form);
  const goldenAuraDate = useCreatureStore((s) => s.goldenAuraDate);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const goldenAura = goldenAuraDate === utcDayKey(now);

  let visible = false;
  let tone: CreatureIslandTone = 'info';
  let text = '';
  if (mood === 'sad') {
    visible = true;
    tone = 'warning';
    text = `${name} is sad. Earn XP to cheer it up`;
  } else if (mood === 'dance' || mood === 'excited') {
    visible = true;
    tone = 'success';
    text = `${name} is celebrating`;
  }
  return { visible, tone, text, name, mood, stage, form, goldenAura };
}

interface CreatureIslandBadgeProps {
  /** Expanded island layout (sprite + sentence) vs compact (sprite + dot). */
  expanded?: boolean;
  className?: string;
}

function CreatureIslandBadgeInner({ expanded = false, className }: CreatureIslandBadgeProps) {
  const signal = useCreatureIslandSignal();
  if (!signal.visible) return null;
  const moodLabel = CREATURE_MOOD_META[signal.mood]?.label ?? '';
  if (expanded) {
    return (
      <span className={cn('flex min-w-0 items-center gap-3', className)} title={signal.text}>
        <span className="armor-plate chamfer-xs flex size-8 shrink-0 items-center justify-center overflow-hidden">
          <CreatureCanvas form={signal.form} stage={signal.stage} mood={signal.mood} size={18} goldenAura={signal.goldenAura} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui font-medium text-fg">{signal.name}</span>
          <span className={cn('block truncate text-xs', TONE_TEXT[signal.tone])}>{signal.text}</span>
        </span>
      </span>
    );
  }
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)} title={signal.text}>
      <span className="-my-2 shrink-0">
        <CreatureCanvas form={signal.form} stage={signal.stage} mood={signal.mood} size={13} goldenAura={signal.goldenAura} />
      </span>
      <span className="min-w-0 truncate text-xs text-fg-muted">
        {signal.name} <span className={TONE_TEXT[signal.tone]}>· {moodLabel}</span>
      </span>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full motion-safe:animate-pulse-soft', TONE_LED[signal.tone])} />
    </span>
  );
}

export const CreatureIslandBadge = memo(CreatureIslandBadgeInner);

interface CreatureLockBadgeProps {
  className?: string;
}

function CreatureLockBadgeInner({ className }: CreatureLockBadgeProps) {
  const known = useCreatureStore((s) => s.lastSyncedUserXP !== null);
  const name = useCreatureStore((s) => s.name);
  const level = useCreatureStore((s) => s.level);
  const stage = useCreatureStore((s) => s.stage);
  const form = useCreatureStore((s) => s.form);
  const mood = useCreatureStore((s) => s.mood);
  const goldenAuraDate = useCreatureStore((s) => s.goldenAuraDate);
  const [today] = useState(() => utcDayKey(Date.now()));

  // Only once the creature exists (born on the first desktop session).
  if (!known) return null;
  const moodMeta = CREATURE_MOOD_META[mood];
  return (
    <div
      className={cn(
        // Cut steel tag, like the lock screen's status strip
        'armor-plate chamfer-xs inline-flex items-center gap-2 py-1 pl-1.5 pr-3',
        className
      )}
      title={`${name} · ${moodMeta.label}`}
    >
      <div className="-my-2">
        <CreatureCanvas form={form} stage={stage} mood={mood === 'sad' ? 'sad' : 'idle'} size={14} goldenAura={goldenAuraDate === today} />
      </div>
      <span className="text-xs text-fg-muted">
        {name} <span className="text-fg-faint">·</span> <span className="tabular font-medium text-accent">Lv {level}</span>{' '}
        <span className="text-fg-subtle">{getStageInfo(stage).label}</span>
      </span>
    </div>
  );
}

export const CreatureLockBadge = memo(CreatureLockBadgeInner);
