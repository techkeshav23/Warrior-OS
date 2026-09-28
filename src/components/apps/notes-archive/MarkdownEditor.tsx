// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Markdown Editor with wiki-link support
// Toolbar (Write / Split / Preview, pin, more) · title + tags ·
// highlighted source editor and/or rendered preview · status bar.
// The source editor is a transparent textarea over a highlighted copy
// of the same text (same font, same box), so markdown reads in colour
// while typing stays a plain, accessible textarea.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, memo, type RefObject } from 'react';
import {
  ChevronLeft,
  Columns2,
  Copy,
  Ellipsis,
  Eye,
  FileText,
  Link2,
  PenLine,
  Pin,
  PinOff,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  Chip,
  EmptyState,
  IconButton,
  Menu,
  SegmentedControl,
  Toolbar,
  ToolbarSpacer,
  type MenuItem,
  type SegmentedOption,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { MarkdownPreview, highlightSource } from './markdown';
import type { Note } from './NotesApp';

export type EditorMode = 'write' | 'split' | 'preview';

interface Props {
  note: Note;
  onUpdate: (changes: Partial<Note>) => void;
  onNavigate: (title: string) => void;
  /** Chosen view; 'split' falls back to 'write' while the pane is narrow. */
  mode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
  /** Lower-cased titles of existing notes (resolved wiki-links). */
  knownTitles?: ReadonlySet<string>;
  /** Notes that link here with [[this title]]. */
  backlinks?: { id: string; title: string }[];
  onOpenNote?: (id: string) => void;
  onTogglePin?: () => void;
  onDelete?: () => void;
  /** Single-pane layout: back to the list. */
  onBack?: () => void;
  /** Focus and select the title on mount (a note that was just created). */
  autoFocusTitle?: boolean;
  onAutoFocused?: () => void;
}

/** Pane width that fits source and preview side by side. */
const SPLIT_MIN_WIDTH = 620;

// Shared by the textarea and its highlighted copy: any difference here
// would drift the caret away from the text.
const SOURCE_TEXT =
  'm-0 block w-full min-w-0 whitespace-pre-wrap break-words px-5 py-4 font-mono text-ui leading-6 tracking-normal [font-variant-ligatures:none] [tab-size:2]';

const PLACEHOLDER =
  'Start writing…\n\n# Heading   **bold**   *italic*   `code`\n- list item   - [ ] task   > quote\n[[Note title]] links another note';

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.offsetWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Transparent textarea over a colour-highlighted copy of its own text. */
function SourceEditor({
  value,
  onChange,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const highlighted = useMemo(() => highlightSource(value), [value]);
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="grid min-h-full">
        <pre aria-hidden className={cn(SOURCE_TEXT, 'pointer-events-none select-none text-fg-muted [grid-area:1/1]')}>
          {highlighted}
          {/* keeps a trailing empty line tall enough for the caret */}{' '}
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          aria-label="Note content (markdown)"
          placeholder={PLACEHOLDER}
          className={cn(
            SOURCE_TEXT,
            'resize-none self-stretch overflow-hidden bg-transparent text-transparent caret-accent outline-none [grid-area:1/1]',
            'select-text placeholder:text-fg-subtle'
          )}
        />
      </div>
    </div>
  );
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function MarkdownEditorInner({
  note,
  onUpdate,
  onNavigate,
  mode = 'write',
  onModeChange,
  knownTitles,
  backlinks = [],
  onOpenNote,
  onTogglePin,
  onDelete,
  onBack,
  autoFocusTitle = false,
  onAutoFocused,
}: Props) {
  const [tagInput, setTagInput] = useState('');
  const [localMode, setLocalMode] = useState<EditorMode>(mode);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [rootRef, width] = useWidth<HTMLDivElement>();

  const chosen = onModeChange ? mode : localMode;
  const setMode = onModeChange ?? setLocalMode;
  const canSplit = width === 0 || width >= SPLIT_MIN_WIDTH;
  const view: EditorMode = chosen === 'split' && !canSplit ? 'write' : chosen;
  const compact = width > 0 && width < 420;

  // A brand-new note: put the cursor in the title with it selected.
  useEffect(() => {
    if (!autoFocusTitle) return;
    const input = titleRef.current;
    if (input) {
      input.focus();
      input.select();
    }
    onAutoFocused?.();
    // mount-only: the parent remounts the editor per note
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || note.tags.includes(tag)) return;
    onUpdate({ tags: [...note.tags, tag] });
    setTagInput('');
  }, [tagInput, note.tags, onUpdate]);

  const removeTag = useCallback(
    (tag: string) => {
      onUpdate({ tags: note.tags.filter((t) => t !== tag) });
    },
    [note.tags, onUpdate]
  );

  const words = wordCount(note.content);
  const minutes = Math.max(1, Math.round(words / 200));
  const savedAt = new Date(note.updatedAt);
  const savedLabel = Number.isNaN(savedAt.getTime())
    ? ''
    : savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const modeOptions: SegmentedOption<EditorMode>[] = [
    { value: 'write', label: compact ? undefined : 'Write', icon: PenLine, 'aria-label': 'Write' },
    ...(canSplit ? [{ value: 'split' as const, label: 'Split', icon: Columns2, 'aria-label': 'Split view' }] : []),
    { value: 'preview', label: compact ? undefined : 'Preview', icon: Eye, 'aria-label': 'Preview' },
  ];

  const menuItems: MenuItem[] = [
    ...(onTogglePin
      ? [{ id: 'pin', label: note.pinned ? 'Unpin note' : 'Pin to top', icon: note.pinned ? PinOff : Pin, onSelect: onTogglePin }]
      : []),
    {
      id: 'copy',
      label: 'Copy as Markdown',
      icon: Copy,
      onSelect: () => {
        navigator.clipboard
          ?.writeText(note.content)
          .then(() => setCopied(true))
          .catch(() => {});
      },
    },
    ...(onDelete
      ? [
          { id: 'sep', divider: true },
          { id: 'delete', label: 'Delete note', icon: Trash2, danger: true, onSelect: onDelete },
        ]
      : []),
  ];

  const preview = (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[68ch] px-5 py-4">
        {note.content.trim() ? (
          <MarkdownPreview
            source={note.content}
            onNavigate={onNavigate}
            knownTitles={knownTitles}
            hideLeadingTitle={note.title}
          />
        ) : (
          <EmptyState
            size="sm"
            icon={FileText}
            title="Nothing to preview"
            description="Switch to Write and start typing."
            className="py-12"
          />
        )}
        {backlinks.length > 0 && (
          <div className="mt-8 border-t border-line pt-4">
            <p className="hud-label mb-2.5 flex items-center gap-1.5">
              <Link2 size={12} strokeWidth={2} aria-hidden />
              Linked from
            </p>
            <div className="flex flex-wrap gap-1.5">
              {backlinks.map((b) => (
                <Chip key={b.id} size="sm" icon={FileText} onClick={() => onOpenNote?.(b.id)} title={`Open “${b.title}”`}>
                  {b.title || 'Untitled'}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const source = (
    <SourceEditor value={note.content} onChange={(content) => onUpdate({ content })} textareaRef={editorRef} />
  );

  return (
    <div ref={rootRef} className="flex h-full min-w-0 flex-col">
      {/* Toolbar */}
      <Toolbar aria-label="Note" className="gap-1.5">
        {onBack && <IconButton icon={ChevronLeft} aria-label="Back to notes" size="sm" onClick={onBack} />}
        <SegmentedControl<EditorMode>
          aria-label="Editor view"
          size="sm"
          value={view}
          onChange={setMode}
          options={modeOptions}
        />
        <ToolbarSpacer />
        {onTogglePin && (
          <IconButton
            icon={Pin}
            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            size="sm"
            active={!!note.pinned}
            tooltip
            tooltipSide="bottom"
            onClick={onTogglePin}
          />
        )}
        <Menu
          align="end"
          width={196}
          aria-label="Note actions"
          trigger={<IconButton icon={Ellipsis} aria-label="More actions" size="sm" />}
          items={menuItems}
        />
      </Toolbar>

      {/* Title + tags */}
      <div className="shrink-0 px-5 pb-3 pt-4">
        <input
          ref={titleRef}
          value={note.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              editorRef.current?.focus();
            }
          }}
          aria-label="Note title"
          className={cn(
            '-mx-2 block w-[calc(100%+1rem)] min-w-0 truncate rounded-control border border-transparent bg-transparent px-2 py-0.5',
            'text-xl font-semibold tracking-tight text-fg outline-none placeholder:text-fg-faint',
            'transition-colors duration-120 ease-out-quint hover:bg-surface-hover focus:border-line-strong focus:bg-ink-950/40'
          )}
          placeholder="Untitled"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-6 items-center gap-0.5 rounded-full border border-line-strong bg-surface-2 pl-2.5 pr-1 font-mono text-2xs text-fg-muted"
            >
              <span className="text-accent/70">#</span>
              <span className="max-w-32 truncate" title={tag}>
                {tag}
              </span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="focus-ring ml-0.5 flex size-4 items-center justify-center rounded-full text-fg-subtle transition-colors duration-120 hover:bg-surface-active hover:text-fg"
              >
                <X size={11} strokeWidth={2} aria-hidden />
              </button>
            </span>
          ))}
          <label className="group/tag relative inline-flex h-6 items-center">
            <Tag
              size={12}
              strokeWidth={1.75}
              aria-hidden
              className="pointer-events-none absolute left-2 text-fg-subtle group-focus-within/tag:text-accent"
            />
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTag();
                else if (e.key === 'Backspace' && !tagInput && note.tags.length > 0) removeTag(note.tags[note.tags.length - 1]);
              }}
              onBlur={() => tagInput.trim() && addTag()}
              aria-label="Add tag"
              placeholder="Add tag"
              className={cn(
                'h-6 w-24 rounded-full border border-dashed border-line-strong bg-transparent pl-6 pr-2.5 font-mono text-2xs text-fg outline-none',
                'transition-[border-color,width,background-color] duration-180 ease-out-quint placeholder:text-fg-subtle',
                'hover:border-fg-faint focus:w-32 focus:border-solid focus:border-accent/50 focus:bg-ink-950/40'
              )}
            />
          </label>
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="min-h-0 flex-1 border-t border-line">
        {view === 'write' && source}
        {view === 'preview' && preview}
        {view === 'split' && (
          <div className="grid h-full grid-cols-2 divide-x divide-line">
            <div className="min-h-0 min-w-0">{source}</div>
            <div className="min-h-0 min-w-0 bg-ink-950/15">{preview}</div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line px-5 font-mono text-2xs text-fg-subtle">
        <span className="tabular truncate">
          {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
          {!compact && (
            <>
              <span className="text-fg-faint"> · </span>
              {note.content.length.toLocaleString()} chars
              <span className="text-fg-faint"> · </span>
              {minutes} min read
            </>
          )}
        </span>
        <span className="flex-1" />
        <span className="tabular flex shrink-0 items-center gap-1.5" aria-live="polite">
          <span className={cn('size-1.5 rounded-full', copied ? 'bg-accent' : 'bg-success')} aria-hidden />
          {copied ? 'Copied' : `Saved ${savedLabel}`}
        </span>
      </div>
    </div>
  );
}

export const MarkdownEditor = memo(MarkdownEditorInner);
