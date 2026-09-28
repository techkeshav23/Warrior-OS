// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Files App
// Virtual file manager backed by localStorage (folders + text files)
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { cn, generateId } from '@/lib/utils';

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
      id: 'gate-dir', name: 'GATE', type: 'folder', children: [
        { id: 'plan', name: 'study-plan.txt', type: 'file', content: 'Week 1: OS + DBMS\nWeek 2: CN + TOC\nWeek 3: DSA + DAA' },
      ],
    },
    { id: 'readme', name: 'README.txt', type: 'file', content: 'Warrior OS virtual file system.\nEverything here is saved in your browser.' },
  ],
};

function loadFS(): FSNode {
  if (typeof window === 'undefined') return DEFAULT_FS;
  try {
    const raw = localStorage.getItem(FS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_FS;
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

function fileIcon(node: FSNode): string {
  if (node.type === 'folder') return '📁';
  if (node.name.endsWith('.md')) return '📄';
  if (node.name.endsWith('.txt')) return '📝';
  if (/\.(js|ts|tsx|jsx|py|c|cpp|java)$/.test(node.name)) return '💻';
  return '📄';
}

function FilesAppInner() {
  const [fs, setFs] = useState<FSNode>(loadFS);
  const [path, setPath] = useState<string[]>([]); // ids of nested folders from root
  const [openFile, setOpenFile] = useState<{ id: string; name: string; content: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

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

  const createNode = useCallback((type: 'folder' | 'file') => {
    const name = type === 'folder' ? 'New Folder' : 'untitled.txt';
    const node: FSNode = type === 'folder'
      ? { id: generateId('d'), name, type: 'folder', children: [] }
      : { id: generateId('f'), name, type: 'file', content: '' };
    commit(updateFolder(fs, path, (children) => [...children, node]));
    setRenaming(node.id);
    setRenameValue(name);
  }, [fs, path, commit]);

  const deleteNode = useCallback((id: string) => {
    commit(updateFolder(fs, path, (children) => children.filter((c) => c.id !== id)));
  }, [fs, path, commit]);

  const applyRename = useCallback((id: string) => {
    const name = renameValue.trim();
    if (name) {
      commit(updateFolder(fs, path, (children) =>
        children.map((c) => (c.id === id ? { ...c, name } : c))
      ));
    }
    setRenaming(null);
  }, [fs, path, renameValue, commit]);

  const saveOpenFile = useCallback(() => {
    if (!openFile) return;
    commit(updateFolder(fs, path, (children) =>
      children.map((c) => (c.id === openFile.id ? { ...c, content: openFile.content } : c))
    ));
    setOpenFile(null);
  }, [fs, path, openFile, commit]);

  return (
    <div className="flex flex-col h-full bg-black/40 text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-white/10 bg-black/20">
        <button
          onClick={() => setPath((p) => p.slice(0, -1))}
          disabled={path.length === 0}
          className="px-2 py-1 rounded text-sm bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30"
        >←</button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 overflow-x-auto text-xs">
          {crumbs.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1 shrink-0">
              {i > 0 && <span className="text-white/25">/</span>}
              <button
                onClick={() => setPath(c.index < 0 ? [] : path.slice(0, c.index + 1))}
                className="hover:text-cyan-300 text-white/60 transition-colors"
              >{c.name}</button>
            </span>
          ))}
        </div>

        <button onClick={() => createNode('folder')} className="px-2 py-1 rounded text-xs bg-cyan-500/10 border border-cyan-400/20 text-cyan-200 hover:bg-cyan-500/20">+ Folder</button>
        <button onClick={() => createNode('file')} className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 hover:bg-white/10">+ File</button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 && (
          <p className="text-center text-white/25 text-sm mt-8">Empty folder — create a file or folder ↑</p>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          {items.map((node) => (
            <div
              key={node.id}
              onDoubleClick={() => {
                if (node.type === 'folder') setPath((p) => [...p, node.id]);
                else setOpenFile({ id: node.id, name: node.name, content: node.content ?? '' });
              }}
              className="group relative flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
            >
              <span className="text-3xl">{fileIcon(node)}</span>
              {renaming === node.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => applyRename(node.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyRename(node.id); if (e.key === 'Escape') setRenaming(null); }}
                  className="w-full text-[11px] text-center bg-black/60 border border-cyan-400/40 rounded px-1 outline-none"
                />
              ) : (
                <span className="text-[11px] text-white/70 text-center break-all line-clamp-2">{node.name}</span>
              )}

              {/* Hover actions */}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setRenaming(node.id); setRenameValue(node.name); }}
                  className="text-[10px] text-white/40 hover:text-cyan-300 px-1"
                  title="Rename"
                >✎</button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                  className="text-[10px] text-white/40 hover:text-red-400 px-1"
                  title="Delete"
                >×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t border-white/10 bg-black/20 text-[11px] text-white/40">
        {items.filter((i) => i.type === 'folder').length} folders · {items.filter((i) => i.type === 'file').length} files
      </div>

      {/* File viewer/editor modal */}
      {openFile && (
        <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpenFile(null)}>
          <div
            className="w-full max-w-lg h-[80%] flex flex-col rounded-xl bg-[#0a0e14] border border-white/15 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <span className="text-sm font-mono text-cyan-300">{fileIcon({ ...openFile, type: 'file' } as FSNode)} {openFile.name}</span>
              <div className="flex gap-2">
                <button onClick={saveOpenFile} className="px-3 py-1 rounded text-xs bg-cyan-400 text-black font-medium hover:bg-cyan-300">Save</button>
                <button onClick={() => setOpenFile(null)} className="px-3 py-1 rounded text-xs bg-white/5 border border-white/10 hover:bg-white/10">Close</button>
              </div>
            </div>
            <textarea
              value={openFile.content}
              onChange={(e) => setOpenFile({ ...openFile, content: e.target.value })}
              className="flex-1 bg-transparent p-3 text-sm font-mono text-white/85 outline-none resize-none leading-relaxed"
              placeholder="Empty file…"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const FilesApp = memo(FilesAppInner);
