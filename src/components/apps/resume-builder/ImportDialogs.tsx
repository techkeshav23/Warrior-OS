// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Import Dialogs
// Pick Project Forge projects or unlocked Warrior OS
// achievements to turn into resume entries
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Hammer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGE_META } from '@/components/apps/project-forge/forge-utils';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { useResumeStore } from '@/stores/useResumeStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useXPStore } from '@/stores/useXPStore';
import type { ForgeStage } from '@/types/project-forge';

interface PickerItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeClass?: string;
  note?: string;
  defaultChecked: boolean;
  disabled?: boolean;
}

interface PickerDialogProps {
  title: string;
  description: string;
  items: PickerItem[];
  empty: ReactNode;
  confirmLabel: (count: number) => string;
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

function PickerDialog({ title, description, items, empty, confirmLabel, onConfirm, onClose }: PickerDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.defaultChecked && !i.disabled).map((i) => i.id))
  );
  const titleId = useId();
  const selectable = items.filter((i) => !i.disabled);
  const chosen = selectable.filter((i) => selected.has(i.id)).map((i) => i.id);
  const allOn = selectable.length > 0 && chosen.length === selectable.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allOn ? new Set<string>() : new Set(selectable.map((i) => i.id)));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
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
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        autoFocus
        onKeyDown={onKeyDown}
        initial={{ y: 16, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 8, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0b0f17]/95 shadow-2xl shadow-black/60 outline-none"
      >
        <header className="flex items-start gap-2 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-bold text-cyan-300">
              {title}
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-white/50">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="px-4 py-6">{empty}</div>
        ) : (
          <>
            {selectable.length > 1 && (
              <div className="border-b border-white/5 px-4 py-2">
                <label className="flex items-center gap-2 text-[11px] text-white/60">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-cyan-400"
                  />
                  Select all
                </label>
              </div>
            )}
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
              {items.map((item) => (
                <li key={item.id}>
                  <label
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
                      item.disabled
                        ? 'border-white/5 opacity-50'
                        : selected.has(item.id)
                          ? 'border-cyan-400/40 bg-cyan-400/[0.06]'
                          : 'border-white/10 hover:bg-white/[0.04]'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!item.disabled && selected.has(item.id)}
                      disabled={item.disabled}
                      onChange={() => toggle(item.id)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-cyan-400"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-white/85">{item.title}</span>
                      {item.subtitle && (
                        <span className="block truncate text-[11px] text-white/45">{item.subtitle}</span>
                      )}
                      {item.note && <span className="block text-[10px] text-cyan-300/70">{item.note}</span>}
                    </span>
                    {item.badge && (
                      <span
                        className={cn(
                          'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                          item.badgeClass ?? 'border-white/10 text-white/50'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <footer className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/65 hover:bg-white/5"
          >
            Cancel
          </button>
          {items.length > 0 && (
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => onConfirm(chosen)}
              className="rounded-md bg-cyan-400 px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-cyan-300 disabled:opacity-40"
            >
              {confirmLabel(chosen.length)}
            </button>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
}

// ─── Project Forge → Projects section ───

const STAGE_ORDER: Record<ForgeStage, number> = { shipped: 0, testing: 1, building: 2, ideas: 3 };

interface ImportDialogProps {
  onClose: () => void;
  /** Receives a short status message for the editor. */
  onDone: (message: string) => void;
}

export function ForgeImportDialog({ onClose, onDone }: ImportDialogProps) {
  const projects = useProjectForgeStore((s) => s.projects);
  const resumeProjects = useResumeStore((s) => s.resume.projects);
  const importForgeProjects = useResumeStore((s) => s.importForgeProjects);

  const sorted = useMemo(
    () =>
      [...projects].sort(
        (a, b) =>
          STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      ),
    [projects]
  );
  const onResume = useMemo(
    () => new Set(resumeProjects.map((p) => p.forgeId).filter((id): id is string => id !== null)),
    [resumeProjects]
  );

  const items: PickerItem[] = sorted.map((p) => ({
    id: p.id,
    title: p.name,
    subtitle: p.techStack.length > 0 ? p.techStack.join(', ') : p.description.split('\n')[0] || undefined,
    badge: STAGE_META[p.stage].label,
    badgeClass: STAGE_META[p.stage].chip,
    note: onResume.has(p.id) ? 'Already on your resume: importing again only fills empty fields' : undefined,
    defaultChecked: !onResume.has(p.id) && p.stage !== 'ideas',
  }));

  const openForge = () => {
    useAppStore.getState().launchApp('project-tracker', useWorkspaceStore.getState().activeWorkspaceId);
    onClose();
  };

  return (
    <PickerDialog
      title="Import from Project Forge"
      description="Each project becomes a resume entry: name, tech stack, live and code links, dates, and its description lines as bullets."
      items={items}
      empty={
        <div className="space-y-3 text-center">
          <p className="text-xs text-white/55">Project Forge has no projects yet.</p>
          <button
            type="button"
            onClick={openForge}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20"
          >
            <Hammer className="h-3.5 w-3.5" /> Open Project Forge
          </button>
        </div>
      }
      confirmLabel={(n) => `Import ${n} ${n === 1 ? 'project' : 'projects'}`}
      onConfirm={(ids) => {
        const chosen = sorted.filter((p) => ids.includes(p.id));
        const { added, updated } = importForgeProjects(chosen);
        const parts: string[] = [];
        if (added > 0) parts.push(`added ${added}`);
        if (updated > 0) parts.push(`filled in ${updated} existing`);
        onDone(parts.length > 0 ? `Project Forge import: ${parts.join(', ')}.` : 'Nothing to import.');
        onClose();
      }}
      onClose={onClose}
    />
  );
}

// ─── Warrior OS achievements → Achievements section ───

export function AchievementImportDialog({ onClose, onDone }: ImportDialogProps) {
  const achievements = useXPStore((s) => s.achievements);
  const entries = useResumeStore((s) => s.resume.achievements);
  const importAchievements = useResumeStore((s) => s.importAchievements);

  const unlocked = useMemo(
    () =>
      achievements
        .filter((a) => a.unlockedAt)
        .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '')),
    [achievements]
  );
  const present = useMemo(
    () => new Set(entries.map((e) => e.osAchievementId).filter((id): id is string => id !== null)),
    [entries]
  );

  const items: PickerItem[] = unlocked.map((a) => ({
    id: a.id,
    title: `${a.icon} ${a.title}`,
    subtitle: a.description,
    badge: a.rarity,
    note: present.has(a.id) ? 'Already on your resume' : undefined,
    defaultChecked: !present.has(a.id),
    disabled: present.has(a.id),
  }));

  return (
    <PickerDialog
      title="Import Warrior OS achievements"
      description="Adds the title and description of unlocked achievements as resume lines you can edit afterwards."
      items={items}
      empty={
        <p className="text-center text-xs text-white/55">
          No Warrior OS achievements are unlocked yet. Ship a project or finish a quiz first.
        </p>
      }
      confirmLabel={(n) => `Add ${n} ${n === 1 ? 'line' : 'lines'}`}
      onConfirm={(ids) => {
        const chosen = unlocked
          .filter((a) => ids.includes(a.id))
          .map((a) => ({ id: a.id, title: a.title, description: a.description }));
        const added = importAchievements(chosen);
        onDone(added > 0 ? `Added ${added} achievement ${added === 1 ? 'line' : 'lines'}.` : 'Already listed.');
        onClose();
      }}
      onClose={onClose}
    />
  );
}
