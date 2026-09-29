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
import { SettingsPage, SettingsSection } from './parts';

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
    <Card padding="none" tone={active ? 'accent' : 'default'} role="group" aria-label={`${ws.name} workspace`}>
      {/* Identity */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 px-4 py-3.5">
        <div className="relative w-20 shrink-0 overflow-hidden rounded-control border border-line-strong">
          <WallpaperThumb id={ws.wallpaper} />
          <span
            style={accentVar(accent)}
            className="absolute bottom-1 left-1 flex size-6 items-center justify-center rounded-[6px] border border-accent/40 bg-ink-950/80 text-accent"
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden />
          </span>
        </div>
        <div className="min-w-0 flex-1 basis-32">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-fg">{ws.name}</p>
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
      <div className="flex flex-col gap-3 border-t border-line px-4 py-3 @lg:flex-row @lg:items-center @lg:justify-between">
        <div role="group" aria-label={`${ws.name} accent`} className="flex flex-wrap items-center gap-2">
          <span className="hud-label mr-1 w-20">Accent</span>
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
                  'focus-ring flex size-7 items-center justify-center rounded-full bg-accent',
                  'ring-offset-2 ring-offset-ink-900 transition-shadow duration-180 ease-out-quint',
                  selected ? 'ring-2 ring-accent' : 'hover:ring-2 hover:ring-line-strong'
                )}
              >
                {selected && <Check size={12} strokeWidth={2.75} className="text-accent-fg" aria-hidden />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 @lg:w-52">
          <span className="hud-label w-20 shrink-0 @lg:hidden">Wallpaper</span>
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
