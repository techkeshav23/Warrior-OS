// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Files App
// Virtual file manager backed by localStorage (folders + text files).
// Locations sidebar · breadcrumb toolbar · grid / list views with
// type-tinted icons · selection · inline rename · editor dialog.
// ═══════════════════════════════════════════════════════════

'use client';

import {
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
  useRef,
  memo,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Eye,
  File,
  FileCode,
  FileJson,
  FilePlus,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  House,
  LayoutGrid,
  List,
  PenLine,
  Pencil,
  Plus,
  SearchX,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  AppLayout,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconButton,
  Kbd,
  Menu,
  ProgressBar,
  SearchField,
  SegmentedControl,
  SidebarNav,
  Toolbar,
  type MenuItem,
} from '@/components/ui';
import { cn, generateId } from '@/lib/utils';
import { MarkdownPreview } from '@/components/apps/notes-archive/markdown';

interface FSNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  content?: string;
  children?: FSNode[];
}

const FS_KEY = 'warrior-fs';

const DEFAULT_FS: FSNode = {
  id: 'root',
  name: 'Warrior',
  type: 'folder',
  children: [
    {
      id: 'notes-dir', name: 'Notes', type: 'folder', children: [
        { id: 'welcome', name: 'welcome.md', type: 'file', content: '# Welcome to Warrior OS\n\nYe tumhara personal command center hai. 🔥\n\nYahan files banao, folders organize karo.' },
      ],
    },
    {
      id: 'training-dir', name: 'Training', type: 'folder', children: [
        { id: 'plan', name: 'learning-plan.txt', type: 'file', content: 'Week 1: Pick a topic. Build a deck in Training Grounds.\nWeek 2: Daily quiz reps. Review every miss.\nWeek 3: Teach it back: notes, a demo, a tiny project.' },
      ],
    },
    { id: 'readme', name: 'README.txt', type: 'file', content: 'Warrior OS virtual file system.\nEverything here is saved in your browser.' },
  ],
};

/** Older versions seeded an exam folder at the root; rename it while it keeps its seeded name. */
function renameLegacySeedFolder(fs: FSNode): FSNode {
  const isLegacy = (c: FSNode) => c.id === 'gate-dir' && c.name === 'GATE';
  if (!Array.isArray(fs?.children) || !fs.children.some(isLegacy)) return fs;
  return { ...fs, children: fs.children.map((c) => (isLegacy(c) ? { ...c, name: 'Training' } : c)) };
}

function loadFS(): FSNode {
  if (typeof window === 'undefined') return DEFAULT_FS;
  try {
    const raw = localStorage.getItem(FS_KEY);
    return raw ? renameLegacySeedFolder(JSON.parse(raw)) : DEFAULT_FS;
  } catch { return DEFAULT_FS; }
}

function saveFS(fs: FSNode) {
  localStorage.setItem(FS_KEY, JSON.stringify(fs));
}

/** Immutably update the folder at the given path of ids, running `fn` on its children */
function updateFolder(root: FSNode, path: string[], fn: (children: FSNode[]) => FSNode[]): FSNode {
  if (path.length === 0) {
    return { ...root, children: fn(root.children ?? []) };
  }
  const [head, ...rest] = path;
  return {
    ...root,
    children: (root.children ?? []).map((child) =>
      child.id === head && child.type === 'folder'
        ? updateFolder(child, rest, fn)
        : child
    ),
  };
}

/** Resolve the folder node at a path of ids */
function folderAtPath(root: FSNode, path: string[]): FSNode {
  let node = root;
  for (const id of path) {
    const next = node.children?.find((c) => c.id === id && c.type === 'folder');
    if (!next) break;
    node = next;
  }
  return node;
}

// ─── File kinds: glyph + tint per type ───────────────────

type KindId = 'folder' | 'markdown' | 'text' | 'code' | 'data' | 'other';

interface Kind {
  icon: LucideIcon;
  label: string;
  /** glyph colour */
  tint: string;
  /** icon well (grid view) */
  well: string;
}

