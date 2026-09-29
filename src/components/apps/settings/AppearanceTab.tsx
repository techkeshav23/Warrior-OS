// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Appearance Tab
// Wallpaper (painted previews), accent color (palette + custom), window
// glass, CRT scanlines and cursor trail. Wallpaper and accent are saved
// to the active workspace, which re-applies them whenever you return.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, type CSSProperties } from 'react';
import { ArrowRight, Check, Feather, Plus } from 'lucide-react';
import { Badge, Button, Slider } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLiteMode } from '@/lib/lite-mode';
import { ACCENT_PRESETS, resolveAccent } from '@/styles/tokens';
import {
  Callout,
  RowValue,
  SettingRow,
  SettingsCard,
  SettingsPage,
  SettingsSection,
  SwitchRow,
  type OpenSettingsTab,
} from './parts';
import { WALLPAPERS, WallpaperThumb, resolveWallpaper, type WallpaperOption } from './wallpapers';
import { saveLookToActiveWorkspace } from './workspace-looks';

/** '#abc' / '#aabbccdd' → '#aabbcc' for <input type="color">. */
function toColorInputValue(hex: string): string {
  if (hex.length === 4) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  if (hex.length === 5) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return hex.slice(0, 7);
}

const accentVar = (value: string) => ({ '--accent': value }) as CSSProperties;

function AppearanceTabInner({ onOpenTab }: { onOpenTab?: OpenSettingsTab }) {
  const wallpaper = useSettingsStore((s) => s.wallpaper);
  const accentColor = useSettingsStore((s) => s.accentColor);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const crtEffect = useSettingsStore((s) => s.crtEffect);
  const cursorTrail = useSettingsStore((s) => s.cursorTrail);
  const adaptiveWallpaper = useSettingsStore((s) => s.adaptiveWallpaper);
  const workspaceName = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name ?? 'current'
  );
  const lite = useLiteMode();

  const activeWallpaper = resolveWallpaper(wallpaper);
  const accent = resolveAccent(accentColor);
  const preset = ACCENT_PRESETS.find((p) => p.value === accent);
  const glassPct = Math.round(glassOpacity * 100);

  const settings = useSettingsStore.getState;
  const pickWallpaper = (id: string) => {
    settings().setWallpaper(id);
    saveLookToActiveWorkspace();
  };
  const pickAccent = (value: string) => {
    settings().setAccentColor(value);
    saveLookToActiveWorkspace();
  };
  const liteBadge = lite ? <Badge size="sm">Off in lite mode</Badge> : undefined;

  return (
    <SettingsPage>
      {/* Lite mode keeps the GPU-heavy visuals off whatever is chosen here */}
      {lite && (
        <Callout
          role="note"
          data-testid="appearance-lite-note"
          icon={Feather}
          title="Lite mode is on"
          action={
            onOpenTab && (
              <Button size="sm" trailingIcon={ArrowRight} onClick={() => onOpenTab('performance')}>
                Performance settings
              </Button>
            )
          }
        >
          The wallpaper stays a still Deep Space background, and CRT scanlines and the cursor trail stay off.
          Your choices below are kept for when lite mode is off.
        </Callout>
      )}

      {/* Wallpaper */}
      <SettingsSection
        title="Wallpaper"
        description={`Live backdrops for the desktop, saved to your ${workspaceName} workspace.`}
      >
        <div role="group" aria-label="Wallpaper" className="grid grid-cols-2 gap-3 @sm:grid-cols-3 @3xl:grid-cols-4">
          {WALLPAPERS.map((w) => (
            <WallpaperTile
              key={w.id}
              option={w}
              selected={activeWallpaper === w.id}
              onSelect={() => pickWallpaper(w.id)}
            />
          ))}
        </div>
        <SettingsCard>
          <SwitchRow
            label="Adaptive wallpaper"
            ariaLabel="Adaptive Wallpaper"
            description="Follows the time of day: Starfield at dawn, Nebula, Fluid and Aurora through the day, Deep Space at night and Matrix Rain after midnight."
            checked={adaptiveWallpaper}
            onCheckedChange={() => settings().toggleAdaptiveWallpaper()}
          />
        </SettingsCard>
      </SettingsSection>

      {/* Accent */}
      <SettingsSection
        title="Accent color"
        description="Tints buttons, focus rings, selection and live status across Warrior OS. Changes apply instantly."
      >
        <SettingsCard>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="size-9 shrink-0 rounded-control bg-accent shadow-glow ring-1 ring-inset ring-fg/20"
              />
              <div className="min-w-0">
                <p className="truncate text-ui font-medium text-fg">{preset ? preset.label : 'Custom color'}</p>
                <p className="tabular font-mono text-xs uppercase text-fg-subtle">{accent}</p>
              </div>
            </div>
            <div role="group" aria-label="Accent color" className="flex flex-wrap items-center gap-3">
              {ACCENT_PRESETS.map((p) => {
                const selected = p.value === accent;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-label={p.label}
                    aria-pressed={selected}
                    title={p.label}
                    onClick={() => pickAccent(p.value)}
                    style={accentVar(p.value)}
                    className={cn(
                      'focus-ring flex size-8 items-center justify-center rounded-full bg-accent',
                      'ring-offset-2 ring-offset-ink-900 transition-shadow duration-180 ease-out-quint',
                      selected ? 'ring-2 ring-accent' : 'hover:ring-2 hover:ring-line-strong'
                    )}
                  >
                    {selected && <Check size={14} strokeWidth={2.75} className="text-accent-fg" aria-hidden />}
                  </button>
                );
              })}
              <span aria-hidden className="mx-0.5 h-6 w-px bg-line" />
              <CustomSwatch value={accent} active={!preset} onChange={pickAccent} />
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Glass & effects */}
      <SettingsSection title="Glass and effects" description="How windows sit on the wallpaper, plus the retro extras.">
        <SettingsCard>
          <SettingRow
            label="Glass opacity"
            htmlFor="appearance-glass-opacity"
            description={
              lite ? 'Windows are solid while lite mode is on.' : 'How solid windows look over the wallpaper.'
            }
            control={<RowValue>{glassPct}%</RowValue>}
          >
            <Slider
              id="appearance-glass-opacity"
              min={0.3}
              max={0.9}
              step={0.05}
              value={glassOpacity}
              onValueChange={(v) => settings().setGlassOpacity(v)}
              aria-valuetext={`${glassPct}%`}
            />
          </SettingRow>
          <SwitchRow
            label="CRT scanlines"
            ariaLabel="CRT Scanlines"
            description="Faint retro scanlines over the whole screen."
            badge={liteBadge}
            checked={crtEffect}
            onCheckedChange={() => settings().toggleCRT()}
          />
          <SwitchRow
            label="Cursor trail"
            ariaLabel="Cursor Trail"
            description="A short fading trail behind the pointer."
            badge={liteBadge}
            checked={cursorTrail}
            onCheckedChange={() => settings().toggleCursorTrail()}
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

