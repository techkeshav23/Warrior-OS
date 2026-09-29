// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Project Modal
// Add / edit a project in a kit Dialog: name, description, stage,
// tech stack tags, links, progress (manual or from the checklist)
// and on hold. Ctrl+Enter saves; Escape / backdrop close.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Anvil, Check, Link2, Pencil, Plus, X } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';
import { Button, Checkbox, Dialog, IconButton, Input, Kbd, Slider, Textarea } from '@/components/ui';
import {
  FORGE_STAGES,
  cleanTag,
  effectiveProgress,
  useProjectForgeStore,
} from '@/stores/useProjectForgeStore';
import type { ForgeLink, ForgeProject, ForgeProjectInput, ForgeStage } from '@/types/project-forge';
import { STAGE_META } from './forge-utils';

interface ProjectModalProps {
  /** Dialog visibility (the component stays mounted while it animates out). */
  open: boolean;
  /** null = create a new project. */
  project: ForgeProject | null;
  initialStage: ForgeStage;
  onClose: () => void;
  /** Called after saving with the project id and names that shipped for the first time. */
  onSaved: (id: string, shipped: string[]) => void;
}

const LINK_LABELS = ['GitHub', 'Live', 'Demo', 'Docs', 'Figma', 'Video', 'Devpost'];
const FIELD_LABEL = 'text-xs font-medium text-fg-muted';

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

// ─── Stage picker (shared look with the project detail) ───

interface StagePickerProps {
  value: ForgeStage;
  onChange: (stage: ForgeStage) => void;
  /** Disable the current stage (detail panel: it is already there). */
  lockCurrent?: boolean;
  'aria-labelledby'?: string;
}

