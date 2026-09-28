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

const TONE_COLOR: Record<CreatureIslandTone, string> = {
  warning: '#ffab00',
  success: '#00e676',
  info: '#00f0ff',
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
  const color = TONE_COLOR[signal.tone];
  return (
    <div className={cn('flex items-center gap-1.5 min-w-0', className)} title={signal.text}>
      <div className="-my-2 shrink-0">
        <CreatureCanvas form={signal.form} stage={signal.stage} mood={signal.mood} size={expanded ? 18 : 13} goldenAura={signal.goldenAura} />
      </div>
      {expanded ? (
        <span className="text-[10px] font-mono truncate" style={{ color }}>
          {signal.text}
        </span>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: color }} />
      )}
    </div>
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
        'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 pl-1 pr-3 py-0.5',
        className
      )}
      title={`${name} · ${moodMeta.label}`}
    >
      <div className="-my-2">
        <CreatureCanvas form={form} stage={stage} mood={mood === 'sad' ? 'sad' : 'idle'} size={14} goldenAura={goldenAuraDate === today} />
      </div>
      <span className="text-[11px] font-mono text-text-secondary">
        {name} · <span className="text-accent-primary font-bold">Lv.{level}</span>{' '}
        <span className="text-text-muted">{getStageInfo(stage).label}</span>
      </span>
    </div>
  );
}

export const CreatureLockBadge = memo(CreatureLockBadgeInner);
