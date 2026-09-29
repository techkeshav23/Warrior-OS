// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspaces Tab
// The three desktops: switch between them and edit each one's look
// (accent chips + wallpaper). Editing the active workspace recolors the
// OS live; the others apply when you switch to them.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import { Check, CodeXml, GraduationCap, Image as ImageIcon, LayoutGrid, Music, type LucideIcon } from 'lucide-react';
import { Badge, Button, Card, Kbd, Select } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ACCENT_PRESETS, resolveAccent } from '@/styles/tokens';
import type { Workspace, WorkspaceId } from '@/types/workspace';
import { WALLPAPERS, WallpaperThumb, resolveWallpaper, wallpaperLabel } from './wallpapers';
import { updateWorkspaceLook } from './workspace-looks';
import { BEVEL_RAISED, BEVEL_SUNK, ENGRAVED_LABEL, SLOT_FILL, STEEL_PLATE } from '@/components/ui/armor';
import { GROOVE, SettingsPage, SettingsSection } from './parts';

/** Workspace.icon holds a lucide icon name. */
const ICONS: Record<string, LucideIcon> = { GraduationCap, Code2: CodeXml, CodeXml, Music };

const WALLPAPER_OPTIONS = WALLPAPERS.map((w) => ({ value: w.id, label: w.label }));

const accentVar = (value: string) => ({ '--accent': value }) as CSSProperties;

function WorkspacesTabInner() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  return (
    <SettingsPage>
      <SettingsSection
        title="Your workspaces"
        description="Each workspace keeps its own windows, wallpaper and accent. Switch from the taskbar or with Ctrl+1, 2 and 3."
      >
        <div className="flex flex-col gap-3">
          {workspaces.map((ws, i) => (
            <WorkspaceCard
              key={ws.id}
              ws={ws}
              index={i}
              active={ws.id === activeWorkspaceId}
              onSwitch={() => switchWorkspace(ws.id as WorkspaceId)}
            />
          ))}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}

function WorkspaceCard({
  ws,
  index,
  active,
  onSwitch,
}: {
  ws: Workspace;
  index: number;
  active: boolean;
  onSwitch: () => void;
}) {
  const accent = resolveAccent(ws.accentColor);
  const Icon = ICONS[ws.icon] ?? LayoutGrid;
  const windows = ws.openWindowIds?.length || 0;

  return (
    <Card
      padding="none"
      hud={active}
      tone={active ? 'accent' : 'default'}
      role="group"
      aria-label={`${ws.name} workspace`}
      className="chamfer-tl-br"
    >
      {/* Identity */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 py-3.5 pr-4 pl-5">
        {/* Stamped bay number */}
        <span
          aria-hidden
          className={cn(
            'engraved flex h-12 w-7 shrink-0 flex-col items-center justify-center font-display text-lg leading-none font-bold tabular chamfer-xs',
            SLOT_FILL,
            BEVEL_SUNK,
            active ? 'text-accent' : 'text-steel-400'
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        {/* Wallpaper viewport, set into a bevelled frame */}
        <div className={cn('relative w-20 shrink-0 overflow-hidden chamfer [--cut:5px] p-0.5', STEEL_PLATE, BEVEL_RAISED)}>
          <div className="chamfer-xs overflow-hidden">
            <WallpaperThumb id={ws.wallpaper} />
          </div>
          <span
            style={accentVar(accent)}
            className="absolute bottom-1 left-1 flex size-6 items-center justify-center chamfer-xs bg-ink-950/85 text-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_45%,transparent)]"
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden />
          </span>
        </div>
        <div className="min-w-0 flex-1 basis-32">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-display text-sm font-semibold uppercase tracking-[0.08em] text-fg" title={ws.name}>
              {ws.name}
            </p>
            {active && (
              <Badge tone="accent" dot size="sm">
                Active
              </Badge>
            )}
          </div>
          <p className="tabular truncate text-xs text-fg-subtle">
            {wallpaperLabel(ws.wallpaper)} · {windows} window{windows === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Kbd keys={['Ctrl', String(index + 1)]} size="sm" />
          {active ? (
            <Button size="sm" variant="ghost" disabled>
              Current
            </Button>
          ) : (
            <Button size="sm" onClick={onSwitch}>
              Switch
            </Button>
          )}
        </div>
      </div>

      {/* Look editor */}
      <div className={cn('flex flex-col gap-3 bg-black/15 py-3 pr-4 pl-5 @lg:flex-row @lg:items-center @lg:justify-between', GROOVE)}>
        <div role="group" aria-label={`${ws.name} accent`} className="flex flex-wrap items-center gap-2">
          <span className={cn(ENGRAVED_LABEL, 'mr-1 w-20')}>Accent</span>
          {ACCENT_PRESETS.map((p) => {
            const selected = p.value === accent;
            return (
              <button
                key={p.value}
                type="button"
                aria-label={p.label}
                aria-pressed={selected}
                title={p.label}
                onClick={() => updateWorkspaceLook(ws.id, { accentColor: p.value })}
                style={accentVar(p.value)}
                className={cn(
                  'flex size-7 items-center justify-center chamfer [--cut:6px] bg-accent',
                  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fg',
                  'transition-[box-shadow,filter] duration-180 ease-out-quint',
                  selected
                    ? 'shadow-[inset_0_0_0_2px_var(--color-ink-950),inset_0_0_0_3.5px_var(--color-fg)]'
                    : 'shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-2px_0_rgb(0_0_0/0.35)] hover:brightness-115'
                )}
              >
                {selected && <Check size={12} strokeWidth={2.75} className="text-accent-fg" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 @lg:w-52">
          <span className={cn(ENGRAVED_LABEL, 'w-20 shrink-0 @lg:hidden')}>Wallpaper</span>
          <Select
            size="sm"
            aria-label={`${ws.name} wallpaper`}
            leadingIcon={ImageIcon}
            value={resolveWallpaper(ws.wallpaper)}
            onValueChange={(v) => updateWorkspaceLook(ws.id, { wallpaper: v })}
            options={WALLPAPER_OPTIONS}
          />
        </div>
      </div>
    </Card>
  );
}

export const WorkspacesTab = memo(WorkspacesTabInner);