const KINDS: Record<KindId, Kind> = {
  folder: { icon: Folder, label: 'Folder', tint: 'text-accent', well: 'border-accent/20 bg-accent/8' },
  markdown: { icon: FileText, label: 'Markdown', tint: 'text-info', well: 'border-info/20 bg-info/8' },
  text: { icon: FileType, label: 'Plain text', tint: 'text-fg-muted', well: 'border-line-strong bg-surface-2' },
  code: { icon: FileCode, label: 'Source code', tint: 'text-success', well: 'border-success/20 bg-success/8' },
  data: { icon: FileJson, label: 'Data', tint: 'text-warning', well: 'border-warning/20 bg-warning/8' },
  other: { icon: File, label: 'File', tint: 'text-fg-subtle', well: 'border-line-strong bg-surface-2' },
};

function kindOf(node: Pick<FSNode, 'type' | 'name'>): KindId {
  if (node.type === 'folder') return 'folder';
  const name = node.name.toLowerCase();
  if (/\.(md|markdown|mdx)$/.test(name)) return 'markdown';
  if (/\.(txt|log|rtf)$/.test(name)) return 'text';
  if (/\.(js|jsx|ts|tsx|py|c|cpp|h|java|go|rs|rb|sh|css|scss|html)$/.test(name)) return 'code';
  if (/\.(json|ya?ml|toml|csv|xml|ini|env)$/.test(name)) return 'data';
  return 'other';
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : '';
}

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function byteSize(text: string): number {
  return encoder ? encoder.encode(text).length : text.length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describe(node: FSNode): string {
  if (node.type === 'folder') {
    const n = node.children?.length ?? 0;
    return n === 0 ? 'Empty' : `${n} ${n === 1 ? 'item' : 'items'}`;
  }
  return formatBytes(byteSize(node.content ?? ''));
}

/** Everything inside a folder, recursively. */
function countDescendants(node: FSNode): number {
  return (node.children ?? []).reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

/** Nominal localStorage budget for the storage meter. */
const STORAGE_BUDGET = 5 * 1024 * 1024;

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

type ViewMode = 'grid' | 'list';

interface OpenFile {
  id: string;
  name: string;
  content: string;
  /** Content when opened, to show unsaved changes. */
  original: string;
}

function FilesAppInner() {
  const [fs, setFs] = useState<FSNode>(loadFS);
  const [path, setPath] = useState<string[]>([]); // ids of nested folders from root
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<FSNode | null>(null);
  const [filePreview, setFilePreview] = useState(false);
  const [rootRef, width] = useWidth<HTMLDivElement>();

  const showSidebar = width === 0 || width >= 640;
  const contentWidth = showSidebar ? width - 200 : width;
  const wideToolbar = width === 0 || contentWidth >= 560;

  const commit = useCallback((next: FSNode) => {
    setFs(next);
    saveFS(next);
  }, []);

  const currentFolder = useMemo(() => folderAtPath(fs, path), [fs, path]);
  const items = useMemo(
    () => [...(currentFolder.children ?? [])].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }),
    [currentFolder]
  );

  const q = filter.trim().toLowerCase();
  const shown = useMemo(() => (q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items), [items, q]);

  // Breadcrumb labels
  const crumbs = useMemo(() => {
    const arr: { id: string; name: string; index: number }[] = [{ id: 'root', name: fs.name, index: -1 }];
    let node = fs;
    path.forEach((id, i) => {
      const next = node.children?.find((c) => c.id === id);
      if (next) { arr.push({ id, name: next.name, index: i }); node = next; }
    });
    return arr;
  }, [fs, path]);

  const usedBytes = useMemo(() => byteSize(JSON.stringify(fs)), [fs]);
  const selected = shown.find((i) => i.id === selectedId) ?? null;
  const folderCount = items.filter((i) => i.type === 'folder').length;
  const fileCount = items.filter((i) => i.type === 'file').length;

  const goTo = useCallback((next: string[]) => {
    setPath(next);
    setSelectedId(null);
    setFilter('');
    setRenaming(null);
  }, []);

  const createNode = useCallback((type: 'folder' | 'file') => {
    const name = type === 'folder' ? 'New Folder' : 'untitled.txt';
    const node: FSNode = type === 'folder'
      ? { id: generateId('d'), name, type: 'folder', children: [] }
      : { id: generateId('f'), name, type: 'file', content: '' };
    commit(updateFolder(fs, path, (children) => [...children, node]));
    setFilter('');
    setSelectedId(node.id);
    setRenaming(node.id);
    setRenameValue(name);
  }, [fs, path, commit]);

  const deleteNode = useCallback((id: string) => {
    commit(updateFolder(fs, path, (children) => children.filter((c) => c.id !== id)));
    setSelectedId((s) => (s === id ? null : s));
  }, [fs, path, commit]);

  const startRename = useCallback((node: FSNode) => {
    setSelectedId(node.id);
    setRenaming(node.id);
    setRenameValue(node.name);
  }, []);

  const applyRename = useCallback((id: string) => {
    const name = renameValue.trim();
    if (name) {
      commit(updateFolder(fs, path, (children) =>
        children.map((c) => (c.id === id ? { ...c, name } : c))
      ));
    }
    setRenaming(null);
  }, [fs, path, renameValue, commit]);

  const openNode = useCallback((node: FSNode) => {
    if (node.type === 'folder') goTo([...path, node.id]);
    else {
      const content = node.content ?? '';
      setFilePreview(false);
      setOpenFile({ id: node.id, name: node.name, content, original: content });
    }
  }, [path, goTo]);

  const saveOpenFile = useCallback(() => {
    if (!openFile) return;
    commit(updateFolder(fs, path, (children) =>
      children.map((c) => (c.id === openFile.id ? { ...c, content: openFile.content } : c))
    ));
    setOpenFile(null);
  }, [fs, path, openFile, commit]);

  const onItemKey = (e: KeyboardEvent<HTMLElement>, node: FSNode) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openNode(node);
    } else if (e.key === 'F2') {
      e.preventDefault();
      startRename(node);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      setPendingDelete(node);
    }
  };

  const itemMenu = (node: FSNode): MenuItem[] => [
    { id: 'open', label: node.type === 'folder' ? 'Open folder' : 'Open file', icon: node.type === 'folder' ? FolderOpen : PenLine, shortcut: 'Enter', onSelect: () => openNode(node) },
    { id: 'rename', label: 'Rename', icon: Pencil, shortcut: 'F2', onSelect: () => startRename(node) },
    { id: 'sep', divider: true },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, shortcut: 'Del', onSelect: () => setPendingDelete(node) },
  ];

  const renameInput = (node: FSNode, className: string) => (
    <input
      autoFocus
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={() => applyRename(node.id)}
      onFocus={(e) => {
        // Select the name without its extension, like every file manager.
        const dot = node.type === 'file' ? e.currentTarget.value.lastIndexOf('.') : -1;
        e.currentTarget.setSelectionRange(0, dot > 0 ? dot : e.currentTarget.value.length);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') applyRename(node.id); if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null); } }}
      aria-label={`Rename ${node.name}`}
      className={cn(
        'min-w-0 rounded-[6px] border border-accent/60 bg-ink-950/70 px-1.5 text-xs text-fg outline-none ring-3 ring-accent/15',
        className
      )}
    />
  );

  // ─── Sidebar: locations + storage ───
  const rootFolders = (fs.children ?? []).filter((c) => c.type === 'folder');
  const sidebar = showSidebar ? (
    <SidebarNav
      aria-label="Locations"
      value={path[0] ?? 'root'}
      onChange={(id) => goTo(id === 'root' ? [] : [id])}
      sections={[
        {
          label: 'Locations',
          items: [
            { id: 'root', label: fs.name, icon: House, count: fs.children?.length ?? 0 },
            ...rootFolders.map((f) => ({ id: f.id, label: f.name, icon: Folder, count: f.children?.length ?? 0 })),
          ],
        },
      ]}
      footer={
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center justify-between gap-2">
            <span className="hud-label flex items-center gap-1.5">
              <HardDrive size={12} strokeWidth={2} aria-hidden />
              Browser storage
            </span>
          </div>
          <ProgressBar value={Math.max(usedBytes / STORAGE_BUDGET, 0.004)} max={1} size="sm" aria-label="Storage used" />
          <p className="tabular font-mono text-2xs text-fg-subtle">
            {formatBytes(usedBytes)} of {formatBytes(STORAGE_BUDGET)}
          </p>
        </div>
      }
    />
  ) : undefined;

  // ─── Toolbar: up · breadcrumb · filter · view · new ───
  const toolbar = (
    <Toolbar aria-label="Files" className="gap-1.5">
      <IconButton
        icon={ChevronLeft}
        aria-label="Up one level"
        size="sm"
        tooltip
        tooltipSide="bottom"
        disabled={path.length === 0}
        onClick={() => goTo(path.slice(0, -1))}
      />
      <nav aria-label="Breadcrumb" className="scrollbar-none flex min-w-0 flex-1 items-center overflow-x-auto">
        <ol className="flex min-w-0 items-center">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={c.id} className={cn('flex min-w-0 items-center', last ? 'max-w-48 shrink-0' : 'max-w-32 shrink')}>
                {i > 0 && <ChevronRight size={14} strokeWidth={1.75} className="mx-0.5 shrink-0 text-fg-faint" aria-hidden />}
                <button
                  type="button"
                  onClick={() => goTo(c.index < 0 ? [] : path.slice(0, c.index + 1))}
                  aria-current={last ? 'page' : undefined}
                  title={c.name}
                  className={cn(
                    'focus-ring flex h-7 min-w-0 items-center gap-1.5 rounded-control px-1.5 text-ui transition-colors duration-120 ease-out-quint',
                    last ? 'font-medium text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'
                  )}
                >
                  {i === 0 && <House size={14} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />}
                  <span className="truncate">{c.name}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className={cn('shrink-0', wideToolbar ? 'w-40' : 'w-32')}>
        <SearchField
          value={filter}
          onValueChange={setFilter}
          placeholder={wideToolbar ? 'Filter this folder' : 'Filter'}
          aria-label="Filter this folder"
          size="sm"
        />
      </div>
      <SegmentedControl<ViewMode>
        aria-label="View"
        size="sm"
        value={view}
        onChange={setView}
        options={[
          { value: 'grid', icon: LayoutGrid, 'aria-label': 'Grid view' },
          { value: 'list', icon: List, 'aria-label': 'List view' },
        ]}
      />
      <Menu
        align="end"
        width={188}
        aria-label="New"
        trigger={
          <Button variant="primary" size="sm" leadingIcon={Plus} trailingIcon={ChevronDown}>
            New
          </Button>
        }
        items={[
          { id: 'file', label: 'Text file', icon: FilePlus, onSelect: () => createNode('file') },
          { id: 'folder', label: 'Folder', icon: FolderPlus, onSelect: () => createNode('folder') },
        ]}
      />
    </Toolbar>
  );

  // ─── Status bar ───
  const footer = (
    <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line px-4 text-xs text-fg-subtle">
      <span className="tabular truncate">
        {folderCount} {folderCount === 1 ? 'folder' : 'folders'} · {fileCount} {fileCount === 1 ? 'file' : 'files'}
        {q && <span className="text-fg-faint"> · {shown.length} shown</span>}
      </span>
      <span className="flex-1" />
      {selected ? (
        <span className="flex min-w-0 items-center gap-1.5 text-fg-muted">
          <span className="truncate" title={selected.name}>{selected.name}</span>
          <span className="tabular shrink-0 font-mono text-2xs text-fg-subtle">{describe(selected)}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <HardDrive size={12} strokeWidth={1.75} aria-hidden />
          Saved in this browser
        </span>
      )}
    </div>
  );

  // ─── Body ───
  const renderGrid = () => (
    <ul
      className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2"
      aria-label={`${currentFolder.name} contents`}
    >
      {shown.map((node) => {
        const kind = KINDS[kindOf(node)];
        const Icon = node.type === 'folder' && node.id === selectedId ? FolderOpen : kind.icon;
        const isSelected = node.id === selectedId;
        const ext = node.type === 'file' ? extensionOf(node.name) : '';
        const body = (
          <>
            <span className={cn('relative flex size-14 items-center justify-center rounded-card border', kind.well)}>
              <Icon
                size={28}
                strokeWidth={1.5}
                className={kind.tint}
                aria-hidden
                {...(node.type === 'folder' ? { fill: 'currentColor', fillOpacity: 0.14 } : {})}
              />
              {ext && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-[4px] border border-line-strong bg-ink-850 px-1 font-mono text-[9px] font-medium leading-[14px] tracking-wide text-fg-muted">
                  {ext}
                </span>
              )}
            </span>
            {renaming === node.id ? (
              renameInput(node, 'mt-1 h-6 w-full text-center')
            ) : (
              <span className="mt-1 line-clamp-2 w-full break-words text-xs font-medium leading-4 text-fg" title={node.name}>
                {node.name}
              </span>
            )}
            <span className="tabular font-mono text-2xs text-fg-subtle">{describe(node)}</span>
          </>
        );
        const tileClass = cn(
          'flex w-full flex-col items-center gap-1 rounded-card px-2 pb-2.5 pt-3.5 text-center',
          'transition-colors duration-120 ease-out-quint',
          isSelected ? 'bg-accent/10 ring-1 ring-inset ring-accent/35' : 'hover:bg-surface-hover'
        );
        return (
          <li key={node.id} className="group/tile relative">
            {renaming === node.id ? (
              <div className={tileClass}>{body}</div>
            ) : (
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`${node.name}, ${kind.label}, ${describe(node)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(node.id);
                }}
                onDoubleClick={() => openNode(node)}
                onKeyDown={(e) => onItemKey(e, node)}
                className={cn('focus-ring active:bg-surface-active', tileClass)}
              >
                {body}
              </button>
            )}
            {renaming !== node.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'absolute right-1 top-1 transition-opacity duration-120',
                  isSelected ? 'opacity-100' : 'opacity-0 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100'
                )}
              >
                <Menu
                  align="end"
                  width={188}
                  aria-label={`${node.name} actions`}
                  trigger={<IconButton icon={Ellipsis} aria-label={`Actions for ${node.name}`} size="xs" />}
                  items={itemMenu(node)}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const showKindColumn = contentWidth === 0 || contentWidth >= 480;
  const listCols = showKindColumn ? 'grid-cols-[minmax(0,1fr)_112px_72px_32px]' : 'grid-cols-[minmax(0,1fr)_72px_32px]';

  const renderList = () => (
    <div role="table" aria-label={`${currentFolder.name} contents`} className="-mx-2">
      <div role="row" className={cn('grid items-center gap-3 border-b border-line px-3 pb-2', listCols)}>
        <span role="columnheader" className="hud-label">Name</span>
        {showKindColumn && <span role="columnheader" className="hud-label">Kind</span>}
        <span role="columnheader" className="hud-label text-right">Size</span>
        <span role="columnheader" aria-label="Actions" />
      </div>
      <div role="rowgroup" className="flex flex-col pt-1">
        {shown.map((node) => {
          const kindId = kindOf(node);
          const kind = KINDS[kindId];
          const isSelected = node.id === selectedId;
          const Icon = kind.icon;
          return (
            <div
              key={node.id}
              role="row"
              aria-selected={isSelected}
              tabIndex={renaming === node.id ? -1 : 0}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(node.id);
              }}
              onDoubleClick={() => renaming !== node.id && openNode(node)}
              onKeyDown={(e) => {
                if (renaming === node.id || e.target !== e.currentTarget) return;
                if (e.key === ' ') {
                  e.preventDefault();
                  setSelectedId(node.id);
                } else onItemKey(e, node);
              }}
              className={cn(
                'focus-ring-inset group/row relative grid h-10 cursor-default items-center gap-3 rounded-control px-3',
                'transition-colors duration-120 ease-out-quint',
                listCols,
                isSelected ? 'bg-accent/10' : 'hover:bg-surface-hover'
              )}
            >
              {isSelected && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
              <span role="cell" className="flex min-w-0 items-center gap-2.5">
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={cn('shrink-0', kind.tint)}
                  aria-hidden
                  {...(node.type === 'folder' ? { fill: 'currentColor', fillOpacity: 0.14 } : {})}
                />
                {renaming === node.id ? (
                  renameInput(node, 'h-7 flex-1')
                ) : (
                  <span className="truncate text-ui text-fg" title={node.name}>
                    {node.name}
                  </span>
                )}
              </span>
              {showKindColumn && (
                <span role="cell" className="truncate text-xs text-fg-subtle">
                  {kind.label}
                </span>
              )}
              <span role="cell" className="tabular text-right font-mono text-2xs text-fg-subtle">
                {describe(node)}
              </span>
              <span role="cell" className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                <span
                  className={cn(
                    'transition-opacity duration-120',
                    isSelected ? 'opacity-100' : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100'
                  )}
                >
                  <Menu
                    align="end"
                    width={188}
                    aria-label={`${node.name} actions`}
                    trigger={<IconButton icon={Ellipsis} aria-label={`Actions for ${node.name}`} size="xs" />}
                    items={itemMenu(node)}
                  />
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const openKind = openFile ? KINDS[kindOf({ type: 'file', name: openFile.name })] : null;
  const openIsMarkdown = openFile ? kindOf({ type: 'file', name: openFile.name }) === 'markdown' : false;
  const dirty = openFile ? openFile.content !== openFile.original : false;
  const pendingCount = pendingDelete?.type === 'folder' ? countDescendants(pendingDelete) : 0;

  return (
    <div ref={rootRef} className="relative h-full min-h-0">
      <AppLayout
        sidebar={sidebar}
        sidebarWidth={200}
        toolbar={toolbar}
        footer={footer}
        onClick={() => setSelectedId(null)}
        bodyClassName="bg-ink-950/10"
      >
        {items.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="This folder is empty"
            description="Create a file or a folder to start filling it."
            className="min-h-full"
            actions={
              <>
                <Button leadingIcon={FolderPlus} onClick={(e) => { e.stopPropagation(); createNode('folder'); }}>
                  New folder
                </Button>
                <Button variant="primary" leadingIcon={FilePlus} onClick={(e) => { e.stopPropagation(); createNode('file'); }}>
                  New file
                </Button>
              </>
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            size="sm"
            icon={SearchX}
            title="No matches"
            description={`Nothing in ${currentFolder.name} matches “${filter.trim()}”.`}
            className="min-h-full"
            actions={
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setFilter(''); }}>
                Clear filter
              </Button>
            }
          />
        ) : view === 'grid' ? (
          renderGrid()
        ) : (
          renderList()
        )}
      </AppLayout>

      {/* File viewer/editor */}
      <Dialog
        open={openFile !== null}
        onClose={() => setOpenFile(null)}
        size="xl"
        icon={openKind?.icon}
        iconTone="neutral"
        title={openFile?.name}
        description={crumbs.map((c) => c.name).join(' / ')}
        footer={
          <>
            <span className="mr-auto flex items-center gap-2 text-xs text-fg-subtle">
              {dirty ? (
                <Badge tone="warning" dot>
                  Unsaved
                </Badge>
              ) : (
                <span className="tabular font-mono text-2xs">{formatBytes(byteSize(openFile?.content ?? ''))}</span>
              )}
              <span className="hidden items-center gap-1 sm:flex">
                <Kbd keys={['Ctrl', 'S']} size="sm" /> save
              </span>
            </span>
            <Button variant="ghost" onClick={() => setOpenFile(null)}>
              Close
            </Button>
            <Button variant="primary" onClick={saveOpenFile} disabled={!dirty}>
              Save
            </Button>
          </>
        }
      >
        {openFile && (
          <div className="flex flex-col gap-3">
            {openIsMarkdown && (
              <SegmentedControl<'edit' | 'preview'>
                aria-label="File view"
                size="sm"
                value={filePreview ? 'preview' : 'edit'}
                onChange={(v) => setFilePreview(v === 'preview')}
                options={[
                  { value: 'edit', label: 'Edit', icon: PenLine },
                  { value: 'preview', label: 'Preview', icon: Eye },
                ]}
                className="self-start"
              />
            )}
            {openIsMarkdown && filePreview ? (
              <div className="scrollbar-thin h-[min(52vh,420px)] overflow-y-auto rounded-control border border-line bg-ink-950/40 px-5 py-4">
                <MarkdownPreview source={openFile.content} />
              </div>
            ) : (
              <textarea
                value={openFile.content}
                onChange={(e) => setOpenFile({ ...openFile, content: e.target.value })}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    saveOpenFile();
                  }
                }}
                aria-label={`Contents of ${openFile.name}`}
                spellCheck={false}
                className={cn(
                  'scrollbar-thin h-[min(52vh,420px)] w-full resize-none rounded-control border border-line-strong bg-ink-950/55 px-4 py-3',
                  'select-text font-mono text-ui leading-6 text-fg outline-none placeholder:text-fg-subtle',
                  'transition-[border-color,box-shadow] duration-120 ease-out-quint focus:border-accent/70 focus:ring-3 focus:ring-accent/15'
                )}
                placeholder="Empty file…"
              />
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteNode(pendingDelete.id);
          setPendingDelete(null);
        }}
        title={pendingDelete?.type === 'folder' ? 'Delete this folder?' : 'Delete this file?'}
        description={
          pendingDelete
            ? pendingDelete.type === 'folder' && pendingCount > 0
              ? `“${pendingDelete.name}” and the ${pendingCount} ${pendingCount === 1 ? 'item' : 'items'} inside it will be permanently deleted.`
              : `“${pendingDelete.name}” will be permanently deleted.`
            : undefined
        }
        confirmLabel="Delete"
      />
    </div>
  );
}

export const FilesApp = memo(FilesAppInner);
