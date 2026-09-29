// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Kanban Column
// One droppable stage lane: stage header (icon, label, count,
// add), a recessed lane with a stage-coloured heat line, the
// sortable cards and designed empty / drop states.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Anvil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui';
import type { ForgeActiveTimer, ForgeProject, ForgeStage } from '@/types/project-forge';
import { SortableProjectCard } from './ProjectCard';
import { STAGE_META, columnId } from './forge-utils';

interface KanbanColumnProps {
  stage: ForgeStage;
  ids: string[];
  projectsById: Record<string, ForgeProject>;
  now: number;
  weekByProject: Record<string, number>;
  lastActivityById: Record<string, number>;
  activeTimer: ForgeActiveTimer | null;
  /** The card being dragged currently sits in this column. */
  isDropTarget: boolean;
  boardEmpty: boolean;
  onAdd: (stage: ForgeStage) => void;
  onOpen: (id: string) => void;
  onToggleTimer: (id: string) => void;
}

function KanbanColumnInner({
  stage,
  ids,
  projectsById,
  now,
  weekByProject,
  lastActivityById,
  activeTimer,
  isDropTarget,
  boardEmpty,
  onAdd,
  onOpen,
  onToggleTimer,
}: KanbanColumnProps) {
  const meta = STAGE_META[stage];
  const StageIcon = meta.Icon;
  const { setNodeRef } = useDroppable({ id: columnId(stage) });

  return (
    <section aria-label={`${meta.label} column`} className="flex min-h-0 min-w-[228px] max-w-[360px] flex-1 shrink-0 flex-col">
      {/* Stage header */}
      <header className="flex h-10 shrink-0 items-center gap-2 pl-1 pr-0.5">
        <StageIcon size={16} strokeWidth={1.75} aria-hidden className={cn('shrink-0', meta.text)} />
        <h3 className="text-ui font-semibold text-fg">{meta.label}</h3>
        <span className="tabular rounded-full bg-surface-active px-1.5 font-mono text-2xs leading-4 text-fg-muted">
          {ids.length}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-xs text-fg-subtle @5xl:inline" title={meta.hint}>
          {meta.hint}
        </span>
        <span className="flex-1 @5xl:hidden" />
        <IconButton
          icon={Plus}
          size="sm"
          aria-label={`Add project to ${meta.label}`}
          tooltip={`Add to ${meta.label}`}
          onClick={() => onAdd(stage)}
        />
      </header>

      {/* Lane */}
      <div
        ref={setNodeRef}
        className={cn(
          'scrollbar-thin relative min-h-24 flex-1 space-y-2 overflow-y-auto rounded-card p-2',
          'transition-[background-color,box-shadow] duration-180 ease-out-quint',
          isDropTarget ? 'bg-accent/[0.06] ring-1 ring-inset ring-accent/30' : 'bg-ink-950/45'
        )}
      >
        <span
          aria-hidden
          className={cn('pointer-events-none absolute inset-x-3 top-0 h-px bg-linear-to-r to-transparent', meta.line)}
        />
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const project = projectsById[id];
            if (!project) return null;
            return (
              <SortableProjectCard
                key={id}
                project={project}
                now={now}
                weekMs={weekByProject[id] ?? 0}
                lastActivity={lastActivityById[id] ?? 0}
                runningSince={activeTimer?.projectId === id ? activeTimer.startedAt : null}
                onOpen={onOpen}
                onToggleTimer={onToggleTimer}
              />
            );
          })}
        </SortableContext>

        {ids.length === 0 &&
          (boardEmpty && stage === 'ideas' ? (
            <button
              type="button"
              onClick={() => onAdd(stage)}
              className={cn(
                'focus-ring group/cta flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-ember-500/35 px-3 py-6 text-center',
                'transition-[background-color,border-color] duration-120 ease-out-quint hover:border-ember-500/60 hover:bg-ember-500/[0.05]'
              )}
            >
              <span className="mb-1 flex size-10 items-center justify-center rounded-card border border-ember-500/35 bg-linear-to-b from-ink-750 to-ink-850 text-ember-400 shadow-[0_0_24px_-6px_var(--color-ember-500)] inset-shadow-[0_1px_0_var(--color-surface-active)]">
                <Anvil size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-ui font-medium text-fg">Forge your first project</span>
              <span className="text-xs text-fg-subtle">Ideas, side projects, hackathon builds</span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-1.5 rounded-card border border-dashed border-line px-3 py-6 text-center">
              <StageIcon size={16} strokeWidth={1.75} aria-hidden className="text-fg-faint" />
              <p className="text-xs text-fg-muted">{meta.empty}</p>
              <p className="text-2xs text-fg-subtle">Drag a card here</p>
            </div>
          ))}
      </div>
    </section>
  );
}

export const KanbanColumn = memo(KanbanColumnInner);
