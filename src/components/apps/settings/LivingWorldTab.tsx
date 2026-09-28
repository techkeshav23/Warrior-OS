// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Living World Tab
// Reality Decay (6.45), auto-mood music (6.53), creature, effects
// and desktop widgets.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DecaySettings } from '@/components/decay';
import { WidgetSettings } from '@/components/widgets';
import { useEffectsStore } from '@/components/effects';
import { useMusicGenStore } from '@/stores/useMusicGenStore';
import { useCreatureStore } from '@/stores/useCreatureStore';

function LivingWorldTabInner() {
  const autoMood = useMusicGenStore((s) => s.autoMood);
  const achievementCinematic = useEffectsStore((s) => s.achievementCinematic);
  const levelUpEffect = useEffectsStore((s) => s.levelUpEffect);
  const disintegrateOnClose = useEffectsStore((s) => s.disintegrateOnClose);

  return (
    <div className="p-6 space-y-8">
      <h3 className="text-lg font-bold text-white">Living World</h3>

      {/* Reality Decay (6.45) */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Reality Decay</label>
        <DecaySettings />
      </section>

      {/* Procedural music (6.53) */}
      <section className="space-y-3">
        <label className="text-xs text-white/60 font-semibold">Procedural Music</label>
        <ToggleRow
          label="Auto-mood music"
          hint="Pick the mood from time of day; typing rhythm can override"
          enabled={autoMood}
          onToggle={() => useMusicGenStore.getState().setAutoMood(!autoMood)}
        />
      </section>

      {/* Warrior Creature */}
      <section className="space-y-3">
        <label className="text-xs text-white/60 font-semibold">Warrior Creature</label>
        <CreatureNameRow />
      </section>

      {/* Effects */}
      <section className="space-y-3">
        <label className="text-xs text-white/60 font-semibold">Effects</label>
        <ToggleRow
          label="Achievement cinematic"
          enabled={achievementCinematic}
          onToggle={() => useEffectsStore.getState().setAchievementCinematic(!achievementCinematic)}
        />
        <ToggleRow
          label="Level-up effect"
          enabled={levelUpEffect}
          onToggle={() => useEffectsStore.getState().setLevelUpEffect(!levelUpEffect)}
        />
        <ToggleRow
          label="Disintegrate windows on close"
          enabled={disintegrateOnClose}
          onToggle={() => useEffectsStore.getState().setDisintegrateOnClose(!disintegrateOnClose)}
        />
      </section>

      {/* Desktop widgets */}
      <section className="space-y-2">
        <label className="text-xs text-white/60 font-semibold">Desktop Widgets</label>
        <WidgetSettings />
      </section>
    </div>
  );
}

function CreatureNameRow() {
  const name = useCreatureStore((s) => s.name);
  const level = useCreatureStore((s) => s.level);
  const stage = useCreatureStore((s) => s.stage);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? name;

  const commit = () => {
    if (draft !== null) useCreatureStore.getState().setName(draft);
    setDraft(null);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-sm text-white/70">Name</span>
        <p className="text-[11px] text-white/40 capitalize">
          {String(stage)} · Lv {level}
        </p>
      </div>
      <input
        value={value}
        maxLength={20}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(null);
        }}
        aria-label="Creature name"
        className="w-40 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white outline-none focus:border-cyan-400/60"
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  enabled,
  onToggle,
}: {
  label: string;
  hint?: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-sm text-white/70">{label}</span>
        {hint && <p className="text-[11px] text-white/40">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          'w-10 h-5 shrink-0 rounded-full transition-all relative',
          enabled ? 'bg-cyan-500' : 'bg-white/20'
        )}
      >
        <div
          className={cn(
            'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all',
            enabled ? 'left-5.5' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

export const LivingWorldTab = memo(LivingWorldTabInner);
