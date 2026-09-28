// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Forge App
// Kanban board + time tracking for side projects. Successor of
// the old Projects app (same app id: project-tracker); its data
// is imported automatically on first load.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Hammer, Plus, Square, SquareKanban, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import type { ForgeStage } from '@/types/project-forge';
import { KanbanBoard } from './KanbanBoard';
import { ProjectDetail } from './ProjectDetail';
import { ProjectModal } from './ProjectModal';
import { RunningClock } from './RunningClock';
import { TimeTracker } from './TimeTracker';
import { celebrateShip } from './forge-utils';

type ForgeTab = 'board' | 'time';

type ModalState = { mode: 'create'; stage: ForgeStage } | { mode: 'edit'; projectId: string } | null;

const TABS: { id: ForgeTab; label: string; Icon: typeof SquareKanban }[] = [
  { id: 'board', label: 'Board', Icon: SquareKanban },
  { id: 'time', label: 'Time', Icon: Timer },
];

function ProjectForgeAppInner() {
  const [tab, setTab] = useState<ForgeTab>('board');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const projects = useProjectForgeStore((s) => s.projects);
  const activeTimer = useProjectForgeStore((s) => s.activeTimer);
  const stopTimer = useProjectForgeStore((s) => s.stopTimer);

  // First open: make sure the old Projects data is in (normally already done at
  // hydration) and catch up on achievements whose condition already holds.
  useEffect(() => {
    const forge = useProjectForgeStore.getState();
    forge.ensureMigrated();
    forge.syncAchievements();
  }, []);

  const shippedCount = useMemo(() => projects.filter((p) => p.stage === 'shipped').length, [projects]);
  const runningProject = activeTimer ? projects.find((p) => p.id === activeTimer.projectId) ?? null : null;
  const detailProject = detailId ? projects.find((p) => p.id === detailId) ?? null : null;
  const editProject = modal?.mode === 'edit' ? projects.find((p) => p.id === modal.projectId) ?? null : null;

  const openCreate = (stage: ForgeStage) => setModal({ mode: 'create', stage });

  return (
    <div className="@container relative flex h-full flex-col bg-black/30 text-white">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-3 py-2">
        <div className="mr-1 flex items-center gap-2">
          <Hammer className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-bold tracking-wider text-cyan-300">PROJECT FORGE</h2>
        </div>

        <div role="tablist" aria-label="Project Forge views" className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                tab === id ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/55 hover:text-white/85'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <span className="hidden text-[11px] text-white/40 @2xl:inline">
          {projects.length} {projects.length === 1 ? 'project' : 'projects'} · {shippedCount} shipped
        </span>

        <div className="ml-auto flex items-center gap-2">
          {activeTimer && (
            <div className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 py-0.5 pl-2.5 pr-0.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              <button
                type="button"
                onClick={() => runningProject && setDetailId(runningProject.id)}
                className="hidden max-w-[140px] truncate text-xs text-cyan-200 hover:underline @xl:inline"
              >
                {runningProject?.name ?? 'Timer'}
              </button>
              <RunningClock startedAt={activeTimer.startedAt} className="text-xs text-cyan-100" />
              <button
                type="button"
                onClick={() => stopTimer()}
                aria-label="Stop timer and log the session"
                title="Stop and log"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/40"
              >
                <Square className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => openCreate('ideas')}
            className="flex items-center gap-1 rounded-lg bg-cyan-400 px-2.5 py-1 text-xs font-semibold text-black transition-colors hover:bg-cyan-300"
          >
            <Plus className="h-3.5 w-3.5" /> New project
          </button>
        </div>
      </header>

      {/* Views */}
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            role="tabpanel"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
          >
            {tab === 'board' ? (
              <KanbanBoard onOpen={setDetailId} onAdd={openCreate} />
            ) : (
              <div className="h-full overflow-y-auto">
                <TimeTracker onOpenProject={setDetailId} />
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
            onEdit={(id) => setModal({ mode: 'edit', projectId: id })}
          />
        )}
      </AnimatePresence>

      {/* Add / edit */}
      <AnimatePresence>
        {modal && (modal.mode === 'create' || editProject) && (
          <ProjectModal
            key={modal.mode === 'edit' ? `edit-${modal.projectId}` : `create-${modal.stage}`}
            project={editProject}
            initialStage={modal.mode === 'create' ? modal.stage : editProject?.stage ?? 'ideas'}
            onClose={() => setModal(null)}
            onSaved={(_id, shipped) => {
              setModal(null);
              if (shipped.length > 0) celebrateShip();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export const ProjectForgeApp = memo(ProjectForgeAppInner);
