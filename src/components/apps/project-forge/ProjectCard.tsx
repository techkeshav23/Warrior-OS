// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Card
// Kanban card: name, timer toggle, description, tech chips,
// stage-tinted progress, tracked time, links and last activity.
// Sortable wrapper for @dnd-kit. States: idle, hover, running
// (ember, the forge is lit), drag ghost (dashed slot) and the
// lifted drag overlay.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { Clock, Github, Globe, Link2, Pause, Play, Square, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Chip, ProgressBar } from '@/components/ui';
import { EMBER_PLATE } from '@/components/ui/armor';
import { CUT } from '@/styles/tokens';
import { CutFrame } from '@/components/ui/CutFrame';
import { effectiveProgress } from '@/stores/useProjectForgeStore';
import type { ForgeLink, ForgeProject } from '@/types/project-forge';
import { RunningClock } from './RunningClock';
import { STAGE_META, displayUrl, formatHours, formatRelative } from './forge-utils';

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

/** Glyph for a project link, from its label or host. */
export function linkIcon(link: Pick<ForgeLink, 'label' | 'url'>): LucideIcon {
  const text = `${link.label} ${link.url}`.toLowerCase();
  if (/github|gitlab|bitbucket|\brepo\b|\bcode\b/.test(text)) return Github;
  if (/\blive\b|\bdemo\b|\bsite\b|\bapp\b|vercel|netlify|pages\.dev/.test(text)) return Globe;
  return Link2;
}

/** Keep clicks and keys on inner controls from opening or dragging the card. */
const stop = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

/** Forged plate per state: cold steel, heated (timer running), lifted, empty slot. */
const SURFACE = {
  idle: 'armor-panel hover:bg-steel-700/70',
  running: 'armor-panel ember-edge bg-ember-800/40 hover:bg-ember-800/55',
  overlay: 'armor-plate cursor-grabbing',
  ghost: 'bg-ember-500/[0.04] text-accent/45',
} as const;

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
  const stack = project.techStack.slice(0, 3);
  const extraStack = project.techStack.length - stack.length;
  const links = project.links.filter((l) => l.url.trim()).slice(0, 3);
  const surface = ghost ? 'ghost' : overlay ? 'overlay' : running ? 'running' : 'idle';

  return (
    // Unclipped shell: carries the lift shadow a clipped plate can't cast.
    <div className={cn(overlay && 'armor-drop rotate-[1.5deg]')}>
    <div
      className={cn(
        'group/card relative chamfer-md p-3',
        'transition-[background-color,box-shadow] duration-120 ease-out-quint',
        SURFACE[surface]
      )}
    >
      {ghost && <CutFrame cut={CUT.md} />}
      {running && (
        // Heat rising off the bottom edge while the forge is lit.
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-ember-500/15 to-transparent"
        />
      )}
      <div className={cn('relative flex flex-col gap-2.5', ghost && 'invisible')}>
        {/* Name + timer toggle */}
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate pt-0.5 text-ui font-semibold text-fg" title={project.name}>
            {project.name}
          </p>
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
                'focus-ring flex size-6 shrink-0 items-center justify-center chamfer-xs',
                'transition-[background-color,color,filter] duration-120 ease-out-quint',
                running
                  ? cn(EMBER_PLATE, 'hover:brightness-110 active:brightness-95')
                  : 'armor-plate text-fg-subtle hover:bg-steel-600 hover:text-ember-400 active:brightness-90'
              )}
            >
              {running ? (
                <Square size={10} strokeWidth={2.5} fill="currentColor" aria-hidden />
              ) : (
                <Play size={11} strokeWidth={2.25} fill="currentColor" className="translate-x-px" aria-hidden />
              )}
            </button>
          )}
        </div>

        {project.description && (
          <p className="-mt-1 line-clamp-2 text-xs leading-4 text-fg-muted">{project.description}</p>
        )}

        {(stack.length > 0 || project.onHold) && (
          <div className="flex flex-wrap items-center gap-1">
            {project.onHold && (
              <Badge tone="warning" size="sm" icon={Pause}>
                On hold
              </Badge>
            )}
            {stack.map((tech) => (
              <Chip key={tech} size="sm">
                {tech}
              </Chip>
            ))}
            {extraStack > 0 && (
              <span
                className="tabular px-1 font-mono text-2xs text-fg-subtle"
                title={project.techStack.slice(stack.length).join(', ')}
              >
                +{extraStack}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <ProgressBar
            value={progress}
            size="sm"
            tone={meta.progress}
            animated={false}
            aria-label={`${project.name} progress`}
            className="flex-1"
          />
          <span className="tabular w-8 text-right font-mono text-2xs text-fg-muted">{progress}%</span>
        </div>

        {/* Meta: tracked time · links · last activity */}
        <div className="flex h-5 items-center gap-2 text-xs text-fg-subtle">
          {running && runningSince !== null ? (
            <span className="flex items-center gap-1.5 text-ember-300" title="Timer running">
              <span aria-hidden className="size-1.5 rounded-full bg-ember-400 shadow-[0_0_6px_var(--color-ember-400)] animate-pulse-soft" />
              <RunningClock startedAt={runningSince} className="text-2xs" />
            </span>
          ) : weekMs > 0 ? (
            <span className="flex items-center gap-1" title="Tracked this week">
              <Clock size={12} strokeWidth={1.75} aria-hidden />
              <span className="tabular font-mono text-2xs">{formatHours(weekMs)}</span>
              <span>this week</span>
            </span>
          ) : null}

          <span className="flex-1" />

          {links.length > 0 && (
            <span className="flex items-center gap-0.5">
              {links.map((link) => {
                const Icon = linkIcon(link);
                const name = link.label.trim() || displayUrl(link.url);
                return overlay ? (
                  <span key={link.id} className="flex size-5 items-center justify-center text-fg-subtle">
                    <Icon size={12} strokeWidth={1.75} aria-hidden />
                  </span>
                ) : (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    draggable={false}
                    onClick={stop}
                    onKeyDown={stop}
                    aria-label={`Open ${name}: ${displayUrl(link.url)}`}
                    title={`${name} · ${displayUrl(link.url)}`}
                    className="focus-ring flex size-5 items-center justify-center chamfer-xs text-fg-subtle transition-colors duration-120 hover:bg-surface-active hover:text-fg"
                  >
                    <Icon size={12} strokeWidth={1.75} aria-hidden />
                  </a>
                );
              })}
            </span>
          )}

          <span className="tabular shrink-0 font-mono text-2xs" title="Last activity">
            {running ? 'active now' : formatRelative(lastActivity, now)}
          </span>
        </div>
      </div>
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
      className="focus-ring touch-manipulation cursor-pointer chamfer-md"
    >
      <ProjectCardView {...cardProps} ghost={isDragging} />
    </div>
  );
}

export const SortableProjectCard = memo(SortableProjectCardInner);
