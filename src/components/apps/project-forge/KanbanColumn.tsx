// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Kanban Column
// One droppable stage column with its sortable project cards
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const { setNodeRef } = useDroppable({ id: columnId(stage) });

  return (
    <section
      aria-label={`${meta.label} column`}
      className={cn(
        'flex min-h-0 min-w-[220px] max-w-[360px] flex-1 shrink-0 flex-col rounded-xl border bg-white/[0.02] transition-colors',
        isDropTarget ? 'border-cyan-400/40 bg-cyan-400/[0.03]' : meta.border
      )}
    >
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
        <h3 className="text-xs font-semibold tracking-wide text-white/85">{meta.label}</h3>
        <span className="rounded-full bg-white/[0.06] px-1.5 text-[10px] tabular-nums text-white/50">{ids.length}</span>
        <span className="hidden truncate text-[10px] text-white/35 @4xl:inline">{meta.hint}</span>
        <button
          type="button"
          onClick={() => onAdd(stage)}
          aria-label={`Add project to ${meta.label}`}
          title={`Add to ${meta.label}`}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-cyan-300"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </header>

      <div ref={setNodeRef} className="min-h-[96px] flex-1 space-y-2 overflow-y-auto p-2">
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
              className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-amber-400/30 px-3 py-5 text-center transition-colors hover:border-amber-400/60 hover:bg-amber-400/[0.04]"
            >
              <Plus className="h-4 w-4 text-amber-300" />
              <span className="text-xs font-medium text-white/75">Forge your first project</span>
              <span className="text-[10px] text-white/40">Ideas, side projects, hackathon builds</span>
            </button>
          ) : (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-5 text-center text-[11px] text-white/35">
              Drop a card here
            </p>
          ))}
      </div>
    </section>
  );
}

export const KanbanColumn = memo(KanbanColumnInner);
