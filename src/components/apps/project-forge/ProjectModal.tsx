// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Modal
// Add / edit a project: name, description, stage, tech stack
// tags, links, progress (manual or from the checklist), on hold
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Link2, Plus, X } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import {
  FORGE_STAGES,
  cleanTag,
  effectiveProgress,
  useProjectForgeStore,
} from '@/stores/useProjectForgeStore';
import type { ForgeLink, ForgeProject, ForgeProjectInput, ForgeStage } from '@/types/project-forge';
import { STAGE_META } from './forge-utils';

interface ProjectModalProps {
  /** null = create a new project. */
  project: ForgeProject | null;
  initialStage: ForgeStage;
  onClose: () => void;
  /** Called after saving with the project id and names that shipped for the first time. */
  onSaved: (id: string, shipped: string[]) => void;
}

const INPUT =
  'w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-cyan-400/50 focus:bg-white/[0.06]';
const LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-white/45';
const LINK_LABELS = ['GitHub', 'Live', 'Demo', 'Docs', 'Figma', 'Video', 'Devpost'];

function toDraft(project: ForgeProject | null, stage: ForgeStage): ForgeProjectInput {
  if (!project) {
    return {
      name: '',
      description: '',
      techStack: [],
      stage,
      progress: 0,
      autoProgress: false,
      links: [],
      onHold: false,
    };
  }
  return {
    name: project.name,
    description: project.description,
    techStack: [...project.techStack],
    stage: project.stage,
    progress: project.progress,
    autoProgress: project.autoProgress,
    links: project.links.map((l) => ({ ...l })),
    onHold: project.onHold,
  };
}

function mergeTags(current: string[], raw: string): string[] {
  const next = [...current];
  const seen = new Set(current.map((t) => t.toLowerCase()));
  for (const part of raw.split(',')) {
    const tag = cleanTag(part);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    next.push(tag);
  }
  return next;
}

