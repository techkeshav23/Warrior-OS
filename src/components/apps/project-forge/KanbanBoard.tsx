// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Kanban Board
// Ideas → Building → Testing → Shipped, drag and drop between
// and within columns (@dnd-kit). The drag overlay is portalled
// to <body> because OS windows are transformed containers.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type MeasuringConfiguration,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { FORGE_STAGES, groupByStage, useProjectForgeStore } from '@/stores/useProjectForgeStore';
import type { ForgeBoardColumns, ForgeProject, ForgeStage } from '@/types/project-forge';
import { KanbanColumn } from './KanbanColumn';
import { ProjectCardView } from './ProjectCard';
import { useNow } from './useNow';
import {
  STAGE_META,
  celebrateShip,
  lastSessionEnd,
  stageOfColumnId,
  summarizeWeek,
} from './forge-utils';

interface KanbanBoardProps {
  onOpen: (id: string) => void;
  onAdd: (stage: ForgeStage) => void;
}

const MEASURING: MeasuringConfiguration = {
  droppable: { strategy: MeasuringStrategy.Always },
};

const DROP_ANIMATION: DropAnimation = {
  duration: 180,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

/** Space picks up / drops; Enter is left free to open a card. */
const KEYBOARD_CODES = {
  start: ['Space'],
  cancel: ['Escape'],
  end: ['Space', 'Enter', 'Tab'],
};

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Press space to pick up a project card. Use the arrow keys to move it within or between columns, space to drop it, or escape to cancel. Press enter to open its details.',
};

function findStage(id: UniqueIdentifier, columns: ForgeBoardColumns): ForgeStage | null {
  const key = String(id);
  const column = stageOfColumnId(key);
  if (column) return column;
  for (const stage of FORGE_STAGES) {
    if (columns[stage].includes(key)) return stage;
  }
  return null;
}

/** Moves the active card into the column it is hovering (pure). */
function moveAcross(
  columns: ForgeBoardColumns,
  activeKey: string,
  overKey: string,
  below: boolean
): ForgeBoardColumns {
  const from = findStage(activeKey, columns);
  const to = findStage(overKey, columns);
  if (!from || !to || from === to) return columns;
  const target = columns[to];
  let index = target.length;
  if (!stageOfColumnId(overKey)) {
    const overIndex = target.indexOf(overKey);
    if (overIndex >= 0) index = overIndex + (below ? 1 : 0);
  }
  const next: ForgeBoardColumns = { ...columns };
  next[from] = columns[from].filter((id) => id !== activeKey);
  next[to] = [...target.slice(0, index), activeKey, ...target.slice(index)];
  return next;
}

