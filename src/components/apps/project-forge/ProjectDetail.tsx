// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Detail
// Side sheet over the board: stage + progress, description,
// stack, links, checklist, time tracking and the danger zone.
// Escape or a click on the scrim closes it.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ExternalLink, ListChecks, Pause, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Checkbox, Chip, EmptyState, IconButton, Input, ProgressBar, Switch } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import { effectiveProgress, useProjectForgeStore } from '@/stores/useProjectForgeStore';
import type { ForgeProject, ForgeStage } from '@/types/project-forge';
import { ConfirmButton } from './ConfirmButton';
import { linkIcon } from './ProjectCard';
import { StagePicker } from './ProjectModal';
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

function SectionTitle({ id, children, aside }: { id?: string; children: string; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex min-h-5 items-center gap-2">
      <h3 id={id} className="hud-label">
        {children}
      </h3>
      {aside}
    </div>
  );
}

function ProjectDetailInner({ project, onClose, onEdit }: ProjectDetailProps) {
  const moveProject = useProjectForgeStore((s) => s.moveProject);
  const updateProject = useProjectForgeStore((s) => s.updateProject);
  const deleteProject = useProjectForgeStore((s) => s.deleteProject);
  const addTask = useProjectForgeStore((s) => s.addTask);
  const toggleTask = useProjectForgeStore((s) => s.toggleTask);
  const removeTask = useProjectForgeStore((s) => s.removeTask);
  const now = useNow(60_000);
  const reduceMotion = useReducedMotion();
  const [taskInput, setTaskInput] = useState('');
  const titleId = useId();
  const stageLabelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the sheet (so Escape and Tab work) and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

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
      className="absolute inset-0 z-20 flex justify-end bg-ink-950/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={TRANSITION.small}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        initial={{ x: reduceMotion ? 0 : 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: reduceMotion ? 0 : 24, opacity: 0, transition: TRANSITION.small }}
        transition={TRANSITION.panel}
        className="@container relative flex h-full w-full max-w-[600px] flex-col border-l border-line-strong bg-ink-900 shadow-e3 outline-none"
      >
        <span
          aria-hidden
          className={cn('pointer-events-none absolute inset-y-0 left-0 w-px bg-linear-to-b to-transparent to-50%', meta.line)}
        />

        {/* Header */}
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 pb-4 pt-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={meta.tone} icon={meta.Icon}>
                {meta.label}
              </Badge>
              {project.onHold && (
                <Badge tone="warning" icon={Pause}>
                  On hold
                </Badge>
              )}
            </div>
            <h2 id={titleId} className="mt-2 truncate text-xl font-semibold text-fg" title={project.name}>
              {project.name}
            </h2>
            <p className="mt-1 truncate text-xs text-fg-subtle">
              Created {formatCalendarDate(project.createdAt)} · active{' '}
              {formatRelative(Date.parse(project.updatedAt), now)}
              {project.shippedAt && (
                <>
                  {' '}
                  · <span className="text-success">shipped {formatCalendarDate(project.shippedAt)}</span>
                </>
              )}
            </p>
          </div>
          <Button variant="secondary" size="sm" leadingIcon={Pencil} onClick={() => onEdit(project.id)}>
            Edit
          </Button>
          <IconButton icon={X} size="sm" aria-label="Close details" onClick={onClose} />
        </header>

        {/* Body */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-7 px-5 py-5">
            {/* Progress + stage */}
            <section aria-label="Progress and stage">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="hud-label">Progress</p>
                  <p className="mt-1.5 font-display text-2xl font-semibold leading-none text-fg tabular">
                    {progress}
                    <span className="ml-0.5 text-base text-fg-subtle">%</span>
                  </p>
                </div>
                <p className="pb-0.5 text-xs text-fg-subtle">
                  {followsChecklist ? `Following the checklist · ${doneTasks}/${project.tasks.length}` : 'Set manually (Edit)'}
                </p>
              </div>
              <ProgressBar value={progress} tone={meta.progress} size="md" className="mt-3" aria-label="Progress" />

              <div className="mt-5 space-y-2.5">
                <p id={stageLabelId} className="text-xs font-medium text-fg-muted">
                  Stage
                </p>
                <StagePicker aria-labelledby={stageLabelId} value={project.stage} onChange={handleMove} lockCurrent />
                {project.stage !== 'shipped' && (
                  <Switch
                    size="sm"
                    label="On hold"
                    description="Parked for now; stays in its column"
                    checked={project.onHold}
                    onCheckedChange={(checked) => updateProject(project.id, { onHold: checked })}
                    wrapperClassName="pt-1"
                  />
                )}
              </div>
            </section>

            {/* About */}
            <section>
              <SectionTitle>Description</SectionTitle>
              {project.description ? (
                <p className="max-w-prose select-text whitespace-pre-wrap text-sm text-fg-muted">{project.description}</p>
              ) : (
                <Button variant="ghost" size="sm" leadingIcon={Pencil} onClick={() => onEdit(project.id)}>
                  Add a description
                </Button>
              )}
            </section>

            {project.techStack.length > 0 && (
              <section>
                <SectionTitle>Tech stack</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {project.techStack.map((tech) => (
                    <Chip key={tech}>{tech}</Chip>
                  ))}
                </div>
              </section>
            )}

            {project.links.length > 0 && (
              <section>
                <SectionTitle>Links</SectionTitle>
                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-2">
                  {project.links.map((link) => {
                    const Icon = linkIcon(link);
                    return (
                      <li key={link.id}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-ring-inset group/link flex h-10 items-center gap-3 px-3 text-ui transition-colors duration-120 hover:bg-surface-hover"
                        >
                          <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle group-hover/link:text-fg" />
                          <span className="shrink-0 font-medium text-fg">{link.label || 'Link'}</span>
                          <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-subtle" title={link.url}>
                            {displayUrl(link.url)}
                          </span>
                          <ExternalLink
                            size={14}
                            strokeWidth={1.75}
                            aria-hidden
                            className="shrink-0 text-fg-subtle opacity-0 transition-opacity duration-120 group-hover/link:opacity-100"
                          />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Checklist */}
            <section>
              <SectionTitle
                aside={
                  <>
                    {project.tasks.length > 0 && (
                      <span className="tabular font-mono text-2xs text-fg-muted">
                        {doneTasks}/{project.tasks.length}
                      </span>
                    )}
                    <span className="flex-1" />
                    <Checkbox
                      label="Drives progress"
                      checked={project.autoProgress}
                      onCheckedChange={(checked) => updateProject(project.id, { autoProgress: checked })}
                    />
                  </>
                }
              >
                Checklist
              </SectionTitle>

              {project.tasks.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={ListChecks}
                  title="No tasks yet"
                  description="Break the build into steps; ticking them can drive progress."
                  className="rounded-card border border-dashed border-line"
                />
              ) : (
                <ul className="divide-y divide-line">
                  {project.tasks.map((task) => (
                    <li key={task.id} className="group/task flex min-h-10 items-center gap-3 rounded-control px-1.5 transition-colors duration-120 hover:bg-surface-hover">
                      <button
                        type="button"
                        onClick={() => toggleTask(project.id, task.id)}
                        aria-pressed={task.done}
                        aria-label={task.done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                        className={cn(
                          'focus-ring flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-[background-color,border-color] duration-120 ease-out-quint',
                          task.done
                            ? 'border-success bg-success text-ink-950'
                            : 'border-fg-faint bg-ink-950/60 hover:border-fg-subtle'
                        )}
                      >
                        {task.done && <Check size={12} strokeWidth={3} aria-hidden />}
                      </button>
                      <span
                        className={cn(
                          'min-w-0 flex-1 select-text py-2 text-ui',
                          task.done ? 'text-fg-subtle line-through decoration-fg-faint' : 'text-fg'
                        )}
                      >
                        {task.title}
                      </span>
                      <IconButton
                        icon={X}
                        size="xs"
                        variant="ghost-danger"
                        aria-label={`Delete task "${task.title}"`}
                        onClick={() => removeTask(project.id, task.id)}
                        className="opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100"
                      />
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddTask} className="mt-3 flex gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    placeholder="Add a task and press Enter"
                    aria-label="New task"
                    maxLength={160}
                  />
                </div>
                <Button type="submit" variant="secondary" leadingIcon={Plus} aria-label="Add task" disabled={!taskInput.trim()}>
                  Add
                </Button>
              </form>
            </section>

            {/* Time */}
            <TimeTracker projectId={project.id} />

            {/* Danger zone */}
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/20 bg-danger/[0.04] px-4 py-3">
              <div className="min-w-0">
                <p className="text-ui font-medium text-fg">Delete project</p>
                <p className="text-xs text-fg-subtle">Removes it from the board along with its time log.</p>
              </div>
              <ConfirmButton
                label="Delete project"
                variant="danger"
                size="md"
                icon={Trash2}
                onConfirm={() => {
                  deleteProject(project.id);
                  onClose();
                }}
                armedChildren="Click again to delete forever"
              >
                Delete project
              </ConfirmButton>
            </section>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export const ProjectDetail = memo(ProjectDetailInner);
