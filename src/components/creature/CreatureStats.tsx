// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Stats popup
// Glass card above the taskbar creature: editable name, current form +
// live sprite, creature level + XP bar, mood, days alive, evolution
// progress to the next stage, study-vs-code pie, interactions count.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BABY_MIN_XP,
  CREATURE_MOOD_META,
  EGG_INCUBATION_DAYS,
  getCreatureLevelProgress,
  useCreatureStore,
} from '@/stores/useCreatureStore';
import { CreatureCanvas } from './CreatureRenderer';
import { CreatureFormBadge } from './CreatureEvolution';
import type { CreatureVitals } from './CreatureEngine';

interface CreatureStatsProps {
  vitals: CreatureVitals;
  onClose: () => void;
}

const STUDY_COLOR = '#00d8ff';
const CODE_COLOR = '#00e676';

function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

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
    isHatched,
    eggReadyToHatch,
    today,
  } = vitals;

  const name = useCreatureStore((s) => s.name);
  const setName = useCreatureStore((s) => s.setName);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (deferred so the opening click doesn't close it).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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

  const beginEdit = () => {
    setDraft(name);
    setEditing(true);
  };
  const commitName = () => {
    setName(draft.trim() || name);
    setEditing(false);
  };

  const lvl = getCreatureLevelProgress(xp);
  const total = studyPoints + codePoints;
  const pieData =
    total === 0
      ? [{ name: 'No activity yet', value: 1, fill: '#2a2a3a' }]
      : [
          { name: 'Study', value: studyPoints, fill: STUDY_COLOR },
          { name: 'Code', value: codePoints, fill: CODE_COLOR },
        ];
  const moodInfo = CREATURE_MOOD_META[mood];
  const isEgg = stage === 'egg';

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn('glass-border rounded-xl w-[304px] p-4', 'text-text-primary shadow-2xl')}
      style={{ background: 'rgba(12, 12, 20, 0.95)', backdropFilter: 'blur(20px)' }}
      role="dialog"
      aria-label={`${name} stats`}
    >
      {/* ─── Header: sprite + identity ─── */}
      <div className="flex items-center gap-3">
        <div className="shrink-0 -m-2">
          <CreatureCanvas form={form} stage={stage} mood={mood} size={40} goldenAura={hasGoldenAura} crack={eggReadyToHatch ? 0.25 : 0} />
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
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditing(false);
                  }
                }}
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm font-display outline-none focus:border-accent-primary"
                aria-label="Creature name"
              />
              <button onClick={commitName} className="text-accent-success p-1 hover:bg-white/5 rounded" aria-label="Save name">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(false)} className="text-text-muted p-1 hover:bg-white/5 rounded" aria-label="Cancel rename">
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
          <CreatureFormBadge form={form} stage={stage} />
          <div className="text-[10px] text-text-secondary">
            {stageInfo.label} stage · Lv.{level}
          </div>
        </div>
      </div>

      {/* ─── Mood + days alive ─── */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono"
          style={{ background: `${moodInfo.color}22`, color: moodInfo.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: moodInfo.color }} />
          <span>{moodInfo.label}</span>
        </div>
        {hasGoldenAura && (
          <div className="px-2 py-1 rounded-md text-[11px] font-mono bg-accent-warning/20 text-accent-warning">
            Golden aura
          </div>
        )}
        <div className="ml-auto text-[11px] font-mono text-text-secondary">
          {daysAlive} day{daysAlive === 1 ? '' : 's'} alive
        </div>
      </div>

      {isEgg ? (
        /* ─── Egg: hatch requirements ─── */
        <div className="mt-3 space-y-2 text-[11px] font-mono">
          <p className="text-text-secondary">
            {eggReadyToHatch
              ? 'The shell is cracking. It hatches any moment now.'
              : `Hatches on day ${EGG_INCUBATION_DAYS + 1} once it has eaten ${BABY_MIN_XP} XP.`}
          </p>
          <div>
            <div className="flex justify-between text-text-secondary mb-1">
              <span>Incubation</span>
              <span>
                {Math.min(daysAlive, EGG_INCUBATION_DAYS)}/{EGG_INCUBATION_DAYS} days
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-primary transition-[width] duration-500"
                style={{ width: `${Math.min(100, (daysAlive / EGG_INCUBATION_DAYS) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-text-secondary mb-1">
              <span>XP eaten</span>
              <span>
                {Math.min(xp, BABY_MIN_XP)}/{BABY_MIN_XP}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-secondary transition-[width] duration-500"
                style={{ width: `${Math.min(100, (xp / BABY_MIN_XP) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ─── Level / XP bar ─── */}
          <div className="mt-3">
            <div className="flex justify-between text-[11px] font-mono text-text-secondary mb-1">
              <span>Level {lvl.level}</span>
              <span>
                {lvl.into.toLocaleString('en-IN')} / {lvl.span.toLocaleString('en-IN')} XP
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: formInfo.accent }}
                initial={{ width: 0 }}
                animate={{ width: `${lvl.pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* ─── Evolution progress ─── */}
          <div className="mt-2">
            <div className="flex justify-between text-[11px] font-mono text-text-secondary mb-1">
              <span>Evolution</span>
              <span>{nextStageInfo ? `${stageProgress}% → ${nextStageInfo.label}` : 'Final stage'}</span>
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
            <div className="mt-1 text-[10px] text-text-secondary">
              {xp.toLocaleString('en-IN')} creature XP
              {nextStageInfo ? ` · next stage at ${nextStageInfo.minXP.toLocaleString('en-IN')}` : ''}
            </div>
          </div>
        </>
      )}

      {/* ─── Activity breakdown ─── */}
      <div className="mt-3 flex items-center gap-3">
        <div className="w-16 h-16 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius={16} outerRadius={30} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 text-[11px] font-mono space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: STUDY_COLOR }} />
            <span className="text-text-secondary">Study</span>
            <span className="ml-auto text-text-primary">{formatMinutes(studyPoints)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: CODE_COLOR }} />
            <span className="text-text-secondary">Code</span>
            <span className="ml-auto text-text-primary">{formatMinutes(codePoints)}</span>
          </div>
          <div className="text-[10px] text-text-secondary pt-0.5">
            Dominant: <span style={{ color: formInfo.accent }}>{dominant}</span>
            {isHatched ? '' : ' (decides its form)'}
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="mt-3 pt-2 border-t border-white/5 flex justify-between text-[10px] font-mono text-text-secondary">
        <span>
          {interactions} interaction{interactions === 1 ? '' : 's'}
        </span>
        <span>Today: {formatMinutes(today.focusMinutes)} focused</span>
      </div>
    </motion.div>
  );
}

export const CreatureStats = memo(CreatureStatsInner);
