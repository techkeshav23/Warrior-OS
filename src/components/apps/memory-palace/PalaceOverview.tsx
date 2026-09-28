// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Overview (spec 6.29)
// Palace overview screen: objects (notes · cards · projects), rooms,
// revision urgency (spaced repetition due / overdue / never studied),
// recency spread, per-room urgency with fly-to buttons, and how far the
// palace is from its next growth.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Building2, Crown, Footprints, Sparkles, Star, TriangleAlert, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppIcon, Button, IconButton, Kbd, ProgressBar, StatTile } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import {
  OBJECTS_PER_CORRIDOR,
  OBJECTS_PER_ROOM,
  ROOMS_PER_WING,
  type PalaceGrowthState,
} from './PalaceGrowth';
import type { RoomLayout } from './PalaceNavigation';
import { NEW_COLOR, RECENCY_STYLES, recencyLabelColor } from './KnowledgeObject';
import type { RecencyBucket } from './palaceData';
import { PALACE } from './palaceTheme';

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

function Growth({ label, current, from, at, color }: { label: string; current: number; from: number; at: number | null; color: string }) {
  if (at === null) {
    return (
      <div className="flex h-8 items-center justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="font-mono text-2xs uppercase tracking-[0.12em] text-success">Complete</span>
      </div>
    );
  }
  const start = Math.max(0, Math.min(from, at - 1));
  const pct = Math.max(0, Math.min(1, (current - start) / Math.max(1, at - start)));
  return (
    <ProgressBar
      size="sm"
      value={pct * 100}
      color={color}
      label={<span className="text-xs text-fg-muted">{label}</span>}
      showValue
      valueLabel={
        <span className="tabular font-mono text-2xs text-fg-subtle">
          {current}/{at}
        </span>
      }
      aria-label={`${label}: ${current} of ${at} objects`}
    />
  );
}

const BUCKETS: RecencyBucket[] = ['today', 'week', 'month', 'stale'];

