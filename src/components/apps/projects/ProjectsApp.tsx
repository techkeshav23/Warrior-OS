// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Projects App
// Kanban board for project management (drag between columns)
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { cn, generateId } from '@/lib/utils';
import type { Project, ProjectStatus, ProjectTask } from '@/types/project';

const STORE_KEY = 'warrior-projects';

const COLUMNS: { status: ProjectStatus; label: string; accent: string; dot: string }[] = [
  { status: 'planning', label: 'Ideas', accent: 'border-amber-400/30', dot: 'bg-amber-400' },
  { status: 'in-progress', label: 'In Progress', accent: 'border-cyan-400/30', dot: 'bg-cyan-400' },
  { status: 'paused', label: 'Paused', accent: 'border-white/20', dot: 'bg-white/40' },
  { status: 'completed', label: 'Completed', accent: 'border-green-400/30', dot: 'bg-green-400' },
];

function loadProjects(): Project[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
  catch { return []; }
}

function saveProjects(p: Project[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(p));
}

function nowISO() {
  // Date is fine at runtime in the browser; only workflow scripts forbid it.
  return new Date().toISOString();
}

function progressOf(p: Project): number {
  if (p.tasks.length === 0) return p.progress || (p.status === 'completed' ? 100 : 0);
  return Math.round((p.tasks.filter((t) => t.completed).length / p.tasks.length) * 100);
}