function KanbanBoardInner({ onOpen, onAdd }: KanbanBoardProps) {
  const projects = useProjectForgeStore((s) => s.projects);
  const sessions = useProjectForgeStore((s) => s.sessions);
  const activeTimer = useProjectForgeStore((s) => s.activeTimer);
  const applyBoard = useProjectForgeStore((s) => s.applyBoard);
  const startTimer = useProjectForgeStore((s) => s.startTimer);
  const stopTimer = useProjectForgeStore((s) => s.stopTimer);
  const now = useNow(30_000);

  // `draft` renders the in-flight layout; `draftRef` is the same value, updated
  // synchronously in the drag handlers so a fast drop never reads a stale layout.
  const [draft, setDraft] = useState<ForgeBoardColumns | null>(null);
  const draftRef = useRef<ForgeBoardColumns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const baseColumns = useMemo(() => groupByStage(projects), [projects]);
  const board = draft ?? baseColumns;

  const projectsById = useMemo(() => {
    const map: Record<string, ForgeProject> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  const week = useMemo(() => summarizeWeek(sessions, activeTimer, now), [sessions, activeTimer, now]);

  const lastActivityById = useMemo(() => {
    const ends = lastSessionEnd(sessions);
    const map: Record<string, number> = {};
    for (const p of projects) {
      const touched = Date.parse(p.updatedAt);
      map[p.id] = Math.max(Number.isNaN(touched) ? 0 : touched, ends[p.id] ?? 0);
    }
    return map;
  }, [projects, sessions]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: KEYBOARD_CODES,
    })
  );

  // Pointer first (precise), rectangles as a fallback; when the pointer is
  // over a column's empty area, snap to the closest card inside it.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
    const overId = getFirstCollision(hits, 'id');
    if (overId == null) return [];
    const stage = stageOfColumnId(String(overId));
    if (stage) {
      const ids = board[stage];
      if (ids.length > 0) {
        const inColumn = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) => ids.includes(String(c.id))),
        });
        if (inColumn.length > 0) return inColumn;
      }
    }
    return [{ id: overId }];
  };

  const nameOf = (id: UniqueIdentifier): string => projectsById[String(id)]?.name ?? 'project';
  const placeOf = (id: UniqueIdentifier): string => {
    const stage = findStage(id, board);
    return stage ? STAGE_META[stage].label : 'the board';
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${placeOf(over.id)}.` : `${nameOf(active.id)} is outside the columns.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} dropped in ${placeOf(over.id)}.` : `${nameOf(active.id)} returned to its column.`,
    onDragCancel: ({ active }) => `Move cancelled. ${nameOf(active.id)} returned to its column.`,
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    draftRef.current = baseColumns;
    setActiveId(String(active.id));
    setDraft(baseColumns);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const translated = active.rect.current.translated;
    const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2;
    const current = draftRef.current ?? baseColumns;
    const next = moveAcross(current, String(active.id), String(over.id), below);
    if (next === current) return;
    draftRef.current = next;
    setDraft(next);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const columns = draftRef.current ?? baseColumns;
    draftRef.current = null;
    setActiveId(null);
    setDraft(null);
    // Dropped outside every column: keep the original layout.
    if (!over) return;

    const activeKey = String(active.id);
    const overKey = String(over.id);
    const stage = findStage(activeKey, columns);
    const overStage = findStage(overKey, columns);
    let finalColumns = columns;
    if (stage && overStage && stage === overStage) {
      const items = columns[stage];
      const oldIndex = items.indexOf(activeKey);
      const newIndex = stageOfColumnId(overKey) ? items.length - 1 : items.indexOf(overKey);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        const reordered: ForgeBoardColumns = { ...columns };
        reordered[stage] = arrayMove(items, oldIndex, newIndex);
        finalColumns = reordered;
      }
    }
    const shipped = applyBoard(finalColumns);
    if (shipped.length > 0) celebrateShip();
  };

  const handleDragCancel = () => {
    draftRef.current = null;
    setActiveId(null);
    setDraft(null);
  };

  const toggleTimer = (id: string) => {
    if (activeTimer?.projectId === id) stopTimer();
    else startTimer(id);
  };

  const activeProject = activeId ? projectsById[activeId] ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={MEASURING}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full min-h-0 gap-3 overflow-x-auto p-3">
        {FORGE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            ids={board[stage]}
            projectsById={projectsById}
            now={now}
            weekByProject={week.byProject}
            lastActivityById={lastActivityById}
            activeTimer={activeTimer}
            isDropTarget={activeId !== null && board[stage].includes(activeId)}
            boardEmpty={projects.length === 0}
            onAdd={onAdd}
            onOpen={onOpen}
            onToggleTimer={toggleTimer}
          />
        ))}
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <DragOverlay dropAnimation={DROP_ANIMATION} zIndex={9000}>
            {activeProject ? (
              <ProjectCardView
                project={activeProject}
                now={now}
                weekMs={week.byProject[activeProject.id] ?? 0}
                lastActivity={lastActivityById[activeProject.id] ?? 0}
                runningSince={activeTimer?.projectId === activeProject.id ? activeTimer.startedAt : null}
                overlay
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}

export const KanbanBoard = memo(KanbanBoardInner);