function PalaceOverviewInner({ summary, growth, rooms, mode, hasContent, onEnter, onClose, onTeleport }: PalaceOverviewProps) {
  const reduceMotion = useReducedMotion();
  const total = Math.max(1, summary.objects);
  const urgent = [...rooms].filter((r) => r.dueCount > 0).sort((a, b) => b.dueCount - a.dueCount);
  const intro = mode === 'intro';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={TRANSITION.small}
      className={cn(
        'absolute inset-0 z-30 flex items-center justify-center p-4',
        intro ? 'bg-ink-950/70 backdrop-blur-sm lite:backdrop-blur-none' : 'bg-ink-950/50'
      )}
      onClick={intro ? undefined : onClose}
    >
      <motion.div
        role="dialog"
        aria-modal={intro ? undefined : true}
        aria-labelledby="palace-overview-title"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97, y: reduceMotion ? 0 : 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={TRANSITION.panel}
        className="glass-popover @container relative flex max-h-full w-full max-w-[600px] flex-col overflow-hidden rounded-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-start gap-3 px-6 pb-4 pt-6">
          <span aria-hidden className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-accent/50 to-transparent" />
          <AppIcon appId="memory-palace" size={40} active />
          <div className="min-w-0 flex-1">
            <div className="hud-label mb-1">{intro ? 'Learn · Spatial memory' : 'Overview'}</div>
            <h2 id="palace-overview-title" className="text-xl font-semibold text-fg">
              Memory Palace
            </h2>
            <p className="mt-1 text-ui text-fg-muted">
              Every note, card and project is an object. Every folder, tag, deck and forge is a room. Walk your knowledge.
            </p>
          </div>
          {!intro && <IconButton icon={X} aria-label="Close overview" tooltip shortcut="O" onClick={onClose} />}
        </div>

        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
          {/* Stats */}
          <div>
            <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
              <StatTile size="sm" label="Objects" value={summary.objects} icon={Sparkles} />
              <StatTile size="sm" label="Rooms" value={summary.rooms} icon={Building2} />
              <StatTile
                size="sm"
                label="Due now"
                value={summary.due}
                icon={TriangleAlert}
                tone={summary.due > 0 ? 'danger' : 'success'}
              />
              <StatTile size="sm" label="New cards" value={summary.fresh} icon={Star} tone={summary.fresh > 0 ? 'gold' : 'default'} />
            </div>
            <p className="tabular mt-2 font-mono text-2xs text-fg-subtle">
              {summary.notes} note{summary.notes === 1 ? '' : 's'} · {summary.cards} card{summary.cards === 1 ? '' : 's'} ·{' '}
              {summary.projects} project{summary.projects === 1 ? '' : 's'}
            </p>
          </div>

          {/* Revision recency */}
          <section aria-label="Revision recency">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="hud-label">Revision recency</h3>
              <span className="tabular truncate text-xs text-fg-subtle">
                {summary.overdue > 0 ? `${summary.overdue} overdue · ` : ''}
                {summary.synced} synced with Training Grounds
              </span>
            </div>
            <div className="flex h-2 gap-px overflow-hidden rounded-full bg-ink-700">
              {BUCKETS.map((b) =>
                summary.recency[b] > 0 ? (
                  <div
                    key={b}
                    title={`${RECENCY_STYLES[b].label}: ${summary.recency[b]}`}
                    style={{ width: `${(summary.recency[b] / total) * 100}%`, backgroundColor: recencyLabelColor(b) }}
                  />
                ) : null
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted">
              {BUCKETS.map((b) => (
                <span key={b} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: recencyLabelColor(b) }} aria-hidden />
                  {RECENCY_STYLES[b].label}
                  <span className="tabular font-mono text-fg">{summary.recency[b]}</span>
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border-[1.5px] border-danger" aria-hidden />
                Red ring = due
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full border-[1.5px]" style={{ borderColor: NEW_COLOR }} aria-hidden />
                Amber ring = never studied
              </span>
            </div>
          </section>

          {/* Rooms that need attention */}
          {urgent.length > 0 && (
            <section aria-label="Rooms needing review">
              <h3 className="hud-label mb-2">Rooms needing review</h3>
              <div className="grid gap-1.5 @md:grid-cols-2">
                {urgent.slice(0, 6).map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => onTeleport(r.key)}
                    title={`Fly to ${r.label}`}
                    className="focus-ring group flex h-10 min-w-0 items-center gap-2.5 rounded-control border border-line bg-surface-2 px-3 text-left transition-colors duration-120 ease-out-quint hover:border-line-strong hover:bg-surface-hover active:bg-surface-active"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: r.accent }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-ui text-fg">{r.label}</span>
                    <span className="tabular shrink-0 rounded-full bg-danger/12 px-2 font-mono text-2xs leading-5 text-danger">
                      {r.dueCount} due
                    </span>
                    <ChevronRight size={14} strokeWidth={1.75} className="shrink-0 text-fg-subtle group-hover:text-fg" aria-hidden />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Growth */}
          <section aria-label="Palace growth" className="rounded-card bg-surface-2 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="hud-label flex items-center gap-1.5">
                <Crown size={14} strokeWidth={1.75} aria-hidden /> Palace growth
              </h3>
              <span className="tabular font-mono text-2xs text-fg-subtle">
                {growth.wings} wing{growth.wings === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <Growth
                label="Next room"
                current={growth.objectCount}
                from={(growth.nextRoomAt ?? 0) - OBJECTS_PER_ROOM}
                at={growth.nextRoomAt}
                color={PALACE.glow}
              />
              <Growth
                label="Corridor extension"
                current={growth.objectCount}
                from={(growth.nextCorridorAt ?? 0) - OBJECTS_PER_CORRIDOR}
                at={growth.nextCorridorAt}
                color={PALACE.lamp}
              />
              <Growth
                label="New wing"
                current={growth.objectCount}
                from={(growth.nextWingAt ?? 0) - OBJECTS_PER_ROOM * ROOMS_PER_WING}
                at={growth.nextWingAt}
                color={PALACE.wing}
              />
              <Growth
                label="Grand Hall"
                current={growth.objectCount}
                from={0}
                at={growth.grandHall ? null : growth.grandHallAt}
                color={PALACE.hall}
              />
            </div>
            {summary.unhoused > 0 && (
              <p className="mt-3 text-xs text-fg-subtle">
                {summary.unhoused} object{summary.unhoused === 1 ? '' : 's'} wait on the archive table in the entrance hall until a room unlocks.
              </p>
            )}
          </section>

        </div>
        {intro && (
          <div className="flex shrink-0 flex-col items-center gap-3 border-t border-line bg-ink-950/40 px-6 py-4">
            <Button variant="primary" size="lg" leadingIcon={Footprints} onClick={onEnter} className="min-w-56">
              Enter the palace
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-fg-subtle">
              <span className="flex items-center gap-1">
                <Kbd size="sm">W</Kbd>
                <Kbd size="sm">A</Kbd>
                <Kbd size="sm">S</Kbd>
                <Kbd size="sm">D</Kbd>
                move
              </span>
              <span className="flex items-center gap-1">
                <Kbd size="sm">Shift</Kbd> sprint
              </span>
              <span className="flex items-center gap-1">
                <Kbd size="sm">Space</Kbd> jump
              </span>
              <span className="flex items-center gap-1">
                <Kbd size="sm">Esc</Kbd> free cursor
              </span>
              <span className="flex items-center gap-1">
                <Kbd size="sm">O</Kbd> overview
              </span>
              <span className="flex items-center gap-1">
                <Kbd size="sm">X</Kbd> close hologram
              </span>
            </div>
            {!hasContent && (
              <p className="max-w-md text-center text-xs text-fg-muted">
                Your palace is only foundations so far. Write notes in <span className="text-accent">Notes Archive</span>, build
                decks in <span className="text-accent">Training Grounds</span> or start a project in{' '}
                <span className="text-accent">Project Forge</span>, and they appear here as glowing objects.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export const PalaceOverview = memo(PalaceOverviewInner);