export function StagePicker({ value, onChange, lockCurrent = false, ...aria }: StagePickerProps) {
  return (
    <div role="group" aria-labelledby={aria['aria-labelledby']} className="grid grid-cols-4 gap-1.5">
      {FORGE_STAGES.map((stage) => {
        const meta = STAGE_META[stage];
        const Icon = meta.Icon;
        const active = value === stage;
        return (
          <button
            key={stage}
            type="button"
            aria-pressed={active}
            disabled={lockCurrent && active}
            onClick={() => onChange(stage)}
            className={cn(
              'focus-ring flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-control border px-2 text-ui font-medium',
              'transition-[background-color,border-color,color] duration-120 ease-out-quint',
              active
                ? cn(meta.selected, 'disabled:cursor-default')
                : 'border-line-strong bg-surface-2 text-fg-muted hover:border-fg-faint hover:bg-surface-hover hover:text-fg active:bg-surface-active'
            )}
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden className={cn('shrink-0', !active && meta.text)} />
            <span className="truncate">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ProjectModalInner({ open, project, initialStage, onClose, onSaved }: ProjectModalProps) {
  const createProject = useProjectForgeStore((s) => s.createProject);
  const updateProject = useProjectForgeStore((s) => s.updateProject);
  const allProjects = useProjectForgeStore((s) => s.projects);

  const [draft, setDraft] = useState<ForgeProjectInput>(() => toDraft(project, initialStage));
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const formId = `${uid}-form`;
  const stageLabelId = `${uid}-stage`;
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

  const onFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      description={
        project
          ? 'Changes land on the board as soon as you save.'
          : 'Park it in any stage, then drag it along the board as it takes shape.'
      }
      icon={project ? Pencil : Anvil}
      iconTone="ember"
      size="lg"
      footer={
        <>
          <span className="mr-auto hidden items-center gap-1.5 text-xs text-fg-subtle sm:flex">
            <Kbd keys={['Ctrl', 'Enter']} size="sm" /> to save
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="ember" leadingIcon={project ? Check : Plus}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={save} onKeyDown={onFormKeyDown} noValidate className="space-y-5">
        <Input
          label="Name"
          size="lg"
          value={draft.name}
          maxLength={80}
          required
          onChange={(e) => {
            patch({ name: e.target.value });
            if (error) setError(null);
          }}
          placeholder="What are you building?"
          error={error}
          className="font-medium"
        />

        <Textarea
          label="Description"
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={3}
          placeholder="The problem, the approach, what makes it interesting."
          hint="One line per highlight works well for the resume."
        />

        <div className="space-y-2.5">
          <p id={stageLabelId} className={FIELD_LABEL}>
            Stage
          </p>
          <StagePicker
            aria-labelledby={stageLabelId}
            value={draft.stage}
            onChange={(stage) => patch({ stage, onHold: stage === 'shipped' ? false : draft.onHold })}
          />
          <Checkbox
            label="On hold"
            description={draft.stage === 'shipped' ? 'Shipped projects are never on hold' : 'Parked for now'}
            checked={draft.onHold && draft.stage !== 'shipped'}
            disabled={draft.stage === 'shipped'}
            onCheckedChange={(checked) => patch({ onHold: checked })}
          />
        </div>

        {/* Tech stack: tags + inline input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-tag`} className={FIELD_LABEL}>
            Tech stack
          </label>
          <div
            className={cn(
              'flex min-h-10 flex-wrap items-center gap-1.5 rounded-control border border-line-strong bg-ink-950/55 p-1.5',
              'transition-[border-color,box-shadow] duration-120 ease-out-quint hover:border-fg-faint',
              'focus-within:border-accent/70 focus-within:ring-3 focus-within:ring-accent/15'
            )}
          >
            {draft.techStack.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-line-strong bg-surface-2 pl-2.5 pr-0.5 text-xs font-medium text-fg"
              >
                <span className="truncate">{tag}</span>
                <button
                  type="button"
                  onClick={() => patch({ techStack: draft.techStack.filter((t) => t !== tag) })}
                  aria-label={`Remove ${tag}`}
                  className="focus-ring flex size-5 items-center justify-center rounded-full text-fg-subtle transition-colors duration-120 hover:bg-danger/15 hover:text-danger"
                >
                  <X size={12} strokeWidth={2} aria-hidden />
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
              aria-describedby={`${uid}-tag-hint`}
              // The wrapper draws the focus ring for the whole field.
              className="h-6 min-w-[96px] flex-1 bg-transparent px-1.5 text-ui text-fg outline-none placeholder:text-fg-subtle"
            />
            <datalist id={tagListId}>
              {knownTags
                .filter((t) => !draft.techStack.some((x) => x.toLowerCase() === t.toLowerCase()))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </div>
          <p id={`${uid}-tag-hint`} className="text-xs text-fg-subtle">
            Enter or comma adds a tag, Backspace removes the last one.
          </p>
        </div>

        {/* Links */}
        <div className="space-y-2">
          <p className={FIELD_LABEL}>Links</p>
          <datalist id={labelListId}>
            {LINK_LABELS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
          {draft.links.map((link) => (
            <div key={link.id} className="flex items-center gap-2">
              <div className="w-28 shrink-0">
                <Input
                  list={labelListId}
                  value={link.label}
                  onChange={(e) => updateLink(link.id, { label: e.target.value })}
                  placeholder="Label"
                  aria-label="Link label"
                />
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  value={link.url}
                  onChange={(e) => updateLink(link.id, { url: e.target.value })}
                  placeholder="github.com/you/project"
                  aria-label="Link URL"
                  inputMode="url"
                  leadingIcon={Link2}
                />
              </div>
              <IconButton
                icon={X}
                variant="ghost-danger"
                aria-label="Remove link"
                onClick={() => patch({ links: draft.links.filter((l) => l.id !== link.id) })}
              />
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={Plus}
            onClick={() => patch({ links: [...draft.links, { id: generateId('fl'), label: '', url: '' }] })}
          >
            Add link
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <Slider
            label="Progress"
            tone="ember"
            min={0}
            max={100}
            step={5}
            value={followsChecklist ? shownProgress : draft.progress}
            disabled={followsChecklist}
            onValueChange={(v) => patch({ progress: v })}
            formatValue={() => `${shownProgress}%`}
          />
          <Checkbox
            label="Follow the checklist"
            description={
              tasks.length > 0
                ? `${doneTasks}/${tasks.length} tasks done`
                : 'Add tasks from the project details'
            }
            checked={draft.autoProgress}
            onCheckedChange={(checked) => patch({ autoProgress: checked })}
          />
        </div>
      </form>
    </Dialog>
  );
}

export const ProjectModal = memo(ProjectModalInner);