function ProjectModalInner({ project, initialStage, onClose, onSaved }: ProjectModalProps) {
  const createProject = useProjectForgeStore((s) => s.createProject);
  const updateProject = useProjectForgeStore((s) => s.updateProject);
  const allProjects = useProjectForgeStore((s) => s.projects);

  const [draft, setDraft] = useState<ForgeProjectInput>(() => toDraft(project, initialStage));
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const tagListId = `${uid}-tags`;
  const labelListId = `${uid}-labels`;

  const knownTags = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of allProjects) {
      for (const tag of p.techStack) {
        const key = tag.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(tag);
        }
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [allProjects]);

  const tasks = project?.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.done).length;
  const followsChecklist = draft.autoProgress && tasks.length > 0;
  const shownProgress = effectiveProgress({ progress: draft.progress, autoProgress: draft.autoProgress, tasks });

  const patch = (next: Partial<ForgeProjectInput>) => setDraft((d) => ({ ...d, ...next }));

  const updateLink = (id: string, next: Partial<ForgeLink>) =>
    setDraft((d) => ({ ...d, links: d.links.map((l) => (l.id === id ? { ...l, ...next } : l)) }));

  const commitTagInput = () => {
    if (!tagInput.trim()) return;
    setDraft((d) => ({ ...d, techStack: mergeTags(d.techStack, tagInput) }));
    setTagInput('');
  };

  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitTagInput();
    } else if (event.key === 'Backspace' && tagInput === '' && draft.techStack.length > 0) {
      patch({ techStack: draft.techStack.slice(0, -1) });
    }
  };

  const save = (event?: FormEvent) => {
    event?.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setError('Give the project a name.');
      return;
    }
    const input: ForgeProjectInput = {
      ...draft,
      name,
      techStack: tagInput.trim() ? mergeTags(draft.techStack, tagInput) : draft.techStack,
    };
    if (project) {
      onSaved(project.id, updateProject(project.id, input));
    } else {
      const id = createProject(input);
      onSaved(id, input.stage === 'shipped' ? [name] : []);
    }
  };

  const onDialogKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={save}
        onKeyDown={onDialogKeyDown}
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b0f17]/95 shadow-2xl shadow-black/60"
      >
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <h2 id={titleId} className="flex-1 text-sm font-bold tracking-wide text-cyan-300">
            {project ? 'Edit project' : 'New project'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <div className="space-y-1">
            <label htmlFor={`${uid}-name`} className={LABEL}>
              Name
            </label>
            <input
              id={`${uid}-name`}
              autoFocus
              value={draft.name}
              maxLength={80}
              onChange={(e) => {
                patch({ name: e.target.value });
                if (error) setError(null);
              }}
              placeholder="What are you building?"
              className={cn(INPUT, 'text-base font-semibold')}
            />
            {error && <p className="text-[11px] text-red-300">{error}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor={`${uid}-desc`} className={LABEL}>
              Description
            </label>
            <textarea
              id={`${uid}-desc`}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
              placeholder="The problem, the approach, what makes it interesting. One line per highlight works well for the resume."
              className={cn(INPUT, 'resize-y leading-snug')}
            />
          </div>

          <div className="space-y-1.5">
            <p className={LABEL}>Stage</p>
            <div className="grid grid-cols-4 gap-1.5">
              {FORGE_STAGES.map((stage) => {
                const meta = STAGE_META[stage];
                const active = draft.stage === stage;
                return (
                  <button
                    key={stage}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patch({ stage, onHold: stage === 'shipped' ? false : draft.onHold })}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
                      active ? meta.activeButton : 'border-white/10 text-white/55 hover:bg-white/5'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <label
              className={cn(
                'flex items-center gap-2 text-xs',
                draft.stage === 'shipped' ? 'text-white/30' : 'text-white/65'
              )}
            >
              <input
                type="checkbox"
                checked={draft.onHold && draft.stage !== 'shipped'}
                disabled={draft.stage === 'shipped'}
                onChange={(e) => patch({ onHold: e.target.checked })}
                className="h-3.5 w-3.5 accent-amber-400"
              />
              On hold (parked for now)
            </label>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${uid}-tag`} className={LABEL}>
              Tech stack
            </label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] p-1.5 focus-within:border-cyan-400/50">
              {draft.techStack.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded border border-cyan-400/25 bg-cyan-400/10 py-0.5 pl-1.5 pr-0.5 text-[11px] text-cyan-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => patch({ techStack: draft.techStack.filter((t) => t !== tag) })}
                    aria-label={`Remove ${tag}`}
                    className="rounded p-0.5 text-cyan-200/60 hover:bg-white/10 hover:text-red-300"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                id={`${uid}-tag`}
                list={tagListId}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKeyDown}
                onBlur={commitTagInput}
                placeholder={draft.techStack.length === 0 ? 'React, Node.js, PostgreSQL…' : 'Add tag'}
                className="min-w-[90px] flex-1 bg-transparent px-1 py-0.5 text-xs text-white/90 outline-none placeholder:text-white/30"
              />
              <datalist id={tagListId}>
                {knownTags
                  .filter((t) => !draft.techStack.some((x) => x.toLowerCase() === t.toLowerCase()))
                  .map((t) => (
                    <option key={t} value={t} />
                  ))}
              </datalist>
            </div>
            <p className="text-[10px] text-white/35">Enter or comma adds a tag, Backspace removes the last one.</p>
          </div>

          <div className="space-y-1.5">
            <p className={LABEL}>Links</p>
            <datalist id={labelListId}>
              {LINK_LABELS.map((label) => (
                <option key={label} value={label} />
              ))}
            </datalist>
            {draft.links.map((link) => (
              <div key={link.id} className="flex items-center gap-1.5">
                <input
                  list={labelListId}
                  value={link.label}
                  onChange={(e) => updateLink(link.id, { label: e.target.value })}
                  placeholder="Label"
                  aria-label="Link label"
                  className={cn(INPUT, 'w-24 shrink-0 text-xs')}
                />
                <input
                  value={link.url}
                  onChange={(e) => updateLink(link.id, { url: e.target.value })}
                  placeholder="github.com/you/project"
                  aria-label="Link URL"
                  inputMode="url"
                  className={cn(INPUT, 'min-w-0 flex-1 text-xs')}
                />
                <button
                  type="button"
                  onClick={() => patch({ links: draft.links.filter((l) => l.id !== link.id) })}
                  aria-label="Remove link"
                  className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-red-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patch({ links: [...draft.links, { id: generateId('fl'), label: '', url: '' }] })
              }
              className="flex items-center gap-1.5 rounded-md border border-dashed border-white/15 px-2.5 py-1 text-xs text-white/55 hover:border-cyan-400/40 hover:text-cyan-300"
            >
              <Link2 className="h-3.5 w-3.5" /> Add link
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={`${uid}-progress`} className={LABEL}>
                Progress
              </label>
              <span className="text-xs tabular-nums text-white/70">{shownProgress}%</span>
            </div>
            <input
              id={`${uid}-progress`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={followsChecklist ? shownProgress : draft.progress}
              disabled={followsChecklist}
              onChange={(e) => patch({ progress: Number(e.target.value) })}
              className="w-full accent-cyan-400 disabled:opacity-40"
            />
            <label className="flex items-center gap-2 text-xs text-white/65">
              <input
                type="checkbox"
                checked={draft.autoProgress}
                onChange={(e) => patch({ autoProgress: e.target.checked })}
                className="h-3.5 w-3.5 accent-cyan-400"
              />
              Follow the checklist
              <span className="text-white/35">
                {tasks.length > 0
                  ? `(${doneTasks}/${tasks.length} tasks done)`
                  : '(add tasks from the project details)'}
              </span>
            </label>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <span className="hidden text-[10px] text-white/35 sm:inline">Ctrl+Enter to save</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/65 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-cyan-300"
            >
              {project ? 'Save changes' : (
                <>
                  <Plus className="h-3.5 w-3.5" /> Create project
                </>
              )}
            </button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  );
}

export const ProjectModal = memo(ProjectModalInner);
