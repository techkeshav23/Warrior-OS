// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Card
// Glass kanban card: name, stack badges, progress, last activity,
// per-project timer button. Sortable wrapper for @dnd-kit.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { Clock, Pause, Play, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { effectiveProgress } from '@/stores/useProjectForgeStore';
import type { ForgeProject } from '@/types/project-forge';
import { RunningClock } from './RunningClock';
import { STAGE_META, formatHours, formatRelative } from './forge-utils';

export interface ProjectCardProps {
  project: ForgeProject;
  now: number;
  /** Tracked ms this week (live timer included). */
  weekMs: number;
  /** Epoch ms of the last activity on the project. */
  lastActivity: number;
  /** startedAt of this project's running timer, if any. */
  runningSince: number | null;
  onToggleTimer?: (id: string) => void;
  /** Rendered inside the drag overlay. */
  overlay?: boolean;
  /** Placeholder left in the column while dragging. */
  ghost?: boolean;
}

function ProjectCardViewInner({
  project,
  now,
  weekMs,
  lastActivity,
  runningSince,
  onToggleTimer,
  overlay = false,
  ghost = false,
}: ProjectCardProps) {
  const meta = STAGE_META[project.stage];
  const progress = effectiveProgress(project);
  const running = runningSince !== null;
  const stack = project.techStack.slice(0, 4);
  const extraStack = project.techStack.length - stack.length;

  return (
    <div
      className={cn(
        'group relative rounded-lg border p-2.5 backdrop-blur-sm transition-colors',
        overlay
          ? 'rotate-[1.2deg] border-cyan-400/60 bg-[#0d1522]/95 shadow-2xl shadow-black/60'
          : running
            ? 'border-cyan-400/50 bg-cyan-400/[0.07] shadow-[0_0_18px_rgba(0,240,255,0.15)]'
            : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]',
        ghost && 'opacity-40'
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">{project.name}</p>
        {onToggleTimer && !overlay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTimer(project.id);
            }}
            // Keep Enter/Space on this button from reaching the card's
            // open/drag key handling. A plain click never starts a drag
            // because the mouse sensor needs 6px of movement first.
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={running ? `Stop timer for ${project.name}` : `Start timer for ${project.name}`}
            title={running ? 'Stop timer' : 'Start timer'}
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
              running
                ? 'border-cyan-400/50 bg-cyan-400/20 text-cyan-200 hover:bg-cyan-400/30'
                : 'border-white/10 text-white/45 hover:border-cyan-400/40 hover:text-cyan-300'
            )}
          >
            {running ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
        )}
      </div>

      {project.description && (
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/50">{project.description}</p>
      )}

      {(stack.length > 0 || project.onHold) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {project.onHold && (
            <span className="flex items-center gap-0.5 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
              <Pause className="h-2.5 w-2.5" /> On hold
            </span>
          )}
          {stack.map((tech) => (
            <span
              key={tech}
              className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-white/70"
            >
              {tech}
            </span>
          ))}
          {extraStack > 0 && <span className="px-1 py-0.5 text-[9px] text-white/40">+{extraStack}</span>}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className={cn('h-full rounded-full transition-all', meta.bar)} style={{ width: `${progress}%` }} />
        </div>
        <span className="w-8 text-right text-[10px] tabular-nums text-white/55">{progress}%</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-white/45">
        {running && runningSince !== null ? (
          <span className="flex items-center gap-1 text-cyan-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            <RunningClock startedAt={runningSince} />
          </span>
        ) : (
          <span className="flex items-center gap-1" title="Tracked this week">
            <Clock className="h-3 w-3" />
            {weekMs > 0 ? `${formatHours(weekMs)} this wk` : 'no time this wk'}
          </span>
        )}
        <span title="Last activity">{running ? 'active now' : formatRelative(lastActivity, now)}</span>
      </div>
    </div>
  );
}

export const ProjectCardView = memo(ProjectCardViewInner);

interface SortableProjectCardProps extends ProjectCardProps {
  onOpen: (id: string) => void;
}

function SortableProjectCardInner({ onOpen, ...cardProps }: SortableProjectCardProps) {
  const { project } = cardProps;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Enter opens the card; Space is the drag key (see KanbanBoard sensors).
    if (event.key === 'Enter' && !isDragging) {
      event.preventDefault();
      onOpen(project.id);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      onClick={() => onOpen(project.id)}
      aria-label={`${project.name}, ${STAGE_META[project.stage].label}, ${effectiveProgress(project)}% done`}
      className="touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
    >
      <ProjectCardView {...cardProps} ghost={isDragging} />
    </div>
  );
}

export const SortableProjectCard = memo(SortableProjectCardInner);
