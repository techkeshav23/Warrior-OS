// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Overview (spec 6.29)
// Palace overview screen: objects (notes · cards · projects), rooms,
// revision urgency (spaced repetition due / overdue / never studied),
// recency spread, per-room urgency with fly-to buttons, and how far the
// palace is from its next growth.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Building2, Crown, Footprints, Sparkles, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OBJECTS_PER_CORRIDOR,
  OBJECTS_PER_ROOM,
  ROOMS_PER_WING,
  type PalaceGrowthState,
} from './PalaceGrowth';
import type { RoomLayout } from './PalaceNavigation';
import { NEW_COLOR, RECENCY_STYLES } from './KnowledgeObject';
import type { RecencyBucket } from './palaceData';

export interface PalaceSummary {
  objects: number;
  notes: number;
  cards: number;
  projects: number;
  rooms: number;
  due: number;
  overdue: number;
  /** Deck cards never studied yet. */
  fresh: number;
  recency: Record<RecencyBucket, number>;
  /** Objects scheduled by Training Grounds spaced repetition (studied cards + linked notes). */
  synced: number;
  unhoused: number;
}

interface PalaceOverviewProps {
  summary: PalaceSummary;
  growth: PalaceGrowthState;
  rooms: RoomLayout[];
  /** Intro variant (first screen) shows the big "Enter" button. */
  mode: 'intro' | 'panel';
  /** Any notes, cards or projects at all. */
  hasContent: boolean;
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

function Progress({ label, current, from, at, color }: { label: string; current: number; from: number; at: number | null; color: string }) {
  if (at === null) {
    return (
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span>{label}</span>
        <span className="text-accent-success">complete</span>
      </div>
    );
  }
  const start = Math.max(0, Math.min(from, at - 1));
  const pct = Math.max(0, Math.min(1, (current - start) / Math.max(1, at - start)));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-white/55">
        <span>{label}</span>
        <span className="font-mono text-white/40">
          {current}/{at} objects
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
    </div>
  );
}

function PalaceOverviewInner({ summary, growth, rooms, mode, hasContent, onEnter, onClose, onTeleport }: PalaceOverviewProps) {
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
            <div className="text-[11px] text-white/50">
              Every note, card and project is an object. Every folder, tag, deck and forge is a room. Walk your knowledge.
            </div>
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
          <Stat icon={<Star className="h-3 w-3" />} label="New cards" value={summary.fresh} tone={summary.fresh > 0 ? 'text-amber-300' : undefined} />
        </div>
        <div className="mt-1.5 text-[10px] text-white/40">
          {summary.notes} note{summary.notes === 1 ? '' : 's'} · {summary.cards} card{summary.cards === 1 ? '' : 's'} ·{' '}
          {summary.projects} project{summary.projects === 1 ? '' : 's'}
        </div>

        {/* Revision urgency */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-white/40">
            <span>Revision recency</span>
            <span className="normal-case tracking-normal text-white/35">
              {summary.overdue > 0 ? `${summary.overdue} overdue · ` : ''}
              {summary.synced} synced with Training Grounds
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
              red border = due for review
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm border" style={{ borderColor: NEW_COLOR }} />
              amber = card never studied
            </span>
          </div>
        </div>

        {/* Rooms that need attention */}
        {urgent.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[10px] uppercase tracking-widest text-white/40">Rooms needing review</div>
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
            <span className="ml-auto normal-case tracking-normal text-white/35">
              {growth.wings} wing{growth.wings === 1 ? '' : 's'}
            </span>
          </div>
          <Progress
            label="Next room"
            current={growth.objectCount}
            from={(growth.nextRoomAt ?? 0) - OBJECTS_PER_ROOM}
            at={growth.nextRoomAt}
            color="#00f0ff"
          />
          <Progress
            label="Corridor extension"
            current={growth.objectCount}
            from={(growth.nextCorridorAt ?? 0) - OBJECTS_PER_CORRIDOR}
            at={growth.nextCorridorAt}
            color="#ffcc80"
          />
          <Progress
            label="New wing"
            current={growth.objectCount}
            from={(growth.nextWingAt ?? 0) - OBJECTS_PER_ROOM * ROOMS_PER_WING}
            at={growth.nextWingAt}
            color="#b388ff"
          />
          <Progress label="Grand Hall" current={growth.objectCount} from={0} at={growth.grandHall ? null : growth.grandHallAt} color="#ffd740" />
          {summary.unhoused > 0 && (
            <div className="text-[10px] text-white/40">
              {summary.unhoused} object{summary.unhoused === 1 ? '' : 's'} wait on the archive table in the entrance hall until a room unlocks.
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
            {!hasContent && (
              <div className="text-center text-[11px] text-white/50">
                Your palace is only foundations so far — write notes in <span className="text-accent-primary">Notes Archive</span>, build decks in{' '}
                <span className="text-accent-primary">Training Grounds</span> or start a project in{' '}
                <span className="text-accent-primary">Project Forge</span>, and they appear here as glowing objects.
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export const PalaceOverview = memo(PalaceOverviewInner);
