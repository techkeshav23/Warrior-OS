// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Stats popup
// Glass card anchored above the taskbar creature. Shows identity,
// level/XP, mood, days alive, evolution progress, activity pie.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreatureStore, CREATURE_FORMS } from '@/stores/useCreatureStore';
import { EvolutionVisual } from './CreatureEvolution';
import type { CreatureVitals } from './CreatureEngine';
import type { CreatureMood } from '@/types/creature';

interface CreatureStatsProps {
  vitals: CreatureVitals;
  onClose: () => void;
}

const MOOD_LABEL: Record<CreatureMood, { label: string; color: string; emoji: string }> = {
  idle: { label: 'Content', color: '#8888a0', emoji: '😌' },
  happy: { label: 'Happy', color: '#00e676', emoji: '😄' },
  sad: { label: 'Sad', color: '#ffab00', emoji: '😢' },
  sleeping: { label: 'Sleeping', color: '#7b61ff', emoji: '😴' },
  dance: { label: 'Ecstatic', color: '#ff3d71', emoji: '🤩' },
  eating: { label: 'Munching', color: '#00f0ff', emoji: '😋' },
  curious: { label: 'Curious', color: '#00f0ff', emoji: '🧐' },
};

function CreatureStatsInner({ vitals, onClose }: CreatureStatsProps) {
  const {
    stage,
    stageInfo,
    nextStageInfo,
    stageProgress,
    form,
    formInfo,
    mood,
    xp,
    level,
    daysAlive,
    interactions,
    studyPoints,
    codePoints,
    dominant,
    hasGoldenAura,
  } = vitals;

  const name = useCreatureStore((s) => s.name);
  const setName = useCreatureStore((s) => s.setName);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const cardRef = useRef<HTMLDivElement>(null);

  const beginEdit = () => {
    setDraft(name);
    setEditing(true);
  };

  // Close on outside click / escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer so the opening click doesn't immediately close it.
    const t = setTimeout(() => {
      window.addEventListener('mousedown', onDown);
      window.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const commitName = () => {
    setName(draft.trim() || name);
    setEditing(false);
  };

  const total = studyPoints + codePoints;
  const pieData =
    total === 0
      ? [{ name: 'No activity yet', value: 1, fill: '#333344' }]
      : [
          { name: 'Study', value: studyPoints, fill: '#00f0ff' },
          { name: 'Code', value: codePoints, fill: '#00e676' },
        ];

  const moodInfo = MOOD_LABEL[mood];

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn(
        'glass glass-border rounded-xl w-[300px] p-4',
        'text-text-primary shadow-2xl'
      )}
      style={{ background: 'rgba(12, 12, 20, 0.9)' }}
    >
      {/* ─── Header: sprite + identity ─── */}
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <EvolutionVisual form={form} stage={stage} mood={mood} size={40} goldenAura={hasGoldenAura} />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draft}
                maxLength={20}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm font-display outline-none focus:border-accent-primary"
              />
              <button onClick={commitName} className="text-accent-success p-1 hover:bg-white/5 rounded" aria-label="Save name">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(false)} className="text-text-muted p-1 hover:bg-white/5 rounded" aria-label="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-base truncate">{name}</span>
              <button
                onClick={beginEdit}
                className="text-text-muted hover:text-accent-primary p-0.5 rounded"
                aria-label="Rename creature"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="text-[11px] font-mono" style={{ color: formInfo.accent }}>
            {formInfo.name}
          </div>
          <div className="text-[10px] text-text-muted">{stageInfo.label} stage</div>
        </div>
      </div>

      {/* ─── Mood + days alive ─── */}
      <div className="mt-3 flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono"
          style={{ background: `${moodInfo.color}22`, color: moodInfo.color }}
        >
          <span>{moodInfo.emoji}</span>
          <span>{moodInfo.label}</span>
        </div>
        {hasGoldenAura && (
          <div className="px-2 py-1 rounded-md text-[11px] font-mono bg-accent-warning/20 text-accent-warning">
            ✨ Golden aura
          </div>
        )}
        <div className="ml-auto text-[11px] font-mono text-text-secondary">
          {daysAlive}d alive
        </div>
      </div>

      {/* ─── Level / XP bar ─── */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] font-mono text-text-secondary mb-1">
          <span>Level {level}</span>
          <span>{xp.toLocaleString('en-IN')} XP</span>
        </div>
      </div>

      {/* ─── Evolution progress ─── */}
      <div className="mt-1">
        <div className="flex justify-between text-[11px] font-mono text-text-secondary mb-1">
          <span>Evolution</span>
          <span>{nextStageInfo ? `→ ${nextStageInfo.label}` : 'Max stage'}</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${formInfo.accent}, #7b61ff)` }}
            initial={{ width: 0 }}
            animate={{ width: `${stageProgress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ─── Activity breakdown ─── */}
      <div className="mt-3 flex items-center gap-3">
        <div className="w-16 h-16 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                innerRadius={16}
                outerRadius={30}
                paddingAngle={2}
                stroke="none"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 text-[11px] font-mono space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#00f0ff' }} />
            <span className="text-text-secondary">Study</span>
            <span className="ml-auto text-text-primary">{studyPoints}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#00e676' }} />
            <span className="text-text-secondary">Code</span>
            <span className="ml-auto text-text-primary">{codePoints}</span>
          </div>
          <div className="text-[10px] text-text-muted pt-0.5">
            Dominant: <span style={{ color: CREATURE_FORMS[form].accent }}>{dominant}</span>
          </div>
        </div>
      </div>

      {/* ─── Interactions footer ─── */}
      <div className="mt-3 pt-2 border-t border-white/5 flex justify-between text-[10px] font-mono text-text-muted">
        <span>{interactions} interactions</span>
        <span>{formInfo.blurb.length > 0 ? 'Growing strong' : ''}</span>
      </div>
    </motion.div>
  );
}

export const CreatureStats = memo(CreatureStatsInner);
