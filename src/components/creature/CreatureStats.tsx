// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Stats popup (FORGE HUD)
// Glass popover above the taskbar creature: sprite + editable name,
// form, stage and level; mood / aura badges; XP and evolution meters
// (hatch requirements while it is an egg); the study-vs-code split
// that decides its form; days alive, interactions and today's focus.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BABY_MIN_XP,
  CREATURE_MOOD_META,
  EGG_INCUBATION_DAYS,
  getCreatureLevelProgress,
  useCreatureStore,
} from '@/stores/useCreatureStore';
import type { CreatureMood } from '@/types/creature';
import { Badge, type Tone } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CreatureCanvas } from './CreatureRenderer';
import { CreatureFormBadge } from './CreatureEvolution';
import type { CreatureVitals } from './CreatureEngine';

interface CreatureStatsProps {
  vitals: CreatureVitals;
  onClose: () => void;
}

/** Split bar series, in chart order. */
const STUDY_COLOR = 'var(--color-viz-1)';
const CODE_COLOR = 'var(--color-viz-2)';

const MOOD_TONE: Record<CreatureMood, Tone> = {
  idle: 'neutral',
  happy: 'success',
  sad: 'warning',
  sleeping: 'info',
  excited: 'ember',
  dance: 'ember',
  eating: 'accent',
  curious: 'accent',
};

/** Form accents (stored as legacy neon hex) → FORGE HUD tokens. */
const FORM_COLOR: Record<string, string> = {
  '#00d8ff': 'var(--color-plasma-400)',
  '#00e676': 'var(--color-success)',
  '#ff3d57': 'var(--color-viz-5)',
};

function formColor(accent: string): string {
  return FORM_COLOR[accent.toLowerCase()] ?? accent;
}

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
  const reduceMotion = useReducedMotion();

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
  const studyPct = total > 0 ? Math.round((studyPoints / total) * 100) : 0;
  const moodInfo = CREATURE_MOOD_META[mood];
  const isEgg = stage === 'egg';
  const accent = formColor(formInfo.accent);

  return (
    <motion.div
      ref={cardRef}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.14 } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="glass-popover w-[320px] overflow-hidden rounded-card text-fg"
      style={{ transformOrigin: 'bottom right' }}
      role="dialog"
      aria-label={`${name} stats`}
    >
      {/* ─── Header: sprite + identity ─── */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line-strong bg-linear-to-b from-ink-750 to-ink-900">
          <CreatureCanvas form={form} stage={stage} mood={mood} size={30} goldenAura={hasGoldenAura} crack={eggReadyToHatch ? 0.25 : 0} />
        </div>
        <div className="min-w-0 flex-1">
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
                className="h-7 min-w-0 flex-1 rounded-control border border-line-strong bg-ink-900/60 px-2 text-ui text-fg outline-none transition-colors focus:border-accent/60"
                aria-label="Creature name"
              />
              <IconButton icon={Check} size="xs" onClick={commitName} aria-label="Save name" className="text-success" />
              <IconButton icon={X} size="xs" onClick={() => setEditing(false)} aria-label="Cancel rename" />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold text-fg">{name}</span>
              <IconButton icon={Pencil} size="xs" iconSize={12} onClick={beginEdit} aria-label="Rename creature" tooltip="Rename" />
            </div>
          )}
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-subtle">
            <CreatureFormBadge form={form} stage={stage} />
            <span aria-hidden className="text-fg-faint">
              ·
            </span>
            <span className="tabular truncate">{isEgg ? `Lv ${level}` : `${stageInfo.label} · Lv ${level}`}</span>
          </div>
        </div>
      </div>

      {/* ─── Mood + aura + age ─── */}
      <div className="flex flex-wrap items-center gap-1.5 px-4">
        <Badge tone={MOOD_TONE[mood] ?? 'neutral'} dot>
          {moodInfo.label}
        </Badge>
        {hasGoldenAura && (
          <Badge tone="gold" icon={Sparkles}>
            Golden aura
          </Badge>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 px-4">
        {isEgg ? (
          /* ─── Egg: hatch requirements ─── */
          <>
            <p className="text-xs text-fg-muted">
              {eggReadyToHatch
                ? 'The shell is cracking. It hatches any moment now.'
                : `Hatches on day ${EGG_INCUBATION_DAYS + 1} once it has eaten ${BABY_MIN_XP} XP. Your study / code balance decides its form.`}
            </p>
            <ProgressBar
              label="Incubation"
              value={Math.min(daysAlive, EGG_INCUBATION_DAYS)}
              max={EGG_INCUBATION_DAYS}
              valueLabel={`${Math.min(daysAlive, EGG_INCUBATION_DAYS)}/${EGG_INCUBATION_DAYS} days`}
              segments={EGG_INCUBATION_DAYS}
              tone="accent"
            />
            <ProgressBar
              label="XP eaten"
              value={Math.min(xp, BABY_MIN_XP)}
              max={BABY_MIN_XP}
              valueLabel={`${Math.min(xp, BABY_MIN_XP)}/${BABY_MIN_XP}`}
              tone="gold"
            />
          </>
        ) : (
          <>
            {/* ─── Level / XP ─── */}
            <ProgressBar
              label={`Level ${lvl.level}`}
              value={lvl.pct}
              valueLabel={`${lvl.into.toLocaleString('en-IN')} / ${lvl.span.toLocaleString('en-IN')} XP`}
              tone="gold"
            />
            {/* ─── Evolution ─── */}
            <div>
              <ProgressBar
                label="Evolution"
                value={stageProgress}
                valueLabel={nextStageInfo ? `${stageProgress}% → ${nextStageInfo.label}` : 'Final stage'}
                color={accent}
                segments={10}
              />
              <p className="tabular mt-1.5 font-mono text-2xs text-fg-subtle">
                {xp.toLocaleString('en-IN')} creature XP
                {nextStageInfo ? ` · next stage at ${nextStageInfo.minXP.toLocaleString('en-IN')}` : ''}
              </p>
            </div>
          </>
        )}

        {/* ─── Activity split: what shapes its form ─── */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="hud-label shrink-0">Study vs code</span>
            <span className="truncate text-2xs text-fg-subtle" title={isHatched ? undefined : 'The dominant side decides its form'}>
              Dominant <span className="font-medium" style={{ color: accent }}>{dominant}</span>
            </span>
          </div>
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {total === 0 ? (
              <span className="h-full flex-1 bg-ink-600/70" />
            ) : (
              <>
                {studyPoints > 0 && <span className="h-full" style={{ width: `${studyPct}%`, background: STUDY_COLOR }} />}
                {codePoints > 0 && <span className="h-full flex-1" style={{ background: CODE_COLOR }} />}
              </>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span aria-hidden className="size-2 rounded-full" style={{ background: STUDY_COLOR }} />
              Study <span className="tabular font-mono text-fg">{formatMinutes(studyPoints)}</span>
            </span>
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span aria-hidden className="size-2 rounded-full" style={{ background: CODE_COLOR }} />
              Code <span className="tabular font-mono text-fg">{formatMinutes(codePoints)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── Stats strip ─── */}
      <dl className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line bg-ink-950/30">
        {[
          ['Days alive', String(daysAlive)],
          ['Interactions', String(interactions)],
          ['Focus today', formatMinutes(today.focusMinutes)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse gap-0.5 px-3 py-2.5">
            <dt className="truncate text-2xs text-fg-subtle">{label}</dt>
            <dd className={cn('tabular truncate text-sm font-semibold text-fg')}>{value}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  );
}

export const CreatureStats = memo(CreatureStatsInner);
