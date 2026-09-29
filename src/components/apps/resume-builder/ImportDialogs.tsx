// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Resume Import Dialogs
// Pick Project Forge projects or unlocked Warrior OS
// achievements to turn into resume entries (kit Dialog).
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Anvil, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Checkbox, Dialog, EmptyState, type IconLike, type Tone } from '@/components/ui';
import { STAGE_META } from '@/components/apps/project-forge/forge-utils';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { useResumeStore } from '@/stores/useResumeStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useXPStore } from '@/stores/useXPStore';
import type { Achievement } from '@/types/achievement';
import type { ForgeStage } from '@/types/project-forge';

interface PickerItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: Tone;
  badgeIcon?: IconLike;
  note?: string;
  defaultChecked: boolean;
  disabled?: boolean;
}

interface PickerDialogProps {
  open: boolean;
  title: string;
  description: string;
  icon: IconLike;
  iconTone: 'accent' | 'ember';
  items: PickerItem[];
  empty: ReactNode;
  confirmLabel: (count: number) => string;
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

function PickerDialog({
  open,
  title,
  description,
  icon,
  iconTone,
  items,
  empty,
  confirmLabel,
  onConfirm,
  onClose,
}: PickerDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.defaultChecked && !i.disabled).map((i) => i.id))
  );
  const selectable = items.filter((i) => !i.disabled);
  const chosen = selectable.filter((i) => selected.has(i.id)).map((i) => i.id);
  const allOn = selectable.length > 0 && chosen.length === selectable.length;
  const someOn = chosen.length > 0 && !allOn;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allOn ? new Set<string>() : new Set(selectable.map((i) => i.id)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      iconTone={iconTone}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {items.length > 0 && (
            <Button variant="primary" disabled={chosen.length === 0} onClick={() => onConfirm(chosen)}>
              {confirmLabel(chosen.length)}
            </Button>
          )}
        </>
      }
    >
      {items.length === 0 ? (
        empty
      ) : (
        <>
          {selectable.length > 1 && (
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <Checkbox label="Select all" checked={allOn} indeterminate={someOn} onChange={toggleAll} />
              <span className="tabular font-mono text-2xs text-fg-subtle">
                {chosen.length}/{selectable.length} selected
              </span>
            </div>
          )}
          <ul className="space-y-1.5">
            {items.map((item) => {
              const isOn = !item.disabled && selected.has(item.id);
              return (
                <li key={item.id}>
                  <label
                    className={cn(
                      'armor-panel chamfer-sm flex items-start gap-3 px-3 py-2.5 transition-[background-color,box-shadow] duration-120 ease-out-quint',
                      item.disabled
                        ? 'cursor-not-allowed opacity-50'
                        : isOn
                          ? 'ember-edge cursor-pointer bg-accent/[0.07]'
                          : 'cursor-pointer hover:bg-steel-700/70'
                    )}
                  >
                    <Checkbox checked={isOn} disabled={item.disabled} onChange={() => toggle(item.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui font-medium text-fg">{item.title}</span>
                      {item.subtitle && (
                        <span className="block truncate text-xs text-fg-subtle" title={item.subtitle}>
                          {item.subtitle}
                        </span>
                      )}
                      {item.note && <span className="mt-0.5 block text-xs text-info">{item.note}</span>}
                    </span>
                    {item.badge && (
                      <Badge size="sm" tone={item.badgeTone ?? 'neutral'} icon={item.badgeIcon} className="mt-0.5">
                        {item.badge}
                      </Badge>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Dialog>
  );
}

// ─── Project Forge → Projects section ───

const STAGE_ORDER: Record<ForgeStage, number> = { shipped: 0, testing: 1, building: 2, ideas: 3 };

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Receives a short status message for the editor. */
  onDone: (message: string) => void;
}

export function ForgeImportDialog({ open, onClose, onDone }: ImportDialogProps) {
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
    badgeTone: STAGE_META[p.stage].tone,
    badgeIcon: STAGE_META[p.stage].Icon,
    note: onResume.has(p.id) ? 'Already on your resume: importing again only fills empty fields' : undefined,
    defaultChecked: !onResume.has(p.id) && p.stage !== 'ideas',
  }));

  const openForge = () => {
    useAppStore.getState().launchApp('project-tracker', useWorkspaceStore.getState().activeWorkspaceId);
    onClose();
  };

  return (
    <PickerDialog
      open={open}
      title="Import from Project Forge"
      description="Each project becomes a resume entry: name, tech stack, live and code links, dates, and its description lines as bullets."
      icon={Anvil}
      iconTone="ember"
      items={items}
      empty={
        <EmptyState
          size="sm"
          tone="ember"
          icon={Anvil}
          title="Project Forge has no projects yet"
          description="Add what you are building there, then import it here."
          actions={
            <Button variant="secondary" size="sm" leadingIcon={Anvil} onClick={openForge}>
              Open Project Forge
            </Button>
          }
        />
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

const RARITY_TONE: Record<Achievement['rarity'], Tone> = {
  common: 'neutral',
  uncommon: 'success',
  rare: 'info',
  epic: 'ember',
  legendary: 'gold',
};

export function AchievementImportDialog({ open, onClose, onDone }: ImportDialogProps) {
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
    title: a.title,
    subtitle: a.description,
    badge: a.rarity,
    badgeTone: RARITY_TONE[a.rarity] ?? 'neutral',
    note: present.has(a.id) ? 'Already on your resume' : undefined,
    defaultChecked: !present.has(a.id),
    disabled: present.has(a.id),
  }));

  return (
    <PickerDialog
      open={open}
      title="Import Warrior OS achievements"
      description="Adds the title and description of unlocked achievements as resume lines you can edit afterwards."
      icon={Trophy}
      iconTone="accent"
      items={items}
      empty={
        <EmptyState
          size="sm"
          icon={Trophy}
          title="No achievements unlocked yet"
          description="Ship a project or finish a quiz first."
        />
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