function ProjectsAppInner() {
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [editing, setEditing] = useState<Project | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState('');

  const commit = useCallback((next: Project[]) => {
    setProjects(next);
    saveProjects(next);
  }, []);

  const addProject = useCallback((status: ProjectStatus) => {
    const proj: Project = {
      id: generateId('p'),
      name: 'New Project',
      description: '',
      techStack: [],
      status,
      progress: 0,
      tasks: [],
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    commit([...projects, proj]);
    setEditing(proj);
  }, [projects, commit]);

  const updateProject = useCallback((updated: Project) => {
    const next = projects.map((p) => (p.id === updated.id ? { ...updated, updatedAt: nowISO() } : p));
    commit(next);
    setEditing(updated);
  }, [projects, commit]);

  const deleteProject = useCallback((id: string) => {
    commit(projects.filter((p) => p.id !== id));
    setEditing(null);
  }, [projects, commit]);

  const moveProject = useCallback((id: string, status: ProjectStatus) => {
    commit(projects.map((p) => (p.id === id ? { ...p, status, updatedAt: nowISO() } : p)));
  }, [projects, commit]);

  const byColumn = useMemo(() => {
    const map: Record<ProjectStatus, Project[]> = { planning: [], 'in-progress': [], paused: [], completed: [] };
    projects.forEach((p) => map[p.status]?.push(p));
    return map;
  }, [projects]);

  return (
    <div className="flex flex-col h-full bg-black/40 text-white">
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2">🚀 Project Board</h2>
        <span className="text-[11px] text-white/40">{projects.length} projects</span>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div className="flex gap-3 h-full min-w-max">
          {COLUMNS.map((col) => (
            <div
              key={col.status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) { moveProject(dragId, col.status); setDragId(null); } }}
              className={cn('w-64 flex flex-col rounded-xl bg-white/[0.03] border', col.accent)}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', col.dot)} />
                  <span className="text-xs font-semibold text-white/80">{col.label}</span>
                  <span className="text-[10px] text-white/30">{byColumn[col.status].length}</span>
                </div>
                <button onClick={() => addProject(col.status)} className="text-white/40 hover:text-cyan-300 text-sm leading-none">+</button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {byColumn[col.status].map((p) => {
                  const prog = progressOf(p);
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setEditing(p)}
                      className={cn(
                        'rounded-lg bg-white/5 border border-white/10 p-2.5 cursor-pointer hover:border-cyan-400/30 transition-colors',
                        dragId === p.id && 'opacity-40'
                      )}
                    >
                      <p className="text-sm font-medium text-white/90 truncate">{p.name}</p>
                      {p.description && <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{p.description}</p>}
                      {p.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.techStack.slice(0, 3).map((t) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300/80 border border-cyan-500/20">{t}</span>
                          ))}
                        </div>
                      )}
                      {p.tasks.length > 0 && (
                        <div className="mt-2">
                          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-cyan-400/70 transition-all" style={{ width: `${prog}%` }} />
                          </div>
                          <p className="text-[9px] text-white/30 mt-1">{p.tasks.filter((t) => t.completed).length}/{p.tasks.length} tasks</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {byColumn[col.status].length === 0 && (
                  <p className="text-[11px] text-white/20 text-center py-4">Drop cards here</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md max-h-[85%] overflow-y-auto rounded-xl bg-[#0a0e14] border border-white/15 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <input
              value={editing.name}
              onChange={(e) => updateProject({ ...editing, name: e.target.value })}
              className="w-full bg-transparent text-lg font-bold text-white outline-none border-b border-white/10 pb-1 focus:border-cyan-400/50"
              placeholder="Project name"
            />
            <textarea
              value={editing.description}
              onChange={(e) => updateProject({ ...editing, description: e.target.value })}
              className="w-full bg-white/5 rounded-lg p-2 text-sm text-white/80 outline-none resize-none h-20 focus:ring-1 ring-cyan-400/30"
              placeholder="Description…"
            />

            {/* Tech stack */}
            <div>
              <p className="text-[11px] text-white/40 uppercase mb-1">Tech Stack</p>
              <div className="flex flex-wrap gap-1 items-center">
                {editing.techStack.map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                    {t}
                    <button onClick={() => updateProject({ ...editing, techStack: editing.techStack.filter((x) => x !== t) })} className="hover:text-red-400">×</button>
                  </span>
                ))}
                <input
                  placeholder="+ add"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (v && !editing.techStack.includes(v)) updateProject({ ...editing, techStack: [...editing.techStack, v] });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="w-16 bg-white/5 rounded px-1.5 py-0.5 text-[11px] outline-none"
                />
              </div>
            </div>

            {/* Tasks */}
            <div>
              <p className="text-[11px] text-white/40 uppercase mb-1">Tasks</p>
              <div className="space-y-1">
                {editing.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => updateProject({ ...editing, tasks: editing.tasks.map((x) => x.id === t.id ? { ...x, completed: !x.completed } : x) })}
                      className={cn('w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0', t.completed ? 'bg-green-500/30 border-green-400 text-green-300' : 'border-white/20')}
                    >{t.completed && '✓'}</button>
                    <span className={cn('text-sm flex-1', t.completed ? 'text-white/30 line-through' : 'text-white/80')}>{t.title}</span>
                    <button onClick={() => updateProject({ ...editing, tasks: editing.tasks.filter((x) => x.id !== t.id) })} className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 text-xs">×</button>
                  </div>
                ))}
              </div>
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTask.trim()) {
                    const task: ProjectTask = { id: generateId('t'), title: newTask.trim(), completed: false, createdAt: nowISO() };
                    updateProject({ ...editing, tasks: [...editing.tasks, task] });
                    setNewTask('');
                  }
                }}
                placeholder="+ add task, Enter"
                className="w-full mt-1.5 bg-white/5 rounded px-2 py-1 text-sm outline-none focus:ring-1 ring-cyan-400/30"
              />
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-2">
              <input value={editing.githubUrl ?? ''} onChange={(e) => updateProject({ ...editing, githubUrl: e.target.value })} placeholder="GitHub URL" className="bg-white/5 rounded px-2 py-1 text-[11px] outline-none" />
              <input value={editing.deployUrl ?? ''} onChange={(e) => updateProject({ ...editing, deployUrl: e.target.value })} placeholder="Live URL" className="bg-white/5 rounded px-2 py-1 text-[11px] outline-none" />
            </div>

            <div className="flex justify-between pt-2 border-t border-white/10">
              <button onClick={() => deleteProject(editing.id)} className="px-3 py-1.5 rounded text-xs text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20">Delete</button>
              <button onClick={() => setEditing(null)} className="px-4 py-1.5 rounded text-xs bg-cyan-400 text-black font-medium hover:bg-cyan-300">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const ProjectsApp = memo(ProjectsAppInner);
