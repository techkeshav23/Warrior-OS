// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Forge App
// Kanban board + time tracking for side projects. Successor of
// the old Projects app (same app id: project-tracker); its data
// is imported automatically on first load.
// Frame: AppHeader (title, live counts, Board/Time tabs, running
// timer, ember "New project") over the active view; the project
// detail slides in as a sheet, add/edit is a kit Dialog.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus, Square, SquareKanban, Timer } from 'lucide-react';
import { AppHeader, Button, IconButton, Tabs } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import type { ForgeProject, ForgeStage } from '@/types/project-forge';
import { KanbanBoard } from './KanbanBoard';
import { ProjectDetail } from './ProjectDetail';
import { ProjectModal } from './ProjectModal';
import { RunningClock } from './RunningClock';
import { TimeTracker } from './TimeTracker';
import { useNow } from './useNow';
import { celebrateShip, formatHours, summarizeWeek } from './forge-utils';

type ForgeTab = 'board' | 'time';

type ModalTarget = { mode: 'create'; stage: ForgeStage } | { mode: 'edit'; projectId: string };

/** The dialog stays mounted while it animates out; `n` remounts it for every open. */
interface ModalState {
  target: ModalTarget;
  open: boolean;
  n: number;
}

const TABS = [
  { id: 'board', label: 'Board', icon: SquareKanban },
  { id: 'time', label: 'Time', icon: Timer },
];

interface TimerPillProps {
  project: ForgeProject | null;
  startedAt: number;
  onOpen: (id: string) => void;
  onStop: () => void;
}

/** Live timer readout in the header: the forge is lit while it runs. */
function TimerPill({ project, startedAt, onOpen, onStop }: TimerPillProps) {
  return (
    <div
      title={`Timer running${project ? ` on ${project.name}` : ''}`}
      className="armor-plate chamfer-sm ember-edge flex h-8 items-center gap-2 bg-ember-800/45 pl-3 pr-1"
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-ember-400 shadow-[0_0_8px_var(--color-ember-400)] animate-pulse-soft"
      />
      <button
        type="button"
        onClick={() => project && onOpen(project.id)}
        title={project ? `Open ${project.name}` : undefined}
        className="focus-ring hidden max-w-[140px] truncate text-ui font-medium text-fg transition-colors duration-120 hover:text-ember-300 @3xl:inline"
      >
        {project?.name ?? 'Timer'}
      </button>
      <RunningClock startedAt={startedAt} className="text-ui text-ember-300" />
      <IconButton
        icon={<Square size={10} strokeWidth={2.5} fill="currentColor" aria-hidden />}
        size="xs"
        aria-label="Stop timer and log the session"
        tooltip="Stop and log"
        onClick={onStop}
      />
    </div>
  );
}

function ProjectForgeAppInner() {
  const [tab, setTab] = useState<ForgeTab>('board');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const reduceMotion = useReducedMotion();
  const tabsId = useId();

  const projects = useProjectForgeStore((s) => s.projects);
  const sessions = useProjectForgeStore((s) => s.sessions);
  const activeTimer = useProjectForgeStore((s) => s.activeTimer);
  const stopTimer = useProjectForgeStore((s) => s.stopTimer);
  const now = useNow(60_000);

  // First open: make sure the old Projects data is in (normally already done at
  // hydration) and catch up on achievements whose condition already holds.
  useEffect(() => {
    const forge = useProjectForgeStore.getState();
    forge.ensureMigrated();
    forge.syncAchievements();
  }, []);

  const shippedCount = useMemo(() => projects.filter((p) => p.stage === 'shipped').length, [projects]);
  const weekTotal = useMemo(() => summarizeWeek(sessions, activeTimer, now).total, [sessions, activeTimer, now]);
  const runningProject = activeTimer ? projects.find((p) => p.id === activeTimer.projectId) ?? null : null;
  const detailProject = detailId ? projects.find((p) => p.id === detailId) ?? null : null;

  const target = modal?.target ?? null;
  const editProject = target?.mode === 'edit' ? projects.find((p) => p.id === target.projectId) ?? null : null;
  // An edited project that was deleted meanwhile has nothing left to show.
  const modalVisible = modal !== null && (target?.mode === 'create' || editProject !== null);

  const openModal = (next: ModalTarget) => setModal((m) => ({ target: next, open: true, n: (m?.n ?? 0) + 1 }));
  const closeModal = () => setModal((m) => (m ? { ...m, open: false } : m));
  const openCreate = (stage: ForgeStage) => openModal({ mode: 'create', stage });

  const subtitle = [
    `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`,
    `${shippedCount} shipped`,
    weekTotal > 0 ? `${formatHours(weekTotal)} this week` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="@container relative flex h-full min-h-0 flex-col text-ui text-fg">
      <AppHeader
        title="Projects"
        subtitle={subtitle}
        actions={
          <>
            <Tabs
              variant="pill"
              size="sm"
              aria-label="Project Forge views"
              idPrefix={tabsId}
              value={tab}
              onChange={(id) => setTab(id as ForgeTab)}
              tabs={TABS}
            />
            {activeTimer && (
              <TimerPill
                project={runningProject}
                startedAt={activeTimer.startedAt}
                onOpen={setDetailId}
                onStop={() => stopTimer()}
              />
            )}
            {/* On the Time view the timer's Start is the hero, so this steps back. */}
            <Button
              variant={tab === 'board' ? 'ember' : 'secondary'}
              leadingIcon={Plus}
              onClick={() => openCreate('ideas')}
            >
              New project
            </Button>
          </>
        }
      />

      {/* Views */}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            role="tabpanel"
            id={`${tabsId}-panel-${tab}`}
            aria-labelledby={`${tabsId}-tab-${tab}`}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: TRANSITION.hover }}
            transition={TRANSITION.small}
            className="absolute inset-0"
          >
            {tab === 'board' ? (
              <KanbanBoard onOpen={setDetailId} onAdd={openCreate} />
            ) : (
              <div className="scrollbar-thin h-full overflow-y-auto">
                <TimeTracker onOpenProject={setDetailId} onCreateProject={() => openCreate('ideas')} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Expanded project */}
      <AnimatePresence>
        {detailProject && (
          <ProjectDetail
            key={detailProject.id}
            project={detailProject}
            onClose={() => setDetailId(null)}
            onEdit={(id) => openModal({ mode: 'edit', projectId: id })}
          />
        )}
      </AnimatePresence>

      {/* Add / edit */}
      {modal && target && (target.mode === 'create' || editProject) && (
        <ProjectModal
          key={`${target.mode === 'edit' ? `edit-${target.projectId}` : `create-${target.stage}`}-${modal.n}`}
          open={modal.open && modalVisible}
          project={editProject}
          initialStage={target.mode === 'create' ? target.stage : editProject?.stage ?? 'ideas'}
          onClose={closeModal}
          onSaved={(_id, shipped) => {
            closeModal();
            if (shipped.length > 0) celebrateShip();
          }}
        />
      )}
    </div>
  );
}

export const ProjectForgeApp = memo(ProjectForgeAppInner);
