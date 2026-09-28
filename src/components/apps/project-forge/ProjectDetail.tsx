// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Detail
// Expanded view of one project: description, stack, links,
// checklist, stage control, time tracking and danger zone
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Check, ExternalLink, ListChecks, Pause, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FORGE_STAGES, effectiveProgress, useProjectForgeStore } from '@/stores/useProjectForgeStore';
import type { ForgeProject, ForgeStage } from '@/types/project-forge';
import { ConfirmButton } from './ConfirmButton';
import { TimeTracker } from './TimeTracker';
import { useNow } from './useNow';
import {
  STAGE_META,
  celebrateShip,
  displayUrl,
  formatCalendarDate,
  formatRelative,
} from './forge-utils';

interface ProjectDetailProps {
  /**
   * Passed in (not selected here) so the exit animation can keep
   * rendering the last snapshot after the project is deleted.
   */
  project: ForgeProject;
  onClose: () => void;
  onEdit: (id: string) => void;
}

function ProjectDetailInner({ project, onClose, onEdit }: ProjectDetailProps) {
  const moveProject = useProjectForgeStore((s) => s.moveProject);
  const updateProject = useProjectForgeStore((s) => s.updateProject);
  const deleteProject = useProjectForgeStore((s) => s.deleteProject);
  const addTask = useProjectForgeStore((s) => s.addTask);
  const toggleTask = useProjectForgeStore((s) => s.toggleTask);
  const removeTask = useProjectForgeStore((s) => s.removeTask);
  const now = useNow(60_000);
  const [taskInput, setTaskInput] = useState('');
  const titleId = useId();

  const meta = STAGE_META[project.stage];
  const progress = effectiveProgress(project);
  const doneTasks = project.tasks.filter((t) => t.done).length;
  const followsChecklist = project.autoProgress && project.tasks.length > 0;

  const handleMove = (stage: ForgeStage) => {
    const shipped = moveProject(project.id, stage);
    if (shipped.length > 0) celebrateShip();
  };

  const handleAddTask = (event: FormEvent) => {
    event.preventDefault();
    if (!taskInput.trim()) return;
    addTask(project.id, taskInput);
    setTaskInput('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <motion.div
      className="absolute inset-0 z-20 flex justify-center bg-black/55 p-3 backdrop-blur-[2px] @container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        autoFocus
        onKeyDown={handleKeyDown}
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0a0e15]/95 shadow-2xl shadow-black/60 outline-none"
      >
        {/* Header */}
        <header className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider', meta.chip)}>
                {meta.label}
              </span>
              {project.onHold && (
                <span className="flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  <Pause className="h-2.5 w-2.5" /> On hold
                </span>
              )}
            </div>
            <h2 id={titleId} className="mt-1 truncate text-lg font-bold text-white">
              {project.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onEdit(project.id)}
            className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/75 hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-md p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid gap-4 p-4 @2xl:grid-cols-[minmax(0,1fr)_300px]">
            {/* Left column */}
            <div className="min-w-0 space-y-4">
              <section>
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">Description</h3>
                {project.description ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{project.description}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => onEdit(project.id)}
                    className="text-sm text-white/40 underline-offset-2 hover:text-cyan-300 hover:underline"
                  >
                    No description yet. Add one.
                  </button>
                )}
              </section>

              {project.techStack.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">Tech stack</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {project.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-md border border-cyan-400/20 bg-cyan-400/[0.08] px-2 py-0.5 text-xs text-cyan-200"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {project.links.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">Links</h3>
                  <ul className="space-y-1">
                    {project.links.map((link) => (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs hover:border-cyan-400/40"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/40 group-hover:text-cyan-300" />
                          <span className="font-medium text-white/85">{link.label}</span>
                          <span className="min-w-0 truncate text-white/40">{displayUrl(link.url)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Checklist */}
              <section>
                <div className="mb-1.5 flex items-center gap-2">
                  <ListChecks className="h-3.5 w-3.5 text-white/45" />
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Checklist</h3>
                  {project.tasks.length > 0 && (
                    <span className="text-[10px] tabular-nums text-white/40">
                      {doneTasks}/{project.tasks.length}
                    </span>
                  )}
                  <label className="ml-auto flex items-center gap-1.5 text-[10px] text-white/50">
                    <input
                      type="checkbox"
                      checked={project.autoProgress}
                      onChange={(e) => updateProject(project.id, { autoProgress: e.target.checked })}
                      className="h-3 w-3 accent-cyan-400"
                    />
                    drives progress
                  </label>
                </div>
                <ul className="space-y-1">
                  {project.tasks.map((task) => (
                    <li key={task.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-white/[0.03]">
                      <button
                        type="button"
                        onClick={() => toggleTask(project.id, task.id)}
                        aria-pressed={task.done}
                        aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          task.done
                            ? 'border-emerald-400/70 bg-emerald-400/20 text-emerald-300'
                            : 'border-white/25 hover:border-cyan-400/60'
                        )}
                      >
                        {task.done && <Check className="h-3 w-3" />}
                      </button>
                      <span className={cn('min-w-0 flex-1 text-sm', task.done ? 'text-white/35 line-through' : 'text-white/80')}>
                        {task.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTask(project.id, task.id)}
                        aria-label={`Delete task "${task.title}"`}
                        className="rounded p-0.5 text-white/30 opacity-0 transition-opacity hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <form onSubmit={handleAddTask} className="mt-1.5 flex gap-1.5">
                  <input
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    placeholder="Add a task and press Enter"
                    aria-label="New task"
                    maxLength={160}
                    className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/90 outline-none placeholder:text-white/30 focus:border-cyan-400/50"
                  />
                  <button
                    type="submit"
                    aria-label="Add task"
                    className="rounded-md border border-white/10 px-2 text-white/55 hover:border-cyan-400/40 hover:text-cyan-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </form>
              </section>
            </div>

            {/* Right column */}
            <div className="min-w-0 space-y-4">
              <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Progress</h3>
                  <span className="text-sm font-semibold tabular-nums text-white/85">{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={cn('h-full rounded-full transition-all', meta.bar)} style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-white/40">
                  {followsChecklist ? 'Following the checklist' : 'Set manually (Edit)'}
                </p>

                <h3 className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">Stage</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {FORGE_STAGES.map((stage) => {
                    const stageMeta = STAGE_META[stage];
                    const active = project.stage === stage;
                    return (
                      <button
                        key={stage}
                        type="button"
                        aria-pressed={active}
                        disabled={active}
                        onClick={() => handleMove(stage)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                          active ? stageMeta.activeButton : 'border-white/10 text-white/55 hover:bg-white/5'
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', stageMeta.dot)} />
                        {stageMeta.label}
                      </button>
                    );
                  })}
                </div>
                {project.stage !== 'shipped' && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={project.onHold}
                      onChange={(e) => updateProject(project.id, { onHold: e.target.checked })}
                      className="h-3.5 w-3.5 accent-amber-400"
                    />
                    On hold
                  </label>
                )}
              </section>

              <TimeTracker projectId={project.id} />

              <section className="space-y-1 text-[11px] text-white/50">
                <p>
                  Created <span className="text-white/75">{formatCalendarDate(project.createdAt)}</span>
                </p>
                <p>
                  Last activity <span className="text-white/75">{formatRelative(Date.parse(project.updatedAt), now)}</span>
                </p>
                {project.shippedAt && (
                  <p>
                    First shipped <span className="text-emerald-300">{formatCalendarDate(project.shippedAt)}</span>
                  </p>
                )}
              </section>

              <ConfirmButton
                label="Delete project"
                onConfirm={() => {
                  deleteProject(project.id);
                  onClose();
                }}
                armedChildren={
                  <>
                    <Trash2 className="h-3.5 w-3.5" /> Click again to delete forever
                  </>
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-1.5 text-xs text-red-300/80 hover:bg-red-500/15"
                armedClassName="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-400/60 bg-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete project and its time log
              </ConfirmButton>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export const ProjectDetail = memo(ProjectDetailInner);
