// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Overview (spec 6.29)
// Palace overview screen: total objects, rooms, revision urgency
// (spaced repetition due / overdue), recency spread, per-room urgency
// with fly-to buttons, and how far the palace is from its next growth.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Building2, Crown, Footprints, Layers, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PalaceGrowthState } from './PalaceGrowth';
import type { RoomLayout } from './PalaceNavigation';
import { RECENCY_STYLES } from './KnowledgeObject';
import type { RecencyBucket } from './palaceData';

export interface PalaceSummary {
  objects: number;
  rooms: number;
  due: number;
  overdue: number;
  recency: Record<RecencyBucket, number>;
  /** Notes whose schedule comes from GATE Arena's spaced repetition. */
  gateLinked: number;
  unhoused: number;
}

interface PalaceOverviewProps {
  summary: PalaceSummary;
  growth: PalaceGrowthState;
  rooms: RoomLayout[];
  /** Intro variant (first screen) shows the big "Enter" button. */
  mode: 'intro' | 'panel';
  hasNotes: boolean;
  onEnter: () => void;
  onClose: () => void;
  onTeleport: (roomKey: string) => void;
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/40">
        {icon}
        {label}
      </div>
      <div className={cn('mt-0.5 font-display text-lg font-bold', tone ?? 'text-white')}>{value}</div>
    </div>
  );
}

function Progress({ label, current, at, color }: { label: string; current: number; at: number | null; color: string }) {
  if (at === null) {
    return (
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>{label}</span>
        <span className="text-accent-success">complete</span>
      </div>
    );
  }
  const prevStep = label.startsWith('Next room') ? at - 10 : label.startsWith('Corridor') ? at - 50 : label.startsWith('New wing') ? at - 100 : 0;
  const pct = Math.max(0, Math.min(1, (current - prevStep) / Math.max(1, at - prevStep)));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-white/55">
        <span>{label}</span>
        <span className="font-mono text-white/40">
          {current}/{at} notes
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
    </div>
  );
}

function PalaceOverviewInner({ summary, growth, rooms, mode, hasNotes, onEnter, onClose, onTeleport }: PalaceOverviewProps) {
  const buckets: RecencyBucket[] = ['today', 'week', 'month', 'stale'];
  const total = Math.max(1, summary.objects);
  const urgent = [...rooms].filter((r) => r.dueCount > 0).sort((a, b) => b.dueCount - a.dueCount);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'absolute inset-0 z-30 flex items-center justify-center p-4',
        mode === 'intro' ? 'bg-black/70 backdrop-blur-sm' : 'bg-black/40'
      )}
      onClick={mode === 'panel' ? onClose : undefined}
    >
      <motion.div
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="glass relative max-h-full w-full max-w-[560px] overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'panel' && (
          <button onClick={onClose} className="absolute right-3 top-3 rounded p-1 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Close overview">
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-primary/15 text-xl">🏛️</div>
          <div>
            <div className="font-display text-lg font-bold tracking-wide text-accent-primary text-glow">MEMORY PALACE</div>
            <div className="text-[11px] text-white/50">Every note is an object. Every subject is a room. Walk your knowledge.</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={<Sparkles className="h-3 w-3" />} label="Objects" value={summary.objects} />
          <Stat icon={<Building2 className="h-3 w-3" />} label="Rooms" value={summary.rooms} />
          <Stat
            icon={<AlertTriangle className="h-3 w-3" />}
            label="Due now"
            value={summary.due}
            tone={summary.due > 0 ? 'text-accent-danger' : 'text-accent-success'}
          />
          <Stat icon={<Layers className="h-3 w-3" />} label="Wings" value={growth.wings} />
        </div>

        {/* Revision urgency */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/40">
            <span>Revision recency</span>
            <span className="normal-case tracking-normal text-white/35">
              {summary.overdue > 0 ? `${summary.overdue} overdue · ` : ''}
              {summary.gateLinked} synced with GATE Arena
            </span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
            {buckets.map((b) =>
              summary.recency[b] > 0 ? (
                <div
                  key={b}
                  title={`${RECENCY_STYLES[b].label}: ${summary.recency[b]}`}
                  style={{ width: `${(summary.recency[b] / total) * 100}%`, backgroundColor: b === 'stale' ? '#6d5f4f' : RECENCY_STYLES[b].color }}
                />
              ) : null
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/50">
            {buckets.map((b) => (
              <span key={b} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: b === 'stale' ? '#6d5f4f' : RECENCY_STYLES[b].color }} />
                {RECENCY_STYLES[b].label} · {summary.recency[b]}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm border border-accent-danger" />
              red border = due for revision
            </span>
          </div>
        </div>

        {/* Rooms that need attention */}
        {urgent.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-widest text-white/40">Rooms needing revision</div>
            <div className="grid gap-1 sm:grid-cols-2">
              {urgent.slice(0, 6).map((r) => (
                <button
                  key={r.key}
                  onClick={() => onTeleport(r.key)}
                  className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.03] px-2 py-1.5 text-left text-[11px] transition-colors hover:border-white/15 hover:bg-white/[0.07]"
                >
                  <span className="truncate" style={{ color: r.accent }}>
                    {r.label}
                  </span>
                  <span className="ml-2 shrink-0 rounded bg-accent-danger/15 px-1.5 text-[10px] font-semibold text-accent-danger">{r.dueCount} due</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Growth */}
        <div className="mt-4 space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/40">
            <Crown className="h-3 w-3" /> Palace growth
          </div>
          <Progress label="Next room" current={growth.noteCount} at={growth.nextRoomAt} color="#00f0ff" />
          <Progress label="Corridor extension" current={growth.noteCount} at={growth.nextCorridorAt} color="#ffcc80" />
          <Progress label="New wing" current={growth.noteCount} at={growth.nextWingAt} color="#b388ff" />
          <Progress label="Grand Hall" current={growth.noteCount} at={growth.grandHall ? null : growth.grandHallAt} color="#ffd740" />
          {summary.unhoused > 0 && (
            <div className="text-[10px] text-white/40">
              {summary.unhoused} note{summary.unhoused === 1 ? '' : 's'} wait on the archive table in the entrance hall until a room unlocks.
            </div>
          )}
        </div>

        {mode === 'intro' && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              onClick={onEnter}
              className="flex items-center gap-2 rounded-xl bg-accent-primary/20 px-6 py-2.5 font-display text-sm font-bold tracking-widest text-accent-primary shadow-[0_0_24px_rgba(0,240,255,0.25)] transition-all hover:bg-accent-primary/30 hover:shadow-[0_0_32px_rgba(0,240,255,0.4)]"
            >
              <Footprints className="h-4 w-4" />
              ENTER THE PALACE
            </button>
            <div className="text-center text-[10px] leading-relaxed text-white/40">
              WASD move · Mouse look · Shift sprint · Space jump · Click an object to open it
              <br />
              Esc frees the cursor · O overview · X closes the last hologram
            </div>
            {!hasNotes && (
              <div className="text-center text-[11px] text-white/50">
                Your palace is empty — write notes in <span className="text-accent-primary">Notes Archive</span> and they appear here as glowing objects.
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export const PalaceOverview = memo(PalaceOverviewInner);