function WallpaperTile({
  option,
  selected,
  onSelect,
}: {
  option: WallpaperOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      title={`${option.label} · ${option.hint}`}
      className={cn(
        'group focus-ring relative flex min-w-0 flex-col overflow-hidden rounded-card border bg-surface-2 text-left',
        'transition-[border-color,background-color,box-shadow] duration-180 ease-out-quint',
        selected
          ? 'border-accent/80 shadow-glow'
          : 'border-line hover:border-line-strong hover:bg-surface-hover active:bg-surface-active'
      )}
    >
      <span className="relative block overflow-hidden">
        <WallpaperThumb
          id={option.id}
          className="transition-transform duration-260 ease-out-quint group-hover:scale-[1.04]"
        />
        {selected && (
          <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg shadow-e1">
            <Check size={12} strokeWidth={2.75} aria-hidden />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col border-t border-line px-3 py-2">
        <span className="truncate text-ui font-medium text-fg">{option.label}</span>
        <span className="truncate text-xs text-fg-subtle">{option.hint}</span>
      </span>
    </button>
  );
}

/** Any color: a native color input dressed as the last swatch. */
function CustomSwatch({ value, active, onChange }: { value: string; active: boolean; onChange: (hex: string) => void }) {
  return (
    <label
      title="Custom color"
      style={active ? accentVar(value) : undefined}
      className={cn(
        'relative flex size-8 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-ink-900',
        'transition-shadow duration-180 ease-out-quint',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent',
        active ? 'bg-accent ring-2 ring-accent' : 'hover:ring-2 hover:ring-line-strong'
      )}
    >
      {!active && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              'conic-gradient(var(--color-viz-1), var(--color-viz-6), var(--color-viz-3), var(--color-viz-5), var(--color-viz-2), var(--color-viz-7), var(--color-viz-8), var(--color-viz-4), var(--color-viz-1))',
          }}
        />
      )}
      <span
        aria-hidden
        className={cn(
          'relative flex items-center justify-center rounded-full',
          active ? 'text-accent-fg' : 'size-6 bg-ink-900 text-fg-muted'
        )}
      >
        {active ? <Check size={14} strokeWidth={2.75} /> : <Plus size={14} strokeWidth={2} />}
      </span>
      <input
        type="color"
        aria-label="Custom accent color"
        value={toColorInputValue(value)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
      />
    </label>
  );
}

export const AppearanceTab = memo(AppearanceTabInner);
